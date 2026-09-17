import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { localDatabase } from '../scripts/local-db.mjs';
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  throw new Error('Local fixtures only.');
const database = localDatabase(),
  ids = [];
const original = database
  .prepare('SELECT * FROM integration_settings WHERE id=1')
  .get();
function client(role, demo = 0) {
  const id = randomUUID(),
    token = randomBytes(32).toString('hex'),
    date = new Date().toISOString();
  ids.push(id);
  database
    .prepare(
      "INSERT INTO users(id,email,name,demo,platform_role,approval_status,created_at) VALUES(?,?,?, ?,?,'approved',?)",
    )
    .run(id, id + '@example.invalid', 'Integration QA', demo, role, date);
  database
    .prepare(
      'INSERT INTO sessions(hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',
    )
    .run(
      createHash('sha256').update(token).digest('hex'),
      id,
      new Date(Date.now() + 3600000).toISOString(),
      date,
    );
  return 'nn_session=' + token;
}
const admin = client('super_admin'),
  user = client('user'),
  demo = client('user', 1);
async function call(cookie, method = 'GET', body, status = 200) {
  const response = await fetch(origin + '/api/admin/integrations', {
    method,
    headers: { cookie, 'Content-Type': 'application/json' },
    ...(method !== 'GET' && body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.status, status, 'Unexpected configuration status');
  return response.json();
}
try {
  for (const cookie of [user, demo]) {
    await call(cookie, 'GET', undefined, 403);
    await call(cookie, 'POST', { values: {} }, 403);
  }
  console.log('PASS Integration access restricted to super admin');
  const initial = await call(admin);
  assert.equal(initial.protected, true, 'Local encryption key not loaded');
  const secret = 'qa_' + randomBytes(32).toString('hex');
  await call(admin, 'POST', {
    revision: initial.revision,
    values: {
      RESEND_API_KEY: secret,
      EMAIL_FROM: 'qa@example.invalid',
      DEMO_LIMIT_PER_HOUR: '4',
      DEMO_GLOBAL_CAP: '250',
    },
  });
  const saved = await call(admin);
  assert.equal(saved.fields.find((f) => f.key === 'RESEND_API_KEY').value, '');
  assert.equal(
    saved.integrations.find((i) => i.id === 'email').configured,
    true,
  );
  assert.equal(
    saved.fields.find((f) => f.key === 'DEMO_LIMIT_PER_HOUR').value,
    '4',
  );
  assert.equal(
    saved.fields.find((f) => f.key === 'DEMO_GLOBAL_CAP').value,
    '250',
  );
  assert(!JSON.stringify(saved).includes(secret));
  const encrypted = database
    .prepare('SELECT payload,iv FROM integration_settings WHERE id=1')
    .get();
  assert(
    encrypted.payload &&
      encrypted.iv &&
      !encrypted.payload.includes(secret) &&
      !encrypted.payload.includes('example.invalid'),
  );
  console.log(
    'PASS Application settings used by runtime, secrets encrypted and never returned',
  );
  await call(
    admin,
    'POST',
    {
      revision: initial.revision,
      values: { EMAIL_FROM: 'stale@example.invalid' },
    },
    409,
  );
  await call(
    admin,
    'POST',
    {
      revision: saved.revision,
      values: { CONFIG_ENCRYPTION_KEY: 'forbidden' },
    },
    400,
  );
  await call(
    admin,
    'POST',
    { revision: saved.revision, values: { JOB_SECRET: 'short' } },
    400,
  );
  await call(
    admin,
    'POST',
    { revision: saved.revision, values: { EMAIL_FROM: 'invalid' } },
    400,
  );
  await call(
    admin,
    'POST',
    { revision: saved.revision, values: { DEMO_LIMIT_PER_HOUR: '0' } },
    400,
  );
  await call(
    admin,
    'POST',
    { revision: saved.revision, values: { DEMO_GLOBAL_CAP: '10001' } },
    400,
  );
  console.log(
    'PASS Concurrent changes, unknown settings and invalid values rejected',
  );
  await call(admin, 'POST', {
    revision: saved.revision,
    values: { RESEND_API_KEY: '' },
  });
  const kept = await call(admin);
  assert(kept.fields.find((f) => f.key === 'RESEND_API_KEY').configured);
  await call(admin, 'POST', {
    revision: kept.revision,
    values: {},
    clear: ['RESEND_API_KEY', 'EMAIL_FROM'],
  });
  const cleared = await call(admin);
  assert.equal(
    cleared.integrations.find((i) => i.id === 'email').configured,
    false,
  );
  assert(
    database
      .prepare(
        'SELECT count(*) AS n FROM integration_settings_audit WHERE actor_id=?',
      )
      .get(ids[0]).n >= 3,
  );
  console.log(
    'PASS Blank fields preserve secrets; explicit clear disables configuration and changes are audited',
  );
} finally {
  database
    .prepare(
      'UPDATE integration_settings SET payload=?,iv=?,revision=revision+1,updated_by=NULL,updated_at=? WHERE id=1',
    )
    .run(original.payload, original.iv, new Date().toISOString());
  for (const id of ids) {
    database
      .prepare('DELETE FROM integration_settings_audit WHERE actor_id=?')
      .run(id);
    database.prepare('DELETE FROM users WHERE id=?').run(id);
  }
  database.close();
}
