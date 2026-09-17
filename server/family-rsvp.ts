import { AppError, Data, Entity, list, validate } from '../lib/domain';
import { enforce, insertEntity, mutate, now, stmt } from './store';
import { hasSensitiveDetails, PRIVACY_NOTICE_VERSION } from '../lib/privacy';

export function familyPending(es: Entity[], family: Entity) {
  if (
    family.data.self_registration &&
    !list(es, 'family_response').some((r) => r.data.household_id === family.id)
  )
    return true;
  return list(es, 'guest')
    .filter((g) => g.data.household_id === family.id)
    .some((g) =>
      list(es, 'guest_invitation')
        .filter((i) => i.data.guest_id === g.id)
        .some(
          (i) =>
            !list(es, 'rsvp').some(
              (r) =>
                r.data.guest_id === g.id &&
                r.data.subevent_id === i.data.subevent_id &&
                r.data.status !== 'pending',
            ),
        ),
    );
}

export async function saveFamily(
  eventId: string,
  family: Entity,
  guests: Entity[],
  subs: Entity[],
  es: Entity[],
  body: Data,
) {
  if (!Array.isArray(body.members) || body.members.length > 100)
    throw new AppError(400, 'Completează membrii familiei.');
  const capacity = Number(family.data.max_members) || 4;
  if (!body.members.length && !body.family_declined)
    throw new AppError(
      400,
      'Adaugă persoanele care vin sau alege că familia nu poate participa.',
    );
  if (hasSensitiveDetails(body.members) && body.sensitive_consent !== true)
    throw new AppError(
      400,
      'Consimțământul explicit este obligatoriu pentru alergii sau nevoi de accesibilitate.',
    );
  const seen = new Set<string>(),
    names = new Set<string>();
  const statements: D1PreparedStatement[] = [];
  for (const member of body.members) {
    if (!member || typeof member !== 'object')
      throw new AppError(400, 'Membru invalid.');
    if (typeof member.name !== 'string' || !member.name.trim())
      throw new AppError(400, 'Numele fiecărei persoane este obligatoriu.');
    const old = member.id ? guests.find((g) => g.id === member.id) : undefined;
    if (member.id && (!old || seen.has(member.id)))
      throw new AppError(
        403,
        'Poți modifica numai membrii propriei familii, o singură dată.',
      );
    if (old) seen.add(old.id);
    const data = validate('guest', {
      ...old?.data,
      name: member.name,
      age: member.age,
      household_id: family.id,
      menu_id: member.menu_id || '',
      allergies: member.allergies || '',
      needs: member.needs || '',
      transport: !!member.transport,
      accommodation: !!member.accommodation,
    });
    if (String(data.allergies).trim() || String(data.needs).trim())
      data.consent = {
        at: now(),
        version: PRIVACY_NOTICE_VERSION,
        source: 'rsvp-family',
      };
    const nameKey = data.name.trim().toLocaleLowerCase('ro');
    if (names.has(nameKey))
      throw new AppError(
        400,
        'Ai introdus același nume de două ori. Verifică membrii familiei.',
      );
    names.add(nameKey);
    enforce('guest', data, es, old?.id);
    const created = old ? null : insertEntity(eventId, 'guest', data, 'guest');
    const id = old?.id || created!.id;
    if (old)
      statements.push(
        stmt(
          'UPDATE entities SET data=?,version=version+1,updated_at=? WHERE event_id=? AND id=?',
          JSON.stringify(data),
          now(),
          eventId,
          id,
        ),
      );
    else statements.push(...created!.statements);
    for (const sub of subs) {
      const status = body.family_declined
        ? 'declined'
        : member.responses?.[sub.id];
      if (!['confirmed', 'declined'].includes(status))
        throw new AppError(
          400,
          'Alege participarea fiecărei persoane la fiecare moment.',
        );
      if (
        !list(es, 'guest_invitation').some(
          (i) => i.data.guest_id === id && i.data.subevent_id === sub.id,
        )
      )
        statements.push(
          ...insertEntity(
            eventId,
            'guest_invitation',
            { guest_id: id, subevent_id: sub.id },
            'guest',
          ).statements,
        );
      const response = list(es, 'rsvp').find(
        (r) => r.data.guest_id === id && r.data.subevent_id === sub.id,
      );
      const responseData = {
        guest_id: id,
        subevent_id: sub.id,
        status,
        source: 'guest',
      };
      if (response)
        statements.push(
          stmt(
            'UPDATE entities SET data=?,version=version+1,updated_at=? WHERE event_id=? AND id=?',
            JSON.stringify(responseData),
            now(),
            eventId,
            response.id,
          ),
        );
      else
        statements.push(
          ...insertEntity(eventId, 'rsvp', responseData, 'guest').statements,
        );
    }
    if (
      member.responses &&
      Object.keys(member.responses).some((id) => !subs.some((s) => s.id === id))
    )
      throw new AppError(403, 'Moment neautorizat.');
  }
  if (guests.some((g) => !seen.has(g.id)))
    throw new AppError(
      400,
      'Păstrează membrii deja salvați și marchează neparticiparea celor care nu vin.',
    );
  const previous = list(es, 'family_response').find(
    (r) => r.data.household_id === family.id,
  );
  const record = {
    household_id: family.id,
    status: body.family_declined ? 'declined' : 'responded',
  };
  if (previous)
    statements.push(
      stmt(
        'UPDATE entities SET data=?,version=version+1,updated_at=? WHERE event_id=? AND id=?',
        JSON.stringify(record),
        now(),
        eventId,
        previous.id,
      ),
    );
  else
    statements.push(
      ...insertEntity(eventId, 'family_response', record, 'guest').statements,
    );
  statements.push(
    ...insertEntity(
      eventId,
      'notification',
      {
        name: `RSVP familie · ${family.data.name}. Lista persoanelor a fost actualizată.${body.members.length > capacity ? ` ${body.members.length - capacity} persoane peste locurile rezervate.` : ''}`,
        read: false,
      },
      'guest',
    ).statements,
  );
  return mutate(
    eventId,
    Number(body.version),
    'guest',
    'rsvp.family',
    statements,
    family.id,
  );
}
