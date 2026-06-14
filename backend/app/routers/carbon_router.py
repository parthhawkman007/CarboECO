from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import User, CarbonLog
from app.schemas import CarbonLogCreate, CarbonLogResponse, CarbonSummary
from app.auth.auth import get_current_user
from app.services.carbon_service import CarbonService
import logging

logger = logging.getLogger("carboeco")
router = APIRouter(prefix="/carbon", tags=["Carbon Footprint Logs"])

@router.post("/logs", response_model=CarbonLogResponse, status_code=status.HTTP_201_CREATED)
def create_log(
    log_in: CarbonLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        log = CarbonService.add_carbon_log(db, current_user.id, log_in)
        return log
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        logger.error(f"Error creating carbon log for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the carbon footprint log."
        )

@router.get("/logs", response_model=List[CarbonLogResponse])
def get_logs(
    category: Optional[str] = Query(None, description="Filter logs by category"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(CarbonLog).filter(CarbonLog.user_id == current_user.id)
    if category:
        query = query.filter(CarbonLog.category == category.lower())
    
    logs = query.order_by(CarbonLog.date.desc(), CarbonLog.created_at.desc()).limit(limit).offset(offset).all()
    return logs

@router.delete("/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    log = db.query(CarbonLog).filter(
        CarbonLog.id == log_id,
        CarbonLog.user_id == current_user.id
    ).first()
    
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carbon log not found."
        )
    
    try:
        db.delete(log)
        db.commit()
        # Recalculate twin state
        CarbonService.update_digital_twin_score(db, current_user.id)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting carbon log {log_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete carbon log")
        
    return None

@router.get("/summary", response_model=CarbonSummary)
def get_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        summary = CarbonService.get_dashboard_summary(db, current_user.id)
        return summary
    except Exception as e:
        logger.error(f"Error fetching dashboard summary for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load carbon summaries")
