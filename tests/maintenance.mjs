import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { localDatabase } from '../scripts/local-db.mjs';
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const testIp = 'qa-maintenance-' + randomUUID();
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Local fixtures only.');
const db = localDatabase();
const ids = { user: randomUUID(), workspace: randomUUID(), event: randomUUID(), family: randomUUID(), job: randomUUID() };
const old = new Date(Date.now() - 8 * 86400000).toISOString();
const temporaryUsers = [];
async function request(path, method = 'GET', body, expected = 200, cookie = '', ip = testIp) {
  const response = await fetch(origin + '/api/' + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip, ...(cookie ? { cookie } : {}) },
    ...(method !== 'GET' && body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, expected, path + ': ' + JSON.stringify(result));
  return { result, cookie: response.headers.get('set-cookie')?.split(';')[0] || cookie };
}
try {
  db.prepare("INSERT INTO users(id,email,name,verified,demo,approval_status,platform_role,created_at) VALUES(?,?,?,1,1,'approved','user',?)").run(ids.user, ids.user + '@demo.invalid', 'Demo vechi QA', old);
  db.prepare('INSERT INTO sessions(hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').run('f'.repeat(64), ids.user, old, old);
  db.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(ids.workspace, 'Spațiu demo vechi', old);
  db.prepare("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'owner')").run(ids.workspace, ids.user);
  db.prepare('INSERT INTO events(id,workspace_id,name,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(ids.event, ids.workspace, 'Demo vechi', JSON.stringify({ demo: true, timezone: 'Europe/Bucharest' }), old, old);
  db.prepare('INSERT INTO entities(id,event_id,kind,data,author_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(ids.family, ids.event, 'household', JSON.stringify({ name: 'Familia veche' }), ids.user, old, old);
  db.prepare('INSERT INTO access_tokens(hash,event_id,household_id,created_at,expires_at) VALUES(?,?,?,?,?)').run('e'.repeat(64), ids.event, ids.family, old, old);
  db.prepare("INSERT INTO jobs(id,event_id,household_id,channel,type,payload,due_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'queued',?,?)").run(ids.job, ids.event, ids.family, 'email', 'invitation', '{}', old, old, old);
  db.prepare('INSERT INTO message_attempts(id,job_id,status,created_at) VALUES(?,?,?,?)').run(randomUUID(), ids.job, 'failed', new Date(Date.now() - 91 * 86400000).toISOString());
  db.prepare('INSERT INTO account_tokens(hash,user_id,purpose,expires_at) VALUES(?,?,?,?)').run('d'.repeat(64), ids.user, 'verify', old);
  db.prepare('INSERT INTO webhook_events(provider,id,created_at) VALUES(?,?,?)').run('qa', randomUUID(), new Date(Date.now() - 31 * 86400000).toISOString());
  db.prepare('INSERT OR REPLACE INTO rate_limits(key,count,expires_at) VALUES(?,?,?)').run('expired-qa', 1, 1);
  db.prepare("DELETE FROM maintenance WHERE key='cleanup'").run();

  const demo = await request('auth/demo', 'POST', {});
  await request('events/' + demo.result.event_id + '/process-demo', 'POST', {}, 200, demo.cookie);
  for (const [table, column, value] of [
    ['users', 'id', ids.user], ['workspaces', 'id', ids.workspace], ['events', 'id', ids.event],
    ['entities', 'id', ids.family], ['jobs', 'id', ids.job], ['access_tokens', 'event_id', ids.event],
  ]) assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=?`).get(value).n, 0, table);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE key='expired-qa'").get().n, 0);
  assert(db.prepare("SELECT ran_at FROM maintenance WHERE key='cleanup'").get().ran_at);
  console.log('PASS Hourly maintenance removes expired operational data and stale demo workspaces');

  const bucket = Math.floor(Date.now() / 1000 / 3600);
  const limitedKey = createHash('sha256').update('demo:192.0.2.14:' + bucket).digest('hex');
  db.prepare('INSERT OR REPLACE INTO rate_limits(key,count,expires_at) VALUES(?,?,?)').run(limitedKey, 3, bucket * 3600 + 7200);
  await request('auth/demo', 'POST', {}, 429, '', '192.0.2.14');
  console.log('PASS Demo creation is limited to three per hour and IP');

  const active = Number(db.prepare("SELECT COUNT(DISTINCT u.id) AS n FROM users u JOIN sessions s ON s.user_id=u.id WHERE u.demo=1 AND s.expires_at>?").get(new Date().toISOString()).n);
  const insertUser = db.prepare("INSERT INTO users(id,email,name,verified,demo,approval_status,platform_role,created_at) VALUES(?,?,?,1,1,'approved','user',?)");
  const insertSession = db.prepare('INSERT INTO sessions(hash,user_id,expires_at,created_at) VALUES(?,?,?,?)');
  for (let i = active; i < 200; i++) {
    const id = randomUUID(); temporaryUsers.push(id);
    insertUser.run(id, id + '@demo.invalid', 'Cap demo QA', new Date().toISOString());
    insertSession.run(createHash('sha256').update(id).digest('hex'), id, new Date(Date.now() + 3600000).toISOString(), new Date().toISOString());
  }
  await request('auth/demo', 'POST', {}, 503, '', testIp + '-cap');
  console.log('PASS Global active-demo capacity returns an explicit service response');
} finally {
  db.prepare("DELETE FROM rate_limits WHERE key='expired-qa' OR key=?").run(createHash('sha256').update('demo:192.0.2.14:' + Math.floor(Date.now() / 1000 / 3600)).digest('hex'));
  for (const id of temporaryUsers) db.prepare('DELETE FROM users WHERE id=?').run(id);
  db.close();
}
