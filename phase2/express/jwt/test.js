import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

import { JWT_AUDIENCE, JWT_ISSUER, app, issueToken } from './service.js';

async function withApp(fn) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function login(base, username, password) {
  const response = await fetch(`${base}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json();
  return { response, body };
}

function b64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

test('login returns a 15-minute bearer token', async () => {
  await withApp(async (base) => {
    const { response, body } = await login(base, 'alice', 'alice-pass');
    assert.equal(response.status, 200);
    assert.equal(body.token_type, 'Bearer');
    assert.equal(body.expires_in, 900);
    assert.equal(body.access_token.split('.').length, 3);
  });
});

test('unknown user and wrong password share a message', async () => {
  await withApp(async (base) => {
    const wrong = await login(base, 'alice', 'nope');
    const missing = await login(base, 'carol', 'alice-pass');
    assert.equal(wrong.response.status, 401);
    assert.equal(missing.response.status, 401);
    assert.equal(wrong.body.detail, 'Username or password is wrong.');
    assert.equal(missing.body.detail, wrong.body.detail);
    assert.match(wrong.response.headers.get('content-type'), /application\/problem\+json/);
  });
});

test('login without fields is 422', async () => {
  await withApp(async (base) => {
    const response = await fetch(`${base}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.status, 422);
    assert.equal(body.title, 'Unprocessable Content');
    const pointers = body.errors.map((err) => err.pointer).sort();
    assert.deepEqual(pointers, ['/password', '/username']);
  });
});

test('broken JSON is 400', async () => {
  await withApp(async (base) => {
    const response = await fetch(`${base}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.status, 400);
    assert.equal(body.detail, 'The JSON is broken.');
  });
});

test('me reads the verified claims', async () => {
  await withApp(async (base) => {
    const { body } = await login(base, 'alice', 'alice-pass');
    const response = await fetch(`${base}/v1/me`, {
      headers: { Authorization: `Bearer ${body.access_token}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: 7, role: 'member' });
  });
});

test('a missing token is 401', async () => {
  await withApp(async (base) => {
    const response = await fetch(`${base}/v1/me`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).detail, 'Token is missing, invalid, or expired.');
  });
});

test('a tampered role is 401', async () => {
  await withApp(async (base) => {
    const { body } = await login(base, 'alice', 'alice-pass');
    const [header, payload, signature] = body.access_token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    claims.role = 'admin';
    const forged = `${header}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature}`;
    const response = await fetch(`${base}/v1/admin/stats`, {
      headers: { Authorization: `Bearer ${forged}` },
    });
    assert.equal(response.status, 401);
  });
});

test('alg none is 401', async () => {
  await withApp(async (base) => {
    const header = b64url({ alg: 'none', typ: 'JWT' });
    const payload = b64url({
      sub: '1',
      role: 'admin',
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
      exp: 9999999999,
    });
    const response = await fetch(`${base}/v1/admin/stats`, {
      headers: { Authorization: `Bearer ${header}.${payload}.` },
    });
    assert.equal(response.status, 401);
  });
});

test('an expired token is 401', async () => {
  await withApp(async (base) => {
    const token = issueToken(7, 'member', -30);
    const response = await fetch(`${base}/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 401);
  });
});

test('a member cannot open admin stats', async () => {
  await withApp(async (base) => {
    const { body } = await login(base, 'alice', 'alice-pass');
    const response = await fetch(`${base}/v1/admin/stats`, {
      headers: { Authorization: `Bearer ${body.access_token}` },
    });
    assert.equal(response.status, 403);
    const problem = await response.json();
    assert.equal(problem.status, 403);
    assert.equal(problem.title, 'Forbidden');
  });
});

test('an admin can open admin stats', async () => {
  await withApp(async (base) => {
    const { body } = await login(base, 'admin', 'admin-pass');
    const response = await fetch(`${base}/v1/admin/stats`, {
      headers: { Authorization: `Bearer ${body.access_token}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { books: 50 });
  });
});

test('alice cannot read bob\'s loan', async () => {
  await withApp(async (base) => {
    const { body } = await login(base, 'alice', 'alice-pass');
    const response = await fetch(`${base}/v1/loans/12`, {
      headers: { Authorization: `Bearer ${body.access_token}` },
    });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).detail, 'Loan 12 not found.');
  });
});

test('bob can read his loan', async () => {
  await withApp(async (base) => {
    const { body } = await login(base, 'bob', 'bob-pass');
    const response = await fetch(`${base}/v1/loans/12`, {
      headers: { Authorization: `Bearer ${body.access_token}` },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user_id, 8);
  });
});

test('admin does not skip the ownership check', async () => {
  await withApp(async (base) => {
    const { body } = await login(base, 'admin', 'admin-pass');
    const response = await fetch(`${base}/v1/loans/12`, {
      headers: { Authorization: `Bearer ${body.access_token}` },
    });
    assert.equal(response.status, 404);
  });
});

test('a missing loan is 404', async () => {
  await withApp(async (base) => {
    const { body } = await login(base, 'bob', 'bob-pass');
    const response = await fetch(`${base}/v1/loans/99`, {
      headers: { Authorization: `Bearer ${body.access_token}` },
    });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).detail, 'Loan 99 not found.');
  });
});
