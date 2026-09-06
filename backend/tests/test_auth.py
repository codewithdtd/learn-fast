import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, decode_access_token, get_password_hash, verify_password


def test_password_hashing_and_verification():
    """Verify that bcrypt hashing generates non-reversible hashes and correctly matches."""
    plain = "SuperSecret123!"
    hashed = get_password_hash(plain)

    # Hash should never equal plaintext
    assert hashed != plain
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")

    # Correct password verifies
    assert verify_password(plain, hashed) is True
    # Incorrect password fails
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_creation_and_decoding():
    """Verify that JWT encode/decode correctly handles payload claims and expirations."""
    user_id = 42
    token = create_access_token(subject=user_id, extra_claims={"role": "tester"})

    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == str(user_id)
    assert payload["role"] == "tester"
    assert "exp" in payload
    assert "iat" in payload

    # Invalid token fails to decode
    assert decode_access_token("invalid.token.signature") is None


def test_auth_register_and_login_flow(api_client: TestClient):
    """Integration test: Register account -> Login -> Get /me profile."""
    # 1. Register
    reg_payload = {
        "email": "learner@example.com",
        "username": "learner_python",
        "full_name": "Python Developer",
        "password": "strongPassword123",
    }
    reg_res = api_client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    user_data = reg_res.json()
    assert user_data["email"] == "learner@example.com"
    assert user_data["username"] == "learner_python"
    assert "hashed_password" not in user_data

    # 2. Duplicate registration fails (HTTP 400)
    dup_res = api_client.post("/api/v1/auth/register", json=reg_payload)
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"]

    # 3. Login with correct password
    login_res = api_client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "learner_python", "password": "strongPassword123"},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    access_token = token_data["access_token"]

    # 4. Login with wrong password (HTTP 401)
    bad_login = api_client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "learner_python", "password": "WrongPassword"},
    )
    assert bad_login.status_code == 401

    # 5. Access protected /auth/me endpoint with Bearer token
    me_res = api_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "learner_python"

    # 6. Access /auth/me without token -> HTTP 401
    unauth_res = api_client.get("/api/v1/auth/me")
    assert unauth_res.status_code == 401


def test_auth_change_password(api_client: TestClient):
    """Test authenticated user updating their password."""
    # Register & Login
    api_client.post(
        "/api/v1/auth/register",
        json={"email": "pwd_test@example.com", "username": "pwd_user", "password": "OldPassword123"},
    )
    login_res = api_client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "pwd_user", "password": "OldPassword123"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Change password with wrong old password -> 400
    fail_change = api_client.post(
        "/api/v1/auth/change-password",
        json={"old_password": "WrongOldPassword", "new_password": "NewPassword123"},
        headers=headers,
    )
    assert fail_change.status_code == 400

    # Change password with correct old password -> 200
    ok_change = api_client.post(
        "/api/v1/auth/change-password",
        json={"old_password": "OldPassword123", "new_password": "NewPassword123"},
        headers=headers,
    )
    assert ok_change.status_code == 200

    # Login with new password succeeds
    relogin = api_client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "pwd_user", "password": "NewPassword123"},
    )
    assert relogin.status_code == 200

