import { Data, Entity, AppError, uid, list } from '../lib/domain';
import { insertEntity, stmt, mutate, now, all, enforce } from './store';
const kinds = ['table', 'assignment', 'decor', 'constraint'];
export function suggestions(es: Entity[], sub: string) {
  const tables = list(es, 'table').filter((t) => t.data.subevent_id === sub);
  const guests = list(es, 'guest')
    .filter(
      (g) =>
        list(es, 'rsvp').some(
          (r) =>
            r.data.guest_id === g.id &&
            r.data.subevent_id === sub &&
            r.data.status === 'confirmed',
        ) &&
        !list(es, 'assignment').some(
          (a) => a.data.guest_id === g.id && a.data.subevent_id === sub,
        ),
    )
    .sort((a, b) => a.data.household_id.localeCompare(b.data.household_id));
  const assignments = list(es, 'assignment').map((a) => ({ ...a.data }));
  const proposed: Data[] = [],
    conflicts: string[] = [];
  for (const g of guests) {
    const familyMembers = list(es, 'guest')
      .filter((x) => x.data.household_id === g.data.household_id)
      .map((x) => x.id);
    const ranked = [...tables].sort(
      (a, b) =>
        assignments.filter(
          (x) => x.table_id === b.id && familyMembers.includes(x.guest_id),
        ).length -
        assignments.filter(
          (x) => x.table_id === a.id && familyMembers.includes(x.guest_id),
        ).length,
    );
    let placed = false;
    for (const t of ranked) {
      const seated = assignments.filter((x) => x.table_id === t.id);
      if (seated.length >= t.data.capacity) continue;
      const forbidden = list(es, 'constraint')
        .filter(
          (c) =>
            c.data.rule === 'apart' &&
            (c.data.guest_id === g.id || c.data.other_guest_id === g.id),
        )
        .map((c) =>
          c.data.guest_id === g.id ? c.data.other_guest_id : c.data.guest_id,
        );
      if (seated.some((x) => forbidden.includes(x.guest_id))) continue;
      const seat = Array.from(
        { length: t.data.capacity },
        (_, i) => i + 1,
      ).find((n) => !seated.some((x) => x.seat === n));
      const assignment = {
        guest_id: g.id,
        table_id: t.id,
        seat,
        subevent_id: sub,
        provisional: false,
      };
      assignments.push(assignment);
      proposed.push({
        ...assignment,
        guest_name: g.data.name,
        table_name: t.data.name,
        reason: seated.some((x) => familyMembers.includes(x.guest_id))
          ? 'Alături de un membru al familiei'
          : 'Primul loc disponibil fără conflict de separare',
      });
      placed = true;
      break;
    }
    if (!placed) conflicts.push(`${g.data.name}: nu există loc compatibil.`);
  }
  for (const rule of list(es, 'constraint').filter(
    (c) => c.data.rule === 'together',
  )) {
    const a = assignments.find(
        (x) => x.guest_id === rule.data.guest_id && x.subevent_id === sub,
      ),
      b = assignments.find(
        (x) => x.guest_id === rule.data.other_guest_id && x.subevent_id === sub,
      );
    if (a && b && a.table_id !== b.table_id)
      conflicts.push(
        'Regula „împreună” necesită ajustare manuală: ' +
          list(es, 'guest')
            .filter((g) =>
              [rule.data.guest_id, rule.data.other_guest_id].includes(g.id),
            )
            .map((g) => g.data.name)
            .join(', '),
      );
  }
  return { proposed, conflicts };
}
export function snapshotStatements(
  event: string,
  es: Entity[],
  actor: string,
  name = 'Versiune sală',
) {
  const r = insertEntity(
    event,
    'floor_version',
    {
      name,
      snapshot: es
        .filter((e) => kinds.includes(e.kind))
        .map((e) => ({ id: e.id, kind: e.kind, data: e.data })),
      saved_at: now(),
    },
    actor,
  );
  return r;
}
export async function restorePlan(
  event: string,
  version: number,
  es: Entity[],
  saved: Entity,
  actor: string,
) {
  const snapshot = saved.data.snapshot;
  if (!Array.isArray(snapshot)) throw new AppError(400, 'Versiune invalidă.');
  const s = [
    ...snapshotStatements(event, es, actor, 'Înainte de restaurare').statements,
    stmt(
      "UPDATE entities SET deleted_at=?,updated_at=? WHERE event_id=? AND kind IN ('assignment','table','decor','constraint') AND deleted_at IS NULL",
      now(),
      now(),
      event,
    ),
  ];
  const snapshotIds = new Set(snapshot.map((x) => x.id));
  for (const row of snapshot) {
    if (!kinds.includes(row.kind))
      throw new AppError(400, 'Versiune invalidă.');
    for (const id of [
      row.data.guest_id,
      row.data.other_guest_id,
      row.data.subevent_id,
    ].filter(Boolean))
      if (!es.some((x) => x.id === id && !x.deleted_at))
        throw new AppError(
          409,
          'Versiunea conține persoane sau momente care nu mai sunt active.',
        );
    s.push(
      stmt(
        'UPDATE entities SET data=?,deleted_at=NULL,version=version+1,updated_at=? WHERE event_id=? AND id=?',
        JSON.stringify(row.data),
        now(),
        event,
        row.id,
      ),
    );
  }
  return mutate(event, version, actor, 'floor.restore', s, saved.id);
}
