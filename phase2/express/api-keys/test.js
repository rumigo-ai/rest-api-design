import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

import { app } from './service.js';

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

test('health is public', async () => {
  await withApp(async (base) => {
    const response = await fetch(`${base}/v1/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('stats without a key is 401 problem+json', async () => {
  await withApp(async (base) => {
    const response = await fetch(`${base}/v1/admin/stats`);
    assert.equal(response.status, 401);
    assert.match(response.headers.get('content-type'), /application\/problem\+json/);
    const body = await response.json();
    assert.equal(body.status, 401);
    assert.equal(body.title, 'Unauthorized');
    assert.equal(body.type, 'about:blank');
    assert.equal(body.detail, 'API key needed.');
  });
});

test('a short key is 401 and does not crash', async () => {
  await withApp(async (base) => {
    const response = await fetch(`${base}/v1/admin/stats`, {
      headers: { 'X-API-Key': 'x' },
    });
    assert.equal(response.status, 401);
  });
});

test('a wrong key is 401', async () => {
  await withApp(async (base) => {
    const response = await fetch(`${base}/v1/admin/stats`, {
      headers: { 'X-API-Key': 'not-the-demo-key' },
    });
    assert.equal(response.status, 401);
  });
});

test('the demo key names the caller', async () => {
  await withApp(async (base) => {
    const response = await fetch(`${base}/v1/admin/stats`, {
      headers: { 'X-API-Key': 'demo-key-123' },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { caller: 'reporting-service' });
  });
});
