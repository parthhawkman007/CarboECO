import pytest
from fastapi.testclient import TestClient
from tests.conftest import get_auth_headers
from datetime import datetime, timezone

def test_community_group_summary(client: TestClient):
    # 1. Authenticate two separate users
    headers_1 = get_auth_headers(client, "user1@carboeco.org")
    headers_2 = get_auth_headers(client, "user2@carboeco.org")
    
    # 2. User 1 creates an Eco Group
    response_create = client.post(
        "/api/community/groups",
        headers=headers_1,
        json={
            "name": "Summary Test Group",
            "description": "A group to test analytics summary aggregation."
        }
    )
    assert response_create.status_code == 201
    group_id = response_create.json()["id"]
    
    # 3. User 2 joins the Eco Group
    response_join = client.post(
        f"/api/community/groups/{group_id}/join",
        headers=headers_2
    )
    assert response_join.status_code == 204
    
    # 4. Log carbon activities for User 1
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    client.post(
        "/api/carbon/logs",
        headers=headers_1,
        json={
            "date": today_str,
            "category": "transportation",
            "subcategory": "petrol_car",
            "value": 50.0,
            "unit": "km"
        }
    )
    
    # Log carbon activities for User 2
    client.post(
        "/api/carbon/logs",
        headers=headers_2,
        json={
            "date": today_str,
            "category": "energy",
            "subcategory": "electricity",
            "value": 100.0,
            "unit": "kWh"
        }
    )
    
    # 5. Fetch the group summary
    response_summary = client.get(
        f"/api/community/groups/{group_id}/summary",
        headers=headers_1
    )
    assert response_summary.status_code == 200
    summary = response_summary.json()
    
    # Assert values
    assert summary["group_id"] == group_id
    assert summary["group_name"] == "Summary Test Group"
    assert summary["member_count"] == 2
    assert summary["log_count"] == 2
    assert summary["total_co2_equivalent"] == 47.0
    assert summary["average_co2_equivalent"] == 23.5

def test_community_group_summary_not_found(client: TestClient):
    headers = get_auth_headers(client, "visitor@carboeco.org")
    response = client.get("/api/community/groups/99999/summary", headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Eco group not found"
