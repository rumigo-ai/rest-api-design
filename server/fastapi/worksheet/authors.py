"""Not imported by main.py. The running server uses api/authors.py. Fill these in."""

from fastapi import APIRouter, Request

from lib.errors import Problem
from lib.schemas import parse_list_query
from lib.store import page_meta, store

router = APIRouter(prefix="/v1/authors", tags=["authors"])


@router.get("")
def list_authors(request: Request) -> dict:
    # GET /v1/authors -> 200, the whole catalog, ten authors, not paginated.
    # Any query parameter -> 422.
    ...


@router.get("/{author_id}")
def get_author(author_id: int) -> dict:
    # GET /v1/authors/7 -> 200, Jane Austen.
    # A missing id -> 404 problem+json.
    ...


@router.get("/{author_id}/books")
def list_author_books(author_id: int, request: Request) -> dict:
    # GET /v1/authors/7/books?limit=10 -> 200, five books. One level of nesting.
    ...
