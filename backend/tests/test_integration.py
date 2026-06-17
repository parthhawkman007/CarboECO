import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models import User, CarbonLog, UserAchievement, Achievement

def test_integration_auth_flow(client: TestClient):
    # 1. Register a new user
    email = "integration_runner@carboeco.org"
    password = "runnerPassword123!"
    reg_response = client.post("/api/auth/register", json={"email": email, "password": password})
    assert reg_response.status_code == 201
    
    # 2. Login to retrieve access token and cookie-based refresh token
    login_response = client.post(
        "/api/auth/login",
        data={"username": email, "password": password}
    )
    assert login_response.status_code == 200
    login_data = login_response.json()
    assert "access_token" in login_data
    access_token = login_data["access_token"]
    
    # 3. Call protected route '/me'
    me_response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert me_response.status_code == 200
    assert me_response.json()["email"] == email

    # 4. Refresh token rotation using the set cookie
    # TestClient automatically maintains cookies in the session
    refresh_response = client.post("/api/auth/refresh")
    assert refresh_response.status_code == 200
    refresh_data = refresh_response.json()
    assert "access_token" in refresh_data
    new_access_token = refresh_data["access_token"]

    # 5. Call protected route with new access token
    me_response_new = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {new_access_token}"}
    )
    assert me_response_new.status_code == 200
    
    # 6. Logout
    logout_response = client.post("/api/auth/logout")
    assert logout_response.status_code == 200
    
    # 7. Subsequent refresh should fail (cookie deleted)
    refresh_fail = client.post("/api/auth/refresh")
    assert refresh_fail.status_code == 401


def test_integration_offline_sync(client: TestClient, db_session: Session):
    # 1. Register and login
    email = "sync_tester@carboeco.org"
    password = "syncPassword123!"
    client.post("/api/auth/register", json={"email": email, "password": password})
    login_res = client.post(
        "/api/auth/login",
        data={"username": email, "password": password}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Simulate offline batch sync of multiple logged actions
    pending_logs = [
        {"date": "2026-06-17", "category": "transportation", "subcategory": "metro", "value": 15.0, "unit": "km"},
        {"date": "2026-06-17", "category": "food", "subcategory": "vegan", "value": 2.0, "unit": "kg"},
        {"date": "2026-06-17", "category": "waste", "subcategory": "recycled", "value": 10.0, "unit": "kg"},
    ]

    for log in pending_logs:
        res = client.post("/api/carbon/logs", json=log, headers=headers)
        assert res.status_code == 201
        assert res.json()["co2_equivalent"] > 0

    # Verify db state
    user = db_session.query(User).filter(User.email == email).first()
    db_logs = db_session.query(CarbonLog).filter(CarbonLog.user_id == user.id).all()
    assert len(db_logs) == 3

    # Check dashboard summary totals
    summary_res = client.get("/api/carbon/summary", headers=headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["daily_co2"] > 0
    assert len(summary["category_breakdown"]) == 6


def test_integration_websocket_concurrency(client: TestClient):
    # Connect client A
    with client.websocket_connect("/ws/community?token=guest") as ws_a:
        msg_a_join = ws_a.receive_json()
        assert msg_a_join["type"] == "user_join"
        
        # Connect client B concurrently
        with client.websocket_connect("/ws/community?token=guest") as ws_b:
            msg_b_join = ws_b.receive_json()
            assert msg_b_join["type"] == "user_join"
            
            # Client A should receive B's join notification
            msg_a_receives_b = ws_a.receive_json()
            assert msg_a_receives_b["type"] == "user_join"

            # Client A sends a chat message
            ws_a.send_json({"type": "chat", "message": "Eco warriors unite!"})
            
            # Both clients receive the chat message
            msg_a_chat = ws_a.receive_json()
            msg_b_chat = ws_b.receive_json()
            
            assert msg_a_chat["type"] == "chat"
            assert msg_a_chat["message"] == "Eco warriors unite!"
            assert msg_b_chat["type"] == "chat"
            assert msg_b_chat["message"] == "Eco warriors unite!"
