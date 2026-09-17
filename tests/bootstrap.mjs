import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  throw new Error('Local tests only.');
const migration = await readFile(new URL('../drizzle/0004_hardening.sql', import.meta.url), 'utf8');
assert.match(migration, /CREATE TABLE platform_audit/);
const implementation = await readFile(new URL('../server/admin.ts', import.meta.url), 'utf8');
assert.match(implementation, /INSERT INTO maintenance\(key,ran_at\) VALUES\('admin-bootstrap'/);
const response = await fetch(origin + '/api/admin/bootstrap', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'cf-connecting-ip': 'qa-bootstrap-' + crypto.randomUUID() },
  body: JSON.stringify({ email: 'first-admin@example.test', name: 'First Admin' }),
});
assert([401, 503].includes(response.status));
const payload = await response.json();
assert(payload.error?.message);
console.log('PASS Bootstrap is closed without a matching secret and uses a persistent one-time claim');
