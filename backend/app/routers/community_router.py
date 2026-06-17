from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import User, EcoGroup, GroupMember, UserProfile
from app.schemas import EcoGroupCreate, EcoGroupResponse
from app.auth.auth import get_current_user
from app.services.cache import CacheService
import logging

logger = logging.getLogger("carboeco")
router = APIRouter(prefix="/community", tags=["Community Module"])

@router.get("/groups", response_model=List[EcoGroupResponse])
def get_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    groups = db.query(EcoGroup).order_by(EcoGroup.members_count.desc()).all()
    return groups

@router.post("/groups", response_model=EcoGroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    group_in: EcoGroupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if name exists
    existing = db.query(EcoGroup).filter(EcoGroup.name == group_in.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Group with this name already exists")

    group = EcoGroup(
        name=group_in.name,
        description=group_in.description,
        created_by=current_user.id,
        members_count=1
    )
    db.add(group)
    db.flush()

    # Create GroupMember for creator
    member = GroupMember(
        group_id=group.id,
        user_id=current_user.id
    )
    db.add(member)

    # Award Creator XP
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if profile:
        profile.xp += 50
        db.flush()

    try:
        db.commit()
        db.refresh(group)
        CacheService.invalidate_pattern("leaderboard:*")
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating community group: {e}")
        raise HTTPException(status_code=500, detail="Failed to create group")

    return group

@router.post("/groups/{group_id}/join", status_code=status.HTTP_204_NO_CONTENT)
def join_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    group = db.query(EcoGroup).filter(EcoGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Eco group not found")

    # Check if already a member
    already_member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id
    ).first()

    if already_member:
        raise HTTPException(status_code=400, detail="You are already a member of this group")

    member = GroupMember(
        group_id=group_id,
        user_id=current_user.id
    )
    db.add(member)
    
    # Increment count
    group.members_count += 1
    
    # Award member XP
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if profile:
        profile.xp += 30
        db.flush()

    try:
        db.commit()
        CacheService.invalidate_pattern("leaderboard:*")
    except Exception as e:
        db.rollback()
        logger.error(f"Error joining community group: {e}")
        raise HTTPException(status_code=500, detail="Failed to join group")

    return None
