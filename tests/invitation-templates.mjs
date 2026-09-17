import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  invitationTemplates,
  invitationArt,
  templateCategories,
  applyTemplate,
} from '../lib/invitation-templates.ts';
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const testIp = 'qa-templates-' + crypto.randomUUID();
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  throw new Error('Local tests only.');
let cookie = '',
  version = 1;
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
assert.equal(invitationTemplates.length, 10);
assert.equal(new Set(invitationTemplates.map((t) => t.id)).size, 10);
assert.equal(new Set(invitationTemplates.map((t) => t.layout)).size, 10);
assert.equal(templateCategories.length, 5);
for (const asset of Object.values(invitationArt)) {
  const bytes = await readFile(new URL('../public' + asset.fallback, import.meta.url));
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  assert.equal((await fetch(origin + asset.fallback)).status, 200);
  for (const format of ['avif', 'webp']) {
    const variants = asset[format].split(', ').map((entry) => entry.split(' ')[0]);
    assert.equal(variants.length, 3);
    for (const variant of variants)
      assert.equal((await fetch(origin + variant)).status, 200);
    const mobile = await readFile(
      new URL('../public' + variants.find((variant) => variant.includes('-640.')), import.meta.url),
    );
    assert(mobile.length < 200_000, `${variants[0]} must stay below 200 KB`);
  }
}
console.log(
  'PASS Ten layouts, five categories and responsive PNG/AVIF/WebP artwork',
);
await call('auth/demo', 'POST', {});
const eventId = (
  await call(
    'events',
    'POST',
    {
      name: 'Invitation collection QA',
      timezone: 'Europe/Bucharest',
      currency: 'RON',
    },
    201,
  )
).id;
const path = 'events/' + eventId;
const state = await call(path);
version = state.event.version;
const design = state.entities.find((e) => e.kind === 'invitation');
const save = (data) =>
  call(path + '/records/invitation/' + design.id, 'PATCH', { version, data });
const publish = () =>
  call(path + '/publish', 'POST', { version, id: design.id });
await publish();
const family = (
  await call(path + '/records/household', 'POST', {
    version,
    data: { name: 'Familia Invitație QA' },
  })
).id;
const link = (
  await call(path + '/invite-link', 'POST', { version, household_id: family })
).url;
const publicPath = 'public/' + link.split('/').pop();
const publicData = () => call(publicPath, 'GET', undefined, 200, true);
let published = (await publicData()).invitation;
assert(!published.template_id, 'Legacy invitation stays available');
for (const template of invitationTemplates) {
  const draft = applyTemplate(
    {
      ...design.data,
      message: 'Mesaj personalizat — ' + template.name,
      partner1: 'Ioana',
      partner2: 'Victor',
      location: 'Grădina noastră',
      rsvp_deadline: '2030-12-01',
    },
    template.id,
  );
  await save(draft);
  assert.deepEqual(
    (await publicData()).invitation,
    published,
    'Saving a draft must not change a sent invitation',
  );
  await publish();
  published = (await publicData()).invitation;
  for (const field of [
    'template_id',
    'message',
    'partner1',
    'partner2',
    'location',
    'rsvp_deadline',
    'background',
    'font',
    'artwork',
  ])
    assert.equal(published[field], draft[field]);
  console.log('PASS Save/publish and unchanged family link: ' + template.name);
}
await call(
  path + '/records/invitation/' + design.id,
  'PATCH',
  { version, data: { ...design.data, template_id: 'unknown' } },
  400,
);
await call(
  path + '/records/invitation/' + design.id,
  'PATCH',
  { version, data: { ...design.data, background: 'url(invalid)' } },
  400,
);
console.log('PASS Unknown templates and unsafe color values rejected');
console.log('12 invitation collection scenarios passed');
