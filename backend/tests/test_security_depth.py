from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy.orm import Session

from app.auth.auth import create_refresh_token
from app.config import settings
from app.models import CarbonLog, RefreshToken, User
from tests.conftest import get_auth_headers


def register_and_login(client: TestClient, email: str, password: str = "securepass123"):
    """Register and return the raw login response (needed for cookie tests)."""
    client.post("/api/auth/register", json={"email": email, "password": password})
    return client.post("/api/auth/login", data={"username": email, "password": password})


def auth_headers(client: TestClient, email: str, password: str = "securepass123") -> dict[str, str]:
    """Return Bearer header dict – thin wrapper over the shared conftest helper."""
    return get_auth_headers(client, email, password)


def test_refresh_token_expiration_removes_stale_token(client: TestClient, db_session: Session):
    register_and_login(client, "expired_refresh@carboeco.org")
    user = db_session.query(User).filter(User.email == "expired_refresh@carboeco.org").first()
    token = create_refresh_token(db_session, user.id)
    db_token = db_session.query(RefreshToken).filter(RefreshToken.token == token).first()
    db_token.expires_at = datetime.utcnow() - timedelta(seconds=1)
    db_session.commit()

    response = client.post("/api/auth/refresh", cookies={"refresh_token": token})

    assert response.status_code == 401
    assert db_session.query(RefreshToken).filter(RefreshToken.token == token).first() is None


def test_access_token_without_subject_is_rejected(client: TestClient):
    token = jwt.encode({"exp": datetime.utcnow() + timedelta(minutes=5)}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    response = client.get("/api/carbon/logs", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_inactive_user_cannot_access_authenticated_api(client: TestClient, db_session: Session):
    login = register_and_login(client, "inactive@carboeco.org")
    user = db_session.query(User).filter(User.email == "inactive@carboeco.org").first()
    user.is_active = False
    db_session.commit()

    response = client.get(
        "/api/carbon/logs",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"}
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Inactive user"


def test_user_cannot_delete_another_users_carbon_log(client: TestClient, db_session: Session):
    owner_headers = auth_headers(client, "owner@carboeco.org")
    attacker_headers = auth_headers(client, "attacker@carboeco.org")
    created = client.post(
        "/api/carbon/logs",
        headers=owner_headers,
        json={"date": "2026-06-13", "category": "digital", "subcategory": "browsing", "value": 2, "unit": "hours"},
    )
    log_id = created.json()["id"]

    response = client.delete(f"/api/carbon/logs/{log_id}", headers=attacker_headers)

    assert response.status_code == 404
    assert db_session.query(CarbonLog).filter(CarbonLog.id == log_id).first() is not None


def test_security_headers_are_present(client: TestClient):
    response = client.get("/api/health")

    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    # Permissions-Policy header added in audit (camera, microphone, geolocation restricted)
    assert "permissions-policy" in response.headers
    assert "camera=()" in response.headers["permissions-policy"]


def test_payload_size_limit_rejects_oversized_requests(client: TestClient):
    response = client.post(
        "/api/auth/register",
        headers={"content-length": str(1024 * 1024 + 1)},
        json={"email": "oversized@carboeco.org", "password": "securepass123"},
    )

    assert response.status_code == 413


def test_invalid_calendar_date_is_rejected(client: TestClient):
    headers = auth_headers(client, "invalid_date@carboeco.org")

    response = client.post(
        "/api/carbon/logs",
        headers=headers,
        json={"date": "2026-02-30", "category": "food", "subcategory": "vegan", "value": 1, "unit": "kg"},
    )

    assert response.status_code == 422


def test_hsts_header_present_in_production_mode(client: TestClient):
    """When ENV=production the HSTS header must be set to enforce HTTPS for 1 year."""
    from unittest.mock import patch
    from app import main as app_main

    with patch.object(app_main.settings, "ENV", "production"):
        response = client.get("/api/health")

    assert "strict-transport-security" in response.headers
    assert "max-age=31536000" in response.headers["strict-transport-security"]
    assert "includeSubDomains" in response.headers["strict-transport-security"]


def test_xss_content_injection_attempt_rejected(client: TestClient):
    """A forged email with XSS payload must be rejected at schema validation (422)."""
    response = client.post(
        "/api/auth/register",
        json={"email": "<script>alert(1)</script>@evil.com", "password": "password123"},
    )
    assert response.status_code == 422


def test_production_mode_requires_secure_key():
    """When ENV=production and SECRET_KEY is the default insecure key, Settings instantiation must fail."""
    from pydantic import ValidationError
    from app.config import Settings
    import pytest

    with pytest.raises(ValidationError) as excinfo:
        Settings(ENV="production", SECRET_KEY="super-secure-carboeco-secret-key-change-in-production-123456")
    
    assert "Insecure default SECRET_KEY is not allowed in production mode" in str(excinfo.value)
