from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import logging
from app.config import settings

logger = logging.getLogger("carboeco")

# Determine engine URL: try PostgreSQL first, fallback to SQLite if connection fails
DATABASE_URL = settings.DATABASE_URL
engine = None
SessionLocal = None

try:
    if DATABASE_URL.startswith("postgresql"):
        engine = create_engine(
            DATABASE_URL,
            pool_size=20,
            max_overflow=10,
            pool_pre_ping=True
        )
        # Try to connect to ensure it's up
        with engine.connect() as conn:
            pass
        logger.info("Successfully connected to PostgreSQL database.")
    else:
        raise ValueError("Non-postgres URL, falling back to SQLite.")
except Exception as e:
    logger.warning(f"PostgreSQL connection failed or not configured ({e}). Falling back to SQLite.")
    engine = create_engine(
        settings.SQLITE_FALLBACK_URL,
        connect_args={"check_same_thread": False} if settings.SQLITE_FALLBACK_URL.startswith("sqlite") else {}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
