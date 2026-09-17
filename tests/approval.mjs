import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { localDatabase } from '../scripts/local-db.mjs';

const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  throw new Error('These fixtures only support the local app.');
const database = localDatabase();
const ids = [];
const digest = (value) => createHash('sha256').update(value).digest('hex');
let count = 0;
async function test(name, fn) {
  await fn();
  console.log('PASS', name);
  count++;
}
function fixture(role, demo = 0) {
  const id = randomUUID(),
    raw = randomBytes(32).toString('hex');
  ids.push(id);
  const stamp = new Date().toISOString();
  database
    .prepare(
      'INSERT INTO users(id,email,name,created_at,approval_status,platform_role,demo) VALUES(?,?,?,?,?,?,?)',
    )
    .run(
      id,
      id + '@example.invalid',
      'Approval QA',
      stamp,
      'approved',
      role,
      demo,
    );
  database
    .prepare(
      'INSERT INTO sessions(hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',
    )
    .run(digest(raw), id, new Date(Date.now() + 3600000).toISOString(), stamp);
  return { id, cookie: 'nn_session=' + raw };
}
async function call(client, path, method = 'GET', body, expected = 200) {
  const response = await fetch(origin + '/api/' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(client?.cookie ? { cookie: client.cookie } : {}),
    },
    ...(method !== 'GET' && body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, expected, path + ': ' + JSON.stringify(result));
  if (client && response.headers.get('set-cookie'))
    client.cookie = response.headers.get('set-cookie').split(';')[0];
  return result;
}
const admin = fixture('super_admin'),
  ordinary = fixture('user'),
  demo = fixture('user', 1);
const pending = {},
  rejected = {};
const pw = 'Approval-QA-passphrase-2026';
try {
  await test('Registration ignores forged admin/approval fields and creates pending account', async () => {
    for (const client of [pending, rejected]) {
      client.email = randomUUID() + '@example.invalid';
      const result = await call(client, 'auth/register', 'POST', {
        name: 'Account QA',
        email: client.email,
        password: pw,
        platform_role: 'super_admin',
        approval_status: 'approved',
        demo: 1,
      });
      client.id = result.user.id;
      ids.push(client.id);
      assert.equal(result.user.approval_status, 'pending');
      assert.equal(result.user.platform_role, 'user');
      assert.equal(result.user.demo, 0);
    }
  });
  await test('Pending sessions cannot read/write events, accept teams, export or approve', async () => {
    await call(pending, 'events', 'GET', undefined, 403);
    await call(pending, 'events', 'POST', { name: 'Blocked' }, 403);
    await call(pending, 'team-accept', 'POST', { token: 'invalid' }, 403);
    await call(pending, 'events/anything/export', 'GET', undefined, 403);
    await call(pending, 'admin/accounts', 'GET', undefined, 403);
    assert.equal((await call(pending, 'me')).user.approval_status, 'pending');
  });
  await test('Anonymous, approved ordinary accounts and demo cannot use admin API', async () => {
    await call(null, 'admin/accounts', 'GET', undefined, 401);
    for (const client of [ordinary, demo]) {
      await call(client, 'admin/accounts', 'GET', undefined, 403);
      await call(
        client,
        'admin/accounts/' + pending.id,
        'POST',
        { status: 'approved' },
        403,
      );
    }
  });
  await test('Admin queue paginates and exposes no password/token or demo accounts', async () => {
    const result = await call(admin, 'admin/accounts?status=approved');
    assert(
      result.accounts.every(
        (account) =>
          !('password' in account) &&
          !('hash' in account) &&
          account.id !== demo.id,
      ),
    );
    assert(result.accounts.length <= 50);
    await call(admin, 'admin/accounts?status=unknown', 'GET', undefined, 400);
    await call(
      admin,
      'admin/accounts/' + demo.id,
      'POST',
      { status: 'approved' },
      409,
    );
    await call(
      admin,
      'admin/accounts/' + admin.id,
      'POST',
      { status: 'rejected' },
      400,
    );
    await call(
      admin,
      'admin/accounts/' + pending.id,
      'POST',
      { status: 'super_admin' },
      400,
    );
  });
  await test('Admin approval immediately unlocks existing session and records actor', async () => {
    await call(admin, 'admin/accounts/' + pending.id, 'POST', {
      status: 'approved',
    });
    assert.equal((await call(pending, 'me')).user.approval_status, 'approved');
    await call(pending, 'events');
    const audit = database
      .prepare('SELECT * FROM account_reviews WHERE user_id=?')
      .all(pending.id);
    assert.equal(audit.length, 1);
    assert.equal(audit[0].reviewer_id, admin.id);
    await call(
      admin,
      'admin/accounts/' + pending.id,
      'POST',
      { status: 'rejected' },
      409,
    );
    await call(pending, 'admin/accounts', 'GET', undefined, 403);
  });
  await test('Rejected users remain blocked after signing in again', async () => {
    await call(admin, 'admin/accounts/' + rejected.id, 'POST', {
      status: 'rejected',
    });
    await call(rejected, 'events', 'GET', undefined, 403);
    const result = await call(rejected, 'auth/login', 'POST', {
      email: rejected.email,
      password: pw,
    });
    assert.equal(result.user.approval_status, 'rejected');
    await call(rejected, 'events', 'GET', undefined, 403);
  });
  await test('Competing decisions produce one winner and one audit record', async () => {
    const target = fixture('user');
    database
      .prepare(
        "UPDATE users SET approval_status='pending',reviewed_at=? WHERE id=?",
      )
      .run(new Date().toISOString(), target.id);
    database
      .prepare('DELETE FROM account_reviews WHERE user_id=?')
      .run(target.id);
    const results = await Promise.all(
      ['approved', 'rejected'].map((status) =>
        fetch(origin + '/api/admin/accounts/' + target.id, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
          body: JSON.stringify({ status }),
        }),
      ),
    );
    assert.deepEqual(
      results.map((response) => response.status).sort((a, b) => a - b),
      [200, 409],
    );
    assert.equal(
      database
        .prepare('SELECT count(*) AS n FROM account_reviews WHERE user_id=?')
        .get(target.id).n,
      1,
    );
  });
  await test('Password recovery cannot approve pending accounts', async () => {
    const target = fixture('user');
    database
      .prepare(
        "UPDATE users SET approval_status='pending',reviewed_at=? WHERE id=?",
      )
      .run(new Date().toISOString(), target.id);
    const raw = randomBytes(32).toString('hex');
    database
      .prepare(
        "INSERT INTO account_tokens(hash,user_id,purpose,expires_at) VALUES(?,?,'recover',?)",
      )
      .run(digest(raw), target.id, new Date(Date.now() + 60000).toISOString());
    await call(null, 'auth/consume', 'POST', { token: raw, password: pw });
    assert.equal(
      database
        .prepare('SELECT approval_status FROM users WHERE id=?')
        .get(target.id).approval_status,
      'pending',
    );
  });
  await test('One-time admin setup requires a strong password, then enables admin login', async () => {
    const target = fixture('super_admin');
    database
      .prepare(
        "UPDATE users SET approval_status='pending',reviewed_at=? WHERE id=?",
      )
      .run(new Date().toISOString(), target.id);
    const raw = randomBytes(32).toString('hex');
    database
      .prepare(
        "INSERT INTO account_tokens(hash,user_id,purpose,expires_at) VALUES(?,?,'setup',?)",
      )
      .run(digest(raw), target.id, new Date(Date.now() + 60000).toISOString());
    await call(
      null,
      'auth/consume',
      'POST',
      { token: raw, password: 'short' },
      400,
    );
    await call(null, 'auth/consume', 'POST', { token: raw, password: pw });
    await call(null, 'auth/consume', 'POST', { token: raw, password: pw }, 400);
    const result = await call(target, 'auth/login', 'POST', {
      email: target.id + '@example.invalid',
      password: pw,
    });
    assert.equal(result.user.platform_role, 'super_admin');
    assert.equal(result.user.approval_status, 'approved');
    await call(target, 'admin/accounts');
  });
  await test('Super admin can browse client spaces without impersonating them or writing', async () => {
    const workspaceId = randomUUID(),
      eventId = randomUUID();
    const stamp = new Date().toISOString();
    database
      .prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)')
      .run(workspaceId, 'Admin browse QA', stamp);
    database
      .prepare(
        "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'owner')",
      )
      .run(workspaceId, ordinary.id);
    database
      .prepare(
        "INSERT INTO events(id,workspace_id,name,data,created_at,updated_at) VALUES(?,?,?,'{}',?,?)",
      )
      .run(eventId, workspaceId, 'Client event QA', stamp, stamp);
    try {
      const scoped = 'events?admin_account=' + ordinary.id;
      assert((await call(admin, scoped)).events.some((e) => e.id === eventId));
      assert(
        !(await call(admin, 'events')).events.some((e) => e.id === eventId),
      );
      await call(admin, 'events/' + eventId + '?admin_account=' + ordinary.id);
      await call(
        admin,
        'events/' + eventId + '?admin_account=' + pending.id,
        'GET',
        undefined,
        403,
      );
      await call(ordinary, scoped, 'GET', undefined, 403);
      await call(demo, scoped, 'GET', undefined, 403);
      await call(admin, scoped, 'POST', { name: 'Forbidden' }, 403);
      const headerRead = await fetch(origin + '/api/events', {
        headers: { cookie: admin.cookie, 'X-Admin-Account': ordinary.id },
      });
      assert.equal(headerRead.status, 200);
      assert.equal((await call(admin, 'me')).user.id, admin.id);
    } finally {
      database.prepare('DELETE FROM events WHERE id=?').run(eventId);
      database
        .prepare('DELETE FROM workspace_members WHERE workspace_id=?')
        .run(workspaceId);
      database.prepare('DELETE FROM workspaces WHERE id=?').run(workspaceId);
    }
  });
  console.log(`${count} approval scenarios passed`);
} finally {
  for (const id of ids) {
    database
      .prepare('DELETE FROM account_reviews WHERE user_id=? OR reviewer_id=?')
      .run(id, id);
    database
      .prepare('UPDATE users SET reviewed_by=NULL WHERE reviewed_by=?')
      .run(id);
  }
  for (const id of ids)
    database.prepare('DELETE FROM users WHERE id=?').run(id);
  database.close();
}
