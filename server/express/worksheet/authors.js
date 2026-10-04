/** Not imported by app.js. The running server uses api/authors.js. Fill these in. */

import { Router } from 'express';

export const authorsRouter = Router();

authorsRouter.get('/v1/authors', (req, res) => {
  // GET /v1/authors -> 200, the whole catalog, ten authors, not paginated.
  // Any query parameter -> 422.
});

authorsRouter.get('/v1/authors/:id', (req, res) => {
  // GET /v1/authors/7 -> 200, Jane Austen.
  // A missing id -> 404 problem+json.
});

authorsRouter.get('/v1/authors/:id/books', (req, res) => {
  // GET /v1/authors/7/books?limit=10 -> 200, five books. One level of nesting.
});
