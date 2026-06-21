from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from app.database import get_db
from app.models import User, EcoGroup, GroupMember, UserProfile, CarbonLog
from app.schemas import EcoGroupCreate, EcoGroupResponse
from app.auth.auth import get_current_user
from app.services.cache import CacheService
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger("carboeco")
router = APIRouter(prefix="/community", tags=["Community Module"])

@router.get("/groups", response_model=List[EcoGroupResponse])
async def get_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(EcoGroup).order_by(EcoGroup.members_count.desc())
    res = await db.execute(stmt)
    groups = res.scalars().all()
    return groups

@router.post("/groups", response_model=EcoGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_in: EcoGroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt_existing = select(EcoGroup).where(EcoGroup.name == group_in.name)
    res_existing = await db.execute(stmt_existing)
    existing = res_existing.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Group with this name already exists")

    group = EcoGroup(
        name=group_in.name,
        description=group_in.description,
        created_by=current_user.id,
        members_count=1
    )
    db.add(group)
    await db.flush()

    member = GroupMember(
        group_id=group.id,
        user_id=current_user.id
    )
    db.add(member)

    # Award Creator XP
    stmt_prof = select(UserProfile).where(UserProfile.user_id == current_user.id)
    res_prof = await db.execute(stmt_prof)
    profile = res_prof.scalar_one_or_none()
    if profile:
        profile.xp += 50
        await db.flush()

    try:
        await db.commit()
        await db.refresh(group)
        await CacheService.invalidate_pattern("leaderboard:*")
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating community group: {e}")
        raise HTTPException(status_code=500, detail="Failed to create group")

    return group

@router.post("/groups/{group_id}/join", status_code=status.HTTP_204_NO_CONTENT)
async def join_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt_group = select(EcoGroup).where(EcoGroup.id == group_id)
    res_group = await db.execute(stmt_group)
    group = res_group.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Eco group not found")

    # Check if already a member
    stmt_member = select(GroupMember).where(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id
    )
    res_member = await db.execute(stmt_member)
    already_member = res_member.scalar_one_or_none()

    if already_member:
        raise HTTPException(status_code=400, detail="You are already a member of this group")

    member = GroupMember(
        group_id=group_id,
        user_id=current_user.id
    )
    db.add(member)
    
    group.members_count += 1
    
    # Award member XP
    stmt_prof = select(UserProfile).where(UserProfile.user_id == current_user.id)
    res_prof = await db.execute(stmt_prof)
    profile = res_prof.scalar_one_or_none()
    if profile:
        profile.xp += 30
        await db.flush()

    try:
        await db.commit()
        await CacheService.invalidate_pattern("leaderboard:*")
    except Exception as e:
        await db.rollback()
        logger.error(f"Error joining community group: {e}")
        raise HTTPException(status_code=500, detail="Failed to join group")

    return None

@router.get("/groups/{group_id}/summary")
async def get_group_summary(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify group exists
    stmt_group = select(EcoGroup).where(EcoGroup.id == group_id)
    res_group = await db.execute(stmt_group)
    group = res_group.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Eco group not found")

    # Get all user IDs in the group
    stmt_members = select(GroupMember.user_id).where(GroupMember.group_id == group_id)
    res_members = await db.execute(stmt_members)
    member_ids = res_members.scalars().all()

    if not member_ids:
        return {
            "group_id": group_id,
            "group_name": group.name,
            "total_co2_equivalent": 0.0,
            "average_co2_equivalent": 0.0,
            "member_count": 0,
            "log_count": 0,
            "days": 30
        }

    # Sum all carbon emissions of group members in the last 30 days
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    stmt_logs = select(
        func.sum(CarbonLog.co2_equivalent),
        func.count(CarbonLog.id)
    ).where(
        CarbonLog.user_id.in_(member_ids),
        CarbonLog.date >= thirty_days_ago
    )
    res_logs = await db.execute(stmt_logs)
    total_co2, log_count = res_logs.first()

    total_co2_val = float(total_co2) if total_co2 is not None else 0.0
    average_co2_val = total_co2_val / len(member_ids) if member_ids else 0.0

    return {
        "group_id": group_id,
        "group_name": group.name,
        "total_co2_equivalent": round(total_co2_val, 2),
        "average_co2_equivalent": round(average_co2_val, 2),
        "member_count": len(member_ids),
        "log_count": log_count or 0,
        "days": 30
    }
