"""Fixed-window rate limits, then a hand-written CORS allow-list.

Read this file from top to bottom. A request hits the middleware first:
1. Build the CORS headers for this origin.
2. OPTIONS stops there. It is only the browser asking permission.
3. Count the request. Login has its own, smaller window.
4. Over the cap: 429 and stop. Under the cap: run the route, then add headers.

    python service.py

Listens on http://127.0.0.1:8030
"""

import math
import time

import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

PORT = 8030
WINDOW_SECONDS = 60

# Tests lower these. Each request reads the current numbers.
LIMITS = {"general": 60, "login": 5}

ALLOWED_ORIGINS = {"http://localhost:3000"}
ALLOWED_METHODS = "GET, POST"
ALLOWED_HEADERS = "Authorization, Content-Type"

BOOKS = [
    {"id": 1, "title": "Dune", "author": "Frank Herbert", "year": 1965},
    {"id": 2, "title": "Neuromancer", "author": "William Gibson", "year": 1984},
]

# A tiny login so the stricter window has a route. Tokens live in the jwt file.
USERS = {"alice": "alice-pass"}

# bucket -> {"start": monotonic seconds, "count": int}. This process only.
WINDOWS: dict[str, dict] = {}

TITLES = {
    400: "Bad Request",
    401: "Unauthorized",
    422: "Unprocessable Content",
    429: "Too Many Requests",
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


def reset_limits() -> None:
    WINDOWS.clear()


def problem_response(
    status: int,
    detail: str,
    errors: list[dict] | None = None,
    headers: dict | None = None,
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
    return JSONResponse(
        body,
        status_code=status,
        media_type="application/problem+json",
        headers=headers,
    )


def client_ip(request: Request) -> str:
    """Who to count. Use the socket address. A client can forge X-Forwarded-For."""
    if request.client is None:
        return "unknown"
    return request.client.host


def limit_for(path: str) -> tuple[str, int]:
    """Login is its own bucket, with a smaller cap. Everything else shares one."""
    if path == "/v1/auth/login":
        return "login", LIMITS["login"]
    return "general", LIMITS["general"]


def take_slot(bucket: str, limit: int) -> tuple[bool, int, int]:
    """Count one request. Return allowed, remaining, and seconds until reset."""
    now = time.monotonic()
    window = WINDOWS.get(bucket)

    # No window yet, or this minute has ended: start again at zero.
    if window is None or now - window["start"] >= WINDOW_SECONDS:
        window = {"start": now, "count": 0}
        WINDOWS[bucket] = window

    elapsed = now - window["start"]
    reset = max(1, math.ceil(WINDOW_SECONDS - elapsed))

    # Already full. Do not count this request.
    if window["count"] >= limit:
        return False, 0, reset

    window["count"] += 1
    remaining = limit - window["count"]
    return True, remaining, reset


def cors_headers(origin: str | None) -> dict[str, str]:
    """Allow one origin. Any other origin gets no Allow-Origin header."""
    headers = {"Vary": "Origin"}
    if origin not in ALLOWED_ORIGINS:
        return headers
    headers["Access-Control-Allow-Origin"] = origin
    headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS
    headers["Access-Control-Allow-Headers"] = ALLOWED_HEADERS
    return headers


def rate_limit_headers(limit: int, remaining: int, reset: int) -> dict[str, str]:
    """The two headers a successful response sends."""
    return {
        "RateLimit-Policy": f"{limit};w={WINDOW_SECONDS}",
        "RateLimit": f"limit={limit}, remaining={remaining}, reset={reset}",
    }


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


@app.middleware("http")
async def rate_limit_and_cors(request: Request, call_next):
    origin = request.headers.get("origin")
    cors = cors_headers(origin)

    # The browser asks with OPTIONS before POST. Answer and do not count it.
    if request.method == "GET":
        return Response(status_code=200, headers=cors)

    bucket, limit = limit_for(request.url.path)
    allowed, remaining, reset = take_slot(f"{client_ip(request)}:{bucket}", limit)
    if not allowed:
        return problem_response(
            429,
            "Too many requests.",
            headers={**cors, "Retry-After": str(reset)},
        )

    response = await call_next(request)
    for name, value in cors.items():
        response.headers[name] = value
    for name, value in rate_limit_headers(limit, remaining, reset).items():
        response.headers[name] = value
    return response


@app.get("/v1/books")
def list_books() -> dict:
    """A normal route, so you can watch the 60-per-minute window."""
    return {"data": BOOKS}


@app.post("/v1/auth/login")
def login(body: LoginIn) -> dict:
    """A small login, so you can watch the 5-per-minute window. Failed tries count."""
    stored = USERS.get(body.username)
    if stored is None or stored != body.password:
        raise Problem(401, "Username or password is wrong.")
    return {"ok": True}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT)
