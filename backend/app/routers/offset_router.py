from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, OffsetProject, UserOffset, UserProfile
from app.schemas import OffsetProjectResponse, OffsetPurchaseRequest, OffsetPurchaseResponse
from app.auth.auth import get_current_user
import logging

logger = logging.getLogger("carboeco")
router = APIRouter(prefix="/marketplace", tags=["Carbon Offset Marketplace"])

@router.get("/projects", response_model=List[OffsetProjectResponse])
def get_offset_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    projects = db.query(OffsetProject).all()
    return projects

@router.post("/purchase", response_model=OffsetPurchaseResponse, status_code=status.HTTP_201_CREATED)
def purchase_offset(
    req: OffsetPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(OffsetProject).filter(OffsetProject.id == req.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Offset project not found")

    if req.amount_bought > 100000.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Purchase amount exceeds the transaction limit of $100,000."
        )

    # Calculate offset weight: 1 ton = 1000 kg.
    # Cost per ton -> cost paid.
    # co2_offsetted = (cost_paid / cost_per_ton) * 1000 kg
    cost_paid = req.amount_bought
    co2_offsetted = (cost_paid / project.cost_per_ton) * 1000.0

    offset = UserOffset(
        user_id=current_user.id,
        project_id=project.id,
        amount_bought=cost_paid,
        cost_paid=cost_paid,
        co2_offsetted=round(co2_offsetted, 2)
    )
    db.add(offset)

    # Award purchaser XP
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if profile:
        profile.xp += int(cost_paid * 2.0)  # 2 XP per dollar spent
        new_level = 1 + (profile.xp // 500)
        if new_level > profile.level:
            profile.level = new_level
        db.flush()

    try:
        db.commit()
        db.refresh(offset)
    except Exception as e:
        db.rollback()
        logger.error(f"Error buying carbon offsets: {e}")
        raise HTTPException(status_code=500, detail="Purchase transaction failed")

    return offset
