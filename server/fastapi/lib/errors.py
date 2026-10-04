"""RFC 9457 problem+json errors for the Library API."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

TITLES = {
    400: "Bad Request",
    404: "Not Found",
    405: "Method Not Allowed",
    409: "Conflict",
    422: "Unprocessable Content",
    500: "Internal Server Error",
}

STRING_FIELDS = {"title", "author", "reviewer", "comment"}


class Problem(Exception):
    def __init__(self, status: int, detail: str, errors: list[dict] | None = None):
        super().__init__(detail)
        self.status = status
        self.detail = detail
        self.errors = errors


def problem_body(status: int, detail: str, errors: list[dict] | None = None) -> dict:
    body = {
        "type": "about:blank",
        "title": TITLES.get(status, "Error"),
        "status": status,
        "detail": detail,
    }
    if errors:
        body["errors"] = errors
    return body


def problem_response(
    status: int, detail: str, errors: list[dict] | None = None
) -> JSONResponse:
    return JSONResponse(
        problem_body(status, detail, errors),
        status_code=status,
        media_type="application/problem+json",
    )


def _pointer(loc: tuple) -> str:
    parts: list[str] = []
    for item in loc:
        if item in {"body", "query", "path", "header", "cookie"}:
            continue
        name = str(item)
        if name in {"book_id", "author_id"}:
            name = "id"
        parts.append(name)
    if not parts:
        return "/"
    return "/" + "/".join(parts)


def _detail_for(err: dict) -> str:
    loc = err.get("loc") or ()
    field = next((str(part) for part in reversed(loc) if part not in {"body", "query", "path"}), "")
    kind = err.get("type") or ""
    ctx = err.get("ctx") or {}

    if kind == "missing":
        return "Field required"
    if kind in {"string_too_short"}:
        return "String should have at least 1 character"
    if kind == "string_too_long":
        return f"String should have at most {ctx.get('max_length')} characters"
    if field == "year" and kind in {"greater_than_equal", "less_than_equal"}:
        return "Year must be between 1450 and 2100"
    if field == "rating" and kind in {"greater_than_equal", "less_than_equal"}:
        return "Rating must be between 1 and 5"
    if field == "year" and kind in {"int_type", "int_parsing", "int_from_float", "finite_number"}:
        return "Year must be an integer"
    if field == "rating" and kind in {"int_type", "int_parsing", "int_from_float"}:
        return "Rating must be an integer"
    if field in STRING_FIELDS and kind in {"string_type", "string_unicode"}:
        return "Field must be a string"
    if kind == "extra_forbidden":
        return "Unknown field"
    if kind in {"model_type", "model_attributes_type", "dict_type"}:
        return "Body must be an object"
    if kind == "value_error":
        message = err.get("msg") or ""
        marker = "Value error, "
        if message.startswith(marker):
            return message[len(marker):]
        return message or "Your request is not valid."
    if field in {"book_id", "author_id", "id"} and "int" in kind:
        return "Id must be an integer"
    return err.get("msg") or "Your request is not valid."


def _from_validation(exc: RequestValidationError) -> JSONResponse:
    raw_errors = exc.errors()
    if any(err.get("type") == "json_invalid" for err in raw_errors):
        return problem_response(400, "The request body is not valid JSON.")

    errors = []
    for err in raw_errors:
        errors.append({"pointer": _pointer(tuple(err.get("loc") or ())), "detail": _detail_for(err)})
    return problem_response(422, "Your request is not valid.", errors)


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(Problem)
    async def problem_handler(_request: Request, exc: Problem) -> JSONResponse:
        return problem_response(exc.status, exc.detail, exc.errors)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return _from_validation(exc)

    @app.exception_handler(StarletteHTTPException)
    async def http_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else "The request could not be processed."
        return problem_response(exc.status_code, detail)

    @app.exception_handler(Exception)
    async def unhandled_handler(_request: Request, _exc: Exception) -> JSONResponse:
        return problem_response(500, "Something went wrong.")
