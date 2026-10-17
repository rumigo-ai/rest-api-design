"""JWT bearer tokens. Log in once, then send the token on each request.

Read this file from top to bottom:
1. Check the password and issue a token.
2. On later requests, read the header, verify the token, then read the user.
3. The route then checks role (403) or ownership (404).

    python service.py

Listens on http://127.0.0.1:8020
"""

import hmac
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
import uvicorn
from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

PORT = 8020

# Production reads this from the environment. It is a constant so the demo runs.
JWT_SECRET = "phase2-demo-secret-do-not-use-in-production"
# secret for the application to use to sign the token
# .env
JWT_ISSUER = "library-api" #extra info 
JWT_AUDIENCE = "library-clients" # kon se user/type
TOKEN_TTL_SECONDS = 900 # 15 minutes

TOKEN_PROBLEM = "Token is missing, invalid, or expired."
LOGIN_PROBLEM = "Username or password is wrong."
# Compared when the username is missing, so both failures do the same work.
UNKNOWN_PASSWORD = "alice-pass"

# Alice is 7, Bob is 8. Loan 12 belongs to Bob.
USERS = {
    "alice": {"id": 7, "password": "alice-pass", "role": "member"},
    "bob": {"id": 8, "password": "bob-pass", "role": "member"},
    "admin": {"id": 1, "password": "admin-pass", "role": "admin"},
}

LOANS = {
    12: {"id": 12, "user_id": 8, "book_id": 1},
}


TITLES = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    422: "Unprocessable Content",
    500: "Internal Server Error",
}


class Problem(Exception):
    def __init__(self, status: int, detail: str, errors: list[dict] | None = None):
        super().__init__(detail)
        self.status = status
        self.detail = detail
        self.errors = errors


class LoginIn(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


def problem_response(
    status: int, detail: str, errors: list[dict] | None = None
) -> JSONResponse:
    """Every error uses the same JSON shape."""
    body = {
        "type": "about:blank",
        "title": TITLES.get(status, "Error"),
        "status": status,
        "detail": detail,
    }
    if errors:
        body["errors"] = errors
    return JSONResponse(body, status_code=status, media_type="application/problem+json")


def passwords_match(given: str, stored: str) -> bool:
    """Constant-time password compare. Padding keeps compare_digest from throwing."""
    given_bytes = given.encode()
    stored_bytes = stored.encode()
    width = max(len(given_bytes), len(stored_bytes), 1)
    given_padded = given_bytes.ljust(width, b"\0")
    stored_padded = stored_bytes.ljust(width, b"\0")
    same_length = len(given_bytes) == len(stored_bytes)
    same_bytes = hmac.compare_digest(given_padded, stored_padded)
    return same_length and same_bytes


def issue_token(user_id: int, role: str, ttl: int = TOKEN_TTL_SECONDS) -> str:
    """Build the payload, then sign it with HS256. The payload is not secret."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "org": "organisation 123",
        "iat": now,
        "exp": now + timedelta(seconds=ttl),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def read_bearer(authorization: str | None) -> str:
    """Step 1 of a protected request. Pull the token out of the header."""
    if not authorization:
        raise Problem(401, TOKEN_PROBLEM)
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        raise Problem(401, TOKEN_PROBLEM)
    token = token.strip()
    if token == "":
        raise Problem(401, TOKEN_PROBLEM)
    return token


def verify_token(token: str) -> dict:
    """Step 2. Check the signature, the algorithm, iss, aud, and exp."""
    try:
        return jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            org="organisation 123",
            options={"require": ["exp", "org", "sub"]},
        )
    except jwt.PyJWTError:
        raise Problem(401, TOKEN_PROBLEM) from None


def read_user(claims: dict) -> dict:
    """Step 3. Read sub and role only after verify_token has succeeded."""
    role = claims.get("role")
    if role not in {"member", "admin"}:
        raise Problem(401, TOKEN_PROBLEM)
    try:
        user_id = int(claims["sub"])
    except (TypeError, ValueError, KeyError):
        raise Problem(401, TOKEN_PROBLEM) from None
    return {"id": user_id, "role": role}


def field_pointer(loc: tuple) -> str:
    parts = [str(part) for part in loc if part not in {"body", "query", "path"}]
    if not parts:
        return "/"
    return "/" + "/".join(parts)


def validation_response(exc: RequestValidationError) -> JSONResponse:
    """Broken JSON is 400. JSON that fails the rules is 422."""
    raw = exc.errors()
    if any(err.get("type") == "json_invalid" for err in raw):
        return problem_response(400, "The JSON is broken.")
    errors = []
    for err in raw:
        if err.get("type") == "missing":
            detail = "Field required"
        else:
            detail = "Invalid value"
        errors.append({"pointer": field_pointer(err.get("loc") or ()), "detail": detail})
    return problem_response(422, "Your request is not valid.", errors)


app = FastAPI(title="Library API", version="2.0.0")


@app.exception_handler(Problem)
def handle_problem(_request: Request, exc: Problem) -> JSONResponse:
    return problem_response(exc.status, exc.detail, exc.errors)


@app.exception_handler(RequestValidationError)
def handle_validation(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return validation_response(exc)


def current_user(authorization: Annotated[str | None, Header()] = None) -> dict:
    """Run the three steps. A route handler starts only if this returns."""
    token = read_bearer(authorization)
    claims = verify_token(token)
    user = read_user(claims)
    return user


@app.post("/v1/auth/login")
def login(body: LoginIn) -> dict:
    """Check the password, then issue a 15-minute token."""
    user = USERS.get(body.username)
    stored_password = user["password"] if user else UNKNOWN_PASSWORD
    password_ok = passwords_match(body.password, stored_password)
    if user is None or not password_ok:
        raise Problem(401, LOGIN_PROBLEM)
    return {
        "access_token": issue_token(user["id"], user["role"]),
        "token_type": "Bearer",
        "expires_in": TOKEN_TTL_SECONDS,
    }


@app.get("/v1/me")
def me(user: Annotated[dict, Depends(current_user)]) -> dict:
    """Who the token says you are."""
    return user


@app.get("/v1/admin/stats")
def admin_stats(user: Annotated[dict, Depends(current_user)]) -> dict:
    """Authorization. The token is valid, but the role may still be wrong."""
    if user["role"] != "admin":
        raise Problem(403, "You are not allowed to do that.")
    return {"books": 50}


@app.get("/v1/loans/{loan_id}")
def get_loan(loan_id: int, user: Annotated[dict, Depends(current_user)]) -> dict:
    """BOLA. A valid token is not enough. The loan must belong to this user."""
    loan = LOANS.get(loan_id)
    owns_loan = loan is not None and loan["user_id"] == user["id"]
    if not owns_loan:
        raise Problem(404, f"Loan {loan_id} not found.")
    return loan


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT)
