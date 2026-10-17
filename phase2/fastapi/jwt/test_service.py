import base64
import json

from fastapi.testclient import TestClient

from service import JWT_AUDIENCE, JWT_ISSUER, app, issue_token

client = TestClient(app)


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def login(username: str, password: str) -> str:
    response = client.post(
        "/v1/auth/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["token_type"] == "Bearer"
    assert body["expires_in"] == 900
    assert body["access_token"].count(".") == 2
    return body["access_token"]


def b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def test_login_returns_a_bearer_token():
    token = login("alice", "alice-pass")
    assert token


def test_unknown_user_and_wrong_password_share_a_message():
    wrong = client.post(
        "/v1/auth/login", json={"username": "alice", "password": "nope"}
    )
    missing = client.post(
        "/v1/auth/login", json={"username": "carol", "password": "alice-pass"}
    )
    assert wrong.status_code == 401
    assert missing.status_code == 401
    assert wrong.json()["detail"] == "Username or password is wrong."
    assert missing.json()["detail"] == wrong.json()["detail"]
    assert "application/problem+json" in wrong.headers["content-type"]


def test_login_without_fields_is_422():
    response = client.post("/v1/auth/login", json={})
    assert response.status_code == 422
    body = response.json()
    assert body["status"] == 422
    assert body["title"] == "Unprocessable Content"
    pointers = {err["pointer"] for err in body["errors"]}
    assert pointers == {"/username", "/password"}


def test_broken_json_is_400():
    response = client.post(
        "/v1/auth/login",
        content=b"{",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json()["status"] == 400
    assert response.json()["detail"] == "The JSON is broken."


def test_me_reads_the_verified_claims():
    token = login("alice", "alice-pass")
    response = client.get("/v1/me", headers=auth(token))
    assert response.status_code == 200
    assert response.json() == {"id": 7, "role": "member"}


def test_missing_token_is_401():
    response = client.get("/v1/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Token is missing, invalid, or expired."


def test_tampered_role_is_401():
    token = login("alice", "alice-pass")
    header, payload, signature = token.split(".")
    claims = json.loads(b64url_decode(payload))
    claims["role"] = "admin"
    forged = ".".join(
        [header, b64url_encode(json.dumps(claims).encode()), signature]
    )
    response = client.get("/v1/admin/stats", headers=auth(forged))
    assert response.status_code == 401


def test_alg_none_is_401():
    header = b64url_encode(json.dumps({"alg": "none", "typ": "JWT"}).encode())
    payload = b64url_encode(
        json.dumps(
            {
                "sub": "1",
                "role": "admin",
                "iss": JWT_ISSUER,
                "aud": JWT_AUDIENCE,
                "exp": 9999999999,
            }
        ).encode()
    )
    response = client.get("/v1/admin/stats", headers=auth(f"{header}.{payload}."))
    assert response.status_code == 401


def test_expired_token_is_401():
    token = issue_token(7, "member", ttl=-30)
    response = client.get("/v1/me", headers=auth(token))
    assert response.status_code == 401


def test_a_member_cannot_open_admin_stats():
    token = login("alice", "alice-pass")
    response = client.get("/v1/admin/stats", headers=auth(token))
    assert response.status_code == 403
    body = response.json()
    assert body["status"] == 403
    assert body["title"] == "Forbidden"


def test_an_admin_can_open_admin_stats():
    token = login("admin", "admin-pass")
    response = client.get("/v1/admin/stats", headers=auth(token))
    assert response.status_code == 200
    assert response.json() == {"books": 50}


def test_alice_cannot_read_bobs_loan():
    token = login("alice", "alice-pass")
    response = client.get("/v1/loans/12", headers=auth(token))
    assert response.status_code == 404
    assert response.json()["detail"] == "Loan 12 not found."


def test_bob_can_read_his_loan():
    token = login("bob", "bob-pass")
    response = client.get("/v1/loans/12", headers=auth(token))
    assert response.status_code == 200
    assert response.json()["user_id"] == 8


def test_admin_does_not_skip_the_ownership_check():
    token = login("admin", "admin-pass")
    response = client.get("/v1/loans/12", headers=auth(token))
    assert response.status_code == 404


def test_a_missing_loan_is_404():
    token = login("bob", "bob-pass")
    response = client.get("/v1/loans/99", headers=auth(token))
    assert response.status_code == 404
    assert response.json()["detail"] == "Loan 99 not found."


print(login("bob", "bob-pass"))
