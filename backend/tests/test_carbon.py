import pytest
from fastapi.testclient import TestClient
from tests.conftest import get_auth_headers

def test_add_carbon_log(client: TestClient):
    headers = get_auth_headers(client, "logger@carboeco.org")
    
    response = client.post(
        "/api/carbon/logs",
        headers=headers,
        json={
            "date": "2026-06-13",
            "category": "transportation",
            "subcategory": "petrol_car",
            "value": 50.0,
            "unit": "km"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["category"] == "transportation"
    assert data["subcategory"] == "petrol_car"
    assert data["value"] == 50.0
    # 50 km * 0.18 (petrol factor) = 9.0 kg CO2e
    assert data["co2_equivalent"] == 9.0
    assert "explanation" in data

def test_get_carbon_logs(client: TestClient):
    headers = get_auth_headers(client, "queryer@carboeco.org")
    
    # Add logs
    client.post(
        "/api/carbon/logs",
        headers=headers,
        json={"date": "2026-06-13", "category": "food", "subcategory": "beef", "value": 2.0, "unit": "kg"}
    )
    client.post(
        "/api/carbon/logs",
        headers=headers,
        json={"date": "2026-06-13", "category": "energy", "subcategory": "electricity", "value": 100.0, "unit": "kWh"}
    )
    
    response = client.get("/api/carbon/logs", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2

def test_delete_carbon_log(client: TestClient):
    headers = get_auth_headers(client, "deleter@carboeco.org")
    
    # Add log
    res = client.post(
        "/api/carbon/logs",
        headers=headers,
        json={"date": "2026-06-13", "category": "digital", "subcategory": "streaming", "value": 10.0, "unit": "hours"}
    )
    log_id = res.json()["id"]
    
    # Delete log
    delete_res = client.delete(f"/api/carbon/logs/{log_id}", headers=headers)
    assert delete_res.status_code == 204
    
    # Check deleted
    get_res = client.get("/api/carbon/logs", headers=headers)
    logs = get_res.json()
    assert not any(log["id"] == log_id for log in logs)

def test_dashboard_summary(client: TestClient):
    headers = get_auth_headers(client, "summary@carboeco.org")
    
    # Add food and transit logs
    client.post(
        "/api/carbon/logs",
        headers=headers,
        json={"date": "2026-06-13", "category": "food", "subcategory": "vegan", "value": 1.0, "unit": "kg"}
    )
    client.post(
        "/api/carbon/logs",
        headers=headers,
        json={"date": "2026-06-13", "category": "transportation", "subcategory": "metro", "value": 20.0, "unit": "km"}
    )
    
    response = client.get("/api/carbon/summary", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "daily_co2" in data
    assert "weekly_co2" in data
    assert "monthly_co2" in data
    assert "annual_co2" in data
    assert "category_breakdown" in data
    assert len(data["category_breakdown"]) == 6
