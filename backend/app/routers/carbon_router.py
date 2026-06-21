from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from app.database import get_db
from app.models import User, CarbonLog, UserProfile, UserOffset
from app.schemas import CarbonLogCreate, CarbonLogResponse, CarbonSummary, GlobalSummary
from app.auth.auth import get_current_user
from app.services.carbon_service import CarbonService
from app.config import settings
import logging

logger = logging.getLogger("carboeco")
router = APIRouter(prefix="/carbon", tags=["Carbon Footprint Logs"])

@router.post("/logs", response_model=CarbonLogResponse, status_code=status.HTTP_201_CREATED,
    openapi_extra={
        'requestBody': {
            'content': {
                'application/json': {
                    'examples': {
                        'petrol_car': {
                            'summary': 'Petrol car journey',
                            'value': {'date': '2026-06-20', 'category': 'transportation', 'subcategory': 'petrol_car', 'value': 50.0, 'unit': 'km'}
                        },
                        'electricity': {
                            'summary': 'Electricity consumption',
                            'value': {'date': '2026-06-20', 'category': 'energy', 'subcategory': 'electricity', 'value': 100.0, 'unit': 'kWh'}
                        },
                        'vegan_meal': {
                            'summary': 'Vegan meal',
                            'value': {'date': '2026-06-20', 'category': 'food', 'subcategory': 'vegan_salad', 'value': 0.5, 'unit': 'kg'}
                        }
                    }
                }
            }
        }
    }
)
async def create_log(
    log_in: CarbonLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        log = await CarbonService.add_carbon_log(db, current_user.id, log_in)
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
async def get_logs(
    category: Optional[str] = Query(None, description="Filter logs by category"),
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[int] = Query(None, description="ID cursor for pagination. Pass the last returned log ID to get next page."),
    offset: Optional[int] = Query(None, ge=0, description="Offset-based pagination (legacy). Ignored if cursor is provided."),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(CarbonLog).where(CarbonLog.user_id == current_user.id)
    if category:
        stmt = stmt.where(CarbonLog.category == category.lower())
    if cursor is not None:
        stmt = stmt.where(CarbonLog.id < cursor)
        stmt = stmt.order_by(CarbonLog.id.desc()).limit(limit)
    else:
        stmt = stmt.order_by(CarbonLog.id.desc()).limit(limit)
        if offset is not None:
            stmt = stmt.offset(offset)
    res = await db.execute(stmt)
    logs = res.scalars().all()
    return logs

@router.delete("/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(CarbonLog).where(
        CarbonLog.id == log_id,
        CarbonLog.user_id == current_user.id
    )
    res = await db.execute(stmt)
    log = res.scalar_one_or_none()
    
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Carbon log not found."
        )
    
    try:
        await db.delete(log)
        await db.flush()
        # Recalculate twin state within the same transaction
        await CarbonService.update_digital_twin_score(db, current_user.id)
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting carbon log {log_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete carbon log")
        
    return None

@router.get("/summary", response_model=CarbonSummary)
async def get_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        summary = await CarbonService.get_dashboard_summary(db, current_user.id)
        return summary
    except Exception as e:
        logger.error(f"Error fetching dashboard summary for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load carbon summaries")

@router.get("/global-summary", response_model=GlobalSummary)
async def get_global_summary(db: AsyncSession = Depends(get_db)):
    try:
        # 1. Total mock/registered user count
        users_stmt = select(func.count(UserProfile.id))
        users_res = await db.execute(users_stmt)
        db_users = users_res.scalar() or 0
        active_citizens = settings.GLOBAL_ACTIVE_CITIZENS_BASE + db_users

        # 2. Total carbon logs logged
        logs_stmt = select(func.count(CarbonLog.id))
        logs_res = await db.execute(logs_stmt)
        db_logs = logs_res.scalar() or 0
        missions_logged = settings.GLOBAL_MISSIONS_BASE + db_logs

        # 3. Sum of offsetted CO2 (kg)
        offsets_stmt = select(func.sum(UserOffset.co2_offsetted))
        offsets_res = await db.execute(offsets_stmt)
        total_offsetted = float(offsets_res.scalar() or 0.0)

        # 4. Global carbon ticker calculations
        base_co2 = settings.GLOBAL_CO2_BASE
        real_time_addition = total_offsetted + (db_logs * settings.GLOBAL_CO2_PER_LOG_ESTIMATE)
        total_co2 = base_co2 + real_time_addition

        # 5. Retrieve 5 most recent carbon logs (anonymized) to serve as a real-time event feed
        recent_stmt = select(CarbonLog, UserProfile.full_name).join(
            UserProfile, UserProfile.user_id == CarbonLog.user_id
        ).order_by(CarbonLog.created_at.desc()).limit(5)
        
        recent_res = await db.execute(recent_stmt)
        recent_rows = recent_res.all()

        recent_events = []
        for log, full_name in recent_rows:
            name = "EcoCitizen"
            if full_name:
                parts = full_name.split()
                if len(parts) > 1:
                    name = f"{parts[0]} {parts[1][0]}."
                else:
                    name = parts[0]
            
            action = f"logged {log.category} activity ({log.subcategory})"
            co2_str = f"{log.co2_equivalent:.1f} kg"
            
            recent_events.append({
                "id": log.id,
                "user": name,
                "action": action,
                "co2": co2_str
            })

        # Pad with realistic static events if database doesn't have enough logs yet
        static_padding = [
            {"id": 1, "user": "Sven K.", "action": "commuted by e-bike in Berlin", "co2": "3.4 kg"},
            {"id": 2, "user": "Elena R.", "action": "composted organic waste in Rome", "co2": "1.1 kg"},
            {"id": 3, "user": "Hiroshi T.", "action": "swapped beef for vegetarian lunch in Tokyo", "co2": "2.5 kg"},
            {"id": 4, "user": "Emma W.", "action": "installed smart plug switches in London", "co2": "0.9 kg"}
        ]
        
        idx = 100
        while len(recent_events) < 4:
            pad = static_padding[len(recent_events) % len(static_padding)].copy()
            pad["id"] = idx
            recent_events.append(pad)
            idx += 1

        return {
            "total_co2": round(total_co2, 2),
            "active_citizens": active_citizens,
            "trees_equivalent": int(total_co2 // 22),
            "energy_saved_kwh": round(total_co2 * 0.82, 1),
            "missions_logged": missions_logged,
            "recent_events": recent_events[:5]
        }
    except Exception as e:
        logger.error(f"Error fetching global carbon summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to load global carbon summaries")
