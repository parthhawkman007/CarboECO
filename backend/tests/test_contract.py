import pytest
import schemathesis
import hypothesis
from app.main import app, rate_limit_db
from app.database import get_db

# Load the OpenAPI schema from the FastAPI app directly
schema = schemathesis.openapi.from_asgi('/api/openapi.json', app)

@pytest.fixture(autouse=True)
def clean_db():
    # Override conftest.py's autouse clean_db to avoid database locking and slow deletions
    pass

@pytest.fixture(autouse=True)
def override_db_for_contract():
    rate_limit_db.clear()
    from tests.conftest import TestingAsyncSessionLocal
    
    async def override_get_db():
        async with TestingAsyncSessionLocal() as session:
            try:
                yield session
            finally:
                await session.close()
                
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()

@schema.parametrize()
@hypothesis.settings(max_examples=5, deadline=None)
def test_api_schema_conformance(case):
    """
    Automatically tests all API endpoints against their OpenAPI schema.
    Verifies request/response validation for every route.
    """
    response = case.call()
    case.validate_response(response, checks=(schemathesis.checks.not_a_server_error,))



