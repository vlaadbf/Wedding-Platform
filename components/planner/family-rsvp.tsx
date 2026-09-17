'use client';
import { useState } from 'react';
import { Data, Entity } from '@/lib/domain';
import { Button } from '@/components/ui/button';
import { FieldControl, Pick, api } from './controls';

export function FamilyRSVP({
  state,
  token,
  en,
  reload,
}: {
  state: Data;
  token: string;
  en: boolean;
  reload: () => Promise<void>;
}) {
  const initial = () =>
    state.guests.map((g: Entity) => ({
      id: g.id,
      ...g.data,
      responses: Object.fromEntries(
        state.subevents.map((s: Entity) => [
          s.id,
          state.responses.find(
            (r: Entity) =>
              r.data.guest_id === g.id && r.data.subevent_id === s.id,
          )?.data.status === 'declined'
            ? 'declined'
            : 'confirmed',
        ]),
      ),
    }));
  const [members, setMembers] = useState<Data[]>(initial);
  const [declined, setDeclined] = useState(
    state.family.response_status === 'declined',
  );
  const [busy, setBusy] = useState(false);
  const [sensitiveConsent, setSensitiveConsent] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  function update(index: number, data: Data) {
    setSaved(false);
    setMembers(members.map((m, i) => (i === index ? { ...m, ...data } : m)));
  }
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await api('public/' + token, 'POST', {
        version: state.event.version,
        members: declined ? members.filter(member => member.id) : members,
        family_declined: declined,
        sensitive_consent: sensitiveConsent,
      });
      const fresh = await api('public/' + token);
      setMembers(
        fresh.guests.map((g: Entity) => ({
          id: g.id,
          ...g.data,
          responses: Object.fromEntries(
            fresh.subevents.map((s: Entity) => [
              s.id,
              fresh.responses.find(
                (r: Entity) =>
                  r.data.guest_id === g.id && r.data.subevent_id === s.id,
              )?.data.status || 'declined',
            ]),
          ),
        })),
      );
      await reload();
      setSaved(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Răspunsul nu a putut fi salvat.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="family-rsvp-form">
      <p className="eyebrow">{state.family.name}</p>
      <h3>
        {en ? 'Who is coming with you?' : 'Cine vine din familia voastră?'}
      </h3>
      <p>
        {en
          ? `We reserved ${state.family.max_members} places for your family, including children. Add each person below.`
          : `Am rezervat ${state.family.max_members} locuri pentru familia voastră, inclusiv copiii. Completează mai jos fiecare persoană care vine.`}
      </p>
      <FieldControl
        field={{
          key: 'declined',
          type: 'boolean',
          label: en
            ? 'Our family cannot attend'
            : 'Familia noastră nu poate participa',
        }}
        value={declined}
        onChange={(v) => {
          setDeclined(!!v);
          setSaved(false);
        }}
      />
      {!declined && (
        <>
          <aside className="privacy-consent-note">
            <strong>
              {en ? 'Sensitive information' : 'Informații sensibile'}
            </strong>
            <p>
              {en
                ? `${state.event.privacy_operator || 'The event organizers'} processes allergy and accessibility details only to prepare menus and requested services. The data remains in the organizer account until it is deleted. Withdraw consent through ${state.event.privacy_contact || 'the invitation contact'}.`
                : `${state.event.privacy_operator || 'Organizatorii evenimentului'} prelucrează alergiile și nevoile de accesibilitate numai pentru meniuri și serviciile solicitate. Datele rămân în contul organizatorului până la ștergere. Retrage consimțământul prin ${state.event.privacy_contact || 'contactul din invitație'}.`}
            </p>
            <FieldControl
              field={{
                key: 'sensitive_consent',
                type: 'boolean',
                label: en
                  ? 'I explicitly consent to processing the allergy or accessibility details I provide.'
                  : 'Consimt explicit la prelucrarea alergiilor sau nevoilor de accesibilitate pe care le completez.',
              }}
              value={sensitiveConsent}
              onChange={(value) => setSensitiveConsent(!!value)}
            />
            <a href={`/confidentialitate?lang=${en ? 'en' : 'ro'}`} target="_blank" rel="noreferrer">
              {en ? 'Read the privacy notice' : 'Citește nota de confidențialitate'}
            </a>
          </aside>
          {members.map((member, index) => (
            <section
              className="panel public-person"
              key={member.id || 'new-' + index}
            >
              <h3>
                {en ? 'Person' : 'Persoana'} {index + 1}
              </h3>
              <div className="form-grid">
                <FieldControl
                  field={{
                    key: 'name',
                    label: en ? 'Full name' : 'Nume și prenume',
                    required: true,
                  }}
                  value={member.name}
                  onChange={(name) => update(index, { name })}
                />
                <FieldControl
                  field={{
                    key: 'age',
                    label: en ? 'Category' : 'Categorie',
                    type: 'select',
                    options: ['adult', 'copil'],
                  }}
                  value={member.age}
                  onChange={(age) => update(index, { age })}
                />
              </div>
              {state.subevents.map((sub: Entity) => (
                <div className="public-subevent" key={sub.id}>
                  <div>
                    <strong>{sub.data.name}</strong>
                    <small>
                      {sub.data.date} · {sub.data.start} · {sub.data.venue}
                    </small>
                  </div>
                  <Pick
                    label={
                      (en ? 'Attendance: ' : 'Participare: ') + sub.data.name
                    }
                    value={member.responses[sub.id]}
                    options={[
                      {
                        value: 'confirmed',
                        label: en ? 'Attending' : 'Participă',
                      },
                      {
                        value: 'declined',
                        label: en ? 'Not attending' : 'Nu participă',
                      },
                    ]}
                    onChange={(status) =>
                      update(index, {
                        responses: { ...member.responses, [sub.id]: status },
                      })
                    }
                  />
                </div>
              ))}
              <div className="form-grid">
                <div className="form-field">
                  <label>{en ? 'Menu' : 'Meniu'}</label>
                  <Pick
                    label={en ? 'Menu' : 'Meniu'}
                    value={member.menu_id || ''}
                    options={[
                      {
                        value: '',
                        label: en ? 'Choose later' : 'Aleg mai târziu',
                      },
                      ...state.menus.map((m: Entity) => ({
                        value: m.id,
                        label: m.data.name,
                      })),
                    ]}
                    onChange={(menu_id) => update(index, { menu_id })}
                  />
                </div>
                <FieldControl
                  field={{
                    key: 'allergies',
                    label: en ? 'Allergies' : 'Alergii alimentare',
                  }}
                  value={member.allergies}
                  onChange={(allergies) => update(index, { allergies })}
                />
                <FieldControl
                  field={{
                    key: 'needs',
                    label: en
                      ? 'Accessibility / other needs'
                      : 'Accesibilitate / alte nevoi',
                  }}
                  value={member.needs}
                  onChange={(needs) => update(index, { needs })}
                />
                <FieldControl
                  field={{
                    key: 'transport',
                    label: en ? 'Transport requested' : 'Solicită transport',
                    type: 'boolean',
                  }}
                  value={member.transport}
                  onChange={(transport) => update(index, { transport })}
                />
                <FieldControl
                  field={{
                    key: 'accommodation',
                    label: en ? 'Accommodation requested' : 'Solicită cazare',
                    type: 'boolean',
                  }}
                  value={member.accommodation}
                  onChange={(accommodation) => update(index, { accommodation })}
                />
              </div>
              {!member.id && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setMembers(members.filter((_, i) => i !== index));
                    setSaved(false);
                  }}
                >
                  {en ? 'Remove' : 'Elimină persoana'}
                </Button>
              )}
            </section>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={busy || members.length >= 100}
            onClick={() => {
              setSaved(false);
              setMembers([
                ...members,
                {
                  name: '',
                  age: 'adult',
                  responses: Object.fromEntries(
                    state.subevents.map((s: Entity) => [s.id, 'confirmed']),
                  ),
                },
              ]);
            }}
          >
            {en ? 'Add person' : 'Adaugă persoană'}
          </Button>
          <p className="muted">
            {members.length} {en ? 'people added' : 'persoane adăugate'} · {state.family.max_members} {en ? 'places initially reserved' : 'locuri rezervate inițial'}
          </p>
          {members.length > state.family.max_members && <p className="info-banner">{en ? 'Additional people will be included in your response. The organizers will see the updated number.' : 'Persoanele suplimentare vor fi incluse în răspuns. Organizatorii vor vedea numărul actualizat.'}</p>}
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {saved && (
        <output className="info-banner">
          {en
            ? 'Your family response has been saved.'
            : 'Răspunsul familiei a fost salvat. Mulțumim!'}
        </output>
      )}
      <Button className="auth-submit" type="submit" disabled={busy}>
        {busy
          ? en
            ? 'Saving…'
            : 'Se salvează…'
          : en
            ? 'Confirm our response'
            : 'Confirmă răspunsul familiei'}
      </Button>
    </form>
  );
}
