from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any
from app.database import get_db
from app.models import User, DigitalTwinState
from app.schemas import DigitalTwinResponse
from app.auth.auth import get_current_user
from app.services.ai_engine import AIEngine
from app.services.sustainability_coach import SustainabilityCoach
import logging

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
def get_forecast(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return AIEngine.forecast_footprint(db, current_user.id)
    except Exception as e:
        logger.error(f"Error in forecast engine: {e}")
        raise HTTPException(status_code=500, detail="Carbon forecasting engine failed")

@router.get("/predict/risk")
def get_risk_analysis(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return AIEngine.calculate_risk_and_goal_probability(db, current_user.id)
    except Exception as e:
        logger.error(f"Error in risk calculation: {e}")
        raise HTTPException(status_code=500, detail="Risk and goal prediction engine failed")

@router.post("/coach/chat", response_model=ChatResponse)
def coach_chat(
    msg: ChatMessage,
    current_user: User = Depends(get_current_user)
):
    try:
        reply = SustainabilityCoach.get_coach_response(msg.message)
        return ChatResponse(reply=reply)
    except Exception as e:
        logger.error(f"Error in coach chat: {e}")
        raise HTTPException(status_code=500, detail="AI Coach is temporarily offline")

@router.post("/scan", response_model=ScanResponse)
def scan_image(
    payload: ScanPayload,
    current_user: User = Depends(get_current_user)
):
    try:
        result = SustainabilityCoach.scan_carbon_image(payload.image_base64)
        return ScanResponse(**result)
    except Exception as e:
        logger.error(f"Error in carbon scanner: {e}")
        raise HTTPException(status_code=500, detail="Gemini Carbon Scanner is temporarily offline")

@router.get("/coach/challenges")
def get_challenges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return SustainabilityCoach.get_weekly_challenges(db, current_user.id)
    except Exception as e:
        logger.error(f"Error loading weekly challenges: {e}")
        raise HTTPException(status_code=500, detail="Failed to load weekly challenges")

@router.post("/copilot/roadmap")
def create_roadmap(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return SustainabilityCoach.generate_roadmap(db, current_user.id)
    except Exception as e:
        logger.error(f"Error generating roadmap: {e}")
        raise HTTPException(status_code=500, detail="Roadmap generation failed")

@router.get("/digital-twin", response_model=DigitalTwinResponse)
def get_digital_twin(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    twin = db.query(DigitalTwinState).filter(DigitalTwinState.user_id == current_user.id).first()
    if not twin:
        raise HTTPException(status_code=404, detail="Digital twin state not found for user")
    return twin
