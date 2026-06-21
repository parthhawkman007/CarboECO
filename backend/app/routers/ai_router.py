from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Dict, Any
from app.database import get_db
from app.models import User, DigitalTwinState
from app.schemas import DigitalTwinResponse
from app.auth.auth import get_current_user
from app.services.ai_engine import AIEngine
from app.services.sustainability_coach import SustainabilityCoach
import asyncio
import logging
import json
import os

logger = logging.getLogger("carboeco")
router = APIRouter(prefix="/ai", tags=["AI Copilot & Coach Engine"])

class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str

class ScanPayload(BaseModel):
    image_base64: str

class ScanResponse(BaseModel):
    category: str
    subcategory: str
    value: float
    unit: str
    explanation: str

@router.get("/predict/forecast")
async def get_forecast(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        return await AIEngine.forecast_footprint(db, current_user.id)
    except Exception as e:
        logger.error(f"Error in forecast engine: {e}")
        raise HTTPException(status_code=500, detail="Carbon forecasting engine failed")

@router.get("/predict/risk")
async def get_risk_analysis(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        return await AIEngine.calculate_risk_and_goal_probability(db, current_user.id)
    except Exception as e:
        logger.error(f"Error in risk calculation: {e}")
        raise HTTPException(status_code=500, detail="Risk and goal prediction engine failed")

@router.post("/coach/chat", response_model=ChatResponse)
async def coach_chat(
    msg: ChatMessage,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        reply = await SustainabilityCoach.get_coach_response(db, current_user.id, msg.message)
        return ChatResponse(reply=reply)
    except Exception as e:
        logger.error(f"Error in coach chat: {e}")
        raise HTTPException(status_code=500, detail="AI Coach is temporarily offline")

@router.post("/scan", response_model=ScanResponse)
async def scan_image(
    payload: ScanPayload,
    current_user: User = Depends(get_current_user)
):
    try:
        result = await asyncio.to_thread(SustainabilityCoach.scan_carbon_image, payload.image_base64)
        return ScanResponse(**result)
    except Exception as e:
        logger.error(f"Error in carbon scanner: {e}")
        raise HTTPException(status_code=500, detail="Gemini Carbon Scanner is temporarily offline")

@router.get("/coach/challenges")
async def get_challenges(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        return await SustainabilityCoach.get_weekly_challenges(db, current_user.id)
    except Exception as e:
        logger.error(f"Error loading weekly challenges: {e}")
        raise HTTPException(status_code=500, detail="Failed to load weekly challenges")

@router.post("/copilot/roadmap")
async def create_roadmap(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        return await SustainabilityCoach.generate_roadmap(db, current_user.id)
    except Exception as e:
        logger.error(f"Error generating roadmap: {e}")
        raise HTTPException(status_code=500, detail="Roadmap generation failed")

@router.get("/digital-twin", response_model=DigitalTwinResponse)
async def get_digital_twin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(DigitalTwinState).where(DigitalTwinState.user_id == current_user.id)
    res = await db.execute(stmt)
    twin = res.scalar_one_or_none()
    if not twin:
        raise HTTPException(status_code=404, detail="Digital twin state not found for user")
    return twin

async def train_user_model_task(user_id: int):
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        try:
            await AIEngine.train_user_model(db, user_id)
        except Exception as e:
            logger.error(f"Error in background model training: {e}")

@router.post("/train", status_code=202)
async def train_model(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    background_tasks.add_task(train_user_model_task, current_user.id)
    return {"message": "Model training initiated"}

@router.get("/model-status")
async def get_model_status(
    current_user: User = Depends(get_current_user)
):
    model_path, metadata_path = AIEngine.get_model_paths(current_user.id)
    if not os.path.exists(metadata_path):
        return {
            "status": "not_trained",
            "message": "No personalized model exists for this user. General baseline is used."
        }
    
    try:
        with open(metadata_path, "r") as f:
            meta = json.load(f)
        return {
            "status": "ready",
            "trained_at": meta.get("trained_at"),
            "model_version": meta.get("model_version"),
            "metrics": {
                "rmse": meta.get("rmse"),
                "mae": meta.get("mae")
            }
        }
    except Exception as e:
        logger.error(f"Failed to read model metadata: {e}")
        return {
            "status": "error",
            "message": "Failed to read model configuration."
        }
