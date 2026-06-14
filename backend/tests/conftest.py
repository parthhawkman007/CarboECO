import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app, rate_limit_db

# Test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_carboeco.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(name="db_session")
def fixture_db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(name="client")
def fixture_client(db_session):
    rate_limit_db.clear()

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Shared authentication helper
# ---------------------------------------------------------------------------

def get_auth_headers(client: TestClient, email: str, password: str = "pass12345") -> dict[str, str]:
    """Register + login and return an Authorization Bearer header dict.

    This module-level helper is the single source of truth – previously this
    function was copy-pasted verbatim into test_ai.py, test_carbon.py,
    test_extras.py, and test_robustness.py (DRY violation).
    Individual test modules should import this instead of re-declaring it.
    """
    client.post("/api/auth/register", json={"email": email, "password": password})
    response = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(name="make_auth_headers")
def fixture_make_auth_headers(client: TestClient):
    """Fixture-style wrapper for tests that prefer dependency injection."""
    def _make(email: str, password: str = "pass12345") -> dict[str, str]:
        return get_auth_headers(client, email, password)
    return _make
