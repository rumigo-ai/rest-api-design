import { Router } from 'express';

import { HttpError } from '../lib/errors.js';
import { pageMeta, store } from '../lib/store.js';
import { parseListQuery, readId } from '../lib/validate.js';

export const authorsRouter = Router();

authorsRouter.get('/v1/authors', (req, res) => {
  const keys = Object.keys(req.query);
  if (keys.length) {
    throw new HttpError(
      422,
      'Your request is not valid.',
      keys.map((key) => ({ pointer: `/${key}`, detail: 'Unknown query parameter' })),
    );
  }
  res.json({ data: store.listAuthors() });
});

authorsRouter.get('/v1/authors/:id', (req, res) => {
  const authorId = readId(req.params.id);
  const author = store.getAuthor(authorId);
  if (!author) throw new HttpError(404, `Author ${authorId} not found.`);
  res.json(author);
});

authorsRouter.get('/v1/authors/:id/books', (req, res) => {
  const authorId = readId(req.params.id);
  const author = store.getAuthor(authorId);
  if (!author) throw new HttpError(404, `Author ${authorId} not found.`);
  const query = parseListQuery(req.query, { allowAuthor: false });
  const { data, total } = store.listBooks({ ...query, author: author.name });
  res.json({ data, meta: pageMeta({ ...query, total }) });
});
