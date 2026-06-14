from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
import logging
from app.config import settings
from app.models import CarbonLog, UserProfile, UserAchievement, Achievement, DigitalTwinState
from app.schemas import CarbonLogCreate

logger = logging.getLogger("carboeco")

class CarbonService:
    @staticmethod
    def calculate_emissions(category: str, subcategory: str, value: float) -> tuple[float, str]:
        """
        Calculates carbon emissions in kg CO2e and returns a tuple (emissions, explanation).
        """
        cat = category.lower()
        sub = subcategory.lower()

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
                co2 = value * settings.EF_ELECTRICITY_GRID
                explanation = f"Consuming {value} kWh of grid electricity emitted {co2:.2f} kg CO2e. Switch to energy-saving appliances or green tariffs."
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
    def add_carbon_log(cls, db: Session, user_id: int, log_in: CarbonLogCreate) -> CarbonLog:
        co2_equivalent, explanation = cls.calculate_emissions(log_in.category, log_in.subcategory, log_in.value)

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
        db.flush()

        # Update profile stats (XP, streaks)
        cls.update_user_stats(db, user_id, log_in.date)

        # Update Digital Twin energy efficiency score
        cls.update_digital_twin_score(db, user_id)

        # Award Achievements
        cls.check_achievements(db, user_id)

        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def update_user_stats(db: Session, user_id: int, log_date_str: str):
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
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

        db.flush()

    @staticmethod
    def update_digital_twin_score(db: Session, user_id: int):
        # Fetch digital twin
        twin = db.query(DigitalTwinState).filter(DigitalTwinState.user_id == user_id).first()
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not twin or not profile:
            return

        # Fetch last 7 days of emissions
        today = datetime.now(timezone.utc)
        seven_days_ago = (today - timedelta(days=7)).strftime("%Y-%m-%d")
        
        logs = db.query(CarbonLog).filter(
            CarbonLog.user_id == user_id,
            CarbonLog.date >= seven_days_ago
        ).all()

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
        # Growth Stage: 1 to 5
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
        db.flush()

    @staticmethod
    def check_achievements(db: Session, user_id: int):
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not profile:
            return

        # Get existing achievement codes
        unlocked = db.query(Achievement.badge_code).join(
            UserAchievement, UserAchievement.achievement_id == Achievement.id
        ).filter(UserAchievement.user_id == user_id).all()
        unlocked_codes = {item[0] for item in unlocked}

        def unlock(code: str):
            if code in unlocked_codes:
                return
            ach = db.query(Achievement).filter(Achievement.badge_code == code).first()
            if ach:
                ua = UserAchievement(user_id=user_id, achievement_id=ach.id)
                db.add(ua)
                profile.xp += ach.xp_reward
                db.flush()

        # 1. First Log
        logs_count = db.query(func.count(CarbonLog.id)).filter(CarbonLog.user_id == user_id).scalar()
        if logs_count >= 1:
            unlock("first_log")

        # 2. Transit Master
        transit_count = db.query(func.count(CarbonLog.id)).filter(
            CarbonLog.user_id == user_id,
            CarbonLog.category == "transportation",
            CarbonLog.subcategory.in_(["metro", "bus", "train"])
        ).scalar()
        if transit_count >= 5:
            unlock("transit_master")

        # 3. Green Eater
        vegan_count = db.query(func.count(CarbonLog.id)).filter(
            CarbonLog.user_id == user_id,
            CarbonLog.category == "food",
            CarbonLog.subcategory.in_(["vegan", "vegetarian"])
        ).scalar()
        if vegan_count >= 5:
            unlock("green_eater")

        # 4. Zero Waste
        recycling_count = db.query(func.count(CarbonLog.id)).filter(
            CarbonLog.user_id == user_id,
            CarbonLog.category == "waste",
            CarbonLog.subcategory == "recycled"
        ).scalar()
        if recycling_count >= 5:
            unlock("zero_waste")

        # 5. Streak badges
        if profile.streak_count >= 3:
            unlock("streak_3")
        if profile.streak_count >= 7:
            unlock("streak_7")

    @classmethod
    def get_dashboard_summary(cls, db: Session, user_id: int) -> dict:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        budget = profile.carbon_budget if profile else 15.0

        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        yesterday_str = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Calculate daily emissions (today)
        daily_co2 = db.query(func.sum(CarbonLog.co2_equivalent)).filter(
            CarbonLog.user_id == user_id,
            CarbonLog.date == today_str
        ).scalar() or 0.0

        # Calculate weekly emissions (last 7 days)
        seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
        weekly_co2 = db.query(func.sum(CarbonLog.co2_equivalent)).filter(
            CarbonLog.user_id == user_id,
            CarbonLog.date >= seven_days_ago
        ).scalar() or 0.0

        # Calculate monthly emissions (last 30 days)
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        monthly_co2 = db.query(func.sum(CarbonLog.co2_equivalent)).filter(
            CarbonLog.user_id == user_id,
            CarbonLog.date >= thirty_days_ago
        ).scalar() or 0.0

        # Calculate annual emissions (last 365 days)
        three_sixty_five_days_ago = (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%d")
        annual_co2 = db.query(func.sum(CarbonLog.co2_equivalent)).filter(
            CarbonLog.user_id == user_id,
            CarbonLog.date >= three_sixty_five_days_ago
        ).scalar() or 0.0

        # Efficiency rating calculation:
        # daily budget comparison
        # Let's say if daily_co2 <= budget * 0.7: A+
        # If daily_co2 <= budget: A
        # If daily_co2 <= budget * 1.2: B
        # If daily_co2 <= budget * 1.5: C
        # Else: F
        # But if no logs exist yet today, check weekly average
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

        # Category Breakdown
        categories = ["transportation", "energy", "food", "waste", "shopping", "digital"]
        breakdown = []
        total_all_time = db.query(func.sum(CarbonLog.co2_equivalent)).filter(
            CarbonLog.user_id == user_id
        ).scalar() or 1e-5  # avoid division by zero

        for cat in categories:
            cat_sum = db.query(func.sum(CarbonLog.co2_equivalent)).filter(
                CarbonLog.user_id == user_id,
                CarbonLog.category == cat
            ).scalar() or 0.0
            
            cat_count = db.query(func.count(CarbonLog.id)).filter(
                CarbonLog.user_id == user_id,
                CarbonLog.category == cat
            ).scalar() or 0

            breakdown.append({
                "category": cat,
                "co2_equivalent": round(cat_sum, 2),
                "percentage": round((cat_sum / total_all_time) * 100.0, 1) if total_all_time > 1e-5 else 0.0,
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
