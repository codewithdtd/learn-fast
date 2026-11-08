from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_returns_ok() -> None:
    client = TestClient(app)

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.text == "ok"
    assert response.headers["content-type"].startswith("text/plain")


def test_root_and_plain_health_endpoints_return_ok() -> None:
    """Test root and /health paths used by Render.com health checks and UptimeRobot."""
    client = TestClient(app)

    for path in ("/", "/health"):
        response = client.get(path)
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ok"
        assert payload["service"] == "learn-fast-api"
