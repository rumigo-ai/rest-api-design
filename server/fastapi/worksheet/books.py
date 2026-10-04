"""Not imported by main.py. The running server uses api/books.py. Fill these in."""

from fastapi import APIRouter, Request, Response

from lib.errors import Problem
from lib.schemas import BookIn, BookPatch, parse_list_query
from lib.store import page_meta, store

router = APIRouter(prefix="/v1/books", tags=["books"])


@router.get("")
def list_books(request: Request) -> dict:
    # GET /v1/books -> 200. No query means limit 10, offset 0, meta.total 50, books 1 through 10.
    # GET /v1/books?limit=5&offset=10 -> ids 11 through 15. meta.total stays 50.
    # GET /v1/books?page=3&per_page=10 -> offset (3 - 1) * 10 = 20, ids 21 through 30.
    # GET /v1/books?limit=51 -> 422. The maximum limit is 50.
    # GET /v1/books?sort=pages -> 422. sort must be one of id, -id, title, -title, year, -year.
    # GET /v1/books?author=Nobody -> 200, data is [], meta.total is 0. A filter that matches nothing is not 404.
    ...


@router.post("", status_code=201)
def create_book(body: BookIn, response: Response) -> dict:
    # POST /v1/books {"title":"Dune","author":"Frank Herbert","year":1965}
    # -> 201, Location /v1/books/51 on a fresh server. A second POST is allowed.
    # POST with body "{" -> 400, the document is not JSON.
    # POST {"title":"","author":"Frank Herbert","year":1} -> 422, errors on /title and /year.
    # POST with an extra "isbn" field -> 422, pointer /isbn, detail Unknown field.
    # Do not add isbn to the book. Unknown fields are rejected.
    ...


@router.post("/{book_id}", status_code=405)
def post_book_item(book_id: int):
    # POST /v1/books/1 -> 405 Method Not Allowed.
    # Creating a book is POST /v1/books, the collection. This path is one book.
    # Set Allow: GET, PUT, PATCH, DELETE.
    # The body is problem+json. Detail says to create with POST /v1/books.
    ...


@router.get("/{book_id}")
def get_book(book_id: int) -> dict:
    # GET /v1/books/1 -> 200, Dune, Frank Herbert, 1965.
    # GET /v1/books/9999 -> 404 problem+json. Header status matches the body status.
    ...


@router.put("/{book_id}")
def replace_book(book_id: int, body: BookIn) -> dict:
    # PUT /v1/books/51 with only {"year":1965} -> 422. PUT replaces the whole book.
    # PUT the same id with title, author, and year -> 200. The id stays the same.
    ...


@router.patch("/{book_id}")
def update_book(book_id: int, body: BookPatch) -> dict:
    # PATCH /v1/books/51 {"year":1966} -> 200. Only the year changes.
    ...


@router.delete("/{book_id}", status_code=204)
def delete_book(book_id: int) -> Response:
    # DELETE /v1/books/51 -> 204 and an empty body.
    # DELETE the same id again -> 404. The book stays gone.
    ...
