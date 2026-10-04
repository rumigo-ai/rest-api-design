"""In-memory library. Restarting the process restores the seed."""

import base64
import json
import math
from pathlib import Path

from lib.errors import Problem

SEED_PATH = Path(__file__).resolve().parents[3] / "seed" / "library.json"


def encode_cursor(after: int) -> str:
    raw = json.dumps({"after": after}).encode()
    return base64.b64encode(raw).decode().rstrip("=")


def decode_cursor(value: str) -> int:
    try:
        if not value or any(ch.isspace() for ch in value):
            raise ValueError
        padded = value + ("=" * (-len(value) % 4))
        raw = base64.b64decode(padded, validate=True)
        data = json.loads(raw)
        after = data["after"] if isinstance(data, dict) else None
        if type(after) is not int or after < 0:
            raise ValueError
        return after
    except (ValueError, KeyError, json.JSONDecodeError, TypeError):
        raise Problem(400, "The cursor is not valid.") from None


def sort_books(books: list[dict], sort: str) -> None:
    if sort == "id":
        books.sort(key=lambda book: book["id"])
    elif sort == "-id":
        books.sort(key=lambda book: -book["id"])
    elif sort == "title":
        books.sort(key=lambda book: (book["title"].casefold(), book["id"]))
    elif sort == "-title":
        books.sort(key=lambda book: book["id"])
        books.sort(key=lambda book: book["title"].casefold(), reverse=True)
    elif sort == "year":
        books.sort(key=lambda book: (book["year"], book["id"]))
    elif sort == "-year":
        books.sort(key=lambda book: (-book["year"], book["id"]))
    else:
        raise ValueError(sort)


class Store:
    def __init__(self) -> None:
        self.authors: dict[int, dict] = {}
        self.books: dict[int, dict] = {}
        self.next_book_id = 1
        self.reset()

    def reset(self) -> None:
        data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
        self.authors = {author["id"]: dict(author) for author in data["authors"]}
        self.books = {book["id"]: dict(book) for book in data["books"]}
        self.next_book_id = max(self.books) + 1 if self.books else 1

    def list_authors(self) -> list[dict]:
        return [self.authors[key] for key in sorted(self.authors)]

    def get_author(self, author_id: int) -> dict | None:
        return self.authors.get(author_id)

    def get_book(self, book_id: int) -> dict | None:
        book = self.books.get(book_id)
        return dict(book) if book else None

    def create_book(self, title: str, author: str, year: int) -> dict:
        book = {"id": self.next_book_id, "title": title, "author": author, "year": year}
        self.books[book["id"]] = book
        self.next_book_id += 1
        return dict(book)

    def replace_book(self, book_id: int, title: str, author: str, year: int) -> dict:
        book = {"id": book_id, "title": title, "author": author, "year": year}
        self.books[book_id] = book
        return dict(book)

    def update_book(self, book_id: int, changes: dict) -> dict:
        self.books[book_id].update(changes)
        return dict(self.books[book_id])

    def delete_book(self, book_id: int) -> bool:
        return self.books.pop(book_id, None) is not None

    def list_books(
        self, *, author: str | None, sort: str, offset: int, limit: int
    ) -> tuple[list[dict], int]:
        rows = [dict(book) for book in self.books.values()]
        if author is not None:
            wanted = author.casefold()
            rows = [book for book in rows if book["author"].casefold() == wanted]
        sort_books(rows, sort)
        total = len(rows)
        return rows[offset : offset + limit], total

    def feed(self, *, limit: int, after: int | None) -> tuple[list[dict], str | None]:
        ids = sorted(self.books)
        if after is not None:
            ids = [book_id for book_id in ids if book_id > after]
        window = ids[: limit + 1]
        chosen = window[:limit]
        data = [dict(self.books[book_id]) for book_id in chosen]
        next_cursor = encode_cursor(chosen[-1]) if len(window) > limit else None
        return data, next_cursor


def page_meta(*, total: int, limit: int, offset: int, page: int | None) -> dict:
    meta = {"total": total, "limit": limit, "offset": offset}
    if page is not None:
        meta["page"] = page
        meta["total_pages"] = math.ceil(total / limit) if limit else 0
    return meta


store = Store()
