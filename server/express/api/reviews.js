/**
 * Finished reviews resource. Not mounted.
 *
 * After the worksheet, import reviewsRouter in app.js and
 * app.use(reviewsRouter) before the 404 handler, then restart.
 */

import { Router } from 'express';

import { HttpError } from '../lib/errors.js';
import { decodeCursor, encodeCursor, store } from '../lib/store.js';
import { parseFeedQuery, readId } from '../lib/validate.js';

export const reviewsRouter = Router();

const reviews = new Map();
let nextReviewId = 1;

function validateReview(body) {
  const errors = [];
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return [{ pointer: '/', detail: 'Body must be an object' }];
  }
  if (!Object.hasOwn(body, 'reviewer')) {
    errors.push({ pointer: '/reviewer', detail: 'Field required' });
  } else if (typeof body.reviewer !== 'string') {
    errors.push({ pointer: '/reviewer', detail: 'Field must be a string' });
  } else if (body.reviewer.length < 1) {
    errors.push({ pointer: '/reviewer', detail: 'String should have at least 1 character' });
  } else if (body.reviewer.length > 100) {
    errors.push({ pointer: '/reviewer', detail: 'String should have at most 100 characters' });
  }

  if (!Object.hasOwn(body, 'rating')) {
    errors.push({ pointer: '/rating', detail: 'Field required' });
  } else if (typeof body.rating !== 'number' || !Number.isInteger(body.rating)) {
    errors.push({ pointer: '/rating', detail: 'Rating must be an integer' });
  } else if (body.rating < 1 || body.rating > 5) {
    errors.push({ pointer: '/rating', detail: 'Rating must be between 1 and 5' });
  }

  if (Object.hasOwn(body, 'comment') && body.comment !== null) {
    if (typeof body.comment !== 'string') {
      errors.push({ pointer: '/comment', detail: 'Field must be a string' });
    } else if (body.comment.length > 500) {
      errors.push({ pointer: '/comment', detail: 'String should have at most 500 characters' });
    }
  }

  for (const key of Object.keys(body)) {
    if (!['reviewer', 'rating', 'comment'].includes(key)) {
      errors.push({ pointer: `/${key}`, detail: 'Unknown field' });
    }
  }
  return errors;
}

function createReview(bookId, body) {
  const folded = body.reviewer.toLowerCase();
  for (const review of reviews.values()) {
    if (review.book_id === bookId && review.reviewer.toLowerCase() === folded) {
      throw new HttpError(409, `${body.reviewer} already reviewed book ${bookId}.`);
    }
  }
  const review = {
    id: nextReviewId,
    book_id: bookId,
    reviewer: body.reviewer,
    rating: body.rating,
    comment: Object.hasOwn(body, 'comment') ? body.comment : null,
  };
  reviews.set(review.id, review);
  nextReviewId += 1;
  return { ...review };
}

function reviewPage(bookId, limit, after) {
  let rows = [...reviews.values()]
    .filter((review) => review.book_id === bookId)
    .sort((a, b) => a.id - b.id)
    .map((review) => ({ ...review }));
  if (after != null) rows = rows.filter((review) => review.id > after);
  const window = rows.slice(0, limit + 1);
  const data = window.slice(0, limit);
  const nextCursor = window.length > limit ? encodeCursor(data[data.length - 1].id) : null;
  return { data, nextCursor };
}

reviewsRouter.get('/v1/books/:id/reviews', (req, res) => {
  const bookId = readId(req.params.id);
  const { limit, cursor } = parseFeedQuery(req.query);
  const after = cursor === undefined ? null : decodeCursor(cursor);
  if (!store.getBook(bookId)) throw new HttpError(404, `Book ${bookId} not found.`);
  const page = reviewPage(bookId, limit, after);
  res.json({ data: page.data, next_cursor: page.nextCursor });
});

reviewsRouter.post('/v1/books/:id/reviews', (req, res) => {
  const bookId = readId(req.params.id);
  const errors = validateReview(req.body);
  if (errors.length) throw new HttpError(422, 'Your request is not valid.', errors);
  if (!store.getBook(bookId)) throw new HttpError(404, `Book ${bookId} not found.`);
  const review = createReview(bookId, req.body);
  res.status(201).set('Location', `/v1/books/${bookId}/reviews/${review.id}`).json(review);
});
