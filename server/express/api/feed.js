import { Router } from 'express';

import { decodeCursor, store } from '../lib/store.js';
import { parseFeedQuery } from '../lib/validate.js';

export const feedRouter = Router();

feedRouter.get('/v1/feed/books', (req, res) => {
  const { limit, cursor } = parseFeedQuery(req.query);
  const after = cursor === undefined ? null : decodeCursor(cursor);
  const { data, nextCursor } = store.feed({ limit, after });
  res.json({ data, next_cursor: nextCursor });
});
