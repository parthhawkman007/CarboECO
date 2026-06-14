import pytest
import time
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models import User, CarbonLog, OffsetProject, RefreshToken
from app.config import settings
from jose import jwt
from tests.conftest import get_auth_headers

# 1. Input Boundary Violations & Clamping Tests
def test_carbon_log_bounds_violations(client: TestClient):
    headers = get_auth_headers(client, "bounds_test@carboeco.org")
    
    # Value is <= 0 (Invalid - returns 422 due to Pydantic gt=0 schema validation)
    res_zero = client.post(
        "/api/carbon/logs",
        headers=headers,
        json={"date": "2026-06-13", "category": "transportation", "subcategory": "petrol_car", "value": -10.0, "unit": "km"}
    )
    assert res_zero.status_code == 422

    # Value is excessively large (Exceeds custom bounds - returns 400)
    res_large = client.post(
        "/api/carbon/logs",
        headers=headers,
        json={"date": "2026-06-13", "category": "transportation", "subcategory": "petrol_car", "value": 99999999.0, "unit": "km"}
    )
    assert res_large.status_code == 400
    assert "exceeds the maximum" in res_large.json()["detail"]

    # Valid upper limit bound check
    res_valid = client.post(
        "/api/carbon/logs",
        headers=headers,
        json={"date": "2026-06-13", "category": "transportation", "subcategory": "petrol_car", "value": 500.0, "unit": "km"}
    )
    assert res_valid.status_code == 201
    assert res_valid.json()["co2_equivalent"] == 500.0 * settings.EF_CAR_PETROL

def test_offset_purchase_bounds_violations(client: TestClient, db_session: Session):
    headers = get_auth_headers(client, "offset_bounds@carboeco.org")
    
    proj = OffsetProject(
        name="Lush Forest Initiative",
        description="Forest conservation project",
        cost_per_ton=12.0,
        co2_offset=5000.0,
        verified_by="VCS"
    )
    db_session.add(proj)
    db_session.commit()

    # Purchase exceeds limit ($100k)
    res_excess = client.post(
        "/api/marketplace/purchase",
        headers=headers,
        json={"project_id": proj.id, "amount_bought": 150000.0}
    )
    assert res_excess.status_code == 400
    assert "exceeds the transaction limit" in res_excess.json()["detail"]

# 2. Authentication and Expiration Failures Tests
def test_expired_jwt_handling(client: TestClient):
    # Construct an expired JWT token manually
    expired_payload = {
        "sub": "expired_user@carboeco.org",
        "exp": int(time.time()) - 3600  # expired 1 hour ago
    }
    expired_token = jwt.encode(expired_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    
    headers = {"Authorization": f"Bearer {expired_token}"}
    response = client.get("/api/carbon/logs", headers=headers)
    assert response.status_code == 401
    assert "Could not validate credentials" in response.json()["detail"]

def test_refresh_token_revocation(client: TestClient, db_session: Session):
    # Register and login
    email = "ref_rev@carboeco.org"
    client.post(
        "/api/auth/register",
        json={"email": email, "password": "securepassword123"}
    )
    
    login_res = client.post(
        "/api/auth/login",
        data={"username": email, "password": "securepassword123"}
    )
    assert login_res.status_code == 200
    
    # Retrieve refresh token from cookies
    cookies = login_res.cookies
    assert "refresh_token" in cookies
    
    # Logout
    logout_res = client.post("/api/auth/logout", cookies=cookies)
    assert logout_res.status_code == 200
    
    # Try refresh with revoked token
    refresh_res = client.post("/api/auth/refresh", cookies=cookies)
    assert refresh_res.status_code == 401
    assert "Invalid or expired refresh token" in refresh_res.json()["detail"]

# 3. Authorization & Role Escalation Prevention Tests
def test_role_escalation_denied(client: TestClient):
    headers = get_auth_headers(client, "normal_user@carboeco.org")
    
    # Regular user attempting admin action (like accessing metrics or seeding directly)
    # The /metrics endpoint is public, let's verify custom admin privilege logic
    # In auth.py, check_admin checks if user.role == "admin"
    # Let's write a mock test checking role protection directly
    from app.auth.auth import check_admin
    from fastapi import HTTPException
    
    user = User(email="normal@carboeco.org", role="user")
    with pytest.raises(HTTPException) as exc_info:
        check_admin(user)
    assert exc_info.value.status_code == 403
    assert "administrative privileges" in exc_info.value.detail

# 4. Empty and Large Datasets Handling
def test_dashboard_empty_dataset(client: TestClient):
    headers = get_auth_headers(client, "empty_dash@carboeco.org")
    
    response = client.get("/api/carbon/summary", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["daily_co2"] == 0.0
    assert data["weekly_co2"] == 0.0
    assert data["efficiency_rating"] == "A"  # Default rating with zero emissions

def test_dashboard_large_dataset(client: TestClient, db_session: Session):
    headers = get_auth_headers(client, "large_dash@carboeco.org")
    user = db_session.query(User).filter(User.email == "large_dash@carboeco.org").first()
    
    # Add 120 logs to DB to simulate a very large dataset
    for i in range(120):
        log = CarbonLog(
            user_id=user.id,
            date="2026-06-13",
            category="digital",
            subcategory="browsing",
            value=1.0,
            unit="hours",
            co2_equivalent=0.02,
            explanation="Browsing check"
        )
        db_session.add(log)
    db_session.commit()

    # Query logs list with pagination limit
    response = client.get("/api/carbon/logs?limit=100", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 100  # Enforce limit bounds

# 5. WebSocket Handshake Tickets Verification
def test_ws_ticket_handshake(client: TestClient):
    headers = get_auth_headers(client, "ws_ticket_user@carboeco.org")
    
    # Get WS ticket
    ticket_res = client.post("/api/auth/ws-ticket", headers=headers)
    assert ticket_res.status_code == 200
    ticket = ticket_res.json()["ticket"]
    
    # Connect to WS using ticket
    with client.websocket_connect(f"/ws/community?ticket={ticket}") as ws:
        join_data = ws.receive_json()
        assert join_data["type"] == "user_join"
        assert "Ws_ticket_user" in join_data["user"]
        
    # Re-using the same ticket must fall back to guest since the ticket is consumed
    with client.websocket_connect(f"/ws/community?ticket={ticket}") as ws2:
        join_data2 = ws2.receive_json()
        assert join_data2["type"] == "user_join"
        assert "EcoGuest" in join_data2["user"]
