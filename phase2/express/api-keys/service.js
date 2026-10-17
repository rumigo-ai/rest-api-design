/**
 * API keys identify an application, not a person.
 *
 * Read this file from top to bottom. Each function is one step:
 * hash the key, compare it, find the caller, then allow or reject.
 *
 *   node service.js
 *   node client.js
 *
 * Listens on http://127.0.0.1:8011
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

const PORT = 8011;

// The slide key. We hash it below and do not store this string in KEYS.
const DEMO_KEY = 'demo-key-123';
const DEMO_OWNER = 'reporting-service';

const TITLES = {
  401: 'Unauthorized',
  500: 'Internal Server Error',
};

function hashKey(raw) {
  // Step 1. Turn the raw key into a hash. The hash is what we store.
  return createHash('sha256').update(raw).digest('hex');
}

// The store: hash -> caller name. One key per caller.
const KEYS = new Map([[hashKey(DEMO_KEY), DEMO_OWNER]]);

function hashesMatch(givenHash, storedHash) {
  // Step 2. Compare two hashes in constant time. Both are 64 characters.
  const left = Buffer.from(givenHash);
  const right = Buffer.from(storedHash);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function findOwner(givenHash) {
  // Step 3. Look through every stored hash. Do not stop at the first match.
  let owner = null;
  for (const [storedHash, name] of KEYS) {
    if (hashesMatch(givenHash, storedHash)) {
      owner = name;
    }
  }
  return owner;
}

function sendProblem(res, status, detail) {
  // Every error uses the same JSON shape.
  res.status(status).type('application/problem+json').json({
    type: 'about:blank',
    title: TITLES[status] || 'Error',
    status,
    detail,
  });
}

function requireApiKey(req, res, next) {
  // Step 4. Read the header, hash it, find the caller. No match is 401.
  const rawKey = req.get('x-api-key') ?? '';
  const givenHash = hashKey(rawKey);
  const owner = findOwner(givenHash);
  if (!owner) {
    sendProblem(res, 401, 'API key needed.');
    return;
  }
  req.caller = owner;
  next();
}

export const app = express();

// Public. No key required, so you can see the contrast with /v1/admin/stats.
app.get('/v1/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Protected. requireApiKey runs before this handler.
app.get('/v1/admin/stats', requireApiKey, (req, res) => {
  res.json({ caller: req.caller });
});

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invoked === thisFile) {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`API keys on http://127.0.0.1:${PORT}`);
  });
}
