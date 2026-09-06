from fastapi.testclient import TestClient
from app.core.config import settings


def test_demo_mode_blocks_destructive_mutations(api_client: TestClient):
    """Ensure DemoReadOnlyMiddleware rejects mutating endpoints when demo_mode=True."""
    # 1. Turn on Demo Mode
    original_setting = settings.demo_mode
    settings.demo_mode = True

    try:
        # Import workbook is blocked (HTTP 403)
        res_import = api_client.post(
            "/api/v1/workbooks/import",
            files={"file": ("test.xlsx", b"dummy content", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert res_import.status_code == 403
        assert "Demo Mode is enabled" in res_import.json()["detail"]

        # Delete workbook is blocked (HTTP 403)
        res_del = api_client.delete("/api/v1/workbooks/1")
        assert res_del.status_code == 403
        assert "Demo Mode is enabled" in res_del.json()["detail"]

        # Rename workbook is blocked (HTTP 403)
        res_patch = api_client.patch("/api/v1/workbooks/1", json={"name": "New Name"})
        assert res_patch.status_code == 403

        # Read operations still succeed (HTTP 200)
        res_get = api_client.get("/api/v1/workbooks")
        assert res_get.status_code == 200

        # Health endpoint reports demo_mode: true
        res_health = api_client.get("/api/v1/health")
        assert res_health.status_code == 200
        assert res_health.json()["demo_mode"] is True

    finally:
        # Restore setting
        settings.demo_mode = original_setting
