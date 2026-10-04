"""Not imported by main.py. The running server uses api/feed.py. Fill these in."""

from fastapi import APIRouter, Request

from lib.schemas import parse_feed_query
from lib.store import decode_cursor, store

router = APIRouter(prefix="/v1/feed", tags=["feed"])


@router.get("/books")
def list_feed(request: Request) -> dict:
    # GET /v1/feed/books?limit=5 -> 200. On a fresh server, ids 1 through 5.
    # next_cursor is eyJhZnRlciI6IDV9, base64 of {"after": 5}. Clients treat it as opaque.
    # GET /v1/feed/books?limit=5&cursor=eyJhZnRlciI6IDV9 -> the page starts at id 6.
    # Stop when next_cursor is null.
    # GET /v1/feed/books?cursor=not-a-cursor -> 400.
    ...
