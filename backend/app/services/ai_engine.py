import numpy as np
import pandas as pd
import os
import joblib
import json
import time
import asyncio
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from datetime import datetime, timedelta, timezone
import logging
from app.models import CarbonLog, UserProfile, AIRecommendation
from app.config import settings

logger = logging.getLogger("carboeco")

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml_models")
os.makedirs(MODELS_DIR, exist_ok=True)

async def upload_to_gcs_if_needed(local_path: str, gcs_blob_name: str):
    bucket_name = os.getenv("GCS_BUCKET_NAME")
    if not bucket_name:
        return
    try:
        from google.cloud import storage
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(gcs_blob_name)
        await asyncio.to_thread(blob.upload_from_filename, local_path)
        logger.info(f"Uploaded {local_path} to GCS bucket {bucket_name}/{gcs_blob_name}")
    except Exception as e:
        logger.warning(f"Failed to upload {local_path} to GCS: {e}")

async def download_from_gcs_if_needed(local_path: str, gcs_blob_name: str) -> bool:
    bucket_name = os.getenv("GCS_BUCKET_NAME")
    if not bucket_name:
        return False
    try:
        from google.cloud import storage
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(gcs_blob_name)
        exists = await asyncio.to_thread(blob.exists)
        if exists:
            await asyncio.to_thread(blob.download_to_filename, local_path)
            logger.info(f"Downloaded {gcs_blob_name} from GCS to {local_path}")
            return True
    except Exception as e:
        logger.warning(f"Failed to download {gcs_blob_name} from GCS: {e}")
    return False

class AIEngine:
    @staticmethod
    def get_model_paths(user_id: int) -> tuple[str, str]:
        model_path = os.path.join(MODELS_DIR, f"user_{user_id}_model.joblib")
        metadata_path = os.path.join(MODELS_DIR, f"user_{user_id}_metadata.json")
        return model_path, metadata_path

    @classmethod
    async def train_user_model(cls, db: AsyncSession, user_id: int) -> dict:
        """
        Asynchronously trains Ridge regression model for the user, persists the model
        and metadata (RMSE, MAE, feature importance, coefficients, drift baseline) to disk.
        """
        # Fetch user profile
        stmt_prof = select(UserProfile).where(UserProfile.user_id == user_id)
        res_prof = await db.execute(stmt_prof)
        profile = res_prof.scalar_one_or_none()
        budget = profile.carbon_budget if profile else 15.0
        streak = float(profile.streak_count if profile else 0)

        # Query all user logs
        stmt_logs = select(CarbonLog.date, CarbonLog.co2_equivalent, CarbonLog.category).where(
            CarbonLog.user_id == user_id
        ).order_by(CarbonLog.date)
        res_logs = await db.execute(stmt_logs)
        logs = res_logs.all()

        model_path, metadata_path = cls.get_model_paths(user_id)

        if not logs or len(logs) < 5:
            # Clean up existing model if database logs deleted/insufficient
            if os.path.exists(model_path):
                os.remove(model_path)
            if os.path.exists(metadata_path):
                os.remove(metadata_path)
            return {}

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
            temp_val = 20.0 - 12.0 * np.cos(2.0 * np.pi * (month_val - 1) / 12.0)
            
            features.append({
                "month_index": float(idx),
                "month_of_year": float(month_val),
                "temp_proxy": float(temp_val),
                "streak_level": float(streak)
            })

        X = pd.DataFrame(features)
        y = monthly_df['co2']

        # Construct and fit standard scaling regression pipeline using Gradient Boosting
        pipeline = Pipeline([
            ('scaler', StandardScaler()),
            ('regressor', GradientBoostingRegressor(n_estimators=100, random_state=42))
        ])
        await asyncio.to_thread(pipeline.fit, X, y)

        # Compute training metrics
        y_pred = await asyncio.to_thread(pipeline.predict, X)
        rmse = float(np.sqrt(mean_squared_error(y, y_pred))) if len(y) > 1 else 0.0
        mae = float(mean_absolute_error(y, y_pred)) if len(y) > 1 else 0.0

        # Extract model coefficients/importances as feature importances
        importances = pipeline.named_steps['regressor'].feature_importances_
        feature_names = X.columns
        coef_dict = {feature_names[i]: round(float(importances[i]), 3) for i in range(len(importances))}

        # Calculate category breakdown weights
        cat_sums = df.groupby('category')['co2'].sum()
        total_co2 = cat_sums.sum()
        feature_importance = {cat: round((val / (total_co2 or 1e-5)) * 100.0, 1) for cat, val in cat_sums.items()}

        # Save model pipeline
        await asyncio.to_thread(joblib.dump, pipeline, model_path)
        await upload_to_gcs_if_needed(model_path, f"user_{user_id}_model.joblib")

        # Baseline drift calculation parameters: all-time logs mean & std dev
        historical_mean = float(df['co2'].mean())
        historical_std = float(df['co2'].std()) if len(df) > 1 else 0.0

        metadata = {
            "user_id": user_id,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "model_version": int(time.time()),
            "rmse": round(rmse, 4),
            "mae": round(mae, 4),
            "historical_mean": round(historical_mean, 4),
            "historical_std": round(historical_std, 4),
            "model_coefficients": coef_dict,
            "feature_importance": feature_importance,
            "features_baseline": X.mean().to_dict()
        }

        def write_metadata():
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=4)

        await asyncio.to_thread(write_metadata)
        await upload_to_gcs_if_needed(metadata_path, f"user_{user_id}_metadata.json")

        logger.info(f"Successfully trained and persisted model for user {user_id}. RMSE: {rmse:.4f}")
        return metadata

    @classmethod
    async def forecast_footprint(cls, db: AsyncSession, user_id: int) -> dict:
        """
        Loads user model and predicts future 12-month carbon footprint trends.
        If no model is cached, it triggers a training pass.
        Detects data distribution drifts and returns explainable AI outputs.
        """
        model_path, metadata_path = cls.get_model_paths(user_id)
        
        # Try downloading model/metadata from GCS if not present locally
        if not os.path.exists(model_path):
            await download_from_gcs_if_needed(model_path, f"user_{user_id}_model.joblib")
        if not os.path.exists(metadata_path):
            await download_from_gcs_if_needed(metadata_path, f"user_{user_id}_metadata.json")

        # Trigger training in background on-the-fly if files don't exist
        if not os.path.exists(model_path) or not os.path.exists(metadata_path):
            from app.database import AsyncSessionLocal
            async def run_bg():
                async with AsyncSessionLocal() as bg_db:
                    try:
                        await cls.train_user_model(bg_db, user_id)
                    except Exception as ex:
                        logger.error(f"Background training failed: {ex}")
            asyncio.create_task(run_bg())

        # Fetch profile
        stmt_prof = select(UserProfile).where(UserProfile.user_id == user_id)
        res_prof = await db.execute(stmt_prof)
        profile = res_prof.scalar_one_or_none()
        budget = profile.carbon_budget if profile else 15.0
        streak = float(profile.streak_count if profile else 0)

        # If still no model, return general project baseline
        if not os.path.exists(model_path) or not os.path.exists(metadata_path):
            months = [datetime.now().strftime("%b %Y")]
            for i in range(1, 12):
                months.append((datetime.now() + timedelta(days=30 * i)).strftime("%b %Y"))
            baseline = (budget * 30.0) * 1.1
            predictions = [round(baseline * (0.97 ** i), 2) for i in range(12)]
            
            return {
                "forecast": predictions,
                "months": months,
                "confidence_interval": [round(p * 0.15, 2) for p in predictions],
                "explanation": "Using general baseline projections. Once you log at least 5 activities, your personalized regression models will activate.",
                "feature_importance": {"transportation": 40.0, "energy": 35.0, "food": 15.0, "waste": 5.0, "shopping": 3.0, "digital": 2.0},
                "model_coefficients": {"month_index": -1.2, "seasonality": 0.5, "temp_proxy": 0.8, "streak_level": -0.4},
                "metrics": {"rmse": 0.0, "mae": 0.0},
                "drift_detected": False
            }

        # Load persisted model pipeline & metadata in separate thread
        try:
            pipeline = await asyncio.to_thread(joblib.load, model_path)
            def load_metadata():
                with open(metadata_path, 'r') as f:
                    return json.load(f)
            metadata = await asyncio.to_thread(load_metadata)
        except Exception as e:
            logger.error(f"Error loading model assets: {e}. Triggering re-training in background.")
            from app.database import AsyncSessionLocal
            async def run_bg():
                async with AsyncSessionLocal() as bg_db:
                    try:
                        await cls.train_user_model(bg_db, user_id)
                    except Exception as ex:
                        logger.error(f"Background re-training failed: {ex}")
            asyncio.create_task(run_bg())
            
            months = [datetime.now().strftime("%b %Y")]
            for i in range(1, 12):
                months.append((datetime.now() + timedelta(days=30 * i)).strftime("%b %Y"))
            baseline = (budget * 30.0) * 1.1
            predictions = [round(baseline * (0.97 ** i), 2) for i in range(12)]
            
            return {
                "forecast": predictions,
                "months": months,
                "confidence_interval": [round(p * 0.15, 2) for p in predictions],
                "explanation": "Model loading failed. Re-training has been scheduled in the background. Using general baseline projections for now.",
                "feature_importance": {"transportation": 40.0, "energy": 35.0, "food": 15.0, "waste": 5.0, "shopping": 3.0, "digital": 2.0},
                "model_coefficients": {"month_index": -1.2, "seasonality": 0.5, "temp_proxy": 0.8, "streak_level": -0.4},
                "metrics": {"rmse": 0.0, "mae": 0.0},
                "drift_detected": False
            }

        # Check for model drift (using last 7 days of logs compared to historical mean)
        seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
        stmt_recent = select(CarbonLog.co2_equivalent).where(
            CarbonLog.user_id == user_id,
            CarbonLog.date >= seven_days_ago
        )
        res_recent = await db.execute(stmt_recent)
        recent_logs = res_recent.scalars().all()

        drift_detected = False
        drift_message = ""
        historical_mean = metadata.get("historical_mean", 0.0)
        historical_std = metadata.get("historical_std", 0.0)

        if recent_logs and len(recent_logs) >= 3 and historical_std > 0.01:
            recent_mean = float(np.mean(recent_logs))
            # Flag drift if current 7-day average deviates by more than 2 standard deviations
            z_score = (recent_mean - historical_mean) / historical_std
            if abs(z_score) > 2.0:
                drift_detected = True
                if z_score > 0:
                    drift_message = f"Warning: Your carbon habits have shifted upwards significantly (Z-score: {z_score:.2f}). Check your transport/utility sectors!"
                else:
                    drift_message = f"Excellent: Your carbon footprint has drifted significantly downwards below your baseline (Z-score: {z_score:.2f})!"

        # Extract coefficients
        coef_dict = metadata.get("model_coefficients", {})
        feature_importance = metadata.get("feature_importance", {})

        # Predict next 12 months
        current_date = datetime.now()
        future_features = []
        future_months = []
        
        # Load all user logs to count months for projecting indexes
        stmt_count = select(func.count(CarbonLog.id)).where(CarbonLog.user_id == user_id)
        res_count = await db.execute(stmt_count)
        logs_count = res_count.scalar() or 0
        last_index = max(1, logs_count // 5)

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
        predictions = await asyncio.to_thread(pipeline.predict, X_future)
        predictions = np.clip(predictions, a_min=10.0, a_max=None)

        # Generate Explainable AI output string
        slope = coef_dict.get("month_index", 0.0)
        temp_effect = coef_dict.get("temp_proxy", 0.0)
        streak_effect = coef_dict.get("streak_level", 0.0)

        explanation_parts = []
        if slope < 0:
            explanation_parts.append(f"Emissions are on a downward trend, dropping by {abs(slope):.2f} kg (scaled) monthly.")
        else:
            explanation_parts.append(f"Emissions are trending upward by {abs(slope):.2f} kg (scaled) monthly.")

        if abs(temp_effect) > 0.1:
            explanation_parts.append(f"Weather seasonality influences electricity/heating demand by {abs(temp_effect):.2f} kg.")

        if streak_effect < 0:
            explanation_parts.append(f"Maintaining your green habit streak helps lower emissions by {abs(streak_effect):.2f} kg.")

        if drift_message:
            explanation_parts.append(drift_message)
        else:
            explanation_parts.append("Your carbon habits are currently in line with historical baselines.")

        explanation = " ".join(explanation_parts)

        # Confidence interval (historical RMSE)
        rmse = metadata.get("rmse", 5.0)
        confidence = [round(float(rmse), 2) for _ in predictions]

        return {
            "forecast": [round(float(p), 2) for p in predictions],
            "months": future_months,
            "confidence_interval": confidence,
            "explanation": explanation,
            "feature_importance": feature_importance,
            "model_coefficients": coef_dict,
            "metrics": {
                "rmse": metadata.get("rmse"),
                "mae": metadata.get("mae"),
                "model_version": metadata.get("model_version"),
                "trained_at": metadata.get("trained_at")
            },
            "drift_detected": drift_detected
        }

    @staticmethod
    async def calculate_risk_and_goal_probability(db: AsyncSession, user_id: int) -> dict:
        """
        Uses mean/standard deviation to calculate the probability of achieving budget goals,
        and flags high-risk carbon behaviors.
        """
        profile_stmt = select(UserProfile).where(UserProfile.user_id == user_id)
        profile_res = await db.execute(profile_stmt)
        profile = profile_res.scalar_one_or_none()
        budget = profile.carbon_budget if profile else 15.0

        # Query last 30 days logs
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        stmt_logs = select(CarbonLog.co2_equivalent).where(
            CarbonLog.user_id == user_id,
            CarbonLog.date >= thirty_days_ago
        )
        logs_res = await db.execute(stmt_logs)
        logs = logs_res.scalars().all()

        if not logs or len(logs) < 3:
            return {
                "goal_probability": 0.50,
                "risk_behaviors": ["Insufficient logging history to assess risk. Start tracking daily."],
                "daily_mean": 0.0,
                "daily_std": 0.0
            }

        emissions = np.array(logs)
        mean_em = emissions.mean()
        std_em = emissions.std() if len(emissions) > 1 else 0.0

        if std_em < 0.01:
            probability = 1.0 if mean_em <= budget else 0.0
        else:
            z_score = (budget - mean_em) / std_em
            probability = float(0.5 * (1.0 + np.erf(z_score / np.sqrt(2.0))))

        probability = float(np.clip(probability, 0.01, 0.99))

        # Risk behaviors detection
        risk_behaviors = []
        
        stmt_risk = select(CarbonLog).where(
            CarbonLog.user_id == user_id,
            CarbonLog.date >= thirty_days_ago,
            CarbonLog.category.in_(["transportation", "food", "energy"])
        )
        risk_res = await db.execute(stmt_risk)
        risk_logs = risk_res.scalars().all()
        
        transport_logs = [l for l in risk_logs if l.category == "transportation"]
        meat_logs = [l for l in risk_logs if l.category == "food" and l.subcategory in ("beef", "lamb")]
        electric_logs = [l for l in risk_logs if l.category == "energy" and l.subcategory == "electricity"]

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
