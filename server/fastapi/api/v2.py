"""Version 2 of the book resource. v1 stays as it is."""

from fastapi import APIRouter, Request

from lib.errors import Problem
from lib.schemas import parse_list_query
from lib.store import page_meta, store

router = APIRouter(prefix="/v2/books", tags=["books-v2"])


def with_link(book: dict) -> dict:
    body = dict(book)
    body["links"] = {"self": f"/v2/books/{book['id']}"}
    return body


@router.get("")
def list_books_v2(request: Request) -> dict:
    query = parse_list_query(request.query_params)
    data, total = store.list_books(
        author=query.author, sort=query.sort, offset=query.offset, limit=query.limit
    )
    return {
        "data": [with_link(book) for book in data],
        "meta": page_meta(
            total=total, limit=query.limit, offset=query.offset, page=query.page
        ),
    }


@router.get("/{book_id}")
def get_book_v2(book_id: int) -> dict:
    book = store.get_book(book_id)
    if book is None:
        raise Problem(404, f"Book {book_id} not found.")
    return with_link(book)
