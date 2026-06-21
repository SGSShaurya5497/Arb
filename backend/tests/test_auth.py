"""
test_auth.py — test suite for registration and JWT issuance.
"""

from fastapi.testclient import TestClient

def test_register_success(client: TestClient):
    payload = {"email": "new_user@example.com", "password": "securepassword123"}
    res = client.post("/auth/register", json=payload)
    
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "new_user@example.com"
    assert "hashed_password" not in data # Ensure schema prevents leaking hash
    assert data["is_active"] is True


def test_register_duplicate_email_409(client: TestClient):
    payload = {"email": "duplicate@example.com", "password": "securepassword123"}
    client.post("/auth/register", json=payload)
    
    # Try again with same email
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 409
    assert "already registered" in res.json()["detail"]


def test_login_success(client: TestClient):
    # Register first
    client.post("/auth/register", json={"email": "login_user@example.com", "password": "securepassword123"})
    
    # Login
    res = client.post("/auth/token", data={"username": "login_user@example.com", "password": "securepassword123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password_401(client: TestClient):
    client.post("/auth/register", json={"email": "wrong_pass@example.com", "password": "securepassword123"})
    
    res = client.post("/auth/token", data={"username": "wrong_pass@example.com", "password": "wrongpassword"})
    assert res.status_code == 401
    assert res.json()["detail"] == "Incorrect email or password"


def test_protected_route_no_token_401(client: TestClient):
    # Try to access a protected route without a token
    res = client.get("/api/v1/spreads/current")
    assert res.status_code == 401
    assert res.json()["detail"] == "Not authenticated"
