import re

import pytest
from sqlalchemy import func, select

from app.main import api_app
from app.core.security import create_access_token, get_password_hash
from app.models import Workbook, StudySheet, Flashcard, StudySession
from app.models.user import User
from app.models.writing_attempt import WritingAttempt


IDENTITY_ENDPOINTS = {("POST", "/api/v1/auth/login"), ("GET", "/api/v1/auth/me"), ("GET", "/api/v1/health")}


@pytest.mark.parametrize("role", ["guest", "member", "invalid_token", "inactive_admin"])
def test_every_data_endpoint_requires_active_admin(api_client, db_session, role):
    headers = {}
    if role in {"member", "inactive_admin"}:
        user = User(username="visitor", email="visitor@example.com", hashed_password=get_password_hash("VisitorPass123"),
                    is_superuser=role == "inactive_admin", is_active=role != "inactive_admin")
        db_session.add(user)
        db_session.commit()
        headers["Authorization"] = f"Bearer {create_access_token(subject=user.id)}"
    elif role == "invalid_token":
        headers["Authorization"] = "Bearer invalid.token.value"

    # Duyệt route thực tế để cả endpoint mới trong tương lai phải vượt qua cùng chốt quyền.
    checked = 0
    for template, operations in api_app.openapi()["paths"].items():
        for method_name in operations:
            method = method_name.upper()
            if method not in {"GET", "POST", "PUT", "PATCH", "DELETE"} or (method, template) in IDENTITY_ENDPOINTS:
                continue
            path = re.sub(r"\{[^}]+\}", "1", template)
            response = api_client.request(method, path, headers=headers)
            expected = 403 if role == "member" else 400 if role == "inactive_admin" else 401
            assert response.status_code == expected, f"{role} {method} {path}: {response.status_code} {response.text}"
            checked += 1
    assert checked >= 30
    for model in (Workbook, StudySheet, Flashcard, StudySession, WritingAttempt):
        assert db_session.scalar(select(func.count()).select_from(model)) == 0


def test_identity_is_readable_but_cannot_mutate_as_member(api_client, db_session):
    user = User(username="member", email="member@example.com", hashed_password=get_password_hash("MemberPass123"), is_active=True, is_superuser=False)
    db_session.add(user)
    db_session.commit()
    headers = {"Authorization": f"Bearer {create_access_token(subject=user.id)}"}
    assert api_client.get("/api/v1/auth/me", headers=headers).json()["is_superuser"] is False
    assert api_client.put("/api/v1/auth/me", headers=headers, json={"full_name": "Changed"}).status_code == 403
    assert api_client.post("/api/v1/auth/register", json={"username": "attacker", "email": "attacker@example.com", "password": "StrongPass123"}).status_code == 401
