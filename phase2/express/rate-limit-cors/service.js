/**
 * Fixed-window rate limits, then a hand-written CORS allow-list.
 *
 * Read this file from top to bottom. A request hits the middleware first:
 * 1. Build the CORS headers for this origin.
 * 2. OPTIONS stops there. It is only the browser asking permission.
 * 3. Count the request. Login has its own, smaller window.
 * 4. Over the cap: 429 and stop. Under the cap: run the route, then add headers.
 *
 *   node service.js
 *
 * Listens on http://127.0.0.1:8031
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

const PORT = 8031;
const WINDOW_SECONDS = 60;

// Tests lower these. Each request reads the current numbers.
export const limits = { general: 60, login: 5 };

const ALLOWED_ORIGINS = new Set(['http://localhost:3000']);
const ALLOWED_METHODS = 'GET, POST';
const ALLOWED_HEADERS = 'Authorization, Content-Type';

const BOOKS = [
  { id: 1, title: 'Dune', author: 'Frank Herbert', year: 1965 },
  { id: 2, title: 'Neuromancer', author: 'William Gibson', year: 1984 },
];

// A tiny login so the stricter window has a route. Tokens live in the jwt file.
const USERS = { alice: 'alice-pass' };

// bucket -> { start: seconds, count }. This process only.
const windows = new Map();

const TITLES = {
  400: 'Bad Request',
  401: 'Unauthorized',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

class Problem extends Error {
  constructor(status, detail, errors = null) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.errors = errors;
  }
}

export function resetLimits() {
  windows.clear();
}

function sendProblem(res, status, detail, errors, headers) {
  // Every error uses the same JSON shape.
  const body = {
    type: 'about:blank',
    title: TITLES[status] || 'Error',
    status,
    detail,
  };
  if (errors && errors.length) body.errors = errors;
  if (headers) res.set(headers);
  res.status(status).type('application/problem+json').json(body);
}

function clientIp(req) {
  // Who to count. Use the socket address. A client can forge X-Forwarded-For.
  return req.socket.remoteAddress || 'unknown';
}

function limitFor(pathName) {
  // Login is its own bucket, with a smaller cap. Everything else shares one.
  if (pathName === '/v1/auth/login') return { bucket: 'login', limit: limits.login };
  return { bucket: 'general', limit: limits.general };
}

function takeSlot(bucket, limit) {
  // Count one request. Return allowed, remaining, and seconds until reset.
  const now = Date.now() / 1000;
  let window = windows.get(bucket);

  // No window yet, or this minute has ended: start again at zero.
  if (!window || now - window.start >= WINDOW_SECONDS) {
    window = { start: now, count: 0 };
    windows.set(bucket, window);
  }

  const elapsed = now - window.start;
  const reset = Math.max(1, Math.ceil(WINDOW_SECONDS - elapsed));

  // Already full. Do not count this request.
  if (window.count >= limit) return { allowed: false, remaining: 0, reset };

  window.count += 1;
  return { allowed: true, remaining: limit - window.count, reset };
}

function corsHeaders(origin) {
  // Allow one origin. Any other origin gets no Allow-Origin header.
  const headers = { Vary: 'Origin' };
  if (!ALLOWED_ORIGINS.has(origin)) return headers;
  headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Methods'] = ALLOWED_METHODS;
  headers['Access-Control-Allow-Headers'] = ALLOWED_HEADERS;
  return headers;
}

function rateLimitHeaders(limit, remaining, reset) {
  // The two headers a successful response sends.
  return {
    'RateLimit-Policy': `${limit};w=${WINDOW_SECONDS}`,
    RateLimit: `limit=${limit}, remaining=${remaining}, reset=${reset}`,
  };
}

function loginErrors(body) {
  const errors = [];
  if (!body || typeof body.username !== 'string' || body.username.length === 0) {
    errors.push({ pointer: '/username', detail: 'Field required' });
  }
  if (!body || typeof body.password !== 'string' || body.password.length === 0) {
    errors.push({ pointer: '/password', detail: 'Field required' });
  }
  return errors;
}

export const app = express();

app.use((req, res, next) => {
  const cors = corsHeaders(req.get('origin'));

  // The browser asks with OPTIONS before POST. Answer and do not count it.
  if (req.method === 'OPTIONS') {
    res.status(204).set(cors).end();
    return;
  }

  const { bucket, limit } = limitFor(req.path);
  const slot = takeSlot(`${clientIp(req)}:${bucket}`, limit);
  if (!slot.allowed) {
    sendProblem(res, 429, 'Too many requests.', null, {
      ...cors,
      'Retry-After': String(slot.reset),
    });
    return;
  }

  res.set(cors);
  res.set(rateLimitHeaders(limit, slot.remaining, slot.reset));
  next();
});

app.use(express.json());

// A normal route, so you can watch the 60-per-minute window.
app.get('/v1/books', (_req, res) => {
  res.json({ data: BOOKS });
});

// A small login, so you can watch the 5-per-minute window. Failed tries count.
app.post('/v1/auth/login', (req, res, next) => {
  const errors = loginErrors(req.body);
  if (errors.length) {
    next(new Problem(422, 'Your request is not valid.', errors));
    return;
  }
  const stored = USERS[req.body.username];
  if (stored === undefined || stored !== req.body.password) {
    next(new Problem(401, 'Username or password is wrong.'));
    return;
  }
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  if (err instanceof Problem) {
    sendProblem(res, err.status, err.detail, err.errors);
    return;
  }
  // express.json() reports malformed JSON as this error type.
  if (err.type === 'entity.parse.failed') {
    sendProblem(res, 400, 'The JSON is broken.');
    return;
  }
  sendProblem(res, 500, 'Something went wrong.');
});

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invoked === thisFile) {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`Rate limit and CORS on http://127.0.0.1:${PORT}`);
  });
}
