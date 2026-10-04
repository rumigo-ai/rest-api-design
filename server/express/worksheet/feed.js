/** Not imported by app.js. The running server uses api/feed.js. Fill these in. */

import { Router } from 'express';

export const feedRouter = Router();

feedRouter.get('/v1/feed/books', (req, res) => {
  // GET /v1/feed/books?limit=5 -> 200. On a fresh server, ids 1 through 5.
  // next_cursor is eyJhZnRlciI6IDV9, base64 of {"after": 5}. Clients treat it as opaque.
  // GET /v1/feed/books?limit=5&cursor=eyJhZnRlciI6IDV9 -> the page starts at id 6.
  // Stop when next_cursor is null.
  // GET /v1/feed/books?cursor=not-a-cursor -> 400.
});
