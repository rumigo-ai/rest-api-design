from fastapi import APIRouter, Request

from lib.schemas import parse_feed_query
from lib.store import decode_cursor, store

router = APIRouter(prefix="/v1/feed", tags=["feed"])


@router.get("/books")
def list_feed(request: Request) -> dict:
    limit, cursor = parse_feed_query(request.query_params)
    after = decode_cursor(cursor) if cursor is not None else None
    data, next_cursor = store.feed(limit=limit, after=after)
    return {"data": data, "next_cursor": next_cursor}
