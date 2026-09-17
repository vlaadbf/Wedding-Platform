import { env } from 'cloudflare:workers';
import {
  AppError,
  Data,
  Entity,
  uid,
  schemas,
  permission,
  list,
} from '../lib/domain';
type Bindings = Cloudflare.Env & Partial<Record<'CONFIG_ENCRYPTION_KEY' | 'BOOTSTRAP_SECRET' | 'APP_ORIGIN' | 'RESEND_API_KEY' | 'EMAIL_FROM' | 'RESEND_WEBHOOK_SECRET' | 'TWILIO_ACCOUNT_SID' | 'TWILIO_AUTH_TOKEN' | 'TWILIO_FROM' | 'WHATSAPP_FROM' | 'WHATSAPP_CONTENT_SID' | 'JOB_SECRET' | 'DEMO_LIMIT_PER_HOUR' | 'DEMO_GLOBAL_CAP', string>>;
export const bindings = () => env as unknown as Bindings;
export const db = () => bindings().DB as D1Database;
export const now = () => new Date().toISOString();
export const stmt = (sql: string, ...args: unknown[]) =>
  db()
    .prepare(sql)
    .bind(...args.map((x) => (x === undefined ? null : x)));
export async function one<T = Data>(sql: string, ...args: unknown[]) {
  return await stmt(sql, ...args).first<T>();
}
export async function all<T = Data>(sql: string, ...args: unknown[]) {
  return (await stmt(sql, ...args).all<T>()).results;
}
export async function hash(s: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
export function decode(row: Data) {
  return { ...row, data: JSON.parse(row.data) } as Entity;
}
export async function rows(event: string, deleted = false) {
  return (
    await all(
      'SELECT * FROM entities WHERE event_id=?' +
        (deleted ? '' : ' AND deleted_at IS NULL'),
      event,
    )
  ).map(decode);
}
export async function access(user: Data, eventId: string): Promise<Data> {
  const e = await one('SELECT * FROM events WHERE id=?', eventId);
  if (!e) throw new AppError(404, 'Evenimentul nu este disponibil.');
  const wm = await one(
    'SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?',
    e.workspace_id,
    user.id,
  );
  const em = await one(
    'SELECT * FROM event_members WHERE event_id=? AND user_id=?',
    eventId,
    user.id,
  );
  const role = wm?.role === 'owner' ? 'owner' : em?.role;
  if (!role) throw new AppError(403, 'Nu ai acces la acest eveniment.');
  return {
    event: { ...e, data: JSON.parse(e.data) },
    role,
    grants: JSON.parse(em?.grants || '{}'),
    shared_ids: JSON.parse(em?.shared_ids || '[]'),
  };
}
export function authorize(a: Data, kind: string, action = 'view', id?: string) {
  if (
    !permission(a.role, kind, action, a.grants) ||
    (a.role === 'vendor' && (!id || !a.shared_ids.includes(id)))
  )
    throw new AppError(
      403,
      'Nu ai permisiunea necesară pentru această operațiune.',
    );
}
export function insertEntity(
  eventId: string,
  kind: string,
  data: Data,
  actor: string,
  id = uid(),
) {
  const t = now();
  const s = [
    stmt(
      'INSERT INTO entities(id,event_id,kind,data,author_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
      id,
      eventId,
      kind,
      JSON.stringify(data),
      actor,
      t,
      t,
    ),
  ];
  for (const f of schemas[kind]?.fields || [])
    if (f.ref && data[f.key])
      s.push(
        stmt(
          'INSERT INTO entity_links(event_id,source_id,field,target_id) VALUES(?,?,?,?)',
          eventId,
          id,
          f.key,
          data[f.key],
        ),
      );
  return { id, statements: s };
}
export async function mutate(
  eventId: string,
  version: number,
  actor: string,
  action: string,
  statements: D1PreparedStatement[],
  id?: string,
  key = uid(),
  detail: Data = {},
) {
  if (!Number.isSafeInteger(version) || version < 1)
    throw new AppError(400, 'Versiune de eveniment invalidă.');
  try {
    await db().batch([
      stmt(
        'INSERT INTO mutations(id,event_id,expected_version,created_at) VALUES(?,?,?,?)',
        key,
        eventId,
        version,
        now(),
      ),
      ...statements,
      stmt(
        'INSERT INTO audit(id,event_id,actor_id,action,entity_id,detail,created_at) VALUES(?,?,?,?,?,?,?)',
        uid(),
        eventId,
        actor,
        action,
        id || null,
        JSON.stringify(detail),
        now(),
      ),
    ]);
  } catch (e) {
    const msg = String(e);
    if (msg.includes('VERSION_CONFLICT'))
      throw new AppError(
        409,
        'Evenimentul a fost modificat între timp. Reîncarcă datele și reaplică modificarea.',
        'version_conflict',
      );
    if (msg.includes('UNIQUE'))
      throw new AppError(
        409,
        'Înregistrarea există deja sau locul este ocupat.',
        'duplicate',
      );
    if (msg.includes('FOREIGN KEY'))
      throw new AppError(
        400,
        'Resursa asociată nu aparține acestui eveniment.',
      );
    throw e;
  }
  return { ok: true, id, version: version + 1 };
}
export function enforce(
  kind: string,
  data: Data,
  entities: Entity[],
  id?: string,
) {
  const active = entities.filter((x) => x.id !== id);
  for (const f of schemas[kind]?.fields || [])
    if (
      f.ref &&
      data[f.key] &&
      !entities.some(
        (x) => x.id === data[f.key] && x.kind === f.ref && !x.deleted_at,
      )
    )
      throw new AppError(
        400,
        `${f.label}: resursa nu aparține acestui eveniment.`,
      );
  if (
    ['rsvp', 'checkin'].includes(kind) &&
    !list(entities, 'guest_invitation').some(
      (i) =>
        i.data.guest_id === data.guest_id &&
        i.data.subevent_id === data.subevent_id,
    )
  )
    throw new AppError(400, 'Persoana nu este invitată la acest subeveniment.');
  if (kind === 'assignment') {
    const t = entities.find((x) => x.id === data.table_id)!;
    data.subevent_id = t.data.subevent_id;
    if (
      !list(entities, 'guest_invitation').some(
        (i) =>
          i.data.guest_id === data.guest_id &&
          i.data.subevent_id === data.subevent_id,
      )
    )
      throw new AppError(
        400,
        'Persoana nu este invitată la acest subeveniment.',
      );
    if (data.seat < 1 || data.seat > t.data.capacity)
      throw new AppError(400, 'Locul depășește capacitatea mesei.');
    if (
      list(active, 'assignment').some(
        (a) =>
          a.data.guest_id === data.guest_id &&
          a.data.subevent_id === data.subevent_id,
      )
    )
      throw new AppError(409, 'Invitatul are deja un loc în acest plan.');
    const r = list(entities, 'rsvp').find(
      (r) =>
        r.data.guest_id === data.guest_id &&
        r.data.subevent_id === data.subevent_id,
    );
    if (r?.data.status !== 'confirmed' && !data.provisional)
      throw new AppError(
        400,
        'Pentru o persoană neconfirmată, marchează rezervarea provizorie.',
      );
  }
  if (kind === 'table') {
    if (data.capacity < 1)
      throw new AppError(400, 'Masa trebuie să aibă cel puțin un loc.');
    if (
      list(entities, 'assignment').some(
        (a) =>
          a.data.table_id === id &&
          (a.data.seat > data.capacity ||
            a.data.subevent_id !== data.subevent_id),
      )
    )
      throw new AppError(
        409,
        'Modificarea ar invalida locurile ocupate. Eliberează repartizările afectate.',
      );
  }
  if (['payment', 'schedule'].includes(kind)) {
    const e = entities.find((x) => x.id === data.expense_id)!;
    if (data.currency !== e.data.currency)
      throw new AppError(
        400,
        'Moneda trebuie să coincidă cu moneda cheltuielii.',
      );
    if (data.amount <= 0)
      throw new AppError(400, 'Suma trebuie să fie pozitivă.');
  }
  if (kind === 'refund') {
    const p = entities.find((x) => x.id === data.payment_id)!;
    const refunded = list(active, 'refund')
      .filter((x) => x.data.payment_id === p.id)
      .reduce((s, x) => s + x.data.amount, 0);
    if (
      data.currency !== p.data.currency ||
      data.amount <= 0 ||
      refunded + data.amount > p.data.amount
    )
      throw new AppError(
        400,
        'Rambursarea depășește plata sau are altă monedă.',
      );
  }
  if (kind === 'payment' && id) {
    const refunds = list(entities, 'refund').filter(
      (x) => x.data.payment_id === id,
    );
    if (
      refunds.some((r) => r.data.currency !== data.currency) ||
      refunds.reduce((s, r) => s + r.data.amount, 0) > data.amount
    )
      throw new AppError(400, 'Plata nu poate fi mai mică decât rambursările.');
  }
  if (
    kind === 'expense' &&
    id &&
    list(entities, 'payment').some(
      (p) => p.data.expense_id === id && p.data.currency !== data.currency,
    )
  )
    throw new AppError(
      400,
      'Nu poți modifica moneda unei cheltuieli cu plăți înregistrate.',
    );
  for (const [assign, refKind, key] of [
    ['transport_assignment', 'transport', 'transport_id'],
    ['room_assignment', 'accommodation', 'accommodation_id'],
  ]) {
    if (kind === assign) {
      const target = entities.find((x) => x.id === data[key])!;
      if (
        list(active, assign).filter((x) => x.data[key] === target.id).length >=
        target.data.capacity
      )
        throw new AppError(409, 'Capacitatea disponibilă a fost depășită.');
      if (list(active, assign).some((x) => x.data.guest_id === data.guest_id))
        throw new AppError(409, 'Persoana este deja repartizată.');
    }
    if (
      kind === refKind &&
      list(entities, assign).filter((x) => x.data[key] === id).length >
        data.capacity
    )
      throw new AppError(
        409,
        'Capacitatea este mai mică decât numărul persoanelor repartizate.',
      );
  }
  if (kind === 'timeline' && data.end <= data.start)
    throw new AppError(
      400,
      'Ora de sfârșit trebuie să fie după ora de început.',
    );
  if (kind === 'task' && data.dependency_id) {
    const visited = new Set([id]);
    let p = data.dependency_id;
    while (p) {
      if (visited.has(p))
        throw new AppError(
          400,
          'Dependențele sarcinilor nu pot forma un ciclu.',
        );
      visited.add(p);
      p = entities.find((x) => x.id === p)?.data.dependency_id;
    }
  }
}
