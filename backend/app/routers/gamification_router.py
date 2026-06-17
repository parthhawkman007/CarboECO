from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from app.database import get_db
from app.models import User, UserProfile, Achievement, UserAchievement
from app.schemas import LeaderboardResponse, LeaderboardUser, AchievementResponse, UserAchievementResponse
from app.auth.auth import get_current_user
from app.services.cache import CacheService
import logging

logger = logging.getLogger("carboeco")
router = APIRouter(prefix="/gamification", tags=["Gamification System"])

@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Try fetching from cache first
    cache_key = f"leaderboard:user:{current_user.id}"
    cached_res = CacheService.get(cache_key)
    if cached_res:
        return LeaderboardResponse(**cached_res)

    # Fetch profiles sorted by XP
    profiles = db.query(UserProfile).order_by(desc(UserProfile.xp)).limit(10).all()
    
    leaderboard_list = []
    user_rank = None
    
    for index, p in enumerate(profiles):
        rank = index + 1
        if p.user_id == current_user.id:
            user_rank = rank
            
        leaderboard_list.append(LeaderboardUser(
            user_id=p.user_id,
            full_name=p.full_name,
            xp=p.xp,
            level=p.level,
            streak_count=p.streak_count,
            avatar=p.avatar,
            rank=rank
        ))
        
    # If the user is not in the top 10, calculate their rank manually
    if user_rank is None:
        user_profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
        if user_profile:
            higher_xp_count = db.query(UserProfile).filter(UserProfile.xp > user_profile.xp).count()
            user_rank = higher_xp_count + 1

    response_data = LeaderboardResponse(
        leaderboard=leaderboard_list,
        user_rank=user_rank
    )
    
    # Cache response
    CacheService.set(cache_key, response_data.model_dump(), expire=300)
    
    return response_data

@router.get("/achievements", response_model=List[AchievementResponse])
def list_achievements(
    db: Session = Depends(get_db)
):
    achievements = db.query(Achievement).all()
    return achievements

@router.get("/my-achievements", response_model=List[UserAchievementResponse])
def get_my_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    my_achs = db.query(UserAchievement).filter(UserAchievement.user_id == current_user.id).all()
    return my_achs
