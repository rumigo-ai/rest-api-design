/**
 * JWT bearer tokens. Log in once, then send the token on each request.
 *
 * Read this file from top to bottom:
 * 1. Check the password and issue a token.
 * 2. On later requests, read the header, verify the token, then read the user.
 * 3. The route then checks role (403) or ownership (404).
 *
 *   node service.js
 *
 * Listens on http://127.0.0.1:8021
 */

import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import jwt from 'jsonwebtoken';

const PORT = 8021;

// Production reads this from the environment. It is a constant so the demo runs.
const JWT_SECRET = 'phase2-demo-secret-do-not-use-in-production';
export const JWT_ISSUER = 'library-api';
export const JWT_AUDIENCE = 'library-clients';
const TOKEN_TTL_SECONDS = 900;

const TOKEN_PROBLEM = 'Token is missing, invalid, or expired.';
const LOGIN_PROBLEM = 'Username or password is wrong.';
// Compared when the username is missing, so both failures do the same work.
const UNKNOWN_PASSWORD = 'alice-pass';

// Alice is 7, Bob is 8. Loan 12 belongs to Bob.
const USERS = {
  alice: { id: 7, password: 'alice-pass', role: 'member' },
  bob: { id: 8, password: 'bob-pass', role: 'member' },
  admin: { id: 1, password: 'admin-pass', role: 'admin' },
};

const LOANS = {
  12: { id: 12, user_id: 8, book_id: 1 },
};

const TITLES = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  422: 'Unprocessable Content',
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

function sendProblem(res, status, detail, errors) {
  // Every error uses the same JSON shape.
  const body = {
    type: 'about:blank',
    title: TITLES[status] || 'Error',
    status,
    detail,
  };
  if (errors && errors.length) body.errors = errors;
  res.status(status).type('application/problem+json').json(body);
}

function passwordsMatch(given, stored) {
  // Constant-time password compare. Padding keeps timingSafeEqual from throwing.
  const givenBytes = Buffer.from(given);
  const storedBytes = Buffer.from(stored);
  const width = Math.max(givenBytes.length, storedBytes.length, 1);
  const givenPadded = Buffer.alloc(width);
  const storedPadded = Buffer.alloc(width);
  givenBytes.copy(givenPadded);
  storedBytes.copy(storedPadded);
  const sameLength = givenBytes.length === storedBytes.length;
  const sameBytes = timingSafeEqual(givenPadded, storedPadded);
  return sameLength && sameBytes;
}

export function issueToken(userId, role, ttl = TOKEN_TTL_SECONDS) {
  // Build the payload, then sign it with HS256. The payload is not secret.
  // A negative ttl is how the tests build an already-expired token.
  const claims = { sub: String(userId), role };
  const options = {
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  };
  if (ttl < 0) {
    claims.exp = Math.floor(Date.now() / 1000) + ttl;
  } else {
    options.expiresIn = ttl;
  }
  return jwt.sign(claims, JWT_SECRET, options);
}

function readBearer(header) {
  // Step 1 of a protected request. Pull the token out of the header.
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '');
  if (!match) return null;
  return match[1];
}

function verifyToken(token) {
  // Step 2. Check the signature, the algorithm, iss, aud, and exp.
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  });
}

function readUser(claims) {
  // Step 3. Read sub and role only after verifyToken has succeeded.
  const id = Number(claims.sub);
  const role = claims.role;
  if ((role !== 'member' && role !== 'admin') || !Number.isInteger(id)) {
    return null;
  }
  return { id, role };
}

function loginErrors(body) {
  // Broken fields are 422. A missing body counts as both fields missing.
  const errors = [];
  if (!body || typeof body.username !== 'string' || body.username.length === 0) {
    errors.push({ pointer: '/username', detail: 'Field required' });
  }
  if (!body || typeof body.password !== 'string' || body.password.length === 0) {
    errors.push({ pointer: '/password', detail: 'Field required' });
  }
  return errors;
}

function requireUser(req, _res, next) {
  // Run the three steps. The route handler starts only if this calls next().
  const token = readBearer(req.get('authorization'));
  if (!token) {
    next(new Problem(401, TOKEN_PROBLEM));
    return;
  }

  let claims;
  try {
    claims = verifyToken(token);
  } catch {
    next(new Problem(401, TOKEN_PROBLEM));
    return;
  }

  const user = readUser(claims);
  if (!user) {
    next(new Problem(401, TOKEN_PROBLEM));
    return;
  }

  req.user = user;
  next();
}

export const app = express();
app.use(express.json());

app.post('/v1/auth/login', (req, res, next) => {
  // Check the password, then issue a 15-minute token.
  const errors = loginErrors(req.body);
  if (errors.length) {
    next(new Problem(422, 'Your request is not valid.', errors));
    return;
  }

  const user = USERS[req.body.username];
  const storedPassword = user ? user.password : UNKNOWN_PASSWORD;
  const passwordOk = passwordsMatch(req.body.password, storedPassword);
  if (!user || !passwordOk) {
    next(new Problem(401, LOGIN_PROBLEM));
    return;
  }

  res.json({
    access_token: issueToken(user.id, user.role),
    token_type: 'Bearer',
    expires_in: TOKEN_TTL_SECONDS,
  });
});

app.get('/v1/me', requireUser, (req, res) => {
  // Who the token says you are.
  res.json(req.user);
});

app.get('/v1/admin/stats', requireUser, (req, res, next) => {
  // Authorization. The token is valid, but the role may still be wrong.
  if (req.user.role !== 'admin') {
    next(new Problem(403, 'You are not allowed to do that.'));
    return;
  }
  res.json({ books: 50 });
});

app.get('/v1/loans/:loanId', requireUser, (req, res, next) => {
  // BOLA. A valid token is not enough. The loan must belong to this user.
  const loanId = Number(req.params.loanId);
  const loan = LOANS[loanId];
  const ownsLoan = Number.isInteger(loanId) && loan && loan.user_id === req.user.id;
  if (!ownsLoan) {
    next(new Problem(404, `Loan ${req.params.loanId} not found.`));
    return;
  }
  res.json(loan);
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
    console.log(`JWT on http://127.0.0.1:${PORT}`);
  });
}
