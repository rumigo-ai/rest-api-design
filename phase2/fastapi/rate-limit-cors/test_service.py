from fastapi.testclient import TestClient

import service

client = TestClient(service.app)


def setup_function():
    service.LIMITS["general"] = 60
    service.LIMITS["login"] = 5
    service.reset_limits()


def rate_limit(response) -> dict:
    parts = {}
    for item in response.headers["ratelimit"].split(","):
        key, value = item.strip().split("=")
        parts[key] = int(value)
    return parts


def test_books_send_rate_limit_headers():
    response = client.get("/v1/books")
    assert response.status_code == 200
    assert response.json()["data"][0]["title"] == "Dune"
    assert response.headers["ratelimit-policy"] == "60;w=60"
    parts = rate_limit(response)
    assert parts["limit"] == 60
    assert parts["remaining"] == 59
    assert 1 <= parts["reset"] <= 60


def test_login_sends_the_stricter_policy():
    response = client.post(
        "/v1/auth/login", json={"username": "alice", "password": "alice-pass"}
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert response.headers["ratelimit-policy"] == "5;w=60"
    parts = rate_limit(response)
    assert parts["limit"] == 5
    assert parts["remaining"] == 4


def test_over_the_general_limit_is_429():
    service.LIMITS["general"] = 2
    service.reset_limits()
    assert client.get("/v1/books").status_code == 200
    assert client.get("/v1/books").status_code == 200
    blocked = client.get("/v1/books")
    assert blocked.status_code == 429
    assert "application/problem+json" in blocked.headers["content-type"]
    assert blocked.json()["status"] == 429
    assert blocked.json()["title"] == "Too Many Requests"
    assert 1 <= int(blocked.headers["retry-after"]) <= 60


def test_sixth_login_is_429_even_with_the_right_password():
    for _ in range(5):
        response = client.post(
            "/v1/auth/login", json={"username": "alice", "password": "nope"}
        )
        assert response.status_code == 401
    blocked = client.post(
        "/v1/auth/login", json={"username": "alice", "password": "alice-pass"}
    )
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "Too many requests."
    assert "retry-after" in blocked.headers


def test_login_limit_does_not_block_books():
    for _ in range(5):
        client.post("/v1/auth/login", json={"username": "alice", "password": "nope"})
    response = client.get("/v1/books")
    assert response.status_code == 200
    assert rate_limit(response)["remaining"] == 59


def test_preflight_for_the_allowed_origin():
    response = client.options(
        "/v1/books",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 204
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert response.headers["access-control-allow-methods"] == "GET, POST"
    assert response.headers["access-control-allow-headers"] == "Authorization, Content-Type"
    assert response.headers["access-control-allow-origin"] != "*"
    assert "ratelimit" not in response.headers


def test_preflight_does_not_use_a_slot():
    client.options(
        "/v1/books",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    response = client.get("/v1/books")
    assert rate_limit(response)["remaining"] == 59


def test_allowed_origin_is_echoed_on_the_real_request():
    response = client.get("/v1/books", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_other_origin_is_not_reflected():
    response = client.get("/v1/books", headers={"Origin": "https://evil.example"})
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_a_lookalike_origin_is_not_allowed():
    response = client.get(
        "/v1/books", headers={"Origin": "http://localhost:3000.evil.example"}
    )
    assert "access-control-allow-origin" not in response.headers


def test_429_is_readable_from_the_allowed_origin():
    service.LIMITS["login"] = 1
    service.reset_limits()
    first = client.post(
        "/v1/auth/login",
        json={"username": "alice", "password": "nope"},
        headers={"Origin": "http://localhost:3000"},
    )
    assert first.status_code == 401
    blocked = client.post(
        "/v1/auth/login",
        json={"username": "alice", "password": "nope"},
        headers={"Origin": "http://localhost:3000"},
    )
    assert blocked.status_code == 429
    assert blocked.headers["access-control-allow-origin"] == "http://localhost:3000"
