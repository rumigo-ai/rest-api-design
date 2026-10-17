/**
 * Three calls against the API key server. Start service.js first.
 *
 *   node client.js
 *   node client.js http://127.0.0.1:8010
 */

const base = process.argv[2] ?? 'http://127.0.0.1:8011';
const demoKey = 'demo-key-123';

async function call(path, key) {
  const headers = {};
  if (key !== undefined) headers['X-API-Key'] = key;
  const response = await fetch(base + path, { headers });
  const body = await response.text();
  const shown = key === undefined ? '(none)' : key;
  console.log(`\n${path}  key=${shown}`);
  console.log(`HTTP ${response.status}`);
  console.log(body);
}

await call('/v1/health', undefined);
await call('/v1/admin/stats', demoKey);
await call('/v1/admin/stats', 'nope');
