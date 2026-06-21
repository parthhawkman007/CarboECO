from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
import logging
from app.config import settings

logger = logging.getLogger("carboeco")

DATABASE_URL = settings.DATABASE_URL
# Convert to asyncpg if standard postgresql connection string is passed
if DATABASE_URL.startswith("postgresql://"):
    ASYNC_DB_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    ASYNC_DB_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
else:
    ASYNC_DB_URL = DATABASE_URL

SQLITE_FALLBACK_URL = settings.SQLITE_FALLBACK_URL
if SQLITE_FALLBACK_URL.startswith("sqlite:///"):
    ASYNC_SQLITE_URL = SQLITE_FALLBACK_URL.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
else:
    ASYNC_SQLITE_URL = SQLITE_FALLBACK_URL

engine = None
AsyncSessionLocal = None

class Base(DeclarativeBase):
    pass

try:
    if "postgresql" in ASYNC_DB_URL:
        engine = create_async_engine(
            ASYNC_DB_URL,
            pool_size=20,
            max_overflow=10,
            pool_pre_ping=True,
            connect_args={"server_settings": {"statement_timeout": "5000"}}  # 5 second query timeout
        )
        logger.info("Configured PostgreSQL async engine.")
    else:
        raise ValueError("Non-postgres URL, falling back to SQLite.")
except Exception as e:
    logger.warning(f"PostgreSQL async engine configuration failed or fallback active ({e}). Using SQLite async engine.")
    engine = create_async_engine(
        ASYNC_SQLITE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in ASYNC_SQLITE_URL else {}
    )

AsyncSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine, class_=AsyncSession)

async def get_db():
    async with AsyncSessionLocal() as db:
        try:
            yield db
        finally:
            await db.close()
