import pytest
from fastapi.testclient import TestClient
from app.models import EcoGroup, LearningPath, LearningLesson, OffsetProject
from tests.conftest import get_auth_headers

def test_community_groups(client: TestClient):
    headers = get_auth_headers(client, "grouper@carboeco.org")
    
    # Create group
    response = client.post(
        "/api/community/groups",
        headers=headers,
        json={"name": "Test Green Group", "description": "This is a test description for the group."}
    )
    assert response.status_code == 201
    group_id = response.json()["id"]
    
    # List groups
    list_response = client.get("/api/community/groups", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) >= 1

    # Join group (another user)
    headers2 = get_auth_headers(client, "joiner@carboeco.org")
    join_res = client.post(f"/api/community/groups/{group_id}/join", headers=headers2)
    assert join_res.status_code == 204

def test_education_quiz(client: TestClient, db_session):
    headers = get_auth_headers(client, "student@carboeco.org")
    
    # Create a dummy course and lesson in DB
    path = LearningPath(title="Test Course", description="Test Desc")
    db_session.add(path)
    db_session.flush()
    
    lesson = LearningLesson(
        path_id=path.id,
        title="Test Lesson",
        content="Test Content",
        quiz_question="What is 1+1?",
        quiz_options=["1", "2", "3"],
        quiz_answer="2",
        xp_reward=50
      )
    db_session.add(lesson)
    db_session.commit()
    
    # Get paths
    res_paths = client.get("/api/education/paths", headers=headers)
    assert res_paths.status_code == 200
    
    # Submit correct quiz
    res_quiz = client.post(
        f"/api/education/lessons/{lesson.id}/quiz",
        headers=headers,
        json={"answer": "2"}
    )
    assert res_quiz.status_code == 200
    assert res_quiz.json()["correct"] is True
    assert res_quiz.json()["xp_earned"] == 50

    # Submit incorrect quiz
    res_quiz_wrong = client.post(
        f"/api/education/lessons/{lesson.id}/quiz",
        headers=headers,
        json={"answer": "3"}
    )
    assert res_quiz_wrong.status_code == 200
    assert res_quiz_wrong.json()["correct"] is False

def test_simulator_scenarios(client: TestClient):
    headers = get_auth_headers(client, "simulator_run@carboeco.org")
    
    response = client.post(
        "/api/simulator/run",
        headers=headers,
        json={
            "name": "My Solar EV Scenario",
            "inputs_json": {
                "switch_to_ev": True,
                "ev_annual_km": 15000.0,
                "install_solar_panels": True,
                "solar_capacity_kwh_annual": 5000.0,
                "meatless_days_per_week": 3,
                "reduce_flight_hours": 10.0
            }
        }
    )
    assert response.status_code == 201
    assert "co2_saved" in response.json()
    assert response.json()["co2_saved"] > 0

    # Get history
    history_res = client.get("/api/simulator/history", headers=headers)
    assert history_res.status_code == 200
    assert len(history_res.json()) >= 1

def test_marketplace_purchases(client: TestClient, db_session):
    headers = get_auth_headers(client, "offsetter@carboeco.org")
    
    # Create project in DB
    proj = OffsetProject(
        name="Test Forestry project",
        description="test",
        cost_per_ton=10.0,
        co2_offset=1000.0,
        verified_by="Gold Standard"
    )
    db_session.add(proj)
    db_session.commit()

    # List projects
    res_list = client.get("/api/marketplace/projects", headers=headers)
    assert res_list.status_code == 200

    # Purchase
    res_buy = client.post(
        "/api/marketplace/purchase",
        headers=headers,
        json={"project_id": proj.id, "amount_bought": 50.0}
    )
    assert res_buy.status_code == 201
    assert res_buy.json()["cost_paid"] == 50.0
    assert res_buy.json()["co2_offsetted"] == 5000.0 # ($50 / $10 per ton) * 1000 kg = 5000 kg

def test_websocket_connection(client: TestClient):
    headers = get_auth_headers(client, "ws_user@carboeco.org")
    token = headers["Authorization"].split(" ")[1]

    with client.websocket_connect(f"/ws/community?token={token}") as websocket:
        data = websocket.receive_json()
        assert data["type"] == "user_join"
        assert "Ws_user" in data["user"]

        websocket.send_text('{"type": "chat", "message": "Hello Earth!"}')
        data = websocket.receive_json()
        assert data["type"] == "chat"
        assert data["message"] == "Hello Earth!"

def test_websocket_guest_connection(client: TestClient):
    with client.websocket_connect("/ws/community") as websocket:
        data = websocket.receive_json()
        assert data["type"] == "user_join"
        assert "EcoGuest" in data["user"]

def test_ml_forecasting_pipeline(db_session, client: TestClient):
    headers = get_auth_headers(client, "ml_tester@carboeco.org")
    
    from app.models import User, CarbonLog
    from app.services.ai_engine import AIEngine
    import datetime
    
    user = db_session.query(User).filter(User.email == "ml_tester@carboeco.org").first()
    
    # 1. Sparse data check
    res_sparse = AIEngine.forecast_footprint(db_session, user.id)
    assert len(res_sparse["forecast"]) == 12
    assert "Using general baseline projections" in res_sparse["explanation"]

    # 2. Add sufficient training data
    categories = ["transportation", "energy", "food", "waste", "shopping"]
    for i in range(5):
        date_str = (datetime.datetime(2026, 1 + i, 15)).strftime("%Y-%m-%d")
        log = CarbonLog(
            user_id=user.id,
            date=date_str,
            category=categories[i],
            subcategory="test_sub",
            value=100.0,
            unit="units",
            co2_equivalent=150.0 + (i * 10),
            explanation="Test log"
        )
        db_session.add(log)
    db_session.commit()

    # 3. Fit pipeline check
    res_fit = AIEngine.forecast_footprint(db_session, user.id)
    assert len(res_fit["forecast"]) == 12
    assert "model_coefficients" in res_fit
    assert "month_index" in res_fit["model_coefficients"]
    assert "temp_proxy" in res_fit["model_coefficients"]
