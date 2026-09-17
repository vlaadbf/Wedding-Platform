import assert from 'node:assert/strict';
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const testIp = 'qa-family-' + crypto.randomUUID();
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  throw new Error('Local tests only.');
let cookie = '',
  eventId = '',
  version = 1,
  count = 0;
async function call(
  path,
  method = 'GET',
  body,
  status = 200,
  publicRequest = false,
) {
  const response = await fetch(origin + '/api/' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'cf-connecting-ip': testIp,
      ...(!publicRequest && cookie ? { cookie } : {}),
    },
    ...(method !== 'GET' && body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, status, path + ': ' + JSON.stringify(result));
  if (!publicRequest && response.headers.get('set-cookie'))
    cookie = response.headers.get('set-cookie').split(';')[0];
  if (result.version) version = result.version;
  return result;
}
async function test(name, fn) {
  await fn();
  count++;
  console.log('PASS', name);
}
async function load() {
  const result = await call('events/' + eventId);
  version = result.event.version;
  return result;
}
const change = (path, data, status = 200) =>
  call('events/' + eventId + '/' + path, 'POST', { version, ...data }, status);
await call('auth/demo', 'POST', {});
eventId = (
  await call(
    'events',
    'POST',
    { name: 'Family RSVP QA', timezone: 'Europe/Bucharest', currency: 'RON' },
    201,
  )
).id;
let state = await load();
const invitation = state.entities.find((e) => e.kind === 'invitation');
await call(
  'events/' + eventId + '/records/invitation/' + invitation.id,
  'PATCH',
  { version, data: { ...invitation.data, rsvp_deadline: '2030-12-01' } },
);
await change('publish', { id: invitation.id });
const family = (
  await change('records/household', {
    data: {
      name: 'Familia QA',
      email: 'family@example.invalid',
      max_members: 2,
    },
  })
).id;
const link = (await change('invite-link', { household_id: family })).url;
const path = 'public/' + link.split('/').pop();
const getPublic = () => call(path, 'GET', undefined, 200, true);
let form = await getPublic();
const responses = Object.fromEntries(
  form.subevents.map((s) => [s.id, 'confirmed']),
);
const member = (name, extra = {}) => ({
  name,
  age: 'adult',
  responses,
  ...extra,
});
await test('A family-only invitation works before any person exists', async () => {
  assert.equal(form.family.self_registration, true);
  assert.equal(form.guests.length, 0);
  assert.equal(form.family.max_members, 2);
  assert(form.subevents.length > 0);
  const preview = await change('campaigns', {
    preview: true,
    channel: 'email',
    type: 'rsvp_reminder',
    message: 'Răspunde {link}',
  });
  assert.equal(preview.count, 1);
});
await test('Missing names, foreign people, foreign moments and duplicate names are rejected atomically', async () => {
  await call(
    path,
    'POST',
    {
      version: form.event.version,
      members: [member('   ')],
    },
    400,
    true,
  );
  await call(
    path,
    'POST',
    { version: form.event.version, members: [member('A', { id: 'foreign' })] },
    403,
    true,
  );
  await call(
    path,
    'POST',
    {
      version: form.event.version,
      members: [
        member('A', { responses: { ...responses, foreign: 'confirmed' } }),
      ],
    },
    403,
    true,
  );
  await call(
    path,
    'POST',
    { version: form.event.version, members: [member('A'), member('A')] },
    400,
    true,
  );
  assert.equal((await getPublic()).guests.length, 0);
});
await test('Guest adds adults/children, menus and attendance in one submission', async () => {
  const menu = form.menus[0].id;
  const members = [
    member('Ana QA', { menu_id: menu, allergies: 'Nuci' }),
    member('Mihai QA', { age: 'copil' }),
  ];
  await call(
    path,
    'POST',
    { version: form.event.version, members },
    400,
    true,
  );
  await call(
    path,
    'POST',
    {
      version: form.event.version,
      members,
      sensitive_consent: true,
    },
    200,
    true,
  );
  form = await getPublic();
  assert.equal(form.guests.length, 2);
  assert.equal(form.guests[0].data.allergies, 'Nuci');
  state = await load();
  assert.equal(
    state.entities.find((entity) => entity.kind === 'guest' && entity.data.name === 'Ana QA').data.consent.version,
    '2026-09-16-draft-v1',
  );
  assert.equal(state.summary.confirmed, 2);
  assert.equal(state.summary.children, 1);
  assert.equal(state.summary.unseated, 2);
});
await test('Editing the response preserves people and rejects a stale repeated submit', async () => {
  const payload = {
    version: form.event.version,
    sensitive_consent: true,
    members: form.guests.map((g) =>
      member(g.data.name, { ...g.data, id: g.id }),
    ),
  };
  await call(path, 'POST', payload, 200, true);
  await call(path, 'POST', payload, 409, true);
  form = await getPublic();
  assert.equal(form.guests.length, 2);
  await call(
    path,
    'POST',
    {
      version: form.event.version,
      members: [member('Ana QA', { id: form.guests[0].id })],
    },
    400,
    true,
  );
});
await test('The whole family can decline; reminders stop after a response', async () => {
  await call(
    path,
    'POST',
    {
      version: form.event.version,
      family_declined: true,
      sensitive_consent: true,
      members: form.guests.map((g) =>
        member(g.data.name, { ...g.data, id: g.id }),
      ),
    },
    200,
    true,
  );
  state = await load();
  assert.equal(state.summary.confirmed, 0);
  assert.equal(state.summary.declined, 2);
  const preview = await change('campaigns', {
    preview: true,
    channel: 'email',
    type: 'rsvp_reminder',
    message: 'Răspunde {link}',
  });
  assert.equal(preview.count, 0);
});
await test('An empty family may decline without creating fictitious persons', async () => {
  const other = (
    await change('records/household', {
      data: { name: 'Familia absentă', email: 'absent@example.invalid' },
    })
  ).id;
  const otherLink = (await change('invite-link', { household_id: other })).url;
  const otherPath = 'public/' + otherLink.split('/').pop();
  const before = await call(otherPath, 'GET', undefined, 200, true);
  await call(
    otherPath,
    'POST',
    { version: before.event.version, family_declined: true, members: [] },
    200,
    true,
  );
  const after = await call(otherPath, 'GET', undefined, 200, true);
  assert.equal(after.guests.length, 0);
  assert.equal(after.family.response_status, 'declined');
  await load();
  const preview = await change('campaigns', {
    preview: true,
    channel: 'email',
    type: 'rsvp_reminder',
    message: 'Răspunde {link}',
  });
  assert.equal(preview.count, 0);
});
await test('The invitee may exceed reserved places with named additional people', async () => {
  form = await getPublic();
  await call(
    path,
    'POST',
    {
      version: form.event.version,
      members: [
        ...form.guests.map((g) => member(g.data.name, { id: g.id })),
        member('Persoană suplimentară QA'),
      ],
    },
    200,
    true,
  );
  form = await getPublic();
  assert.equal(form.guests.length, 3);
  assert.equal(form.family.max_members, 2);
  state = await load();
  assert.equal(state.summary.confirmed, 3);
  assert(
    state.entities.some(
      (e) =>
        e.kind === 'notification' &&
        e.data.name.includes('1 persoane peste locurile rezervate.'),
    ),
  );
});
console.log(`${count} family RSVP scenarios passed`);
