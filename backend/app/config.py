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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # 15 minutes
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    COOKIE_SECURE: bool = Field(False, validation_alias="COOKIE_SECURE")
    COOKIE_SAMESITE: str = Field("strict", validation_alias="COOKIE_SAMESITE")

    ELECTRICITY_MAPS_API_KEY: str | None = Field(None, validation_alias="ELECTRICITY_MAPS_API_KEY")
    ELECTRICITY_MAPS_BASE_URL: str = "https://api.electricitymap.org/v3"

    # Global Summary Base Stats (aggregate baseline from pre-launch data)
    GLOBAL_CO2_BASE: float = 14805492.4
    GLOBAL_ACTIVE_CITIZENS_BASE: int = 34182
    GLOBAL_MISSIONS_BASE: int = 118504
    GLOBAL_CO2_PER_LOG_ESTIMATE: float = 2.5  # estimated kg saved per log

    # Metrics authentication
    METRICS_USER: str = "prometheus"
    METRICS_PASSWORD: str = Field("super-secure-metrics-password-123", validation_alias="METRICS_PASSWORD")

    # Database
    DATABASE_URL: str = Field("postgresql://postgres:postgres@localhost:5432/carboeco", validation_alias="DATABASE_URL")
    SQLITE_FALLBACK_URL: str = "sqlite:///./carboeco_dev.db"

    # Trusted Proxies for X-Forwarded-For protection
    TRUSTED_PROXIES: list[str] = ["127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]

    # Region-specific carbon intensity (in kg CO2e per kWh for Electricity)
    GRID_INTENSITY_BY_REGION: dict[str, float] = {
        "IN": 0.82,
        "US": 0.38,
        "EU": 0.25,
        "FR": 0.05,
        "GL": 0.42
    }

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
    def verify_production_settings(self) -> 'Settings':
        if self.ENV.lower() == "production":
            if self.SECRET_KEY == _INSECURE_DEFAULT_KEY or not self.SECRET_KEY:
                raise ValueError("Insecure default SECRET_KEY is not allowed in production mode.")
            if self.REDIS_URL and self.REDIS_URL.startswith("redis://"):
                import logging
                logging.getLogger("carboeco").warning(
                    "WARNING: Redis is configured without TLS (redis://). Use rediss:// in production for encrypted connections."
                )
        return self

settings = Settings()

