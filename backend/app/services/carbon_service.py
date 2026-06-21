from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, case, select
from app.services.cache import CacheService
from datetime import datetime, timedelta, timezone
import logging
from app.config import settings
from app.models import CarbonLog, UserProfile, UserAchievement, Achievement, DigitalTwinState
from app.schemas import CarbonLogCreate

logger = logging.getLogger("carboeco")

class CarbonService:
    @staticmethod
    async def get_live_grid_intensity(region: str) -> float:
        """
        Fetches real-time grid carbon intensity from Electricity Maps API.
        Falls back to config static values if API key is not set or request fails.
        """
        import httpx
        api_key = settings.ELECTRICITY_MAPS_API_KEY
        static_intensity = settings.GRID_INTENSITY_BY_REGION.get(region.upper(), settings.EF_ELECTRICITY_GRID)
        
        if not api_key:
            return static_intensity
        
        zone_map = {'IN': 'IN-NO', 'US': 'US-CAL-CISO', 'EU': 'DE', 'FR': 'FR', 'GL': 'DE'}
        zone = zone_map.get(region.upper(), 'DE')
        
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(
                    f"{settings.ELECTRICITY_MAPS_BASE_URL}/carbon-intensity/latest",
                    params={'zone': zone},
                    headers={'auth-token': api_key}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    grams_per_kwh = data.get('carbonIntensity', 0)
                    return round(grams_per_kwh / 1000.0, 4)  # Convert g/kWh to kg/kWh
        except Exception as e:
            logger.warning(f"Electricity Maps API failed for region {region}: {e}")
        
        return static_intensity

    @staticmethod
    def calculate_emissions(category: str, subcategory: str, value: float, region: str = "US", live_grid_intensity: float | None = None) -> tuple[float, str]:
        """
        Calculates carbon emissions in kg CO2e and returns a tuple (emissions, explanation).
        Calculations are regional-aware for utilities (electricity).
        """
        cat = category.lower()
        sub = subcategory.lower()
        region_upper = region.upper()

        if value <= 0:
            raise ValueError("Consumption value must be greater than zero.")
        
        # Max bounds protection
        max_bounds = {
            "transportation": 100000.0,
            "energy": 100000.0,
            "food": 10000.0,
            "waste": 10000.0,
            "shopping": 1000000.0,
            "digital": 10000.0
        }
        if cat in max_bounds and value > max_bounds[cat]:
            raise ValueError(f"Value {value} exceeds the maximum single-log bound of {max_bounds[cat]} for {cat}.")

        co2 = 0.0
        explanation = ""

        if cat == "transportation":
            if "petrol" in sub or "gasoline" in sub:
                co2 = value * settings.EF_CAR_PETROL
                explanation = f"Driving a petrol car for {value} km emitted {co2:.2f} kg CO2e. Consider hybrid or public transit options next time."
            elif "diesel" in sub:
                co2 = value * settings.EF_CAR_DIESEL
                explanation = f"Driving a diesel car for {value} km emitted {co2:.2f} kg CO2e. Diesel engines emit more particulate matter than petrol."
            elif "electric" in sub or "ev" in sub:
                co2 = value * settings.EF_CAR_ELECTRIC
                petrol_comp = value * settings.EF_CAR_PETROL
                savings = petrol_comp - co2
                explanation = f"Driving an EV for {value} km emitted {co2:.2f} kg CO2e, saving you {savings:.2f} kg CO2e compared to a petrol car."
            elif "motorcycle" in sub:
                co2 = value * settings.EF_MOTORCYCLE
                explanation = f"Riding a motorcycle for {value} km emitted {co2:.2f} kg CO2e."
            elif "metro" in sub or "train" in sub or "subway" in sub:
                co2 = value * settings.EF_METRO
                petrol_comp = value * settings.EF_CAR_PETROL
                savings = petrol_comp - co2
                explanation = f"Taking the metro for {value} km emitted only {co2:.2f} kg CO2e. This saved {savings:.2f} kg CO2e compared to driving."
            elif "bus" in sub:
                co2 = value * settings.EF_BUS
                petrol_comp = value * settings.EF_CAR_PETROL
                savings = petrol_comp - co2
                explanation = f"Taking the bus for {value} km emitted {co2:.2f} kg CO2e, saving {savings:.2f} kg CO2e compared to a private vehicle."
            elif "short" in sub or "domestic" in sub:
                co2 = value * settings.EF_FLIGHT_SHORT
                explanation = f"Taking a short-haul flight of {value} km emitted {co2:.2f} kg CO2e. Short flights have high landing/takeoff overheads."
            elif "long" in sub or "international" in sub:
                co2 = value * settings.EF_FLIGHT_LONG
                explanation = f"Taking a long-haul flight of {value} km emitted {co2:.2f} kg CO2e. Consider purchasing offsets for this journey."
            else:
                co2 = value * settings.EF_CAR_PETROL
                explanation = f"Transportation log for {value} km emitted {co2:.2f} kg CO2e."

        elif cat == "energy":
            if "electricity" in sub:
                # Region-specific grid factors mapping
                ef_grid = live_grid_intensity if live_grid_intensity is not None else settings.GRID_INTENSITY_BY_REGION.get(region_upper, settings.EF_ELECTRICITY_GRID)
                co2 = value * ef_grid
                if live_grid_intensity is not None:
                    explanation = (
                        f"Consuming {value} kWh of grid electricity in region {region_upper} emitted {co2:.2f} kg CO2e "
                        f"(real-time grid intensity: {ef_grid} kg/kWh). Switch to energy-saving appliances or solar."
                    )
                else:
                    explanation = (
                        f"Consuming {value} kWh of grid electricity in region {region_upper} emitted {co2:.2f} kg CO2e "
                        f"(grid intensity: {ef_grid} kg/kWh). Switch to energy-saving appliances or solar."
                    )
            elif "gas" in sub:
                co2 = value * settings.EF_GAS
                explanation = f"Using {value} kWh of natural gas emitted {co2:.2f} kg CO2e. Lowering your thermostat 1 degree can save 10% gas."
            elif "water" in sub:
                co2 = value * settings.EF_WATER
                explanation = f"Consuming {value} liters of municipal water emitted {co2:.2f} kg CO2e. Heating water is the major carbon contributor."
            else:
                co2 = value * settings.EF_ELECTRICITY_GRID
                explanation = f"Energy consumption of {value} units emitted {co2:.2f} kg CO2e."

        elif cat == "food":
            if "beef" in sub or "lamb" in sub:
                co2 = value * settings.EF_FOOD_BEEF
                explanation = f"Eating {value} kg of beef emitted {co2:.2f} kg CO2e. Red meat has a high carbon intensity due to methane emissions."
            elif "pork" in sub or "chicken" in sub or "poultry" in sub:
                co2 = value * settings.EF_FOOD_PORK_POULTRY
                explanation = f"Eating {value} kg of poultry/pork emitted {co2:.2f} kg CO2e. This is significantly lower carbon than beef."
            elif "dairy" in sub or "cheese" in sub:
                co2 = value * settings.EF_FOOD_DAIRY
                explanation = f"Consuming {value} kg of dairy products emitted {co2:.2f} kg CO2e."
            elif "vegetarian" in sub or "egg" in sub:
                co2 = value * settings.EF_FOOD_VEGETARIAN
                explanation = f"Consuming {value} kg of vegetarian food emitted {co2:.2f} kg CO2e."
            elif "vegan" in sub or "plant" in sub:
                co2 = value * settings.EF_FOOD_VEGAN
                explanation = f"Consuming {value} kg of vegan/plant-based food emitted {co2:.2f} kg CO2e. Excellent low-impact choice!"
            else:
                co2 = value * settings.EF_FOOD_VEGETARIAN
                explanation = f"Food log of {value} kg emitted {co2:.2f} kg CO2e."

        elif cat == "waste":
            if "landfill" in sub or "trash" in sub:
                co2 = value * settings.EF_WASTE_LANDFILL
                explanation = f"Sending {value} kg of waste to landfill emitted {co2:.2f} kg CO2e. Landfilled organic waste decomposes into methane."
            elif "recycled" in sub or "recycling" in sub:
                co2 = value * settings.EF_WASTE_RECYCLED
                landfill_comp = value * settings.EF_WASTE_LANDFILL
                savings = landfill_comp - co2
                explanation = f"Recycling {value} kg of materials emitted {co2:.2f} kg CO2e, preventing {savings:.2f} kg CO2e of landfill emissions."
            elif "compost" in sub:
                co2 = value * settings.EF_WASTE_COMPOSTED
                explanation = f"Composting {value} kg of organic waste emitted {co2:.2f} kg CO2e. This turns waste into nutrient-rich soil."
            else:
                co2 = value * settings.EF_WASTE_LANDFILL
                explanation = f"Disposing of {value} kg of waste emitted {co2:.2f} kg CO2e."

        elif cat == "shopping":
            if "clothing" in sub or "fashion" in sub:
                co2 = value * settings.EF_SHOPPING_CLOTHING
                explanation = f"Spending ${value} on fashion emitted {co2:.2f} kg CO2e. The fashion industry accounts for ~10% of global emissions."
            elif "electronics" in sub or "gadget" in sub:
                co2 = value * settings.EF_SHOPPING_ELECTRONICS
                explanation = f"Spending ${value} on electronics emitted {co2:.2f} kg CO2e. Rare metal extraction makes electronics carbon-heavy."
            elif "misc" in sub or "general" in sub:
                co2 = value * settings.EF_SHOPPING_MISC
                explanation = f"General shopping of ${value} emitted {co2:.2f} kg CO2e."
            else:
                co2 = value * settings.EF_SHOPPING_MISC
                explanation = f"Shopping purchase of ${value} emitted {co2:.2f} kg CO2e."

        elif cat == "digital":
            if "streaming" in sub or "video" in sub:
                co2 = value * settings.EF_DIGITAL_STREAMING
                explanation = f"Streaming video for {value} hours emitted {co2:.2f} kg CO2e due to server hosting and network power usage."
            elif "browsing" in sub or "internet" in sub:
                co2 = value * settings.EF_DIGITAL_BROWSING
                explanation = f"Browsing the web for {value} hours emitted {co2:.2f} kg CO2e."
            elif "ai" in sub or "query" in sub or "llm" in sub:
                co2 = value * settings.EF_DIGITAL_AI_QUERY
                explanation = f"Making {value} AI queries emitted {co2:.2f} kg CO2e. Large models require specialized energy-intensive hardware."
            else:
                co2 = value * settings.EF_DIGITAL_BROWSING
                explanation = f"Digital footprint log for {value} units emitted {co2:.2f} kg CO2e."

        return co2, explanation

    @classmethod
    async def add_carbon_log(cls, db: AsyncSession, user_id: int, log_in: CarbonLogCreate) -> CarbonLog:
        # Load user profile to check region
        stmt_prof = select(UserProfile).where(UserProfile.user_id == user_id)
        res_prof = await db.execute(stmt_prof)
        profile = res_prof.scalar_one_or_none()
        region = profile.region if profile else "US"

        live_grid_intensity = None
        if log_in.category.lower() == "energy" and "electricity" in log_in.subcategory.lower():
            live_grid_intensity = await cls.get_live_grid_intensity(region)

        co2_equivalent, explanation = cls.calculate_emissions(log_in.category, log_in.subcategory, log_in.value, region, live_grid_intensity)

        # Create log
        log = CarbonLog(
            user_id=user_id,
            date=log_in.date,
            category=log_in.category,
            subcategory=log_in.subcategory,
            value=log_in.value,
            unit=log_in.unit,
            co2_equivalent=co2_equivalent,
            explanation=explanation,
            metadata_json=log_in.metadata_json
        )
        db.add(log)
        await db.flush()

        # Update profile stats (XP, streaks)
        await cls.update_user_stats(db, user_id, log_in.date)

        # Update Digital Twin energy efficiency score
        await cls.update_digital_twin_score(db, user_id)

        # Award Achievements
        await cls.check_achievements(db, user_id)

        await db.commit()
        await db.refresh(log)
        
        # Async invalidate pattern
        await CacheService.invalidate_pattern("leaderboard:*")
        return log

    @staticmethod
    async def update_user_stats(db: AsyncSession, user_id: int, log_date_str: str):
        stmt = select(UserProfile).where(UserProfile.user_id == user_id)
        res = await db.execute(stmt)
        profile = res.scalar_one_or_none()
        if not profile:
            return

        # Award default log XP
        profile.xp += 20

        # Calculate streak logic
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        yesterday_str = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

        if profile.last_active_date is None:
            profile.streak_count = 1
        elif profile.last_active_date == log_date_str:
            # Already active today, streak stays same
            pass
        elif profile.last_active_date == yesterday_str:
            profile.streak_count += 1
            # Award milestone XP
            if profile.streak_count % 7 == 0:
                profile.xp += 100  # Weekly streak bonus
        else:
            # Missed a day, reset streak to 1
            profile.streak_count = 1

        profile.last_active_date = log_date_str

        # Level up logic (e.g. level = 1 + floor(XP / 500))
        new_level = 1 + (profile.xp // 500)
        if new_level > profile.level:
            profile.level = new_level

        await db.flush()

    @staticmethod
    async def update_digital_twin_score(db: AsyncSession, user_id: int):
        # Fetch digital twin and profile
        stmt_twin = select(DigitalTwinState).where(DigitalTwinState.user_id == user_id)
        twin_res = await db.execute(stmt_twin)
        twin = twin_res.scalar_one_or_none()

        stmt_prof = select(UserProfile).where(UserProfile.user_id == user_id)
        prof_res = await db.execute(stmt_prof)
        profile = prof_res.scalar_one_or_none()
        
        if not twin or not profile:
            return

        # Fetch last 7 days of emissions
        today = datetime.now(timezone.utc)
        seven_days_ago = (today - timedelta(days=7)).strftime("%Y-%m-%d")
        
        stmt_logs = select(CarbonLog).where(
            CarbonLog.user_id == user_id,
            CarbonLog.date >= seven_days_ago
        )
        logs_res = await db.execute(stmt_logs)
        logs = logs_res.scalars().all()

        total_weekly_co2 = sum(log.co2_equivalent for log in logs)
        average_daily_co2 = total_weekly_co2 / 7.0 if logs else 0.0

        # Calculate efficiency score (budget / average daily) * 100 capped at 100
        budget = profile.carbon_budget
        if average_daily_co2 == 0:
            eff_score = 100.0
        else:
            eff_score = min((budget / average_daily_co2) * 50.0, 100.0) # budget relative efficiency

        twin.energy_efficiency_score = round(eff_score, 1)

        # Update growth stage based on level and efficiency score
        stage = 1
        if profile.level >= 2 and eff_score >= 40:
            stage = 2
        if profile.level >= 4 and eff_score >= 60:
            stage = 3
        if profile.level >= 6 and eff_score >= 75:
            stage = 4
        if profile.level >= 8 and eff_score >= 85:
            stage = 5

        twin.tree_growth_stage = stage
        
        # update twin leaves color based on efficiency
        avatar = dict(twin.current_avatar_state_json)
        avatar["health"] = int(eff_score)
        if eff_score >= 80:
            avatar["leaves_color"] = "#10B981"  # Emerald
            avatar["theme"] = "emerald"
        elif eff_score >= 50:
            avatar["leaves_color"] = "#0EA5E9"  # Sky Blue
            avatar["theme"] = "sky"
        else:
            avatar["leaves_color"] = "#EF4444"  # Red/Alert
            avatar["theme"] = "warn"
            
        twin.current_avatar_state_json = avatar
        await db.flush()

    @staticmethod
    async def check_achievements(db: AsyncSession, user_id: int):
        stmt_prof = select(UserProfile).where(UserProfile.user_id == user_id)
        prof_res = await db.execute(stmt_prof)
        profile = prof_res.scalar_one_or_none()
        if not profile:
            return

        # 1. Get existing achievement codes
        stmt_unlocked = select(Achievement.badge_code).join(
            UserAchievement, UserAchievement.achievement_id == Achievement.id
        ).where(UserAchievement.user_id == user_id)
        res_unlocked = await db.execute(stmt_unlocked)
        unlocked = res_unlocked.all()
        unlocked_codes = {item[0] for item in unlocked}

        # Determine which achievement codes we potentially need to unlock
        target_codes = []
        for code in ["first_log", "transit_master", "green_eater", "zero_waste", "streak_3", "streak_7"]:
            if code not in unlocked_codes:
                target_codes.append(code)

        if not target_codes:
            return

        # 2. Batch fetch achievements
        stmt_ach = select(Achievement).where(Achievement.badge_code.in_(target_codes))
        res_ach = await db.execute(stmt_ach)
        achievements = res_ach.scalars().all()
        achievement_map = {ach.badge_code: ach for ach in achievements}

        # 3. Batch query carbon statistics
        stmt_counts = select(
            func.count(CarbonLog.id).label("total_count"),
            func.sum(case(((CarbonLog.category == "transportation") & (CarbonLog.subcategory.in_(["metro", "bus", "train"])), 1), else_=0)).label("transit_count"),
            func.sum(case(((CarbonLog.category == "food") & (CarbonLog.subcategory.in_(["vegan", "vegetarian"])), 1), else_=0)).label("vegan_count"),
            func.sum(case(((CarbonLog.category == "waste") & (CarbonLog.subcategory == "recycled"), 1), else_=0)).label("recycling_count")
        ).where(CarbonLog.user_id == user_id)
        res_counts = await db.execute(stmt_counts)
        counts = res_counts.first()

        logs_count = counts.total_count or 0
        transit_count = counts.transit_count or 0
        vegan_count = counts.vegan_count or 0
        recycling_count = counts.recycling_count or 0

        # Helper to unlock
        async def unlock(code: str):
            ach = achievement_map.get(code)
            if ach:
                ua = UserAchievement(user_id=user_id, achievement_id=ach.id)
                db.add(ua)
                profile.xp += ach.xp_reward
                await db.flush()

        if logs_count >= 1:
            await unlock("first_log")
        if transit_count >= 5:
            await unlock("transit_master")
        if vegan_count >= 5:
            await unlock("green_eater")
        if recycling_count >= 5:
            await unlock("zero_waste")
        if profile.streak_count >= 3:
            await unlock("streak_3")
        if profile.streak_count >= 7:
            await unlock("streak_7")

    @classmethod
    async def get_dashboard_summary(cls, db: AsyncSession, user_id: int) -> dict:
        stmt_prof = select(UserProfile).where(UserProfile.user_id == user_id)
        res_prof = await db.execute(stmt_prof)
        profile = res_prof.scalar_one_or_none()
        budget = profile.carbon_budget if profile else 15.0

        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        yesterday_str = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        three_sixty_five_days_ago = (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%d")
        
        # Query 1: Single database roundtrip for all statistics via conditional aggregation
        stmt_stats = select(
            func.sum(case(((CarbonLog.date == today_str), CarbonLog.co2_equivalent), else_=0.0)).label("daily"),
            func.sum(case(((CarbonLog.date >= seven_days_ago), CarbonLog.co2_equivalent), else_=0.0)).label("weekly"),
            func.sum(case(((CarbonLog.date >= thirty_days_ago), CarbonLog.co2_equivalent), else_=0.0)).label("monthly"),
            func.sum(case(((CarbonLog.date >= three_sixty_five_days_ago), CarbonLog.co2_equivalent), else_=0.0)).label("annual"),
            func.sum(CarbonLog.co2_equivalent).label("all_time")
        ).where(CarbonLog.user_id == user_id)
        
        stats_res = await db.execute(stmt_stats)
        stats = stats_res.first()
        
        daily_co2 = float(stats.daily or 0.0)
        weekly_co2 = float(stats.weekly or 0.0)
        monthly_co2 = float(stats.monthly or 0.0)
        annual_co2 = float(stats.annual or 0.0)
        total_all_time = float(stats.all_time or 0.0)

        # Efficiency rating calculation
        eval_co2 = daily_co2
        if daily_co2 == 0.0:
            eval_co2 = weekly_co2 / 7.0 if weekly_co2 > 0.0 else 0.0

        if eval_co2 == 0.0:
            rating = "A"
        elif eval_co2 <= budget * 0.7:
            rating = "A+"
        elif eval_co2 <= budget:
            rating = "A"
        elif eval_co2 <= budget * 1.2:
            rating = "B"
        elif eval_co2 <= budget * 1.5:
            rating = "C"
        else:
            rating = "F"

        # Query 2: Single database roundtrip for category breakdown via GROUP BY
        stmt_breakdown = select(
            CarbonLog.category,
            func.sum(CarbonLog.co2_equivalent).label("co2_sum"),
            func.count(CarbonLog.id).label("log_count")
        ).where(
            CarbonLog.user_id == user_id
        ).group_by(
            CarbonLog.category
        )
        
        breakdown_res = await db.execute(stmt_breakdown)
        breakdown_rows = breakdown_res.all()
        breakdown_map = {row.category: (float(row.co2_sum or 0.0), int(row.log_count or 0)) for row in breakdown_rows}

        categories = ["transportation", "energy", "food", "waste", "shopping", "digital"]
        breakdown = []

        for cat in categories:
            cat_sum, cat_count = breakdown_map.get(cat, (0.0, 0))
            breakdown.append({
                "category": cat,
                "co2_equivalent": round(cat_sum, 2),
                "percentage": round((cat_sum / (total_all_time or 1e-5)) * 100.0, 1) if total_all_time > 1e-5 else 0.0,
                "logs_count": cat_count
            })

        return {
            "daily_co2": round(daily_co2, 2),
            "weekly_co2": round(weekly_co2, 2),
            "monthly_co2": round(monthly_co2, 2),
            "annual_co2": round(annual_co2, 2),
            "daily_budget": budget,
            "efficiency_rating": rating,
            "category_breakdown": breakdown
        }
