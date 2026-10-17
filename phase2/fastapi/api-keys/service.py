"""API keys identify an application, not a person.

Read this file from top to bottom. Each function is one step:
hash the key, compare it, find the caller, then allow or reject.

    python service.py
    python client.py

Listens on http://127.0.0.1:8010
"""

import hashlib
import hmac
from typing import Annotated

import uvicorn
from fastapi import Depends, FastAPI, Header, Request
from fastapi.responses import JSONResponse

PORT = 8010

# The slide key. We hash it below and do not store this string in KEYS.
DEMO_KEY = "demo-key-1234"
DEMO_OWNER = "reporting-service"

TITLES = {
    401: "Unauthorized",
    500: "Internal Server Error",
}


class ExceptionClass(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def hash_key(raw: str) -> str:
    """Step 1. Turn the raw key into a hash. The hash is what we store."""
    return hashlib.sha256(raw.encode()).hexdigest()


# The store: hash -> caller name. One key per caller.
KEYS: dict[str, str] = {hash_key(DEMO_KEY): DEMO_OWNER}


def hashes_match(given_hash: str, stored_hash: str) -> bool:
    """Step 2. Compare two hashes in constant time. Both are 64 characters."""
    return hmac.compare_digest(given_hash, stored_hash)


def find_owner(given_hash: str) -> str | None:
    """Step 3. Look through every stored hash. Do not stop at the first match."""
    owner = None
    for stored_hash, name in KEYS.items():
        if hashes_match(given_hash, stored_hash):
            owner = name
    return owner


def problem_response(status: int, detail: str) -> JSONResponse:
    """Every error uses the same JSON shape."""
    body = {
        "type": "about:blank",
        "title": TITLES.get(status, "Error"),
        "status": status,
        "detail": detail,
    }
    return JSONResponse(body, status_code=status, media_type="application/problem+json")


app = FastAPI(title="Library API", version="2.0.0")


@app.exception_handler(ExceptionClass)
def handle_problem(_request: Request, exc: ExceptionClass) -> JSONResponse:
    return problem_response(exc.status, exc.detail)


def require_api_key(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> str:
    """Step 4. Read the header, hash it, find the caller. No match is 401."""
    raw_key = x_api_key or ""
    given_hash = hash_key(raw_key)
    owner = find_owner(given_hash)
    if owner is None:
        raise ExceptionClass(401, "API key needed.")
    return owner


@app.get("/v1/health")
def health() -> dict:
    """Public. No key required, so you can see the contrast with /v1/admin/stats."""
    return {"status": "ok"}


@app.get("/v1/admin/stats")
def admin_stats(caller: Annotated[str, Depends(require_api_key)]) -> dict:
    """Protected. FastAPI runs require_api_key before this function."""
    return {"caller": caller}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT)
