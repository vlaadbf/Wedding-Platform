import { Data, AppError, uid, list } from '../lib/domain';
import { bindings, all, one, stmt, now, rows, hash, token, db } from './store';
export function integrationStatus(demo = false) {
  const b = bindings();
  return [
    {
      id: 'email',
      name: 'Email · Resend',
      configured: !!(b.RESEND_API_KEY && b.EMAIL_FROM),
      description:
        'Domeniu verificat, cheie API și adresă expeditor. Acceptarea nu dovedește livrarea.',
      required: 'RESEND_API_KEY, EMAIL_FROM, RESEND_WEBHOOK_SECRET',
    },
    {
      id: 'sms',
      name: 'SMS · Twilio',
      configured: !!(
        b.TWILIO_ACCOUNT_SID &&
        b.TWILIO_AUTH_TOKEN &&
        b.TWILIO_FROM
      ),
      description:
        'Număr expeditor și contacte în format internațional. Costul depinde de destinație.',
      required: 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM',
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp · Twilio',
      configured: !!(
        b.TWILIO_ACCOUNT_SID &&
        b.TWILIO_AUTH_TOKEN &&
        b.WHATSAPP_FROM &&
        b.WHATSAPP_CONTENT_SID
      ),
      description:
        'Expeditor oficial, acordul destinatarului și șablon aprobat de WhatsApp.',
      required:
        'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, WHATSAPP_FROM, WHATSAPP_CONTENT_SID',
    },
    {
      id: 'stripe',
      name: 'Plăți online · Stripe',
      configured: false,
      description:
        'Evidența manuală este disponibilă. Fluxul de încasare pentru furnizori necesită Stripe Connect și configurare separată.',
      required: 'Stripe Connect · flux comercial de definit',
    },
    {
      id: 'worker',
      name: 'Procesare automată',
      configured: !!b.JOB_SECRET,
      description:
        'Un scheduler extern apelează endpointul protejat în fiecare minut.',
      required: 'JOB_SECRET + scheduler HTTPS',
    },
  ].map((x) => ({ ...x, demo }));
}
export function localToUTC(date: string, time: string, zone: string) {
  const target = Date.parse(date + 'T' + time + ':00Z');
  if (!Number.isFinite(target))
    throw new AppError(400, 'Data programării nu este validă.');
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const local = (ms: number) => {
    const p = Object.fromEntries(
      fmt.formatToParts(ms).map((p) => [p.type, p.value]),
    );
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  };
  const wanted = date + 'T' + time;
  const matches: number[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = target + offset * 60000;
    if (local(candidate) === wanted) matches.push(candidate);
  }
  if (matches.length !== 1)
    throw new AppError(
      400,
      matches.length
        ? 'Ora este ambiguă la schimbarea orei sezoniere. Alege o altă oră.'
        : 'Ora nu există în fusul selectat.',
    );
  return new Date(matches[0]).toISOString();
}
export async function send(
  channel: string,
  to: string,
  text: string,
  id: string,
  origin: string,
) {
  const b = bindings();
  if (!integrationStatus().find((x) => x.id === channel)?.configured)
    return { status: 'unconfigured', error: 'Integrare neconfigurată' };
  try {
    let response: Response;
    if (channel === 'email')
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${b.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': id,
        },
        body: JSON.stringify({
          from: b.EMAIL_FROM,
          to: [to],
          subject: 'O invitație pentru tine',
          text,
        }),
        signal: AbortSignal.timeout(15000),
      });
    else {
      const form = new URLSearchParams({
        To: channel === 'whatsapp' ? 'whatsapp:' + to : to,
        From: channel === 'whatsapp' ? b.WHATSAPP_FROM : b.TWILIO_FROM,
        StatusCallback: origin + '/api/webhooks/twilio',
      });
      if (channel === 'whatsapp') {
        form.set('ContentSid', b.WHATSAPP_CONTENT_SID);
        form.set('ContentVariables', JSON.stringify({ '1': text }));
      } else form.set('Body', text);
      response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${b.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization:
              'Basic ' + btoa(b.TWILIO_ACCOUNT_SID + ':' + b.TWILIO_AUTH_TOKEN),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form,
          signal: AbortSignal.timeout(15000),
        },
      );
    }
    if (!response.ok)
      return {
        status:
          response.status === 429
            ? 'retry'
            : response.status >= 500
              ? 'unknown'
              : 'failed',
        error: `Furnizorul a răspuns cu HTTP ${response.status}`,
      };
    const r = (await response.json()) as Data;
    return { status: 'accepted', provider_id: r.id || r.sid };
  } catch {
    return {
      status: 'unknown',
      error: 'Rezultat incert. Verifică la furnizor înainte de a retrimite.',
    };
  }
}
export async function tick(origin: string, eventId?: string, demoOnly = false) {
  const due = await all(
    "SELECT * FROM jobs WHERE status='queued' AND due_at<=?" +
      (eventId ? ' AND event_id=?' : '') +
      ' ORDER BY due_at LIMIT 20',
    ...[now(), ...(eventId ? [eventId] : [])],
  );
  let processed = 0;
  for (const job of due) {
    const event = await one('SELECT * FROM events WHERE id=?', job.event_id);
    if (!event) continue;
    const e = JSON.parse(event.data);
    if (demoOnly && !e.demo) continue;
    const allRows = await rows(job.event_id);
    const family = allRows.find((x) => x.id === job.household_id);
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hourCycle: 'h23',
        timeZone: e.timezone,
      }).format(new Date()),
    );
    if (!e.demo && (hour < 9 || hour >= 20)) continue;
    const claim = await stmt(
      "UPDATE jobs SET status='processing',locked_at=?,updated_at=? WHERE id=? AND status='queued' RETURNING id",
      now(),
      now(),
      job.id,
    ).first();
    if (!claim) continue;
    let result: Data = { status: 'skipped', error: '' };
    const guests = list(allRows, 'guest').filter(
      (x) => x.data.household_id === job.household_id,
    );
    const responses = list(allRows, 'rsvp');
    const pending = guests.some((g) =>
      list(allRows, 'guest_invitation')
        .filter((i) => i.data.guest_id === g.id)
        .some(
          (i) =>
            !responses.some(
              (r) =>
                r.data.guest_id === g.id &&
                r.data.subevent_id === i.data.subevent_id &&
                r.data.status !== 'pending',
            ),
        ),
    );
    if (
      e.status === 'cancelled' ||
      !family ||
      family.data.opt_out ||
      (job.type === 'rsvp_reminder' && !pending)
    )
      result = {
        status: 'skipped',
        error: 'Destinatar neeligibil la momentul expedierii.',
      };
    else if (e.demo)
      result = {
        status: 'simulated',
        error: 'Mod demo: niciun mesaj extern nu a fost expediat.',
      };
    else {
      const p = JSON.parse(job.payload);
      result = await send(
        job.channel,
        job.channel === 'email' ? family.data.email : family.data.phone,
        p.text,
        job.id,
        origin,
      );
    }
    const retry = result.status === 'retry' && job.attempt < 3;
    await db().batch([
      stmt(
        'UPDATE jobs SET status=?,attempt=attempt+1,provider_id=?,error=?,due_at=?,updated_at=? WHERE id=?',
        retry ? 'queued' : result.status === 'retry' ? 'failed' : result.status,
        result.provider_id || null,
        result.error || null,
        retry
          ? new Date(Date.now() + 60000 * 2 ** job.attempt).toISOString()
          : job.due_at,
        now(),
        job.id,
      ),
      stmt(
        'INSERT INTO message_attempts(id,job_id,status,code,created_at) VALUES(?,?,?,?,?)',
        uid(),
        job.id,
        result.status,
        result.error || null,
        now(),
      ),
    ]);
    processed++;
  }
  // A crashed process leaves uncertainty: do not retry a potentially accepted message.
  await stmt(
    "UPDATE jobs SET status='unknown',error='Proces întrerupt. Reconciliere necesară.',updated_at=? WHERE status='processing' AND locked_at<?",
    now(),
    new Date(Date.now() - 300000).toISOString(),
  ).run();
  // Persistent, deduplicated payment reminders. No outbound communication implied.
  const events = await all(
    'SELECT id,data FROM events' + (eventId ? ' WHERE id=?' : ''),
    ...(eventId ? [eventId] : []),
  );
  for (const event of events) {
    const es = await rows(event.id);
    for (const schedule of list(es, 'schedule')) {
      const exp = schedule.data.expense_id;
      const paid =
        list(es, 'payment')
          .filter((p) => p.data.expense_id === exp)
          .reduce((s, p) => s + p.data.amount, 0) -
        list(es, 'refund')
          .filter((r) =>
            list(es, 'payment').some(
              (p) => p.id === r.data.payment_id && p.data.expense_id === exp,
            ),
          )
          .reduce((s, r) => s + r.data.amount, 0);
      const due = list(es, 'schedule')
        .filter(
          (s) => s.data.expense_id === exp && s.data.due <= schedule.data.due,
        )
        .reduce((s, x) => s + x.data.amount, 0);
      if (
        Date.parse(schedule.data.due) <= Date.now() + 7 * 86400000 &&
        paid < due
      ) {
        const id = 'due-' + schedule.id;
        await stmt(
          'INSERT OR IGNORE INTO entities(id,event_id,kind,data,author_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
          id,
          event.id,
          'notification',
          JSON.stringify({
            name: `Scadență: ${schedule.data.name} · ${schedule.data.due}`,
            read: false,
            context_id: schedule.id,
          }),
          'system',
          now(),
          now(),
        ).run();
      }
    }
  }
  return { ok: true, processed };
}
async function hmac(secret: string, message: string, algorithm = 'SHA-256') {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign'],
  );
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)),
  );
}
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
export async function webhook(req: Request, provider: string) {
  const raw = await req.text(),
    b = bindings();
  let id: string, pid: string, status: string;
  if (provider === 'resend') {
    if (!b.RESEND_WEBHOOK_SECRET)
      throw new AppError(503, 'Webhook neconfigurat.');
    const sid = req.headers.get('svix-id') || '',
      ts = req.headers.get('svix-timestamp') || '',
      sig = req.headers.get('svix-signature') || '';
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 300)
      throw new AppError(401, 'Semnătură expirată.');
    const keyBytes = Uint8Array.from(
      atob(b.RESEND_WEBHOOK_SECRET.replace('whsec_', '')),
      (c) => c.charCodeAt(0),
    );
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const expected = b64(
      new Uint8Array(
        await crypto.subtle.sign(
          'HMAC',
          key,
          new TextEncoder().encode(`${sid}.${ts}.${raw}`),
        ),
      ),
    );
    if (!sig.split(' ').some((x) => x === 'v1,' + expected))
      throw new AppError(401, 'Semnătură invalidă.');
    const data = JSON.parse(raw);
    id = sid;
    pid = data.data.email_id;
    status =
      (
        {
          'email.delivered': 'delivered',
          'email.bounced': 'failed',
          'email.failed': 'failed',
        } as Data
      )[data.type] || 'unknown';
  } else if (provider === 'twilio') {
    if (!b.TWILIO_AUTH_TOKEN) throw new AppError(503, 'Webhook neconfigurat.');
    const form = new URLSearchParams(raw);
    const message =
      req.url +
      [...form.keys()]
        .sort()
        .map((k) => k + form.get(k))
        .join('');
    if (
      req.headers.get('x-twilio-signature') !==
      b64(await hmac(b.TWILIO_AUTH_TOKEN, message, 'SHA-1'))
    )
      throw new AppError(401, 'Semnătură invalidă.');
    pid = form.get('MessageSid') || '';
    status =
      (
        {
          delivered: 'delivered',
          read: 'delivered',
          failed: 'failed',
          undelivered: 'failed',
          sent: 'accepted',
          queued: 'accepted',
        } as Data
      )[form.get('MessageStatus') || ''] || 'unknown';
    id = pid + ':' + form.get('MessageStatus');
  } else throw new AppError(404, 'Webhook necunoscut.');
  if (!pid || !id) throw new AppError(400, 'Eveniment webhook invalid.');
  const existing = await one(
    'SELECT id FROM webhook_events WHERE provider=? AND id=?',
    provider,
    id,
  );
  if (existing) return { ok: true, duplicate: true };
  await db().batch([
    stmt(
      'INSERT OR IGNORE INTO webhook_events(provider,id,created_at) VALUES(?,?,?)',
      provider,
      id,
      now(),
    ),
    stmt(
      "UPDATE jobs SET status=?,updated_at=? WHERE provider_id=? AND status NOT IN ('delivered','failed')",
      status,
      now(),
      pid,
    ),
  ]);
  return { ok: true };
}
