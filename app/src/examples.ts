export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type Example = {
  id: string
  title: string
  expect: string
  explain: string
  method: Method
  path: string
  params: string
}

export type ExampleGroup = {
  title: string
  blurb?: string
  examples: Example[]
}

function params(query: Record<string, string>, body: unknown = null): string {
  return JSON.stringify({ query, body }, null, 2)
}

const dune = { title: 'Dune', author: 'Frank Herbert', year: 1965 }
const review = { reviewer: 'Ada Lovelace', rating: 5, comment: 'Still sharp.' }

export const groups: ExampleGroup[] = [
  {
    title: 'Build it',
    examples: [
      {
        id: 'read-book',
        title: 'Read book 1',
        expect: '200 OK',
        explain:
          'Book 1 is already in the seed, so this read does not create anything. The body is one book: id 1, Dune, Frank Herbert, 1965. query is empty and body is null, so nothing is added to the path and no body is sent.',
        method: 'GET',
        path: '/v1/books/1',
        params: params({}),
      },
      {
        id: 'create-dune',
        title: 'Create Dune',
        expect: '201 Created',
        explain:
          'POST adds a book. On a fresh server the new id is 51 and the Location header is /v1/books/51. Sending this again is allowed: POST may create a second copy. The body object is sent as JSON.',
        method: 'POST',
        path: '/v1/books',
        params: params({}, dune),
      },
      {
        id: 'patch-year',
        title: 'PATCH the year',
        expect: '200 OK',
        explain:
          'PATCH changes only the fields you send. The year becomes 1966 and the title and author stay. Use the id from the create response. On a fresh server that is 51. Edit the path if you have already created more books.',
        method: 'PATCH',
        path: '/v1/books/51',
        params: params({}, { year: 1966 }),
      },
      {
        id: 'put-missing',
        title: 'PUT with a missing field',
        expect: '422 Unprocessable Content',
        explain:
          'PUT replaces the whole book, so title, author, and year are all required. This body has only the year. The response is problem+json and the errors list names the missing fields. The status line may say Unprocessable Entity while the JSON title says Unprocessable Content. Branch on the number.',
        method: 'PUT',
        path: '/v1/books/51',
        params: params({}, { year: 1965 }),
      },
      {
        id: 'put-full',
        title: 'PUT the whole book',
        expect: '200 OK',
        explain:
          'The same id, this time with title, author, and year. The book is replaced and the id stays the same. Compare this with PATCH: PATCH can send one field, PUT cannot.',
        method: 'PUT',
        path: '/v1/books/51',
        params: params({}, dune),
      },
      {
        id: 'delete-book',
        title: 'Delete the book',
        expect: '204 No Content',
        explain: 'A successful delete has an empty body. There is no JSON to read. The book is gone.',
        method: 'DELETE',
        path: '/v1/books/51',
        params: params({}),
      },
      {
        id: 'delete-again',
        title: 'Delete it again',
        expect: '404 Not Found',
        explain:
          'Deleting the same id a second time does not succeed again. The book stays gone, so this is a missing resource. The body is problem+json, and the header status matches the status field.',
        method: 'DELETE',
        path: '/v1/books/51',
        params: params({}),
      },
    ],
  },
  {
    title: 'Status codes',
    examples: [
      {
        id: 'missing-book',
        title: 'Book 9999',
        expect: '404 Not Found',
        explain:
          'This id is not in the catalog. A useful error uses the real status, Content-Type application/problem+json, and a body with no stack trace. The status in the header and the status field in the JSON are the same number.',
        method: 'GET',
        path: '/v1/books/9999',
        params: params({}),
      },
      {
        id: 'broken-json',
        title: 'Broken JSON',
        expect: '400 Bad Request',
        explain:
          'body is the raw string {, not a JSON object. A string body is sent exactly as written, so the server receives a broken document and rejects it before any field checks. 400 means the request itself is broken. 422 would mean the JSON parsed and a rule failed.',
        method: 'POST',
        path: '/v1/books',
        params: params({}, '{'),
      },
      {
        id: 'empty-title',
        title: 'Empty title, year 1',
        expect: '422 Unprocessable Content',
        explain:
          'This JSON parses. The title is empty and the year is 1, and both break a rule. Look at the errors list: one entry points at /title and one at /year. That is the difference from the broken-JSON example.',
        method: 'POST',
        path: '/v1/books',
        params: params({}, { title: '', author: 'Frank Herbert', year: 1 }),
      },
    ],
  },
  {
    title: 'Pagination',
    examples: [
      {
        id: 'catalog-page',
        title: 'Catalog, first page',
        expect: '200 OK',
        explain:
          'query is empty, so the server uses its default: limit 10, offset 0. meta.total is 50, the whole seed, and data is books 1 through 10. The maximum limit is 50, so a caller cannot ask for an unbounded list.',
        method: 'GET',
        path: '/v1/books',
        params: params({}),
      },
      {
        id: 'offset-page',
        title: 'Offset page',
        expect: '200 OK',
        explain:
          'limit and offset are query fields, so they are appended to the path. This page skips 10 books and returns 5, ids 11 through 15, on a fresh server. meta.total stays 50. Offset counts positions, so a row inserted at the front shifts every later page.',
        method: 'GET',
        path: '/v1/books',
        params: params({ limit: '5', offset: '10' }),
      },
      {
        id: 'page-number',
        title: 'Page number',
        expect: '200 OK',
        explain:
          'page and per_page are another way to write the same offset. Page 3 at 10 per page is offset (3 − 1) × 10 = 20, so meta.offset is 20 and the ids run from 21 through 30. It is still offset pagination. Deep pages stay slow.',
        method: 'GET',
        path: '/v1/books',
        params: params({ page: '3', per_page: '10' }),
      },
      {
        id: 'limit-too-big',
        title: 'Limit above 50',
        expect: '422 Unprocessable Content',
        explain:
          'The catalog refuses a limit above 50. This is a rule on a query value, not a broken URL, so the status is 422. The cap is what stops a caller from asking for every row in one request.',
        method: 'GET',
        path: '/v1/books',
        params: params({ limit: '51' }),
      },
      {
        id: 'feed-first',
        title: 'Feed, first page',
        expect: '200 OK',
        explain:
          'The feed is for infinite scroll. It does not use offset. The body has data and next_cursor. On a fresh server the first page is ids 1 through 5 and next_cursor is eyJhZnRlciI6IDV9, the base64 of {"after": 5}. Clients should treat that string as opaque.',
        method: 'GET',
        path: '/v1/feed/books',
        params: params({ limit: '5' }),
      },
      {
        id: 'feed-cursor',
        title: 'Feed, second page',
        expect: '200 OK',
        explain:
          'Send the cursor from the previous page back as a query field. This saved cursor is the fresh-server value, so the page starts at id 6. If you created books, paste the new next_cursor into query. Stop when next_cursor is null.',
        method: 'GET',
        path: '/v1/feed/books',
        params: params({ limit: '5', cursor: 'eyJhZnRlciI6IDV9' }),
      },
      {
        id: 'bad-cursor',
        title: 'Bad cursor',
        expect: '400 Bad Request',
        explain:
          'not-a-cursor does not decode, so the request is broken. That is 400, the same class of failure as a body of {. A cursor the server issued and a cursor the client invented are different things.',
        method: 'GET',
        path: '/v1/feed/books',
        params: params({ cursor: 'not-a-cursor' }),
      },
    ],
  },
  {
    title: 'Authors',
    examples: [
      {
        id: 'author-list',
        title: 'Author catalog',
        expect: '200 OK',
        explain:
          'Authors are their own resource. This list is the whole catalog and it is not paginated, because it is small and stable. Ten authors come back.',
        method: 'GET',
        path: '/v1/authors',
        params: params({}),
      },
      {
        id: 'author-one',
        title: 'Author 7',
        expect: '200 OK',
        explain:
          'Jane Austen is author 7, the example from the URL-design part of the session. The path names the resource and the id. It does not use a verb such as /getAuthor.',
        method: 'GET',
        path: '/v1/authors/7',
        params: params({}),
      },
      {
        id: 'author-books',
        title: "Author 7's books",
        expect: '200 OK',
        explain:
          "One level of nesting: this author's books, not a second level under each book. Five books come back. limit is a query field on this list the same way it is on the catalog.",
        method: 'GET',
        path: '/v1/authors/7/books',
        params: params({ limit: '10' }),
      },
    ],
  },
  {
    title: 'Practice',
    examples: [
      {
        id: 'v2-book',
        title: 'v2, read book 1',
        expect: '200 OK',
        explain:
          'The version lives in the path. v2 adds links.self, here /v2/books/1, and keeps id, title, author, and year. GET /v1/books/1 stays the old shape, so existing clients do not change. Book 9999 on /v2/books/9999 is still 404.',
        method: 'GET',
        path: '/v2/books/1',
        params: params({}),
      },
      {
        id: 'v2-list',
        title: 'v2, first two books',
        expect: '200 OK',
        explain:
          'A new version of the list uses the same limit and offset rules. meta.total is 50. Each book in data has links.self. The v1 list does not.',
        method: 'GET',
        path: '/v2/books',
        params: params({ limit: '2' }),
      },
      {
        id: 'post-item',
        title: 'POST on one book',
        expect: '405 Method Not Allowed',
        explain:
          'POST creates a resource, so it belongs on the collection, POST /v1/books. This path is already one book. The status is 405, and the Allow header lists GET, PUT, PATCH, and DELETE. The body is problem+json and points at the collection.',
        method: 'POST',
        path: '/v1/books/1',
        params: params({}, { title: 'Dune', author: 'Frank Herbert', year: 1965 }),
      },
      {
        id: 'unknown-field',
        title: 'Unknown field isbn',
        expect: '422 Unprocessable Content',
        explain:
          'The JSON parses, then isbn is not a book field. That is 422 with an errors entry at /isbn. Do not store the extra field and do not ignore it. 400 would mean the document itself was broken.',
        method: 'POST',
        path: '/v1/books',
        params: params({}, { title: 'Dune', author: 'Frank Herbert', year: 1965, isbn: '978-0-441-17271-9' }),
      },
      {
        id: 'empty-author',
        title: 'Author matches nothing',
        expect: '200 OK',
        explain:
          'author=Nobody is a valid filter that matches no rows. data is an empty array and meta.total is 0. That is 200. 404 would mean the list endpoint itself is missing. A bad sort such as sort=pages is the 422 next to this: the query broke a rule.',
        method: 'GET',
        path: '/v1/books',
        params: params({ author: 'Nobody' }),
      },
    ],
  },
  {
    title: 'Reviews',
    blurb:
      'Not mounted. Fill in worksheet/reviews, then wire server/fastapi/api/reviews.py and server/express/api/reviews.js into the apps and restart. Until then every item here is 404.',
    examples: [
      {
        id: 'create-review',
        title: 'Create a review',
        expect: '404 until wired in, then 201 Created',
        explain:
          'The room designs this route in worksheet/reviews first, so the servers do not mount it yet. After you wire api/reviews into both apps and restart, this creates a review on book 1. Look for 201, a Location header of /v1/books/1/reviews/1, and a body with the id the server assigned. Sending it a second time is 409.',
        method: 'POST',
        path: '/v1/books/1/reviews',
        params: params({}, review),
      },
      {
        id: 'review-again',
        title: 'Same reviewer again',
        expect: '404 until wired in, then 409 Conflict',
        explain:
          'Run Create a review first. This body uses ada lovelace, and the duplicate check ignores case, so it is the same reviewer. The detail says Ada Lovelace already reviewed book 1. Until api/reviews is wired into both servers and they are restarted, Send returns 404.',
        method: 'POST',
        path: '/v1/books/1/reviews',
        params: params({}, { reviewer: 'ada lovelace', rating: 5, comment: 'Still sharp.' }),
      },
      {
        id: 'review-rating',
        title: 'Rating 0',
        expect: '404 until wired in, then 422',
        explain:
          'A rating must be an integer from 1 to 5. Zero is valid JSON that breaks that rule, so it is 422, not 400. A missing reviewer is the same status. Until api/reviews is wired into both servers and they are restarted, the route does not exist.',
        method: 'POST',
        path: '/v1/books/1/reviews',
        params: params({}, { reviewer: 'Ada Lovelace', rating: 0, comment: 'Still sharp.' }),
      },
      {
        id: 'review-missing-book',
        title: 'Unknown book',
        expect: '404 until wired in, then 404 for the book',
        explain:
          'Book 9999 is not in the catalog, so a review cannot be attached to it. After api/reviews is wired in, the body is problem+json for the missing book rather than a missing route. Checks run in this order: validate the body, look up the book, then look for a duplicate.',
        method: 'POST',
        path: '/v1/books/9999/reviews',
        params: params({}, review),
      },
      {
        id: 'list-reviews',
        title: 'List reviews',
        expect: '404 until wired in, then 200 OK',
        explain:
          'The list uses a cursor, the same idea as the book feed. The body is data plus next_cursor, and next_cursor is null on the last page. Default limit is 10 and the maximum is 50. Until api/reviews is wired into both servers and they are restarted, this 404s.',
        method: 'GET',
        path: '/v1/books/1/reviews',
        params: params({ limit: '10' }),
      },
      {
        id: 'review-bad-cursor',
        title: 'Bad review cursor',
        expect: '404 until wired in, then 400',
        explain:
          'A review cursor that does not decode is a broken request, so 400. That check happens before the book lookup. Until api/reviews is wired into both servers and they are restarted, the path itself 404s.',
        method: 'GET',
        path: '/v1/books/1/reviews',
        params: params({ cursor: 'not-a-cursor' }),
      },
      {
        id: 'review-limit',
        title: 'Review limit above 50',
        expect: '404 until wired in, then 422',
        explain:
          'The review list uses the same cap as the catalog. limit 51 is a rule failure, so 422. Until api/reviews is wired into both servers and they are restarted, Send returns 404.',
        method: 'GET',
        path: '/v1/books/1/reviews',
        params: params({ limit: '51' }),
      },
    ],
  },
]

export const examples = groups.flatMap((group) => group.examples)

export function findExample(id: string): Example {
  const example = examples.find((item) => item.id === id)
  if (!example) return examples[0]
  return example
}
