import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
import logging
from app.models import CarbonLog, UserProfile, AIRecommendation
from app.config import settings

logger = logging.getLogger("carboeco")

class AIEngine:
    @staticmethod
    def forecast_footprint(db: Session, user_id: int) -> dict:
        """
        Predicts future 12-month carbon footprint trends using a multi-variate scikit-learn
        preprocessing pipeline (StandardScaler + Ridge Regression) fitted on user's history.
        Features include trend index, seasonality indicators, simulated regional weather proxies, and user streaks.
        """
        # Fetch user profile
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        budget = profile.carbon_budget if profile else 15.0
        streak = float(profile.streak_count if profile else 0)

        # Query all user logs
        logs = db.query(CarbonLog.date, CarbonLog.co2_equivalent, CarbonLog.category).filter(
            CarbonLog.user_id == user_id
        ).order_by(CarbonLog.date).all()

        if not logs or len(logs) < 5:
            # Not enough data for custom regression, generate seed simulation
            months = [f"Month {i+1}" for i in range(12)]
            # Slight downward trend based on active tracking
            baseline = (budget * 30.0) * 1.1  # slightly above budget initially
            predictions = []
            for i in range(12):
                decay = baseline * (0.97 ** i) # 3% reduction per month
                predictions.append(round(decay, 2))
            
            return {
                "forecast": predictions,
                "months": months,
                "confidence_interval": [round(p * 0.15, 2) for p in predictions],
                "explanation": "Using general baseline projections. Once you log at least 5 activities, your personalized regression models will activate.",
                "feature_importance": {"transportation": 40.0, "energy": 35.0, "food": 15.0, "waste": 5.0, "shopping": 3.0, "digital": 2.0},
                "model_coefficients": {"month_index": -1.2, "seasonality": 0.5, "temp_proxy": 0.8, "streak_level": -0.4}
            }

        # Load logs into DataFrame
        df = pd.DataFrame([{"date": log[0], "co2": log[1], "category": log[2]} for log in logs])
        df['date'] = pd.to_datetime(df['date'])
        
        # Aggregate monthly
        monthly_df = df.groupby(df['date'].dt.to_period('M')).agg({
            'co2': 'sum',
            'category': 'count'
        }).reset_index()

        monthly_df['month_index'] = np.arange(len(monthly_df))

        # Engineer features
        features = []
        for idx, row in monthly_df.iterrows():
            month_dt = row['date'].to_timestamp()
            month_val = month_dt.month
            # Simulating temperature proxy: high in summer, low in winter
            temp_val = 20.0 - 12.0 * np.cos(2.0 * np.pi * (month_val - 1) / 12.0)
            
            features.append({
                "month_index": float(idx),
                "month_of_year": float(month_val),
                "temp_proxy": float(temp_val),
                "streak_level": float(streak)
            })

        X = pd.DataFrame(features)
        y = monthly_df['co2']

        # Construct and fit standard scaling regression pipeline
        pipeline = Pipeline([
            ('scaler', StandardScaler()),
            ('regressor', Ridge(alpha=1.0))
        ])
        pipeline.fit(X, y)

        # Forecast next 12 months
        last_index = monthly_df['month_index'].max() if not monthly_df.empty else 0
        current_date = datetime.now()
        
        future_features = []
        future_months = []
        for i in range(1, 13):
            future_date = current_date + timedelta(days=30 * i)
            future_month = future_date.month
            temp_val = 20.0 - 12.0 * np.cos(2.0 * np.pi * (future_month - 1) / 12.0)
            
            future_features.append({
                "month_index": float(last_index + i),
                "month_of_year": float(future_month),
                "temp_proxy": float(temp_val),
                "streak_level": float(streak)
            })
            future_months.append(future_date.strftime("%b %Y"))

        X_future = pd.DataFrame(future_features)
        predictions = pipeline.predict(X_future)
        
        # Ensure no negative emissions
        predictions = np.clip(predictions, a_min=10.0, a_max=None)

        # Extract model coefficients as feature importances
        coefs = pipeline.named_steps['regressor'].coef_
        feature_names = X.columns
        coef_dict = {feature_names[i]: round(float(coefs[i]), 3) for i in range(len(coefs))}

        # Calculate category breakdown weights
        cat_sums = df.groupby('category')['co2'].sum()
        total_co2 = cat_sums.sum()
        feature_importance = {cat: round((val / total_co2) * 100.0, 1) for cat, val in cat_sums.items()}

        # Explanation generation based on index coefficient
        slope = coef_dict.get("month_index", 0.0)
        if slope < 0:
            trend_str = "decreasing"
            action_str = "Great job! Keep doing what you are doing to sustain this trajectory."
        else:
            trend_str = "increasing"
            action_str = "Warning: Consider adjusting your transport and energy habits to reverse this upward trend."

        explanation = f"Your carbon emissions are currently {trend_str} by {abs(slope):.2f} units (scaled) per month. {action_str}"

        # Confidence interval estimation (RMSE of historical vs predictions)
        y_pred = pipeline.predict(X)
        rmse = np.sqrt(np.mean((y - y_pred) ** 2)) if len(y) > 1 else (y.mean() * 0.1)
        confidence = [round(float(rmse), 2) for _ in predictions]

        return {
            "forecast": [round(float(p), 2) for p in predictions],
            "months": future_months,
            "confidence_interval": confidence,
            "explanation": explanation,
            "feature_importance": feature_importance,
            "model_coefficients": coef_dict
        }

    @staticmethod
    def calculate_risk_and_goal_probability(db: Session, user_id: int) -> dict:
        """
        Uses mean/standard deviation to calculate the probability of achieving budget goals,
        and flags high-risk carbon behaviors.
        """
        # Fetch user profile
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        budget = profile.carbon_budget if profile else 15.0

        # Query last 30 days logs – single round-trip
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        logs = db.query(CarbonLog.co2_equivalent).filter(
            CarbonLog.user_id == user_id,
            CarbonLog.date >= thirty_days_ago
        ).all()

        if not logs or len(logs) < 3:
            return {
                "goal_probability": 0.50,  # 50% default
                "risk_behaviors": ["Insufficient logging history to assess risk. Start tracking daily."],
                "daily_mean": 0.0,
                "daily_std": 0.0
            }

        # Convert to numpy array
        emissions = np.array([log[0] for log in logs])
        mean_em = emissions.mean()
        std_em = emissions.std() if len(emissions) > 1 else 0.0

        # Goal probability: P(Emissions <= Budget)
        # Using cumulative distribution function of normal distribution
        if std_em < 0.01:
            # Zero variance
            probability = 1.0 if mean_em <= budget else 0.0
        else:
            z_score = (budget - mean_em) / std_em
            # Approx CDF
            probability = 0.5 * (1.0 + np.erf(z_score / np.sqrt(2.0)))

        # Clamp between 0.01 and 0.99
        probability = float(np.clip(probability, 0.01, 0.99))

        # Risk behaviors detection
        risk_behaviors = []
        
        # Batch-load transport/meat/electric logs in ONE query to avoid N+1
        risk_logs = db.query(CarbonLog).filter(
            CarbonLog.user_id == user_id,
            CarbonLog.date >= thirty_days_ago,
            CarbonLog.category.in_(["transportation", "food", "energy"])
        ).all()
        
        transport_logs = [l for l in risk_logs if l.category == "transportation"]
        meat_logs = [
            l for l in risk_logs
            if l.category == "food" and l.subcategory in ("beef", "lamb")
        ]
        electric_logs = [
            l for l in risk_logs
            if l.category == "energy" and l.subcategory == "electricity"
        ]

        petrol_km = sum(
            log.value for log in transport_logs
            if "petrol" in log.subcategory.lower() or "diesel" in log.subcategory.lower()
        )
        if petrol_km > 200:
            risk_behaviors.append(
                f"High reliance on combustion engines ({petrol_km:.0f} km in last 30 days). "
                "Driving is your largest carbon risk."
            )

        meat_kg = sum(log.value for log in meat_logs)
        if meat_kg > 5.0:
            risk_behaviors.append(
                f"High red meat intake ({meat_kg:.1f} kg beef/lamb in last 30 days). "
                "Consider Meatless Mondays to drop food impact."
            )

        elec_kwh = sum(log.value for log in electric_logs)
        if elec_kwh > 300:
            risk_behaviors.append(
                f"Electricity consumption of {elec_kwh:.0f} kWh in 30 days "
                "exceeds average carbon-efficient household targets."
            )

        if not risk_behaviors:
            risk_behaviors.append("No high-risk behaviors identified! You are tracking in line with sustainable levels.")

        return {
            "goal_probability": round(probability, 2),
            "risk_behaviors": risk_behaviors,
            "daily_mean": round(float(mean_em), 2),
            "daily_std": round(float(std_em), 2)
        }
