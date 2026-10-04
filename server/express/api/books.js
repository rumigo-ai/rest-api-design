import { Router } from 'express';

import { HttpError, sendProblem } from '../lib/errors.js';
import { pageMeta, store } from '../lib/store.js';
import { changesFrom, parseListQuery, readId, validateBook } from '../lib/validate.js';

export const booksRouter = Router();

function requireBook(bookId) {
  const book = store.getBook(bookId);
  if (!book) throw new HttpError(404, `Book ${bookId} not found.`);
  return book;
}

booksRouter.get('/v1/books', (req, res) => {
  const query = parseListQuery(req.query);
  const { data, total } = store.listBooks(query);
  res.json({ data, meta: pageMeta({ ...query, total }) });
});

booksRouter.post('/v1/books', (req, res) => {
  const errors = validateBook(req.body, { partial: false });
  if (errors.length) throw new HttpError(422, 'Your request is not valid.', errors);
  const book = store.createBook(req.body);
  res.status(201).set('Location', `/v1/books/${book.id}`).json(book);
});

booksRouter.post('/v1/books/:id', (req, res) => {
  const bookId = readId(req.params.id);
  res.set('Allow', 'GET, PUT, PATCH, DELETE');
  sendProblem(
    res,
    405,
    `POST is not allowed on /v1/books/${bookId}. Create a book with POST /v1/books.`,
  );
});

booksRouter.get('/v1/books/:id', (req, res) => {
  res.json(requireBook(readId(req.params.id)));
});

booksRouter.put('/v1/books/:id', (req, res) => {
  const bookId = readId(req.params.id);
  const errors = validateBook(req.body, { partial: false });
  if (errors.length) throw new HttpError(422, 'Your request is not valid.', errors);
  requireBook(bookId);
  res.json(store.replaceBook(bookId, req.body));
});

booksRouter.patch('/v1/books/:id', (req, res) => {
  const bookId = readId(req.params.id);
  const errors = validateBook(req.body, { partial: true });
  if (errors.length) throw new HttpError(422, 'Your request is not valid.', errors);
  requireBook(bookId);
  res.json(store.updateBook(bookId, changesFrom(req.body)));
});

booksRouter.delete('/v1/books/:id', (req, res) => {
  const bookId = readId(req.params.id);
  if (!store.deleteBook(bookId)) {
    throw new HttpError(404, `Book ${bookId} not found.`);
  }
  res.status(204).end();
});
