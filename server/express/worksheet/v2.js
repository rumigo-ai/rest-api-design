/**
 * Not imported by app.js. The running server uses api/v2.js. Fill these in.
 *
 * Version in the path. Do not change GET /v1/books or GET /v1/books/:id.
 * Old clients keep the four fields. v2 adds links.self.
 */

import { Router } from 'express';

export const v2Router = Router();

v2Router.get('/v2/books', (req, res) => {
  // GET /v2/books?limit=2 -> 200. Same page rules as v1: meta.total is 50, data has two books.
  // Each book still has id, title, author, and year, plus links.self such as /v2/books/1.
  // GET /v1/books?limit=2 stays the old shape, with no links field.
});

v2Router.get('/v2/books/:id', (req, res) => {
  // GET /v2/books/1 -> 200, Dune, plus links.self "/v2/books/1".
  // GET /v2/books/9999 -> 404 problem+json, same as v1.
  // GET /v1/books/1 does not grow a links field. That is why the version is in the path.
});
