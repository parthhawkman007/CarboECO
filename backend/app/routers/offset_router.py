from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from typing import List
import secrets
import time
from app.database import get_db
from app.models import User, OffsetProject, UserOffset, UserProfile
from app.schemas import OffsetProjectResponse, OffsetPurchaseRequest, OffsetPurchaseResponse
from app.auth.auth import get_current_user
from app.services.cache import CacheService
import logging

import uuid
import hashlib
import json
from datetime import datetime
from fastapi.responses import JSONResponse

logger = logging.getLogger("carboeco")
router = APIRouter(prefix="/marketplace", tags=["Carbon Offset Marketplace"])
cert_router = APIRouter(prefix="/offsets", tags=["Offset Certificates"])

@router.get("/projects", response_model=List[OffsetProjectResponse])
async def get_offset_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(OffsetProject)
    res = await db.execute(stmt)
    projects = res.scalars().all()
    return projects

@router.post("/purchase", response_model=OffsetPurchaseResponse, status_code=status.HTTP_201_CREATED)
async def purchase_offset(
    req: OffsetPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt_proj = select(OffsetProject).where(OffsetProject.id == req.project_id)
    res_proj = await db.execute(stmt_proj)
    project = res_proj.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Offset project not found")

    if req.amount_bought > 100000.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Purchase amount exceeds the transaction limit of $100,000."
        )

    cost_paid = req.amount_bought
    co2_offsetted = (cost_paid / project.cost_per_ton) * 1000.0

    offset = UserOffset(
        user_id=current_user.id,
        project_id=project.id,
        amount_bought=cost_paid,
        cost_paid=cost_paid,
        co2_offsetted=round(co2_offsetted, 2),
        registry_serial_number="",
        certificate_download_url=""
    )
    # Bind project in memory to avoid lazy loading trigger on response serialization
    offset.project = project
    db.add(offset)
    await db.flush()  # Flush to generate offset.id

    # Generate custom registry serial number and certificate URL using the ID
    serial = f"CARBOECO-{offset.id:08d}-{int(time.time())}"
    cert_url = f"/api/offsets/{offset.id}/certificate"
    
    offset.registry_serial_number = serial
    offset.certificate_download_url = cert_url

    # Award purchaser XP
    stmt_prof = select(UserProfile).where(UserProfile.user_id == current_user.id)
    res_prof = await db.execute(stmt_prof)
    profile = res_prof.scalar_one_or_none()
    if profile:
        profile.xp += int(cost_paid * 2.0)  # 2 XP per dollar spent
        new_level = 1 + (profile.xp // 500)
        if new_level > profile.level:
            profile.level = new_level
        await db.flush()

    try:
        await db.commit()
        stmt_full = select(UserOffset).options(joinedload(UserOffset.project)).where(UserOffset.id == offset.id)
        res_full = await db.execute(stmt_full)
        offset_full = res_full.scalar_one()
        # Invalidate leaderboards
        await CacheService.invalidate_pattern("leaderboard:*")
    except Exception as e:
        await db.rollback()
        logger.error(f"Error buying carbon offsets: {e}")
        raise HTTPException(status_code=500, detail="Purchase transaction failed")

    return offset_full

@cert_router.get("/{offset_id}/certificate")
async def get_offset_certificate(
    offset_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserOffset).options(joinedload(UserOffset.project)).where(
        UserOffset.id == offset_id,
        UserOffset.user_id == current_user.id
    )
    res = await db.execute(stmt)
    offset = res.scalar_one_or_none()
    if not offset:
        raise HTTPException(status_code=404, detail="Offset purchase record not found")

    # Generate certificate ID UUID based on offset ID
    cert_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"carboeco.org/offsets/{offset_id}"))

    cert_data = {
        "certificate_id": cert_uuid,
        "recipient_email": current_user.email,
        "offset_project_name": offset.project.name,
        "co2_offsetted_kg": offset.co2_offsetted,
        "purchase_date": offset.purchased_at.strftime("%Y-%m-%d %H:%M:%S") if offset.purchased_at else datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "registry_serial_number": offset.registry_serial_number,
        "registry_information": f"Verified by {offset.project.verified_by}",
        "verification_url": f"https://registry.carboeco.org/verify/{offset.registry_serial_number}"
    }

    # Generate digital signature (SHA-256 hash of cert_data)
    serialized_data = json.dumps(cert_data, sort_keys=True)
    digital_signature = hashlib.sha256(serialized_data.encode()).hexdigest()
    cert_data["digital_signature"] = digital_signature

    headers = {
        "Content-Disposition": f"attachment; filename=certificate_{offset_id}.json"
    }

    return JSONResponse(content=cert_data, headers=headers)
