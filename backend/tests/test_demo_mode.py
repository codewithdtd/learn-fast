import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import Workbook


@pytest.mark.parametrize("legacy_demo_flag", [False, True])
def test_public_access_never_reads_or_changes_real_library(api_client: TestClient, monkeypatch, legacy_demo_flag):
    monkeypatch.setattr(settings, "demo_mode", legacy_demo_flag)
    assert api_client.get("/api/v1/workbooks").status_code == 401
    assert api_client.post("/api/v1/workbooks/import").status_code == 401
    assert api_client.delete("/api/v1/workbooks/1").status_code == 401
    response = api_client.get("/api/v1/health")
    assert response.status_code == 200 and response.text == "ok"


def test_admin_can_manage_library_even_with_legacy_demo_flag(admin_api_client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "demo_mode", True)
    workbook = Workbook(name="Private workbook", original_filename="private.xlsx")
    db_session.add(workbook)
    db_session.commit()
    response = admin_api_client.patch(f"/api/v1/workbooks/{workbook.id}", json={"name": "Updated workbook"})
    assert response.status_code == 200
    assert response.json()["name"] == "Updated workbook"
    assert admin_api_client.get("/api/v1/workbooks").json()[0]["name"] == "Updated workbook"