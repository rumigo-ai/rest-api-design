/**
 * Not imported by app.js. Design this before you open api/reviews.js.
 *
 * Wire the finished router in app.js only after the room has filled this in.
 * Until then these paths 404.
 */

import { Router } from 'express';

export const reviewsRouter = Router();

reviewsRouter.get('/v1/books/:id/reviews', (req, res) => {
  // GET /v1/books/1/reviews?limit=10 -> 200 {"data": [...], "next_cursor": null} on the last page.
  // Default limit 10, maximum 50. limit=51 -> 422.
  // A cursor that does not decode -> 400, before the book lookup.
  // Unknown book -> 404.
});

reviewsRouter.post('/v1/books/:id/reviews', (req, res) => {
  // POST /v1/books/1/reviews {"reviewer":"Ada Lovelace","rating":5,"comment":"Still sharp."}
  // -> 201, Location /v1/books/1/reviews/1, and the review with the id the server assigned.
  // The same reviewer again, ignoring case, -> 409. Detail: Ada Lovelace already reviewed book 1.
  // rating 0 or a missing reviewer -> 422.
  // POST /v1/books/9999/reviews -> 404 for the missing book.
  // Check the body first, then the book, then the duplicate.
});
