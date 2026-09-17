import assert from 'node:assert/strict';

const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const testIp = 'qa-batch-' + crypto.randomUUID();
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  throw new Error('Local tests only.');
let cookie = '';
async function call(path, method = 'GET', body, expected = 200) {
  const response = await fetch(origin + '/api/' + path, {
    method,
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': testIp, ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}
await call('auth/demo', 'POST', {});
const event = await call('events', 'POST', { name: 'Atomic batch QA', timezone: 'Europe/Bucharest', currency: 'RON' }, 201);
let state = await call('events/' + event.id);
const rows = (count) => Array.from({ length: count }, (_, index) => ({ name: `Persoană ${index}`, family: 'Familia Atomică' }));
await call('events/' + event.id + '/import', 'POST', { version: state.event.version, rows: rows(150), duplicate_policy: 'create' });
state = await call('events/' + event.id);
await call('events/' + event.id + '/import', 'POST', { version: state.event.version, rows: rows(151), duplicate_policy: 'create' }, 400);
console.log('PASS Atomic import accepts 150 rows and rejects 151 before building a D1 batch');
