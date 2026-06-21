from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.database import get_db
from app.models import User, SimulationRun
from app.schemas import SimulationRunCreate, SimulationRunResponse
from app.auth.auth import get_current_user
from app.config import settings
import logging

logger = logging.getLogger("carboeco")
router = APIRouter(prefix="/simulator", tags=["Impact Simulator"])

@router.post("/run", response_model=SimulationRunResponse, status_code=status.HTTP_201_CREATED)
async def run_simulation(
    sim_in: SimulationRunCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    inputs = sim_in.inputs_json
    co2_saved = 0.0

    # 1. Switch to EV: savings = annual_km * (petrol_factor - electric_factor)
    if inputs.get("switch_to_ev", False):
        km = float(inputs.get("ev_annual_km", 10000.0))
        savings = km * (settings.EF_CAR_PETROL - settings.EF_CAR_ELECTRIC)
        co2_saved += savings

    # 2. Solar Panels: savings = capacity * electricity_factor
    if inputs.get("install_solar_panels", False):
        kwh = float(inputs.get("solar_capacity_kwh_annual", 4000.0))
        # Fetch grid factor for current user's region
        user_region = "US"
        if current_user.profile:
            user_region = current_user.profile.region
        ef_grid = settings.GRID_INTENSITY_BY_REGION.get(user_region.upper(), settings.EF_ELECTRICITY_GRID)
        savings = kwh * ef_grid
        co2_saved += savings

    # 3. Meatless Days: savings = days * 52 * (beef_factor - vegetarian_factor) * avg_kg_meat_day
    days = int(inputs.get("meatless_days_per_week", 0))
    if days > 0:
        days = min(days, 7)
        savings = days * 52 * (settings.EF_FOOD_BEEF - settings.EF_FOOD_VEGETARIAN) * 0.25
        co2_saved += savings

    # 4. Flight reduction: savings = hours * 800km/hr * short_flight_factor
    flight_hours = float(inputs.get("reduce_flight_hours", 0.0))
    if flight_hours > 0:
        savings = flight_hours * 800.0 * settings.EF_FLIGHT_SHORT
        co2_saved += savings

    co2_saved = round(co2_saved, 2)

    sim = SimulationRun(
        user_id=current_user.id,
        name=sim_in.name,
        inputs_json=inputs,
        co2_saved=co2_saved
    )
    db.add(sim)
    
    try:
        await db.commit()
        await db.refresh(sim)
    except Exception as e:
        await db.rollback()
        logger.error(f"Error saving simulation run: {e}")
        raise HTTPException(status_code=500, detail="Failed to run simulation")

    return sim

@router.get("/history", response_model=List[SimulationRunResponse])
async def get_simulation_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(SimulationRun).where(
        SimulationRun.user_id == current_user.id
    ).order_by(SimulationRun.created_at.desc())
    res = await db.execute(stmt)
    sims = res.scalars().all()
    return sims
