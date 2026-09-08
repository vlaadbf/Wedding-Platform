import assert from 'node:assert/strict';
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
let count = 0;
const report = [];
async function test(name, fn) {
  await fn();
  count++;
  report.push(name);
  console.log('PASS', name);
}
class Client {
  cookie = '';
  event = '';
  version = 1;
  async call(path, method = 'GET', body, expected = 200) {
    const r = await fetch(origin + '/api/' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.headers.get('set-cookie'))
      this.cookie = r.headers.get('set-cookie').split(';')[0];
    const text = await r.text();
    let d;
    try {
      d = JSON.parse(text);
    } catch {
      d = text;
    }
    assert.equal(
      r.status,
      expected,
      `${path}: ${JSON.stringify(d).slice(0, 400)}`,
    );
    return d;
  }
  async load() {
    const s = await this.call('events/' + this.event);
    this.version = s.event.version;
    return s;
  }
  async change(path, data = {}, expected = 200) {
    return this.call(
      'events/' + this.event + '/' + path,
      'POST',
      { version: this.version, ...data },
      expected,
    );
  }
  async add(kind, data, expected = 200) {
    const r = await this.change('records/' + kind, { data }, expected);
    if (expected === 200) this.version = r.version;
    return r;
  }
}
const a = new Client(),
  b = new Client(),
  anon = new Client();
let family, guest, sub, table, expense, payment, link, invite;
await test('Demo persistă 120 persoane fictive și separă familiile', async () => {
  const d = await a.call('auth/demo', 'POST', {});
  a.event = d.event_id;
  const s = await a.load();
  assert.equal(s.summary.total, 120);
  assert.equal(s.summary.households, 50);
  assert.equal(s.summary.confirmed, 86);
  assert.equal(s.summary.unseated, 12);
  assert.equal(s.summary.paid, 2575000);
});
await test('Cont, eveniment nou și onboarding fără dată', async () => {
  const d = await a.call(
    'events',
    'POST',
    {
      name: 'Flux verificare · QA',
      budget: 100000,
      currency: 'RON',
      timezone: 'Europe/Bucharest',
    },
    201,
  );
  a.event = d.id;
  const s = await a.load();
  assert.equal(s.event.data.date, '');
  assert(s.entities.filter((x) => x.kind === 'task').every((t) => !t.data.due));
  sub = s.entities.find(
    (x) => x.kind === 'subevent' && x.data.name.includes('Recepție'),
  ).id;
  invite = s.entities.find((x) => x.kind === 'invitation');
});
await test('Acces API neautorizat și cross-event ref respinse', async () => {
  await anon.call('events/' + a.event, 'GET', undefined, 401);
  const d = await b.call('auth/register', 'POST', {
    email: 'qa-' + crypto.randomUUID() + '@example.invalid',
    name: 'QA recepție',
    password: 'Fictitious-QA-passphrase-2026',
  });
  await b.call('events/' + a.event, 'GET', undefined, 403);
  await a.add(
    'guest',
    { name: 'Test referință', household_id: 'alt-eveniment' },
    400,
  );
});
const importRows = [
  {
    name: 'Ana Test',
    family: 'Familia Test',
    email: 'ana@example.invalid',
    age: 'adult',
  },
  { name: 'Mihai Test', family: 'Familia Test', age: 'adult' },
];
await test('Import cu previzualizare și grupare familială', async () => {
  const preview = await a.change('import', { rows: importRows, preview: true });
  assert.equal(preview.report.length, 2);
  assert(preview.report.every((r) => !r.error));
  const r = await a.change('import', {
    rows: importRows,
    duplicate_policy: 'skip',
    key: crypto.randomUUID(),
  });
  assert.equal(r.created, 2);
  const s = await a.load();
  assert.equal(s.summary.total, 2);
  assert.equal(s.summary.households, 1);
  family = s.entities.find((x) => x.kind === 'household').id;
  guest = s.entities.find((x) => x.kind === 'guest').id;
});
await test('Reimportul avertizează și nu dublează implicit', async () => {
  const p = await a.change('import', { rows: importRows, preview: true });
  assert(p.report.every((r) => r.duplicates.length > 0));
  const r = await a.change('import', {
    rows: importRows,
    duplicate_policy: 'skip',
    key: crypto.randomUUID(),
  });
  assert.equal(r.created, 0);
  assert.equal(r.skipped, 2);
  assert.equal((await a.load()).summary.total, 2);
});
await test('Datele de contact invalide au erori pe rânduri', async () => {
  const p = await a.change('import', {
    rows: [{ name: 'Eroare', family: 'Test', email: 'invalid' }],
    preview: true,
  });
  assert(p.report[0].error);
});
await test('Invitația se personalizează și se publică separat', async () => {
  const r = await a.call(
    'events/' + a.event + '/records/invitation/' + invite.id,
    'PATCH',
    {
      version: a.version,
      data: {
        ...invite.data,
        message: 'Invitația noastră testată',
        rsvp_deadline: '2027-12-01',
      },
    },
  );
  a.version = r.version;
  await a.change('publish', { id: invite.id });
  await a.load();
  link = (await a.change('invite-link', { household_id: family })).url;
  await a.load();
  const p = await anon.call('public/' + link.split('/').pop());
  assert.equal(p.invitation.message, 'Invitația noastră testată');
  assert.equal(p.guests.length, 2);
  assert(!('notes' in p.guests[0].data));
});
await test('Programare persistentă cu activare explicită și fără dubluri', async () => {
  const message = 'Dragă {family}, {link}';
  await a.change(
    'campaigns',
    { channel: 'email', type: 'rsvp_reminder', message },
    400,
  );
  await a.change('campaigns', {
    channel: 'email',
    type: 'rsvp_reminder',
    message,
    activate: true,
    date: '2026-01-01',
    time: '10:00',
  });
  const s = await a.load();
  assert.equal(s.jobs.length, 1);
  assert.equal(s.jobs[0].status, 'queued');
});
await test('Portalul respinge persoanele și momentele neautorizate', async () => {
  const path = 'public/' + link.split('/').pop();
  await anon.call(
    path,
    'POST',
    {
      version: a.version,
      responses: [
        { guest_id: 'foreign', subevent_id: sub, status: 'confirmed' },
      ],
    },
    403,
  );
  await anon.call(
    path,
    'POST',
    {
      version: a.version,
      responses: [
        { guest_id: guest, subevent_id: 'foreign', status: 'confirmed' },
      ],
    },
    403,
  );
});
await test('RSVP actualizează dashboardul și istoricul', async () => {
  const path = 'public/' + link.split('/').pop(),
    p = await anon.call(path);
  const responses = p.invitations.map((i) => ({
    guest_id: i.data.guest_id,
    subevent_id: i.data.subevent_id,
    status: 'confirmed',
  }));
  await anon.call(path, 'POST', {
    version: p.event.version,
    responses,
    guests: [],
  });
  const s = await a.load();
  assert.equal(s.summary.confirmed, 2);
  assert.equal(s.summary.unseated, 2);
  const p2 = await anon.call(path);
  await anon.call(path, 'POST', {
    version: p2.event.version,
    responses,
    guests: [],
  });
  assert.equal(
    (await a.load()).entities.filter((x) => x.kind === 'rsvp').length,
    6,
  );
});
await test('Reminderul reevaluează RSVP înainte de expediere', async () => {
  await a.change('process-demo');
  const s = await a.load();
  assert.equal(s.jobs[0].status, 'skipped');
  await a.change('process-demo');
  assert.equal((await a.load()).jobs.length, 1);
});
await test('Editările simultane primesc 409, fără suprascriere', async () => {
  const v = a.version;
  const results = await Promise.all([
    a.call('events/' + a.event + '/records/task', 'POST', {
      version: v,
      data: { name: 'Concurență A' },
    }),
    fetch(origin + '/api/events/' + a.event + '/records/task', {
      method: 'POST',
      headers: { cookie: a.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ version: v, data: { name: 'Concurență B' } }),
    }),
  ]);
  assert.equal(results[1].status, 409);
  await a.load();
});
await test('Repartizare și constrângeri de capacitate / unicitate', async () => {
  table = (
    await a.add('table', { name: 'Masa test', subevent_id: sub, capacity: 1 })
  ).id;
  await a.add('assignment', { guest_id: guest, table_id: table, seat: 1 });
  const s = await a.load();
  assert.equal(s.summary.unseated, 1);
  await a.add('assignment', { guest_id: guest, table_id: table, seat: 1 }, 409);
  const other = s.entities.find((x) => x.kind === 'guest' && x.id !== guest);
  await a.add(
    'assignment',
    { guest_id: other.id, table_id: table, seat: 2 },
    400,
  );
});
await test('Avansuri și rambursări au solduri exacte', async () => {
  expense = (
    await a.add('expense', {
      name: 'Locație test',
      estimated: 100000,
      contracted: 90000,
      currency: 'RON',
    })
  ).id;
  payment = (
    await a.add('payment', {
      name: 'Avans manual',
      expense_id: expense,
      amount: 25001,
      currency: 'RON',
      date: '2026-09-08',
    })
  ).id;
  await a.add('refund', {
    name: 'Ajustare',
    payment_id: payment,
    amount: 501,
    currency: 'RON',
    date: '2026-09-08',
  });
  const s = await a.load();
  assert.equal(s.summary.paid, 24500);
  assert.equal(s.summary.remaining, 65500);
  await a.add(
    'refund',
    {
      name: 'Peste sumă',
      payment_id: payment,
      amount: 25001,
      currency: 'RON',
      date: '2026-09-08',
    },
    400,
  );
  await a.add(
    'payment',
    {
      name: 'Monedă greșită',
      expense_id: expense,
      amount: 1,
      currency: 'EUR',
      date: '2026-09-08',
    },
    400,
  );
  await a.add(
    'payment',
    {
      name: 'Zecimale',
      expense_id: expense,
      amount: 1.1,
      currency: 'RON',
      date: '2026-09-08',
    },
    400,
  );
});
await test('Reminder de scadență persistă o singură notificare', async () => {
  await a.add('schedule', {
    name: 'Sold locație',
    expense_id: expense,
    amount: 90000,
    currency: 'RON',
    due: '2026-09-01',
  });
  await a.change('process-demo');
  const s = await a.load();
  const n = s.entities.filter(
    (x) => x.kind === 'notification' && x.id.startsWith('due-'),
  ).length;
  assert.equal(n, 1);
  await a.change('process-demo');
  assert.equal(
    (await a.load()).entities.filter(
      (x) => x.kind === 'notification' && x.id.startsWith('due-'),
    ).length,
    n,
  );
});
await test('Exportul locației include masa și respectă filtrul', async () => {
  const csv = await a.call('events/' + a.event + '/export?kind=guest&q=Ana');
  assert(csv.includes('Masa test'));
  assert(csv.includes('Ana Test'));
  assert(!csv.includes('Mihai Test'));
});
await test('Check-in repetat este idempotent și se poate anula', async () => {
  await a.change('checkin', { guest_id: guest, subevent_id: sub });
  await a.load();
  const r = await a.change('checkin', { guest_id: guest, subevent_id: sub });
  assert(r.duplicate);
  assert.equal((await a.load()).summary.arrived, 1);
  await a.change('checkin', { guest_id: guest, subevent_id: sub, undo: true });
  assert.equal((await a.load()).summary.arrived, 0);
  await a.change('checkin', { guest_id: guest, subevent_id: sub });
  await a.load();
});
await test('Invitarea unui coorganizator și acceptarea prin contul destinat', async () => {
  const me = (await b.call('me')).user;
  const r = await a.change('team', { email: me.email, role: 'checkin' });
  await a.load();
  await b.call('team-accept', 'POST', {
    token: new URL(r.url).searchParams.get('team_token'),
  });
  b.event = a.event;
  const s = await b.load();
  assert.equal(s.role, 'checkin');
  assert(!s.entities.some((e) => e.kind === 'payment'));
  assert(!('budget' in s.event.data));
  assert(
    s.entities
      .filter((e) => e.kind === 'guest')
      .every((g) => !('email' in g.data) && !('allergies' in g.data)),
  );
  await b.call(
    'events/' + a.event + '/export?kind=payment',
    'GET',
    undefined,
    403,
  );
  await b.add('payment', { name: 'Forbidden' }, 403);
});
await test('Linkurile revocate nu mai oferă acces', async () => {
  await a.change('revoke-links', { household_id: family });
  await anon.call('public/' + link.split('/').pop(), 'GET', undefined, 404);
  await a.load();
});
await test('Capacitățile transportului și cazării sunt protejate', async () => {
  const transport = (
    await a.add('transport', { name: 'Vehicul test', capacity: 1 })
  ).id;
  await a.add('transport_assignment', {
    guest_id: guest,
    transport_id: transport,
  });
  const s = await a.load(),
    other = s.entities.find((x) => x.kind === 'guest' && x.id !== guest);
  await a.add(
    'transport_assignment',
    { guest_id: other.id, transport_id: transport },
    409,
  );
});
await test('Trimiterea reală e blocată când integrarea lipsește', async () => {
  const r = await b.call(
    'events',
    'POST',
    { name: 'Eveniment real QA', currency: 'RON' },
    201,
  );
  const old = b.event;
  b.event = r.id;
  await b.load();
  await b.change(
    'campaigns',
    { channel: 'email', message: 'Test', activate: true },
    503,
  );
  b.event = old;
});
await test('Ștergerea unei mese eliberează persoanele', async () => {
  await a.call('events/' + a.event + '/records/table/' + table, 'DELETE', {
    version: a.version,
  });
  assert.equal((await a.load()).summary.unseated, 2);
});
await test('Protecție CSRF pentru mutații', async () => {
  const r = await fetch(origin + '/api/events/' + a.event + '/records/task', {
    method: 'POST',
    headers: {
      cookie: a.cookie,
      origin: 'https://foreign.invalid',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      version: a.version,
      data: { name: 'Nu trebuie creat' },
    }),
  });
  assert.equal(r.status, 403);
});
await test('Endpointul joburilor și webhookurile resping accesul neautorizat', async () => {
  await anon.call('jobs', 'POST', {}, 401);
  await anon.call('webhooks/resend', 'POST', {}, 503);
});
await test('API-ul paginat de recepție elimină contactele și alergiile', async()=>{
  const result=await b.call('events/'+a.event+'/records/guest');
  assert(result.items.every(g=>!('email' in g.data)&&!('allergies' in g.data)));
  const evs=await b.call('events');assert(evs.events.every(e=>!('budget' in e.data)));
});
await test('Exportul XLSX produce un registru valid, autorizat',async()=>{
  const r=await fetch(origin+'/api/events/'+a.event+'/export?kind=guest&format=xlsx',{headers:{cookie:a.cookie}});
  assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.subarray(0,2).toString(),'PK');
  const {default:ExcelJS}=await import('exceljs');const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);assert.equal(book.worksheets[0].rowCount,3);
});
await test('Planul salvează versiuni și restaurează fără dublarea locurilor',async()=>{
  const t=(await a.add('table',{name:'Masa versiuni',subevent_id:sub,capacity:4,x:100,y:100})).id;
  const saved=await a.change('floor',{action:'save'});await a.load();
  const original=(await a.load()).entities.find(e=>e.id===t);
  await a.call('events/'+a.event+'/records/table/'+t,'PATCH',{version:a.version,data:{...original.data,x:300}});await a.load();
  await a.change('floor',{action:'restore',id:saved.id});assert.equal((await a.load()).entities.find(e=>e.id===t).data.x,100);
  const preview=await a.change('floor',{action:'suggest',preview:true});assert.equal(preview.proposed.length,2);
  await a.change('floor',{action:'suggest',confirm:true});assert.equal((await a.load()).summary.unseated,0);
});
await test('Codul QR opac este limitat la eveniment și idempotent',async()=>{
  const r=await a.change('invite-link',{household_id:family});await a.load();
  await a.change('checkin',{qr:r.url,subevent_id:sub});await a.load();
  await a.change('checkin',{qr:r.url,subevent_id:sub});assert.equal((await a.load()).summary.arrived,2);
  await a.change('checkin',{qr:'0'.repeat(64),subevent_id:sub},404);
});
await test('Fusul orar și orele DST imposibile / ambigue sunt respinse',async()=>{
  await a.call('events','POST',{name:'Bad zone',timezone:'Invalid/Zone'},400);
  await a.change('campaigns',{activate:true,channel:'email',type:'invitation',message:'Test {link}',date:'2027-03-28',time:'03:30'},400);
  await a.change('campaigns',{activate:true,channel:'email',type:'invitation',message:'Test {link}',date:'2027-10-31',time:'03:30'},400);
});
await test('Anularea evenimentului oprește accesul public',async()=>{
  const r=await a.change('invite-link',{household_id:family});const current=await a.load();
  await a.call('events/'+a.event,'PATCH',{...current.event.data,name:current.event.name,status:'cancelled',version:a.version});
  await anon.call('public/'+r.url.split('/').pop(),'GET',undefined,410);
});
console.log(
  `\n${count} verificări API trecute. Flux integral demonstrat pe date fictive.`,
);
