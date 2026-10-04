from fastapi import APIRouter, Request

from lib.errors import Problem
from lib.schemas import parse_list_query
from lib.store import page_meta, store

router = APIRouter(prefix="/v1/authors", tags=["authors"])


@router.get("")
def list_authors(request: Request) -> dict:
    if list(request.query_params):
        errors = [
            {"pointer": f"/{key}", "detail": "Unknown query parameter"}
            for key in request.query_params
        ]
        raise Problem(422, "Your request is not valid.", errors)
    return {"data": store.list_authors()}


@router.get("/{author_id}")
def get_author(author_id: int) -> dict:
    author = store.get_author(author_id)
    if author is None:
        raise Problem(404, f"Author {author_id} not found.")
    return author


@router.get("/{author_id}/books")
def list_author_books(author_id: int, request: Request) -> dict:
    author = store.get_author(author_id)
    if author is None:
        raise Problem(404, f"Author {author_id} not found.")
    query = parse_list_query(request.query_params, allow_author=False)
    data, total = store.list_books(
        author=author["name"], sort=query.sort, offset=query.offset, limit=query.limit
    )
    return {
        "data": data,
        "meta": page_meta(
            total=total, limit=query.limit, offset=query.offset, page=query.page
        ),
    }
