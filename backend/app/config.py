import os
import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator, model_validator

logger = logging.getLogger("carboeco")

_INSECURE_DEFAULT_KEY = "super-secure-carboeco-secret-key-change-in-production-123456"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "CarboECO"
    ENV: str = "development"
    SECRET_KEY: str = Field(_INSECURE_DEFAULT_KEY, validation_alias="SECRET_KEY")
    GEMINI_API_KEY: str | None = Field(None, validation_alias="GEMINI_API_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    COOKIE_SECURE: bool = Field(False, validation_alias="COOKIE_SECURE")
    COOKIE_SAMESITE: str = Field("lax", validation_alias="COOKIE_SAMESITE")

    # Database
    DATABASE_URL: str = Field("postgresql://postgres:postgres@localhost:5432/carboeco", validation_alias="DATABASE_URL")
    SQLITE_FALLBACK_URL: str = "sqlite:///./carboeco_dev.db"

    # Redis Cache
    REDIS_URL: str = Field("redis://localhost:6379/0", validation_alias="REDIS_URL")

    # Rate Limiting
    RATE_LIMIT_CALLS: int = 100
    RATE_LIMIT_PERIOD_SEC: int = 60

    # Carbon Emission Factors (in kg CO2e per unit)
    # Transportation (per km)
    EF_CAR_PETROL: float = 0.18
    EF_CAR_DIESEL: float = 0.17
    EF_CAR_ELECTRIC: float = 0.05
    EF_MOTORCYCLE: float = 0.10
    EF_METRO: float = 0.03
    EF_BUS: float = 0.05
    EF_FLIGHT_SHORT: float = 0.25  # < 1500 km
    EF_FLIGHT_LONG: float = 0.15   # >= 1500 km

    # Utilities (Electricity in kWh, Gas in kWh, Water in Liters)
    EF_ELECTRICITY_GRID: float = 0.42  # kg CO2e per kWh
    EF_GAS: float = 0.20                # kg CO2e per kWh
    EF_WATER: float = 0.0003            # kg CO2e per liter

    # Food (per kg)
    EF_FOOD_BEEF: float = 27.0
    EF_FOOD_PORK_POULTRY: float = 6.0
    EF_FOOD_DAIRY: float = 3.0
    EF_FOOD_VEGETARIAN: float = 1.2
    EF_FOOD_VEGAN: float = 0.5

    # Waste (per kg)
    EF_WASTE_LANDFILL: float = 1.2
    EF_WASTE_RECYCLED: float = 0.1
    EF_WASTE_COMPOSTED: float = 0.2

    # Shopping (per USD spent)
    EF_SHOPPING_CLOTHING: float = 0.4
    EF_SHOPPING_ELECTRONICS: float = 0.8
    EF_SHOPPING_MISC: float = 0.2

    # Digital (per hour/query)
    EF_DIGITAL_STREAMING: float = 0.05  # per hour
    EF_DIGITAL_BROWSING: float = 0.02   # per hour
    EF_DIGITAL_AI_QUERY: float = 0.005  # per query

    @model_validator(mode="after")
    def verify_secure_key(self) -> 'Settings':
        if self.ENV == "production" and self.SECRET_KEY == _INSECURE_DEFAULT_KEY:
            import secrets
            logger.warning("Insecure default SECRET_KEY detected in production. Generating dynamic session key.")
            self.SECRET_KEY = secrets.token_hex(32)
        return self

settings = Settings()

