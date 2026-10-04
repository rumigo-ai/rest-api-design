"""Request bodies and query parsing.

BookIn is the slide example: type hints are the validation rules.
"""

import re
from dataclasses import dataclass

from pydantic import BaseModel, ConfigDict, Field

from lib.errors import Problem

SORTS = ("id", "-id", "title", "-title", "year", "-year")
SORT_DETAIL = "Sort must be one of: id, -id, title, -title, year, -year"
LIST_PARAMS = {"author", "sort", "limit", "offset", "page", "per_page"}
FEED_PARAMS = {"limit", "cursor"}
INT_PATTERN = re.compile(r"-?\d{1,15}")


class BookIn(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
        json_schema_extra={
            "examples": [{"title": "Dune", "author": "Frank Herbert", "year": 1965}]
        },
    )
    title: str = Field(min_length=1, max_length=200)
    author: str = Field(min_length=1, max_length=100)
    year: int = Field(ge=1450, le=2100)


class BookPatch(BaseModel):
    """Fields you may send. Omitted fields stay as they are. Null is rejected."""

    model_config = ConfigDict(
        extra="forbid",
        strict=True,
        json_schema_extra={"examples": [{"year": 1966}]},
    )
    title: str | None = Field(default=None, min_length=1, max_length=200)
    author: str | None = Field(default=None, min_length=1, max_length=100)
    year: int | None = Field(default=None, ge=1450, le=2100)


@dataclass
class ListQuery:
    author: str | None
    sort: str
    limit: int
    offset: int
    page: int | None


def _unknown_params(params, allowed: set[str], errors: list[dict]) -> None:
    for key in params:
        if key not in allowed:
            errors.append({"pointer": f"/{key}", "detail": "Unknown query parameter"})


def _take_int(
    params,
    key: str,
    *,
    default: int,
    minimum: int,
    maximum: int | None,
    label: str,
    errors: list[dict],
) -> int:
    if key not in params:
        return default
    raw = params.get(key)
    pointer = f"/{key}"
    if raw is None or INT_PATTERN.fullmatch(raw) is None:
        errors.append({"pointer": pointer, "detail": f"{label} must be an integer"})
        return default
    value = int(raw)
    if maximum is None:
        if value < minimum:
            errors.append({"pointer": pointer, "detail": f"{label} must be {minimum} or greater"})
    elif value < minimum or value > maximum:
        errors.append(
            {"pointer": pointer, "detail": f"{label} must be between {minimum} and {maximum}"}
        )
    return value


def parse_list_query(params, *, allow_author: bool = True) -> ListQuery:
    errors: list[dict] = []
    allowed = set(LIST_PARAMS)
    if not allow_author:
        allowed.discard("author")
    _unknown_params(params, allowed, errors)

    page_style = "page" in params or "per_page" in params
    offset_style = "offset" in params or "limit" in params
    if page_style and offset_style:
        raise Problem(
            422,
            "Your request is not valid.",
            [{"pointer": "/", "detail": "Use limit and offset, or page and per_page, not both."}],
        )

    author = None
    if allow_author and "author" in params:
        author = params.get("author") or ""
        if author == "":
            author = None
        elif len(author) > 100:
            errors.append(
                {
                    "pointer": "/author",
                    "detail": "String should have at most 100 characters",
                }
            )

    sort = "id"
    if "sort" in params:
        sort = params.get("sort") or ""
        if sort not in SORTS:
            errors.append({"pointer": "/sort", "detail": SORT_DETAIL})

    page = None
    if page_style:
        page = _take_int(params, "page", default=1, minimum=1, maximum=None, label="Page", errors=errors)
        limit = _take_int(
            params, "per_page", default=10, minimum=1, maximum=50, label="Per page", errors=errors
        )
        offset = (page - 1) * limit
    else:
        limit = _take_int(
            params, "limit", default=10, minimum=1, maximum=50, label="Limit", errors=errors
        )
        offset = _take_int(
            params, "offset", default=0, minimum=0, maximum=None, label="Offset", errors=errors
        )

    if errors:
        raise Problem(422, "Your request is not valid.", errors)
    return ListQuery(author=author, sort=sort, limit=limit, offset=offset, page=page)


def parse_feed_query(params) -> tuple[int, str | None]:
    errors: list[dict] = []
    _unknown_params(params, FEED_PARAMS, errors)
    limit = _take_int(params, "limit", default=10, minimum=1, maximum=50, label="Limit", errors=errors)
    if errors:
        raise Problem(422, "Your request is not valid.", errors)
    cursor = params.get("cursor") if "cursor" in params else None
    return limit, cursor
