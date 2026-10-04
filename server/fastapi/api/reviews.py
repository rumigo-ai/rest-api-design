"""Finished reviews resource. Not mounted.

After the worksheet, add these two lines to main.py and restart:

    from api.reviews import router as reviews_router
    app.include_router(reviews_router)
"""

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from lib.errors import Problem
from lib.schemas import parse_feed_query
from lib.store import decode_cursor, encode_cursor, store

router = APIRouter(prefix="/v1/books/{book_id}/reviews", tags=["reviews"])

_reviews: dict[int, dict] = {}
_next_review_id = 1


class ReviewIn(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    reviewer: str = Field(min_length=1, max_length=100)
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)


def reviews_for(book_id: int) -> list[dict]:
    rows = [dict(review) for review in _reviews.values() if review["book_id"] == book_id]
    rows.sort(key=lambda review: review["id"])
    return rows


def create_review(book_id: int, reviewer: str, rating: int, comment: str | None) -> dict:
    global _next_review_id
    folded = reviewer.casefold()
    for review in _reviews.values():
        if review["book_id"] == book_id and review["reviewer"].casefold() == folded:
            raise Problem(409, f"{reviewer} already reviewed book {book_id}.")
    review = {
        "id": _next_review_id,
        "book_id": book_id,
        "reviewer": reviewer,
        "rating": rating,
        "comment": comment,
    }
    _reviews[review["id"]] = review
    _next_review_id += 1
    return dict(review)


@router.get("")
def list_reviews(book_id: int, request: Request) -> dict:
    limit, cursor = parse_feed_query(request.query_params)
    after = decode_cursor(cursor) if cursor is not None else None
    if store.get_book(book_id) is None:
        raise Problem(404, f"Book {book_id} not found.")
    rows = reviews_for(book_id)
    if after is not None:
        rows = [row for row in rows if row["id"] > after]
    window = rows[: limit + 1]
    chosen = window[:limit]
    next_cursor = encode_cursor(chosen[-1]["id"]) if len(window) > limit else None
    return {"data": chosen, "next_cursor": next_cursor}


@router.post("", status_code=201)
def create_review_route(book_id: int, body: ReviewIn, response: Response) -> dict:
    if store.get_book(book_id) is None:
        raise Problem(404, f"Book {book_id} not found.")
    review = create_review(book_id, body.reviewer, body.rating, body.comment)
    response.headers["Location"] = f"/v1/books/{book_id}/reviews/{review['id']}"
    return review
