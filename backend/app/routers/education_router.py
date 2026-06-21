from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from app.database import get_db
from app.models import User, LearningPath, LearningLesson, UserLessonProgress, UserProfile
from app.schemas import LearningPathResponse, QuizSubmit, QuizResponse
from app.auth.auth import get_current_user
from app.services.cache import CacheService
import logging

logger = logging.getLogger("carboeco")
router = APIRouter(prefix="/education", tags=["Education Center"])

@router.get("/paths", response_model=List[LearningPathResponse])
async def get_paths(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(LearningPath).options(selectinload(LearningPath.lessons))
    res = await db.execute(stmt)
    paths = res.scalars().all()
    return paths

@router.post("/lessons/{lesson_id}/quiz", response_model=QuizResponse)
async def submit_lesson_quiz(
    lesson_id: int,
    submission: QuizSubmit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt_lesson = select(LearningLesson).where(LearningLesson.id == lesson_id)
    res_lesson = await db.execute(stmt_lesson)
    lesson = res_lesson.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Check if already completed
    stmt_prog = select(UserLessonProgress).where(
        UserLessonProgress.user_id == current_user.id,
        UserLessonProgress.lesson_id == lesson_id
    )
    res_prog = await db.execute(stmt_prog)
    existing_progress = res_prog.scalar_one_or_none()

    is_correct = lesson.quiz_answer.strip().lower() == submission.answer.strip().lower()
    
    xp_earned = 0
    explanation = f"Quiz explanation: {lesson.quiz_question} -> Answer: {lesson.quiz_answer}"
    
    if is_correct:
        xp_earned = lesson.xp_reward
        if not existing_progress:
            # First time completing
            progress = UserLessonProgress(
                user_id=current_user.id,
                lesson_id=lesson_id,
                completed=True
            )
            db.add(progress)
            
            # Award XP to profile
            stmt_prof = select(UserProfile).where(UserProfile.user_id == current_user.id)
            res_prof = await db.execute(stmt_prof)
            profile = res_prof.scalar_one_or_none()
            if profile:
                profile.xp += xp_earned
                new_level = 1 + (profile.xp // 500)
                if new_level > profile.level:
                    profile.level = new_level
                await db.flush()
        
        try:
            await db.commit()
            await CacheService.invalidate_pattern("leaderboard:*")
        except Exception as e:
            await db.rollback()
            logger.error(f"Error completing quiz progress: {e}")
            raise HTTPException(status_code=500, detail="Failed to save completion progress")
            
        return QuizResponse(
            correct=True,
            correct_answer=lesson.quiz_answer,
            xp_earned=xp_earned,
            explanation=f"Correct! You've earned {xp_earned} XP. {explanation}"
        )
    else:
        return QuizResponse(
            correct=False,
            correct_answer=lesson.quiz_answer,
            xp_earned=0,
            explanation="Incorrect answer, try again! Study the lesson material carefully."
        )
