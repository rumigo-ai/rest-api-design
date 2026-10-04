import express from 'express';

import { HttpError, sendProblem } from './lib/errors.js';
import { authorsRouter } from './api/authors.js';
import { booksRouter } from './api/books.js';
import { docsRouter } from './api/docs.js';
import { feedRouter } from './api/feed.js';
import { v2Router } from './api/v2.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use(express.json());

  app.use(docsRouter);
  app.use(booksRouter);
  app.use(authorsRouter);
  app.use(feedRouter);
  app.use(v2Router);

  app.use((_req, res) => {
    sendProblem(res, 404, 'Not Found');
  });

  app.use((err, _req, res, _next) => {
    if (
      err.type === 'entity.parse.failed' ||
      (err instanceof SyntaxError && err.status === 400)
    ) {
      sendProblem(res, 400, 'The request body is not valid JSON.');
      return;
    }
    if (err instanceof HttpError) {
      sendProblem(res, err.status, err.detail, err.errors);
      return;
    }
    console.error(err);
    sendProblem(res, 500, 'Something went wrong.');
  });

  return app;
}

export const app = createApp();
