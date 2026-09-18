import { suggestions, snapshotStatements, restorePlan } from './seating';
import { adminAccounts, bootstrapAdmin } from './admin';
import { familyPending, saveFamily } from './family-rsvp';
import { runtimeSettings } from './integration-settings';
import {
  Data,
  Entity,
  AppError,
  uid,
  schemas,
  validate,
  list,
  summary,
  csv,
  permission,
  labels,
} from '../lib/domain';
import {
  db,
  stmt,
  one,
  all,
  now,
  rows,
  access,
  authorize,
  mutate,
  insertEntity,
  enforce,
  decode,
  hash,
  token,
  bindings,
} from './store';
import { auth, requireUser, user, rate, secureEqual } from './auth';
import { createEvent } from './seed';
import { integrationStatus, localToUTC, tick, webhook } from './integrations';
import { hasSensitiveDetails, PRIVACY_NOTICE_VERSION } from '../lib/privacy';
import { isUserTheme } from '../lib/themes';
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...extra,
    },
  });
const invitationExpiry = (eventData: Data) => {
  const base = eventData.date
    ? Date.parse(String(eventData.date) + 'T23:59:59.999Z') + 30 * 86400000
    : Date.now() + 400 * 86400000;
  return new Date(base).toISOString();
};
const redact = (a: Data, x: Entity): Entity =>
  a.role === 'checkin'
    ? {
        ...x,
        data: Object.fromEntries(
          Object.entries(x.data).filter(([k]) =>
            (x.kind === 'guest'
              ? ['name', 'household_id', 'age']
              : x.kind === 'household'
                ? ['name']
                : x.kind === 'rsvp'
                  ? ['guest_id', 'subevent_id', 'status']
                  : Object.keys(x.data)
            ).includes(k),
          ),
        ),
      }
    : x;
const safeEvent = (e: Data) => {
  const d = { ...e.data };
  delete d.published_invitation;
  return { ...e, data: d };
};
function eventInput(b: Data) {
  const name = String(b.name || '').trim();
  if (!name || name.length > 200)
    throw new AppError(400, 'Completează numele evenimentului.');
  const zone = String(b.timezone || 'Europe/Bucharest');
  try {
    new Intl.DateTimeFormat('ro', { timeZone: zone });
  } catch {
    throw new AppError(400, 'Fus orar invalid.');
  }
  const date = String(b.date || '');
  if (
    date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date)
  )
    throw new AppError(400, 'Dată invalidă.');
  const budget = Number(b.budget || 0);
  if (!Number.isSafeInteger(budget) || budget < 0)
    throw new AppError(400, 'Buget invalid.');
  if (!['RON', 'EUR', 'USD'].includes(b.currency || 'RON'))
    throw new AppError(400, 'Monedă invalidă.');
  return {
    name,
    date,
    timezone: zone,
    budget,
    currency: b.currency || 'RON',
    language: b.language === 'en' ? 'en' : 'ro',
    city: String(b.city || '').slice(0, 200),
    venue: String(b.venue || '').slice(0, 300),
    partner1: String(b.partner1 || '').slice(0, 100),
    partner2: String(b.partner2 || '').slice(0, 100),
    expected: Math.min(10000, Math.max(1, Number(b.expected) || 120)),
    app_name: String(b.app_name || 'Planora').slice(0, 80),
    privacy_operator: String(b.privacy_operator || '').trim().slice(0, 200),
    privacy_contact: String(b.privacy_contact || '').trim().slice(0, 300),
    status: b.status === 'cancelled' ? 'cancelled' : 'active',
  };
}
export async function handle(req: Request) {
  const correlation = uid();
  try {
    return await route(req);
  } catch (e) {
    if (e instanceof AppError)
      return json(
        { error: { code: e.code, message: e.message, correlation } },
        e.status,
      );
    console.error(
      JSON.stringify({
        correlation,
        code: 'internal_error',
        type: e instanceof Error ? e.name : 'unknown',
      }),
    );
    return json(
      {
        error: {
          code: 'internal_error',
          message:
            'Operațiunea nu a fost finalizată. Reîncearcă sau contactează administratorul.',
          correlation,
        },
      },
      500,
    );
  }
}
async function route(req: Request): Promise<Response> {
  const url = new URL(req.url),
    parts = url.pathname
      .replace(/^\/api\/?/, '')
      .split('/')
      .filter(Boolean),
    method = req.method,
    publicOrigin = bindings().APP_ORIGIN?.replace(/\/$/, '') || url.origin;
  const write = !['GET', 'HEAD'].includes(method);
  if (write && !['webhooks', 'jobs'].includes(parts[0])) {
    const origin = req.headers.get('origin');
    if (origin && origin !== url.origin && origin !== publicOrigin)
      throw new AppError(403, 'Originea cererii nu este autorizată.');
    if (req.headers.get('sec-fetch-site') === 'cross-site')
      throw new AppError(403, 'Cerere între site-uri respinsă.');
  }
  if (Number(req.headers.get('content-length') || 0) > 6 * 1024 * 1024)
    throw new AppError(413, 'Fișier prea mare (maximum 5 MB).');
  if (parts[0] === 'health') return json({ ok: true, service: 'Planora' });
  if (parts[0] === 'webhooks' && method === 'POST')
    return json(await webhook(req, parts[1]));
  if (parts[0] === 'jobs' && method === 'POST') {
    const secret = (await runtimeSettings()).JOB_SECRET;
    if (
      !secret ||
      !secureEqual(req.headers.get('authorization') || '', 'Bearer ' + secret)
    )
      throw new AppError(401, 'Autorizare necesară.');
    return json(await tick(publicOrigin));
  }
  let body: Data = {};
  if (
    write &&
    !req.headers.get('content-type')?.includes('multipart/form-data')
  ) {
    const raw = await req.text();
    if (raw.length > 1000000) throw new AppError(413, 'Cerere prea mare.');
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new AppError(400, 'Cererea JSON nu este validă.');
    }
    if (!body || Array.isArray(body) || typeof body !== 'object')
      throw new AppError(400, 'Cerere invalidă.');
  }
  if (parts[0] === 'auth' && method === 'POST') {
    const r = await auth(req, parts[1], body);
    if (parts[1] === 'demo') {
      const id = await createEvent(
        r.body.user,
        {
          name: 'Sofia & Andrei',
          partner1: 'Sofia',
          partner2: 'Andrei',
          date: '2026-10-17',
          city: 'București',
          venue: 'Domeniul Magnolia',
          budget: 14000000,
        },
        true,
        true,
      );
      r.body.event_id = id;
    }
    return json(r.body, 200, r.cookie ? { 'Set-Cookie': r.cookie } : {});
  }
  if (
    parts[0] === 'admin' &&
    parts[1] === 'bootstrap' &&
    parts.length === 2 &&
    method === 'POST'
  )
    return json(await bootstrapAdmin(req, body, publicOrigin), 201);
  if (parts[0] === 'public-event')
    return publicEventRoute(req, parts[1], method);
  if (parts[0] === 'public') return publicRoute(req, parts[1], body);
  if (parts[0] === 'me') {
    const u = await user(req);
    if (method === 'PATCH' && parts[1] === 'theme') {
      if (!u) throw new AppError(401, 'Autentifică-te pentru a continua.');
      if (!isUserTheme(body.theme))
        throw new AppError(400, 'Tema selectată nu este disponibilă.');
      await stmt('UPDATE users SET theme=? WHERE id=?', body.theme, u.id).run();
      return json({ user: { ...u, theme: body.theme } });
    }
    if (method !== 'GET' || parts.length !== 1)
      throw new AppError(404, 'Acțiune indisponibilă.');
    return json({ user: u });
  }
  let u = await requireUser(req);
  if (parts[0] === 'admin')
    return json(await adminAccounts(u, parts, method, body, url));
  const viewing =
    req.headers.get('x-admin-account') || url.searchParams.get('admin_account');
  if (viewing) {
    if (u.demo || u.platform_role !== 'super_admin')
      throw new AppError(403, 'Acces rezervat super adminului.');
    if (method !== 'GET' || parts[0] !== 'events')
      throw new AppError(
        403,
        'Contul clientului este deschis pentru consultare.',
      );
    const target = await one(
      "SELECT id,email,name,demo,approval_status,platform_role,theme FROM users WHERE id=? AND demo=0 AND platform_role='user'",
      viewing,
    );
    if (!target) throw new AppError(404, 'Cont indisponibil.');
    u = target;
  }
  if (parts[0] === 'sessions') {
    if (method === 'DELETE') {
      await stmt('DELETE FROM sessions WHERE user_id=?', u.id).run();
      return json({ ok: true }, 200, {
        'Set-Cookie': 'nn_session=; Path=/; Max-Age=0',
      });
    }
    return json({
      sessions: await all(
        'SELECT created_at,expires_at FROM sessions WHERE user_id=?',
        u.id,
      ),
    });
  }
  if (parts[0] === 'team-accept' && method === 'POST') {
    const h = await hash(String(body.token || ''));
    const invite = await one(
      'SELECT * FROM team_invites WHERE hash=? AND expires_at>? AND used_at IS NULL',
      h,
      now(),
    );
    if (!invite || invite.email !== u.email)
      throw new AppError(403, 'Invitație invalidă sau destinată altui cont.');
    await db().batch([
      stmt(
        'INSERT INTO event_members(event_id,user_id,role,grants) VALUES(?,?,?,?) ON CONFLICT(event_id,user_id) DO UPDATE SET role=excluded.role,grants=excluded.grants',
        invite.event_id,
        u.id,
        invite.role,
        invite.grants,
      ),
      stmt('UPDATE team_invites SET used_at=? WHERE hash=?', now(), h),
    ]);
    return json({ ok: true, event_id: invite.event_id });
  }
  if (parts[0] === 'events' && parts.length === 1) {
    if (method === 'GET') {
      const es = await all(
        "SELECT DISTINCT e.* FROM events e LEFT JOIN workspace_members w ON w.workspace_id=e.workspace_id AND w.user_id=? LEFT JOIN event_members m ON m.event_id=e.id AND m.user_id=? WHERE w.role='owner' OR m.user_id IS NOT NULL ORDER BY e.created_at DESC",
        u.id,
        u.id,
      );
      return json({
        events: es.map((e) => {
          const d = JSON.parse(e.data);
          return {
            id: e.id,
            workspace_id: e.workspace_id,
            name: e.name,
            data: { date: d.date, city: d.city, demo: d.demo },
          };
        }),
      });
    }
    if (method === 'POST') {
      await rate(req, 'event-create', 10);
      const input = eventInput(body);
      if (body.workspace_id) {
        const wm = await one(
          "SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=? AND role='owner'",
          body.workspace_id,
          u.id,
        );
        if (!wm)
          throw new AppError(403, 'Nu poți crea evenimente în acest spațiu.');
      }
      return json(
        {
          id: await createEvent(
            u,
            { ...input, workspace_id: body.workspace_id },
            !!u.demo,
          ),
        },
        201,
      );
    }
  }
  if (parts[0] !== 'events' || !parts[1])
    throw new AppError(404, 'Rută necunoscută.');
  const eventId = parts[1],
    a = await access(u, eventId),
    event = a.event;
  const op = parts[2];
  const skipsEntityScan =
    ['team', 'audit', 'trash', 'documents', 'job-action'].includes(op || '') ||
    (op === 'records' && method === 'GET');
  const es = skipsEntityScan ? [] : await rows(eventId);
  const version = Number(body.version);
  if (!op && method === 'GET') {
    const visible = es
      .filter(
        (x) =>
          permission(a.role, x.kind, 'view', a.grants) &&
          (a.role !== 'vendor' || a.shared_ids.includes(x.id)),
      )
      .map((x) => {
        if (a.role === 'checkin' && x.kind === 'guest')
          return {
            ...x,
            data: {
              name: x.data.name,
              household_id: x.data.household_id,
              age: x.data.age,
            },
          };
        if (a.role === 'checkin' && x.kind === 'household')
          return { ...x, data: { name: x.data.name } };
        if (a.role === 'checkin' && x.kind === 'rsvp')
          return {
            ...x,
            data: {
              guest_id: x.data.guest_id,
              subevent_id: x.data.subevent_id,
              status: x.data.status,
            },
          };
        return x;
      });
    const eventOut = safeEvent(event);
    if (!permission(a.role, 'expense', 'view', a.grants))
      delete eventOut.data.budget;
    return json({
      event: eventOut,
      entities: visible,
      role: a.role,
      grants: a.grants,
      summary: summary(visible, event.data),
      jobs: permission(a.role, 'campaign', 'view', a.grants)
        ? await all(
            'SELECT id,campaign_id,household_id,channel,type,due_at,status,attempt,error,provider_id FROM jobs WHERE event_id=? ORDER BY created_at DESC LIMIT 300',
            eventId,
          )
        : [],
    });
  }
  if (!op && method === 'PATCH') {
    if (!['owner', 'partner', 'planner'].includes(a.role))
      throw new AppError(403, 'Nu poți modifica setările.');
    const data = { ...event.data, ...eventInput({ ...event.data, ...body }) };
    return json(
      await mutate(eventId, version, u.id, 'event.update', [
        stmt(
          'UPDATE events SET name=?,data=? WHERE id=?',
          data.name,
          JSON.stringify(data),
          eventId,
        ),
      ]),
    );
  }
  if (op === 'floor') {
    authorize(a, 'table', method === 'GET' ? 'view' : 'edit');
    authorize(a, 'guest', 'view');
    if (method !== 'GET' && !['owner', 'partner', 'planner'].includes(a.role))
      throw new AppError(
        403,
        'Doar organizatorii pot aplica versiuni complete de plan.',
      );
    if (method === 'GET')
      return json({
        versions: es
          .filter((x) => x.kind === 'floor_version')
          .map((x) => ({
            id: x.id,
            name: x.data.name,
            created_at: x.created_at,
            count: x.data.snapshot.length,
          })),
        ...suggestions(
          es,
          url.searchParams.get('subevent') || summary(es, event.data).reception,
        ),
      });
    if (body.action === 'save') {
      const saved = snapshotStatements(
        eventId,
        es,
        u.id,
        String(body.name || 'Plan sală · ' + now()),
      );
      return json(
        await mutate(
          eventId,
          version,
          u.id,
          'floor.save',
          saved.statements,
          saved.id,
        ),
      );
    }
    if (body.action === 'restore') {
      const saved = es.find(
        (x) => x.id === body.id && x.kind === 'floor_version',
      );
      if (!saved) throw new AppError(404, 'Versiune inexistentă.');
      return json(await restorePlan(eventId, version, es, saved, u.id));
    }
    if (body.action === 'suggest') {
      authorize(a, 'assignment', 'create');
      const proposal = suggestions(
        es,
        body.subevent || summary(es, event.data).reception,
      );
      if (body.preview) return json(proposal);
      if (body.confirm !== true)
        throw new AppError(400, 'Previzualizează și confirmă sugestiile.');
      const statements = [
        ...snapshotStatements(eventId, es, u.id, 'Înainte de sugestii')
          .statements,
      ];
      for (const p of proposal.proposed) {
        const data = {
          guest_id: p.guest_id,
          table_id: p.table_id,
          seat: p.seat,
          subevent_id: p.subevent_id,
          provisional: false,
        };
        statements.push(
          ...insertEntity(eventId, 'assignment', data, u.id).statements,
        );
      }
      return json(
        await mutate(eventId, version, u.id, 'floor.suggestions', statements),
      );
    }
  }
  if (op === 'records') {
    const kind = parts[3],
      id = parts[4];
    if (!schemas[kind]) throw new AppError(404, 'Modul necunoscut.');
    if (method === 'GET') {
      authorize(a, kind, 'view');
      const q = (url.searchParams.get('q') || '').toLowerCase(),
        status = url.searchParams.get('status'),
        page = Math.max(1, Number(url.searchParams.get('page')) || 1),
        size = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get('size')) || 25),
        );
      const where = ["e.event_id=?", "e.kind=?", 'e.deleted_at IS NULL'];
      const args: unknown[] = [eventId, kind];
      if (q) {
        where.push("LOWER(e.data) LIKE ? ESCAPE '\\'");
        args.push('%' + q.replace(/[\\%_]/g, '\\$&') + '%');
      }
      if (status) {
        if (kind === 'guest') {
          if (status === 'pending')
            where.push(
              "NOT EXISTS(SELECT 1 FROM entities r WHERE r.event_id=e.event_id AND r.kind='rsvp' AND r.deleted_at IS NULL AND json_extract(r.data,'$.guest_id')=e.id AND json_extract(r.data,'$.status') IN ('confirmed','declined'))",
            );
          else {
            where.push(
              "EXISTS(SELECT 1 FROM entities r WHERE r.event_id=e.event_id AND r.kind='rsvp' AND r.deleted_at IS NULL AND json_extract(r.data,'$.guest_id')=e.id AND json_extract(r.data,'$.status')=?)",
            );
            args.push(status);
          }
        } else {
          where.push("json_extract(e.data,'$.status')=?");
          args.push(status);
        }
      }
      const clause = where.join(' AND ');
      const total = await one<{ total: number }>(
        `SELECT COUNT(*) AS total FROM entities e WHERE ${clause}`,
        ...args,
      );
      const items = (
        await all(
          `SELECT e.* FROM entities e WHERE ${clause} ORDER BY e.created_at,e.id LIMIT ? OFFSET ?`,
          ...args,
          size,
          (page - 1) * size,
        )
      ).map(decode);
      return json({
        total: Number(total?.total || 0),
        page,
        items: items.map((x) => redact(a, x)),
      });
    }
    const action = method === 'DELETE' ? 'delete' : id ? 'edit' : 'create';
    authorize(a, kind, action, id);
    if (['checkin', 'campaign', 'document'].includes(kind))
      throw new AppError(400, 'Folosește fluxul dedicat acestui modul.');
    const old = id ? es.find((x) => x.id === id && x.kind === kind) : undefined;
    if (id && !old)
      throw new AppError(404, 'Înregistrarea nu mai este disponibilă.');
    if (method === 'DELETE') {
      const dependencies = await all(
        'SELECT e.id,e.kind FROM entity_links l JOIN entities e ON e.id=l.source_id WHERE l.event_id=? AND l.target_id=? AND e.deleted_at IS NULL',
        eventId,
        id,
      );
      const allowed =
        kind === 'table'
          ? ['assignment']
          : kind === 'guest'
            ? [
                'assignment',
                'guest_invitation',
                'rsvp',
                'checkin',
                'transport_assignment',
                'room_assignment',
              ]
            : [];
      if (dependencies.some((x) => !allowed.includes(x.kind)))
        throw new AppError(
          409,
          'Înregistrarea are legături active. Elimină întâi legăturile din celelalte module.',
        );
      const statements = [
        stmt(
          'UPDATE entities SET deleted_at=?,updated_at=?,version=version+1 WHERE event_id=? AND id=?',
          now(),
          now(),
          eventId,
          id,
        ),
        ...dependencies.map((x) =>
          stmt(
            'UPDATE entities SET deleted_at=?,updated_at=?,version=version+1 WHERE event_id=? AND id=?',
            now(),
            now(),
            eventId,
            x.id,
          ),
        ),
      ];
      return json(
        await mutate(
          eventId,
          version,
          u.id,
          'delete',
          statements,
          id,
          undefined,
          { kind },
        ),
      );
    }
    const data = validate(kind, body.data || {});
    if (kind === 'rsvp') data.source = 'organizer';
    enforce(kind, data, es, id);
    if (kind === 'invitation' && old?.data.published_at)
      data.published_at = old.data.published_at;
    const statements: D1PreparedStatement[] = [];
    let newId = id;
    if (id) {
      statements.push(
        stmt(
          'UPDATE entities SET data=?,version=version+1,updated_at=?,author_id=? WHERE event_id=? AND id=?',
          JSON.stringify(data),
          now(),
          u.id,
          eventId,
          id,
        ),
        stmt(
          'DELETE FROM entity_links WHERE event_id=? AND source_id=?',
          eventId,
          id,
        ),
      );
      for (const f of schemas[kind].fields)
        if (f.ref && data[f.key])
          statements.push(
            stmt(
              'INSERT INTO entity_links(event_id,source_id,field,target_id) VALUES(?,?,?,?)',
              eventId,
              id,
              f.key,
              data[f.key],
            ),
          );
    } else {
      const r = insertEntity(eventId, kind, data, u.id);
      newId = r.id;
      statements.push(...r.statements);
      if (kind === 'guest') {
        for (const sub of list(es, 'subevent'))
          statements.push(
            ...insertEntity(
              eventId,
              'guest_invitation',
              { guest_id: newId, subevent_id: sub.id },
              u.id,
            ).statements,
          );
      }
    }
    if (kind === 'automation' && data.active) {
      if (old?.data.active)
        throw new AppError(
          409,
          'Dezactivează regula înainte de a modifica o automatizare activă.',
        );
      statements.push(
        ...(await campaignStatements(
          eventId,
          newId!,
          { ...data, date: data.date, time: data.time },
          a,
          es,
          publicOrigin,
          u.id,
        )),
      );
    }
    if (kind === 'automation' && !data.active)
      statements.push(
        stmt(
          "UPDATE jobs SET status='cancelled',updated_at=? WHERE event_id=? AND campaign_id=? AND status IN ('queued','paused')",
          now(),
          eventId,
          newId,
        ),
      );
    if (kind === 'rsvp') {
      const notification = insertEntity(
        eventId,
        'notification',
        {
          name: 'RSVP modificat. Verifică meniul, transportul și locul la masă.',
          read: false,
          context_id: data.guest_id,
        },
        u.id,
      );
      statements.push(...notification.statements);
    }
    return json(
      await mutate(
        eventId,
        version,
        u.id,
        id ? 'update' : 'create',
        statements,
        newId,
        undefined,
        { kind, before: old?.data || null },
      ),
    );
  }
  if (op === 'restore' && method === 'POST') {
    const record = (await rows(eventId, true)).find(
      (x) => x.id === body.id && x.deleted_at,
    );
    if (!record) throw new AppError(404, 'Nu există în coș.');
    authorize(a, record.kind, 'create');
    enforce(record.kind, record.data, es);
    return json(
      await mutate(
        eventId,
        version,
        u.id,
        'restore',
        [
          stmt(
            'UPDATE entities SET deleted_at=NULL,version=version+1,updated_at=? WHERE event_id=? AND id=?',
            now(),
            eventId,
            body.id,
          ),
        ],
        body.id,
      ),
    );
  }
  if (op === 'trash') {
    if (!['owner', 'partner', 'planner'].includes(a.role))
      throw new AppError(403, 'Acces restricționat.');
    return json({
      items: (await rows(eventId, true)).filter((x) => x.deleted_at),
    });
  }
  if (op === 'audit') {
    if (!['owner', 'partner', 'planner'].includes(a.role))
      throw new AppError(403, 'Acces restricționat.');
    return json({
      items: await all(
        'SELECT a.*,u.name AS actor_name FROM audit a LEFT JOIN users u ON u.id=a.actor_id WHERE a.event_id=? ORDER BY a.created_at DESC LIMIT 100',
        eventId,
      ),
    });
  }
  if (op === 'import' && method === 'POST')
    return importGuests(body, eventId, a, es, u);
  if (op === 'publish' && method === 'POST') {
    authorize(a, 'invitation', 'edit', body.id);
    const inv = es.find((x) => x.kind === 'invitation' && x.id === body.id);
    if (!inv) throw new AppError(404, 'Invitație inexistentă.');
    const data = {
      ...event.data,
      published_invitation: { ...inv.data, published_at: now() },
    };
    return json(
      await mutate(
        eventId,
        version,
        u.id,
        'invitation.publish',
        [
          stmt(
            'UPDATE events SET data=? WHERE id=?',
            JSON.stringify(data),
            eventId,
          ),
          stmt(
            'UPDATE entities SET data=?,version=version+1,updated_at=? WHERE id=? AND event_id=?',
            JSON.stringify({ ...inv.data, published_at: now() }),
            now(),
            inv.id,
            eventId,
          ),
        ],
        inv.id,
      ),
    );
  }
  if (op === 'invite-link' && method === 'POST') {
    authorize(a, 'invitation', 'create');
    const family = es.find(
      (x) => x.id === body.household_id && x.kind === 'household',
    );
    if (!family) throw new AppError(400, 'Familie invalidă.');
    const raw = token();
    const statements = [
      stmt(
        'INSERT INTO access_tokens(hash,event_id,household_id,created_at,expires_at) VALUES(?,?,?,?,?)',
        await hash(raw),
        eventId,
        family.id,
        now(),
        invitationExpiry(event.data),
      ),
    ];
    if (body.revoke)
      statements.unshift(
        stmt(
          'UPDATE access_tokens SET revoked_at=? WHERE event_id=? AND household_id=?',
          now(),
          eventId,
          family.id,
        ),
      );
    const result = await mutate(
      eventId,
      version,
      u.id,
      'invitation.link',
      statements,
      family.id,
    );
    return json({ ...result, url: `${publicOrigin}/rsvp/${raw}` });
  }
  if (op === 'revoke-links' && method === 'POST') {
    authorize(a, 'invitation', 'delete');
    return json(
      await mutate(
        eventId,
        version,
        u.id,
        'invitation.revoke',
        [
          stmt(
            'UPDATE access_tokens SET revoked_at=? WHERE event_id=? AND household_id=?',
            now(),
            eventId,
            body.household_id,
          ),
        ],
        body.household_id,
      ),
    );
  }
  if (op === 'campaigns' && method === 'POST') {
    authorize(a, 'campaign', 'send');
    if (
      !event.data.demo &&
      (await integrationStatus()).find((x) => x.id === body.channel)
        ?.configured &&
      !u.verified
    )
      throw new AppError(403, 'Verifică adresa de email înainte de expediere.');
    if (body.preview) {
      const eligible = eligibleFamilies(es, body.channel, body.type);
      return json({
        count: eligible.length,
        excluded: list(es, 'household').length - eligible.length,
        sample: eligible[0]?.data,
        configured: !!(await integrationStatus()).find(
          (x) => x.id === body.channel,
        )?.configured,
        demo: !!event.data.demo,
      });
    }
    if (body.activate !== true)
      throw new AppError(400, 'Confirmă explicit programarea campaniei.');
    const id = uid(),
      s = await campaignStatements(eventId, id, body, a, es, publicOrigin, u.id);
    s.unshift(
      ...insertEntity(
        eventId,
        'campaign',
        {
          name: String(body.name || 'Invitația noastră'),
          channel: body.channel,
          type: body.type || 'invitation',
          message: body.message,
          status: 'queued',
        },
        u.id,
        id,
      ).statements,
    );
    return json(
      await mutate(eventId, version, u.id, 'campaign.schedule', s, id),
    );
  }
  if (op === 'job-action' && method === 'POST') {
    authorize(a, 'campaign', 'send');
    const status = (
      { pause: 'paused', resume: 'queued', cancel: 'cancelled' } as Data
    )[body.action];
    if (!status) throw new AppError(400, 'Acțiune invalidă.');
    return json(
      await mutate(
        eventId,
        version,
        u.id,
        'campaign.' + body.action,
        [
          stmt(
            "UPDATE jobs SET status=?,updated_at=? WHERE event_id=? AND campaign_id=? AND status IN ('queued','paused')",
            status,
            now(),
            eventId,
            body.campaign_id,
          ),
        ],
        body.campaign_id,
      ),
    );
  }
  if (op === 'process-demo' && method === 'POST') {
    authorize(a, 'campaign', 'send');
    if (!event.data.demo)
      throw new AppError(403, 'Acțiune disponibilă doar în demo.');
    return json(await tick(publicOrigin, eventId, true));
  }
  if (op === 'checkin' && method === 'POST') {
    authorize(a, 'checkin', body.undo ? 'delete' : 'create');
    if (body.qr) {
      const raw = String(body.qr).split('/').pop();
      const tokenRow = await one(
        'SELECT household_id FROM access_tokens WHERE hash=? AND event_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)',
        await hash(raw || ''),
        eventId,
        now(),
      );
      if (!tokenRow)
        throw new AppError(
          404,
          'Codul QR nu este valabil pentru acest eveniment.',
        );
      body.household_id = tokenRow.household_id;
    }
    const ids = body.household_id
      ? list(es, 'guest')
          .filter((g) => g.data.household_id === body.household_id)
          .map((g) => g.id)
      : [body.guest_id];
    if (ids.length > 20 || !ids.length)
      throw new AppError(400, 'Selecție invalidă.');
    const statements: D1PreparedStatement[] = [];
    for (const id of ids) {
      const g = es.find((x) => x.id === id && x.kind === 'guest');
      if (!g) throw new AppError(400, 'Invitat invalid.');
      const data = {
        guest_id: id,
        subevent_id: body.subevent_id,
        arrived_at: now(),
      };
      enforce('checkin', data, es);
      const existing = list(es, 'checkin').find(
        (x) =>
          x.data.guest_id === id && x.data.subevent_id === body.subevent_id,
      );
      if (body.undo) {
        if (existing)
          statements.push(
            stmt(
              'UPDATE entities SET deleted_at=?,updated_at=? WHERE id=? AND event_id=?',
              now(),
              now(),
              existing.id,
              eventId,
            ),
          );
      } else if (!existing)
        statements.push(
          ...insertEntity(eventId, 'checkin', data, u.id).statements,
        );
    }
    if (!statements.length)
      return json({ ok: true, duplicate: true, version: event.version });
    return json(
      await mutate(
        eventId,
        version,
        u.id,
        body.undo ? 'checkin.undo' : 'checkin',
        statements,
      ),
    );
  }
  if (op === 'export') {
    const kind = url.searchParams.get('kind') || 'guest';
    authorize(a, kind, 'export');
    const q = (url.searchParams.get('q') || '').toLowerCase(),
      status = url.searchParams.get('status');
    const s = summary(es, event.data);
    const records = list(es, kind)
      .filter((x) => !q || JSON.stringify(x.data).toLowerCase().includes(q))
      .filter(
        (x) =>
          !status ||
          (kind === 'guest' && status === 'unseated'
            ? !list(es, 'assignment').some(
                (a) =>
                  a.data.guest_id === x.id &&
                  a.data.subevent_id === s.reception,
              ) &&
              list(es, 'rsvp').some(
                (r) =>
                  r.data.guest_id === x.id &&
                  r.data.subevent_id === s.reception &&
                  r.data.status === 'confirmed',
              )
            : kind === 'guest'
              ? (list(es, 'rsvp').find(
                  (r) =>
                    r.data.guest_id === x.id &&
                    r.data.subevent_id === s.reception,
                )?.data.status || 'pending') === status
              : x.data.status === status),
      );
    const output = records.map((x) => {
      const d: Data = { id: x.id, ...x.data };
      for (const f of schemas[kind]?.fields || [])
        if (f.ref)
          d[f.key] = es.find((e) => e.id === d[f.key])?.data.name || d[f.key];
      if (kind === 'guest') {
        const assignment = list(es, 'assignment').find(
          (a) => a.data.guest_id === x.id && a.data.subevent_id === s.reception,
        );
        d.table =
          es.find((e) => e.id === assignment?.data.table_id)?.data.name || '';
        d.seat = assignment?.data.seat || '';
        d.rsvp =
          labels[
            list(es, 'rsvp').find(
              (r) =>
                r.data.guest_id === x.id && r.data.subevent_id === s.reception,
            )?.data.status || 'pending'
          ];
      }
      return d;
    });
    await stmt(
      'INSERT INTO audit(id,event_id,actor_id,action,detail,created_at) VALUES(?,?,?,?,?,?)',
      uid(),
      eventId,
      u.id,
      'export',
      JSON.stringify({ kind, count: output.length, q, status }),
      now(),
    ).run();
    if (url.searchParams.get('format') === 'xlsx') {
      const ExcelJS = await import('exceljs');
      const book = new ExcelJS.Workbook();
      const sheet = book.addWorksheet('Export');
      const fields = output.length ? Object.keys(output[0]) : ['id', 'name'];
      sheet.addRow(fields);
      for (const row of output)
        sheet.addRow(fields.map((f) => String(row[f] ?? '')));
      sheet.getRow(1).font = { bold: true };
      sheet.columns.forEach((c) => (c.width = 24));
      const bytes = await book.xlsx.writeBuffer();
      return new Response(bytes as unknown as BodyInit, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${kind}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }
    return new Response(
      csv(output, output.length ? Object.keys(output[0]) : ['id', 'name']),
      {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${kind}.csv"`,
          'Cache-Control': 'no-store',
        },
      },
    );
  }
  if (op === 'team') {
    if (a.role !== 'owner')
      throw new AppError(403, 'Doar proprietarul gestionează echipa.');
    if (method === 'GET')
      return json({
        members: await all(
          'SELECT m.user_id,m.role,m.grants,u.name,u.email FROM event_members m JOIN users u ON u.id=m.user_id WHERE event_id=?',
          eventId,
        ),
        invites: await all(
          'SELECT email,role,expires_at,used_at FROM team_invites WHERE event_id=?',
          eventId,
        ),
      });
    if (method === 'DELETE')
      return json(
        await mutate(eventId, version, u.id, 'team.remove', [
          stmt(
            'DELETE FROM event_members WHERE event_id=? AND user_id=?',
            eventId,
            body.user_id,
          ),
        ]),
      );
    if (method === 'POST') {
      const email = String(body.email || '')
        .trim()
        .toLowerCase();
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        ![
          'partner',
          'planner',
          'collaborator',
          'finance',
          'checkin',
          'vendor',
        ].includes(body.role)
      )
        throw new AppError(400, 'Email sau rol invalid.');
      const raw = token(),
        grants = body.grants || {};
      const result = await mutate(eventId, version, u.id, 'team.invite', [
        stmt(
          'INSERT INTO team_invites(hash,event_id,email,role,grants,expires_at) VALUES(?,?,?,?,?,?)',
          await hash(raw),
          eventId,
          email,
          body.role,
          JSON.stringify(grants),
          new Date(Date.now() + 7 * 86400000).toISOString(),
        ),
      ]);
      return json({
        ...result,
        url: `${publicOrigin}/?team_token=${raw}`,
        message:
          'Link creat. Trimite-l personal destinatarului; niciun email nu a fost expediat.',
      });
    }
  }
  if (op === 'documents') return documents(req, parts, body, a, u);
  throw new AppError(404, 'Acțiune indisponibilă.');
}
function eligibleFamilies(es: Entity[], channel: string, type: string) {
  return list(es, 'household')
    .filter(
      (h) =>
        !h.data.opt_out &&
        (channel === 'email'
          ? h.data.email
          : /^\+\d{8,15}$/.test(h.data.phone || '')),
    )
    .filter((h) => type !== 'rsvp_reminder' || familyPending(es, h));
}
async function campaignStatements(
  eventId: string,
  campaignId: string,
  b: Data,
  a: Data,
  es: Entity[],
  origin: string,
  _actor: string,
) {
  const channel = b.channel || 'email',
    type = b.type || 'invitation';
  if (
    !['email', 'sms', 'whatsapp'].includes(channel) ||
    !['invitation', 'rsvp_reminder', 'logistics', 'thanks'].includes(type)
  )
    throw new AppError(400, 'Tip de campanie invalid.');
  if (
    !a.event.data.demo &&
    !(await integrationStatus()).find((x) => x.id === channel)?.configured
  )
    throw new AppError(
      503,
      'Integrare neconfigurată. Campania nu a fost programată.',
      'integration_unconfigured',
    );
  if (!a.event.data.published_invitation)
    throw new AppError(400, 'Publică mai întâi designul invitației.');
  if (!a.event.data.demo && !(await runtimeSettings()).JOB_SECRET)
    throw new AppError(503, 'Procesul de fundal nu este configurat.');
  const due = b.date
    ? localToUTC(b.date, b.time || '10:00', a.event.data.timezone)
    : now();
  if (!String(b.message || '').trim())
    throw new AppError(400, 'Completează mesajul.');
  const families = eligibleFamilies(es, channel, type);
  if (!families.length)
    throw new AppError(400, 'Nu există destinatari eligibili.');
  if (families.length > 150)
    throw new AppError(
      400,
      'Campania are peste 150 de familii eligibile. Împarte destinatarii în segmente mai mici.',
    );
  const s: D1PreparedStatement[] = [];
  for (const h of families) {
    const raw = token();
    s.push(
      stmt(
        'UPDATE access_tokens SET revoked_at=? WHERE event_id=? AND household_id=? AND revoked_at IS NULL',
        now(),
        eventId,
        h.id,
      ),
      stmt(
        'INSERT INTO access_tokens(hash,event_id,household_id,created_at,expires_at) VALUES(?,?,?,?,?)',
        await hash(raw),
        eventId,
        h.id,
        now(),
        invitationExpiry(a.event.data),
      ),
    );
    const values: Data = {
      family: h.data.name,
      name: h.data.name,
      couple: a.event.name,
      date: a.event.data.date,
      venue: a.event.data.venue,
      deadline: a.event.data.published_invitation.rsvp_deadline,
      link: origin + '/rsvp/' + raw,
      privacy: origin + '/confidentialitate',
    };
    const text = String(b.message).replace(
      /\{(family|name|couple|date|venue|deadline|link|privacy)\}/g,
      (_, k) => values[k] || '',
    );
    s.push(
      stmt(
        'INSERT INTO jobs(id,event_id,campaign_id,household_id,channel,type,payload,due_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        uid(),
        eventId,
        campaignId,
        h.id,
        channel,
        type,
        JSON.stringify({ text }),
        due,
        'queued',
        now(),
        now(),
      ),
    );
  }
  return s;
}
async function importGuests(
  b: Data,
  eventId: string,
  a: Data,
  es: Entity[],
  u: Data,
) {
  authorize(a, 'guest', 'create');
  authorize(a, 'household', 'create');
  if (!Array.isArray(b.rows) || b.rows.length > 150)
    throw new AppError(400, 'Importă maximum 150 de persoane o dată.');
  const report = b.rows.map((row: Data, index: number) => {
    try {
      if (!row.name || !row.family)
        throw new AppError(400, 'Numele și familia sunt obligatorii.');
      const data = validate('guest', { ...row, household_id: 'preview' });
      const duplicates = list(es, 'guest')
        .filter(
          (g) =>
            g.data.name.toLowerCase() === data.name.toLowerCase() ||
            (data.email && g.data.email === data.email),
        )
        .map((g) => ({ id: g.id, name: g.data.name }));
      return {
        row: index + 1,
        data,
        family: String(row.family).trim(),
        duplicates,
        error: null,
      };
    } catch (e) {
      return {
        row: index + 1,
        error: e instanceof Error ? e.message : 'Date invalide',
        duplicates: [],
      };
    }
  });
  if (b.preview) return json({ report });
  if (report.some((r: Data) => r.error))
    throw new AppError(400, 'Corectează rândurile invalide înainte de import.');
  const policy = b.duplicate_policy;
  if (!['skip', 'create', 'update'].includes(policy))
    throw new AppError(400, 'Alege explicit cum tratezi duplicatele.');
  const s: D1PreparedStatement[] = [],
    families = new Map<string, string>();
  let created = 0,
    updated = 0,
    skipped = 0;
  for (const row of report as Data[]) {
    if (row.duplicates.length && policy === 'skip') {
      skipped++;
      continue;
    }
    if (row.duplicates.length && policy === 'update') {
      const target = b.matches?.[row.row];
      if (!target || !row.duplicates.some((d: Data) => d.id === target))
        throw new AppError(
          400,
          `Rândul ${row.row}: selectează explicit persoana de actualizat.`,
        );
      authorize(a, 'guest', 'edit');
      const old = es.find((x) => x.id === target)!;
      const data = { ...row.data, household_id: old.data.household_id };
      enforce('guest', data, es, target);
      s.push(
        stmt(
          'UPDATE entities SET data=?,version=version+1,updated_at=? WHERE event_id=? AND id=?',
          JSON.stringify(data),
          now(),
          eventId,
          target,
        ),
      );
      updated++;
      continue;
    }
    let family = families.get(row.family);
    if (!family) {
      const h = insertEntity(
        eventId,
        'household',
        validate('household', {
          self_registration: false,
          name: row.family,
          email: row.data.email,
          phone: row.data.phone,
        }),
        u.id,
      );
      family = h.id;
      families.set(row.family, family);
      s.push(...h.statements);
    }
    const g = insertEntity(
      eventId,
      'guest',
      { ...row.data, household_id: family },
      u.id,
    );
    s.push(...g.statements);
    for (const sub of list(es, 'subevent'))
      s.push(
        ...insertEntity(
          eventId,
          'guest_invitation',
          { guest_id: g.id, subevent_id: sub.id },
          u.id,
        ).statements,
      );
    created++;
  }
  const result = await mutate(
    eventId,
    Number(b.version),
    u.id,
    'guests.import',
    s,
    undefined,
    b.key || uid(),
    { created, updated, skipped },
  );
  return json({ ...result, created, updated, skipped, report });
}
async function publicEventRoute(req: Request, eventId: string, method: string) {
  await rate(req, 'public-event', 120);
  if (method !== 'GET') throw new AppError(405, 'Metodă indisponibilă.');
  if (!/^[a-f0-9-]{36}$/i.test(eventId || ''))
    throw new AppError(404, 'Eveniment indisponibil.');
  const event = await one('SELECT * FROM events WHERE id=?', eventId);
  if (!event) throw new AppError(404, 'Eveniment indisponibil.');
  const data = JSON.parse(event.data);
  if (data.status === 'cancelled')
    throw new AppError(410, 'Evenimentul a fost anulat.');
  if (!data.published_invitation)
    return json(
      { published: false },
      200,
      { 'X-Robots-Tag': 'noindex, nofollow' },
    );
  const entities = await rows(eventId);
  return json(
    {
      published: true,
      event: {
        id: event.id,
        name: event.name,
        data: {
          date: data.date,
          city: data.city,
          venue: data.venue,
          partner1: data.partner1,
          partner2: data.partner2,
        },
      },
      invitation: data.published_invitation,
      subevents: list(entities, 'subevent').map((subevent) => ({
        id: subevent.id,
        data: {
          name: subevent.data.name,
          date: subevent.data.date,
          start: subevent.data.start,
          end: subevent.data.end,
          venue: subevent.data.venue,
          address: subevent.data.address,
          instructions: subevent.data.instructions,
        },
      })),
    },
    200,
    { 'X-Robots-Tag': 'noindex, nofollow' },
  );
}

async function publicRoute(req: Request, raw: string, b: Data) {
  await rate(req, 'rsvp', 60);
  if (!/^[a-f0-9]{64}$/.test(raw || ''))
    throw new AppError(404, 'Invitație indisponibilă.');
  const t = await one(
    'SELECT * FROM access_tokens WHERE hash=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)',
    await hash(raw),
    now(),
  );
  if (!t)
    throw new AppError(
      404,
      'Linkul nu mai este activ. Contactează organizatorii.',
    );
  const e = await one('SELECT * FROM events WHERE id=?', t.event_id);
  const ed = JSON.parse(e!.data),
    es = await rows(t.event_id);
  if (ed.status === 'cancelled')
    throw new AppError(
      410,
      'Evenimentul a fost anulat. Contactează organizatorii.',
    );
  const family = es.find(
    (x) => x.id === t.household_id && x.kind === 'household',
  );
  if (!family || !ed.published_invitation)
    throw new AppError(404, 'Invitația nu este publicată.');
  const guests = list(es, 'guest').filter(
    (x) => x.data.household_id === family.id,
  );
  const invitations = list(es, 'guest_invitation').filter((x) =>
    guests.some((g) => g.id === x.data.guest_id),
  );
  const subs = list(es, 'subevent').filter(
    (s) =>
      family.data.self_registration ||
      invitations.some((i) => i.data.subevent_id === s.id),
  );
  const responses = list(es, 'rsvp').filter((x) =>
    guests.some((g) => g.id === x.data.guest_id),
  );
  if (req.method === 'GET')
    return json(
      {
        event: {
          name: e!.name,
          partner1: ed.partner1,
          partner2: ed.partner2,
          venue: ed.venue,
          city: ed.city,
          date: ed.date,
          timezone: ed.timezone,
          privacy_operator:
            ed.privacy_operator || `${ed.partner1 || ''} ${ed.partner2 || ''}`.trim(),
          privacy_contact: ed.privacy_contact || ed.published_invitation.help || '',
          demo: ed.demo,
          version: e!.version,
        },
        invitation: ed.published_invitation,
        family: {
          name: family.data.name,
          max_companions: family.data.max_companions,
          self_registration: !!family.data.self_registration,
          max_members: Number(family.data.max_members) || 4,
          response_status: list(es, 'family_response').find(
            (r) => r.data.household_id === family.id,
          )?.data.status,
        },
        guests: guests.map((g) => ({
          id: g.id,
          data: {
            name: g.data.name,
            age: g.data.age,
            menu_id: g.data.menu_id,
            allergies: g.data.allergies,
            needs: g.data.needs,
            transport: g.data.transport,
            accommodation: g.data.accommodation,
          },
        })),
        subevents: subs,
        invitations,
        responses,
        menus: list(es, 'menu'),
      },
      200,
      { 'X-Robots-Tag': 'noindex, nofollow' },
    );
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: ed.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  if (
    ed.published_invitation.rsvp_deadline &&
    today > ed.published_invitation.rsvp_deadline
  )
    throw new AppError(
      403,
      `Termenul RSVP a trecut. Contact: ${ed.published_invitation.help || 'organizatorii evenimentului'}.`,
    );
  if (family.data.self_registration)
    return json(await saveFamily(t.event_id, family, guests, subs, es, b));
  if (!Array.isArray(b.responses) || b.responses.length > 100)
    throw new AppError(400, 'Răspuns invalid.');
  const statements: D1PreparedStatement[] = [];
  const submittedGuests = Array.isArray(b.guests) ? b.guests : [];
  if (hasSensitiveDetails(submittedGuests) && b.sensitive_consent !== true)
    throw new AppError(
      400,
      'Consimțământul explicit este obligatoriu pentru alergii sau nevoi de accesibilitate.',
    );
  const seen = new Set();
  for (const r of b.responses) {
    if (
      !guests.some((g) => g.id === r.guest_id) ||
      !invitations.some(
        (i) =>
          i.data.guest_id === r.guest_id &&
          i.data.subevent_id === r.subevent_id,
      ) ||
      !['confirmed', 'declined'].includes(r.status)
    )
      throw new AppError(
        403,
        'Poți răspunde numai pentru membrii și momentele din invitația ta.',
      );
    const key = r.guest_id + ':' + r.subevent_id;
    if (seen.has(key)) throw new AppError(400, 'Răspuns repetat în formular.');
    seen.add(key);
    const data = validate('rsvp', { ...r, source: 'guest' });
    const old = responses.find(
      (x) =>
        x.data.guest_id === r.guest_id && x.data.subevent_id === r.subevent_id,
    );
    if (old)
      statements.push(
        stmt(
          'UPDATE entities SET data=?,version=version+1,updated_at=? WHERE event_id=? AND id=?',
          JSON.stringify(data),
          now(),
          t.event_id,
          old.id,
        ),
      );
    else
      statements.push(
        ...insertEntity(t.event_id, 'rsvp', data, 'guest').statements,
      );
  }
  for (const input of b.guests || []) {
    const g = guests.find((x) => x.id === input.id);
    if (!g) throw new AppError(403, 'Persoană neautorizată.');
    const data = validate('guest', {
      ...g.data,
      menu_id: input.menu_id || '',
      allergies: input.allergies || '',
      needs: input.needs || '',
      transport: !!input.transport,
      accommodation: !!input.accommodation,
    });
    if (String(data.allergies).trim() || String(data.needs).trim())
      data.consent = {
        at: now(),
        version: PRIVACY_NOTICE_VERSION,
        source: 'rsvp',
      };
    enforce('guest', data, es, g.id);
    statements.push(
      stmt(
        'UPDATE entities SET data=?,version=version+1,updated_at=? WHERE event_id=? AND id=?',
        JSON.stringify(data),
        now(),
        t.event_id,
        g.id,
      ),
    );
  }
  const companions = Array.isArray(b.companions) ? b.companions : [];
  if (
    companions.some((name: unknown) => typeof name !== 'string' || !name.trim())
  )
    throw new AppError(
      400,
      'Numele fiecărei persoane suplimentare este obligatoriu.',
    );
  if (guests.length + companions.length > 100)
    throw new AppError(400, 'Maximum 100 de persoane pe familie.');
  for (const name of companions) {
    const data = {
      ...validate('guest', { name, household_id: family.id }),
      is_companion: true,
    };
    const g = insertEntity(t.event_id, 'guest', data, 'guest');
    statements.push(...g.statements);
    for (const s of subs)
      statements.push(
        ...insertEntity(
          t.event_id,
          'guest_invitation',
          { guest_id: g.id, subevent_id: s.id },
          'guest',
        ).statements,
      );
  }
  statements.push(
    ...insertEntity(
      t.event_id,
      'notification',
      {
        name: `RSVP nou · ${family.data.name}. Verifică eventualele modificări de meniu și loc.`,
        read: false,
      },
      'guest',
    ).statements,
  );
  return json(
    await mutate(
      t.event_id,
      Number(b.version),
      'guest',
      'rsvp.submit',
      statements,
      family.id,
      undefined,
      { responses: b.responses },
    ),
  );
}
async function documents(
  req: Request,
  parts: string[],
  b: Data,
  a: Data,
  u: Data,
) {
  const eventId = a.event.id,
    id = parts[3];
  authorize(a, 'document', req.method === 'GET' ? 'view' : 'create', id);
  if (req.method === 'GET' && !id)
    return json({
      items: await all(
        'SELECT id,name,mime,size,version,created_at FROM documents WHERE event_id=? ORDER BY created_at DESC',
        eventId,
      ),
    });
  if (req.method === 'GET') {
    const d = await one(
      'SELECT * FROM documents WHERE event_id=? AND id=?',
      eventId,
      id,
    );
    if (!d) throw new AppError(404, 'Document indisponibil.');
    if (!bindings().FILES)
      throw new AppError(503, 'Stocarea fișierelor nu este configurată.');
    const file = await bindings().FILES.get(d.storage_key);
    if (!file) throw new AppError(404, 'Fișier indisponibil.');
    return new Response(file.body, {
      headers: {
        'Content-Type': d.mime,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  if (req.method === 'POST') {
    if (!bindings().FILES)
      throw new AppError(503, 'Stocarea fișierelor nu este configurată.');
    const form = await req.formData(),
      file = form.get('file');
    if (
      !(file instanceof File) ||
      file.size > 5 * 1024 * 1024 ||
      !['application/pdf', 'image/png', 'image/jpeg', 'text/plain'].includes(
        file.type,
      )
    )
      throw new AppError(
        400,
        'Acceptăm PDF, PNG, JPG sau TXT de maximum 5 MB.',
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid =
      file.type === 'application/pdf'
        ? new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
        : file.type === 'image/png'
          ? bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71
          : file.type === 'image/jpeg'
            ? bytes[0] === 255 && bytes[1] === 216
            : !bytes.includes(0);
    if (!valid)
      throw new AppError(
        400,
        'Conținutul fișierului nu corespunde tipului declarat.',
      );
    const id = uid(),
      key = eventId + '/' + id;
    await bindings().FILES.put(key, bytes, {
      httpMetadata: { contentType: file.type },
    });
    try {
      return json(
        await mutate(
          eventId,
          Number(form.get('version')),
          u.id,
          'document.upload',
          [
            stmt(
              'INSERT INTO documents(id,event_id,name,mime,size,storage_key,created_at,author_id) VALUES(?,?,?,?,?,?,?,?)',
              id,
              eventId,
              file.name.slice(0, 200),
              file.type,
              file.size,
              key,
              now(),
              u.id,
            ),
          ],
          id,
        ),
      );
    } catch (e) {
      await bindings().FILES.delete(key);
      throw e;
    }
  }
  throw new AppError(405, 'Metodă indisponibilă.');
}
