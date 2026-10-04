# Library API contract

Phase 1. FastAPI on port 8000 and Express on port 8001 both follow this page. A curl that works on one host works on the other.

## Resources

A book:

```json
{"id": 1, "title": "Dune", "author": "Frank Herbert", "year": 1965}
```

`title` is 1–200 characters. `author` is 1–100 characters. `year` is an integer from 1450 to 2100. The server assigns `id`. Clients do not send `id`.

The author catalog is a separate list of `{id, name}`. A book's `author` is the person's name. Names match without regard to case. Creating a book for a name that is not in the catalog does not add an author. `GET /v1/authors/7` is Jane Austen, which is the author on the URL-design slide.

The seed has 50 books, ids 1 through 50. The next created book is 51. Restarting the process restores the seed.

## Books

| Method | Path | Success |
| --- | --- | --- |
| GET | `/v1/books` | 200 and a page |
| POST | `/v1/books` | 201, `Location: /v1/books/{id}`, and the book |
| GET | `/v1/books/{id}` | 200 and the book |
| PUT | `/v1/books/{id}` | 200 and the replaced book |
| PATCH | `/v1/books/{id}` | 200 and the book |
| DELETE | `/v1/books/{id}` | 204 and an empty body |

PUT sends `title`, `author`, and `year`. A missing field is 422. PATCH sends only the fields that change. `{}` is a valid PATCH and changes nothing. Sending the same title twice is allowed: POST is not idempotent.

Deleting a book that exists returns 204. Deleting it again returns 404. The book stays gone, which is the idempotent effect. The second status tells the client it is already gone.

## Authors

| Method | Path | Success |
| --- | --- | --- |
| GET | `/v1/authors` | 200 `{"data": [ ... ]}` |
| GET | `/v1/authors/{id}` | 200 and one author |
| GET | `/v1/authors/{id}/books` | 200 and a book page, already filtered to that author |

The catalog is small, so `GET /v1/authors` is not paginated and takes no query parameters. The nested book list uses the same list query as `/v1/books`, except `author` is not accepted there. The path already chose the author.

## List query

Use one style on a single request.

Offset:

```
GET /v1/books?limit=5&offset=10
```

```json
{"data": [], "meta": {"total": 50, "limit": 5, "offset": 10}}
```

Page number:

```
GET /v1/books?page=3&per_page=10
```

`offset = (page - 1) * per_page`. The meta object also includes `page` and `total_pages`.

`limit` and `per_page` default to 10. The maximum is 50. Above that, or below 1, the response is 422. `offset` defaults to 0. `page` defaults to 1. A page past the end is 200 with an empty `data` array.

Optional:

- `author` filters by name, case-insensitive, exact.
- `sort` is one of `id`, `-id`, `title`, `-title`, `year`, `-year`. The default is `id`. Equal keys stay in id order, so pages do not shuffle.

Sending `page` or `per_page` together with `limit` or `offset` is 422. An unknown query parameter is 422. A cursor belongs on the feed, so `cursor` on `/v1/books` is 422.

## Feed

```
GET /v1/feed/books?limit=5
GET /v1/feed/books?limit=5&cursor=eyJhZnRlciI6IDV9
```

```json
{"data": [], "next_cursor": "eyJhZnRlciI6IDV9"}
```

The feed is always in id order. The server reads `limit + 1` rows. `next_cursor` is null on the last page. The cursor is base64 of `{"after": 5}` with a space after the colon. That string is `eyJhZnRlciI6IDV9`. Clients treat it as opaque. A cursor that does not decode is 400. A well-formed cursor past the last id is 200 with an empty page.

With 50 books, `limit=20` walks the feed in three calls. The third call has `next_cursor: null`.

## Errors

Failures use `Content-Type: application/problem+json`. The status in the header and the `status` field match. The body has `type`, `title`, `status`, and `detail`. Field errors add `errors`. There is no stack trace, SQL, or file path.

```json
{
  "type": "about:blank",
  "title": "Unprocessable Content",
  "status": 422,
  "detail": "Your request is not valid.",
  "errors": [
    {"pointer": "/title", "detail": "Field required"}
  ]
}
```

| Situation | Status | Title |
| --- | --- | --- |
| JSON does not parse | 400 | Bad Request |
| Cursor does not decode | 400 | Bad Request |
| Book id or author id is missing | 404 | Not Found |
| JSON parsed, but a field breaks a rule | 422 | Unprocessable Content |
| Query breaks a rule, including limit above 50 | 422 | Unprocessable Content |
| POST on one book, `/v1/books/{id}` | 405 | Method Not Allowed |

The JSON `title` for 422 is `Unprocessable Content`. The status line may still say `Unprocessable Entity`. That phrase comes from Python and Node, which still print the older wording. Read the number, and the `title` field.

An unknown body field, such as `isbn` on a book, is 422 with pointer `/isbn`. A list filter that matches nothing is 200 with `"data": []` and `meta.total` 0, not 404. `POST /v1/books/{id}` is 405. The `Allow` header is `GET, PUT, PATCH, DELETE`. Create stays `POST /v1/books`.

## Version 2

`GET /v2/books` and `GET /v2/books/{id}` use the same rules as v1. Each book adds `links.self`, for example `"/v2/books/1"`. v1 responses do not grow that field. A missing v2 id is the same 404 as v1.

404 detail looks like `Book 9999 not found.` or `Author 99 not found.` A 404 body has no `errors` array. A path that is not an integer, such as `/v1/books/abc`, is 422 with pointer `/id`.
