import pytest
from fastapi.testclient import TestClient

def test_register_user(client: TestClient):
    response = client.post(
        "/api/auth/register",
        json={"email": "tester@carboeco.org", "password": "securepassword123"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "tester@carboeco.org"
    assert "id" in data
    assert data["role"] == "user"

def test_register_user_duplicate(client: TestClient):
    # Register once
    client.post(
        "/api/auth/register",
        json={"email": "duplicate@carboeco.org", "password": "securepassword123"}
    )
    # Register twice
    response = client.post(
        "/api/auth/register",
        json={"email": "duplicate@carboeco.org", "password": "securepassword123"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "A user with this email address already exists."

def test_register_rejects_weak_password(client: TestClient):
    response = client.post(
        "/api/auth/register",
        json={"email": "weak_password@carboeco.org", "password": "short"}
    )
    assert response.status_code == 422

def test_login_user(client: TestClient):
    # Register user
    email = "login_tester@carboeco.org"
    password = "loginpass123"
    client.post(
        "/api/auth/register",
        json={"email": email, "password": password}
    )
    
    # Login
    response = client.post(
        "/api/auth/login",
        data={"username": email, "password": password}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == email

def test_login_user_invalid_password(client: TestClient):
    email = "login_tester@carboeco.org"
    response = client.post(
        "/api/auth/login",
        data={"username": email, "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"
