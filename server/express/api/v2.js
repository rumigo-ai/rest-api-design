/** Version 2 of the book resource. v1 stays as it is. */

import { Router } from 'express';

import { HttpError } from '../lib/errors.js';
import { pageMeta, store } from '../lib/store.js';
import { parseListQuery, readId } from '../lib/validate.js';

export const v2Router = Router();

function withLink(book) {
  return { ...book, links: { self: `/v2/books/${book.id}` } };
}

v2Router.get('/v2/books', (req, res) => {
  const query = parseListQuery(req.query);
  const { data, total } = store.listBooks(query);
  res.json({ data: data.map(withLink), meta: pageMeta({ ...query, total }) });
});

v2Router.get('/v2/books/:id', (req, res) => {
  const bookId = readId(req.params.id);
  const book = store.getBook(bookId);
  if (!book) throw new HttpError(404, `Book ${bookId} not found.`);
  res.json(withLink(book));
});
