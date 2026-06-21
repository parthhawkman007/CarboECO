from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, select, func
from sqlalchemy.orm import selectinload
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
async def get_leaderboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Try fetching from cache first
    cache_key = f"leaderboard:user:{current_user.id}"
    cached_res = await CacheService.get(cache_key)
    if cached_res:
        return LeaderboardResponse(**cached_res)

    # Use a subquery with SQL RANK() window function
    rank_subq = select(
        UserProfile.user_id,
        UserProfile.xp,
        UserProfile.level,
        UserProfile.streak_count,
        UserProfile.full_name,
        UserProfile.avatar,
        func.rank().over(order_by=UserProfile.xp.desc()).label('rank')
    ).subquery()

    # Fetch top 10 from the ranked subquery
    top_10_stmt = select(rank_subq).order_by(rank_subq.c.rank.asc()).limit(10)
    top_10_res = await db.execute(top_10_stmt)
    top_10_rows = top_10_res.all()
    
    leaderboard_list = []
    user_rank = None
    
    for row in top_10_rows:
        if row.user_id == current_user.id:
            user_rank = row.rank
            
        leaderboard_list.append(LeaderboardUser(
            user_id=row.user_id,
            full_name=row.full_name,
            xp=row.xp,
            level=row.level,
            streak_count=row.streak_count,
            avatar=row.avatar,
            rank=row.rank
        ))
        
    if user_rank is None:
        user_rank_stmt = select(rank_subq.c.rank).where(rank_subq.c.user_id == current_user.id)
        user_rank_res = await db.execute(user_rank_stmt)
        user_rank = user_rank_res.scalar_one_or_none()

    response_data = LeaderboardResponse(
        leaderboard=leaderboard_list,
        user_rank=user_rank
    )
    
    # Cache response
    await CacheService.set(cache_key, response_data.model_dump(), expire=300)
    
    return response_data

@router.get("/achievements", response_model=List[AchievementResponse])
async def list_achievements(
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Achievement)
    res = await db.execute(stmt)
    achievements = res.scalars().all()
    return achievements

@router.get("/my-achievements", response_model=List[UserAchievementResponse])
async def get_my_achievements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserAchievement).options(selectinload(UserAchievement.achievement)).where(UserAchievement.user_id == current_user.id)
    res = await db.execute(stmt)
    my_achs = res.scalars().all()
    return my_achs
