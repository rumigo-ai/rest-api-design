from fastapi import APIRouter, Request, Response

from lib.errors import Problem, problem_response
from lib.schemas import BookIn, BookPatch, parse_list_query
from lib.store import page_meta, store

router = APIRouter(prefix="/v1/books", tags=["books"])


@router.get("")
def list_books(request: Request) -> dict:
    query = parse_list_query(request.query_params)
    data, total = store.list_books(
        author=query.author, sort=query.sort, offset=query.offset, limit=query.limit
    )
    return {
        "data": data,
        "meta": page_meta(
            total=total, limit=query.limit, offset=query.offset, page=query.page
        ),
    }


@router.post("", status_code=201)
def create_book(body: BookIn, response: Response) -> dict:
    book = store.create_book(title=body.title, author=body.author, year=body.year)
    response.headers["Location"] = f"/v1/books/{book['id']}"
    return book


@router.post("/{book_id}", status_code=405)
def post_book_item(book_id: int):
    # POST belongs on the collection. The item path already has GET, PUT, PATCH, and DELETE.
    response = problem_response(
        405,
        f"POST is not allowed on /v1/books/{book_id}. Create a book with POST /v1/books.",
    )
    response.headers["Allow"] = "GET, PUT, PATCH, DELETE"
    return response


@router.get("/{book_id}")
def get_book(book_id: int) -> dict:
    book = store.get_book(book_id)
    if book is None:
        raise Problem(404, f"Book {book_id} not found.")
    return book


@router.put("/{book_id}")
def replace_book(book_id: int, body: BookIn) -> dict:
    if store.get_book(book_id) is None:
        raise Problem(404, f"Book {book_id} not found.")
    return store.replace_book(book_id, title=body.title, author=body.author, year=body.year)


@router.patch("/{book_id}")
def update_book(book_id: int, body: BookPatch) -> dict:
    if store.get_book(book_id) is None:
        raise Problem(404, f"Book {book_id} not found.")
    changes = body.model_dump(exclude_unset=True)
    errors = []
    for field, value in changes.items():
        if value is None and field == "year":
            errors.append({"pointer": "/year", "detail": "Year must be an integer"})
        elif value is None:
            errors.append({"pointer": f"/{field}", "detail": "Field must be a string"})
    if errors:
        raise Problem(422, "Your request is not valid.", errors)
    return store.update_book(book_id, changes)


@router.delete("/{book_id}", status_code=204)
def delete_book(book_id: int) -> Response:
    if not store.delete_book(book_id):
        raise Problem(404, f"Book {book_id} not found.")
    return Response(status_code=204)
