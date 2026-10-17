import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';

import { app, limits, resetLimits } from './service.js';

function send(base, path, { method = 'GET', headers = {}, body = null } = {}) {
  const url = new URL(path, base);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text,
            json() {
              return text ? JSON.parse(text) : null;
            },
          });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function rateLimit(response) {
  const parts = {};
  for (const item of response.headers.ratelimit.split(',')) {
    const [key, value] = item.trim().split('=');
    parts[key] = Number(value);
  }
  return parts;
}

function restore() {
  limits.general = 60;
  limits.login = 5;
  resetLimits();
}

test('fixed window and CORS', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    restore();
    const books = await send(base, '/v1/books');
    assert.equal(books.status, 200);
    assert.equal(books.json().data[0].title, 'Dune');
    assert.equal(books.headers['ratelimit-policy'], '60;w=60');
    const bookParts = rateLimit(books);
    assert.equal(bookParts.limit, 60);
    assert.equal(bookParts.remaining, 59);
    assert.ok(bookParts.reset >= 1 && bookParts.reset <= 60);

    restore();
    const loggedIn = await send(base, '/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'alice-pass' }),
    });
    assert.equal(loggedIn.status, 200);
    assert.deepEqual(loggedIn.json(), { ok: true });
    assert.equal(loggedIn.headers['ratelimit-policy'], '5;w=60');
    const loginParts = rateLimit(loggedIn);
    assert.equal(loginParts.limit, 5);
    assert.equal(loginParts.remaining, 4);

    restore();
    limits.general = 2;
    resetLimits();
    assert.equal((await send(base, '/v1/books')).status, 200);
    assert.equal((await send(base, '/v1/books')).status, 200);
    const blockedBooks = await send(base, '/v1/books');
    assert.equal(blockedBooks.status, 429);
    assert.match(blockedBooks.headers['content-type'], /application\/problem\+json/);
    assert.equal(blockedBooks.json().status, 429);
    assert.equal(blockedBooks.json().title, 'Too Many Requests');
    const retry = Number(blockedBooks.headers['retry-after']);
    assert.ok(retry >= 1 && retry <= 60);

    restore();
    for (let i = 0; i < 5; i += 1) {
      const failed = await send(base, '/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alice', password: 'nope' }),
      });
      assert.equal(failed.status, 401);
    }
    const blockedLogin = await send(base, '/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'alice-pass' }),
    });
    assert.equal(blockedLogin.status, 429);
    assert.equal(blockedLogin.json().detail, 'Too many requests.');
    assert.ok(blockedLogin.headers['retry-after']);

    restore();
    for (let i = 0; i < 5; i += 1) {
      await send(base, '/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alice', password: 'nope' }),
      });
    }
    const afterLogins = await send(base, '/v1/books');
    assert.equal(afterLogins.status, 200);
    assert.equal(rateLimit(afterLogins).remaining, 59);

    restore();
    const preflight = await send(base, '/v1/books', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers['access-control-allow-origin'], 'http://localhost:3000');
    assert.equal(preflight.headers['access-control-allow-methods'], 'GET, POST');
    assert.equal(
      preflight.headers['access-control-allow-headers'],
      'Authorization, Content-Type',
    );
    assert.notEqual(preflight.headers['access-control-allow-origin'], '*');
    assert.equal(preflight.headers.ratelimit, undefined);
    const afterPreflight = await send(base, '/v1/books');
    assert.equal(rateLimit(afterPreflight).remaining, 59);

    restore();
    const allowed = await send(base, '/v1/books', {
      headers: { Origin: 'http://localhost:3000' },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:3000');

    restore();
    const evil = await send(base, '/v1/books', {
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(evil.status, 200);
    assert.equal(evil.headers['access-control-allow-origin'], undefined);

    const lookalike = await send(base, '/v1/books', {
      headers: { Origin: 'http://localhost:3000.evil.example' },
    });
    assert.equal(lookalike.headers['access-control-allow-origin'], undefined);

    restore();
    limits.login = 1;
    resetLimits();
    const first = await send(base, '/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({ username: 'alice', password: 'nope' }),
    });
    assert.equal(first.status, 401);
    const blockedFromBrowser = await send(base, '/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({ username: 'alice', password: 'nope' }),
    });
    assert.equal(blockedFromBrowser.status, 429);
    assert.equal(
      blockedFromBrowser.headers['access-control-allow-origin'],
      'http://localhost:3000',
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
