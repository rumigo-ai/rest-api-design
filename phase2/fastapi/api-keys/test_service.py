from fastapi.testclient import TestClient

from service import app

client = TestClient(app)


def test_health_is_public():
    response = client.get("/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_stats_without_a_key_is_401():
    response = client.get("/v1/admin/stats")
    assert response.status_code == 401
    assert "application/problem+json" in response.headers["content-type"]
    body = response.json()
    assert body["status"] == 401
    assert body["title"] == "Unauthorized"
    assert body["type"] == "about:blank"


def test_short_key_is_401_and_does_not_crash():
    response = client.get("/v1/admin/stats", headers={"X-API-Key": "x"})
    assert response.status_code == 401
    assert response.json()["detail"] == "API key needed."


def test_wrong_key_is_401():
    response = client.get("/v1/admin/stats", headers={"X-API-Key": "not-the-demo-key"})
    assert response.status_code == 401


def test_demo_key_names_the_caller():
    response = client.get("/v1/admin/stats", headers={"X-API-Key": "demo-key-123"})
    assert response.status_code == 200
    assert response.json() == {"caller": "reporting-service"}
