import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Override DATABASE_URL globally to use SQLite before importing application modules
from app.config import settings
settings.DATABASE_URL = "sqlite:///./test_carboeco.db"

from app.database import Base, get_db
from app.main import app, rate_limit_db


# Sync database URL for test assertions
SYNC_TEST_DB_URL = "sqlite:///./test_carboeco.db"
sync_engine = create_engine(SYNC_TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)

# Async database URL for FastAPI application running in tests
ASYNC_TEST_DB_URL = "sqlite+aiosqlite:///./test_carboeco.db"
async_engine = create_async_engine(ASYNC_TEST_DB_URL, connect_args={"check_same_thread": False})
TestingAsyncSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=async_engine, class_=AsyncSession)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=sync_engine)
    yield
    Base.metadata.drop_all(bind=sync_engine)

@pytest.fixture(autouse=True)
def clean_db():
    # Clean all tables before each test to ensure transaction-like isolation
    with sync_engine.connect() as conn:
        transaction = conn.begin()
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
        transaction.commit()
    yield

@pytest.fixture(name="db_session")
def fixture_db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture(name="client")
def fixture_client():
    rate_limit_db.clear()

    async def override_get_db():
        async with TestingAsyncSessionLocal() as session:
            try:
                yield session
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

# Shared authentication helper
def get_auth_headers(client: TestClient, email: str, password: str = "pass12345") -> dict[str, str]:
    client.post("/api/auth/register", json={"email": email, "password": password})
    response = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(name="make_auth_headers")
def fixture_make_auth_headers(client: TestClient):
    def _make(email: str, password: str = "pass12345") -> dict[str, str]:
        return get_auth_headers(client, email, password)
    return _make


# Mock CacheService for testing without Redis dependency
from app.services.cache import CacheService
import json
import fnmatch

_test_cache = {}

@pytest.fixture(autouse=True)
def mock_cache_service(monkeypatch):
    _test_cache.clear()

    async def mock_get(key: str):
        val = _test_cache.get(key)
        if val is not None:
            return json.loads(val)
        return None

    async def mock_set(key: str, value: any, expire: int = 300):
        _test_cache[key] = json.dumps(value)
        return True

    async def mock_invalidate(key: str):
        _test_cache.pop(key, None)
        return True

    async def mock_invalidate_pattern(pattern: str):
        keys_to_remove = [k for k in _test_cache.keys() if fnmatch.fnmatch(k, pattern)]
        for k in keys_to_remove:
            _test_cache.pop(k, None)
        return True

    async def mock_get_client():
        return None  # Fallback to local process memory

    monkeypatch.setattr(CacheService, "get", mock_get)
    monkeypatch.setattr(CacheService, "set", mock_set)
    monkeypatch.setattr(CacheService, "invalidate", mock_invalidate)
    monkeypatch.setattr(CacheService, "invalidate_pattern", mock_invalidate_pattern)
    monkeypatch.setattr(CacheService, "get_client", mock_get_client)

