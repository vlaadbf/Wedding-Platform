'use client';
import { useCallback, useEffect, useState } from 'react';
import { Heart, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Data, Entity } from '@/lib/domain';
import { api, Pick, FieldControl } from './controls';
import { InvitationCard } from './invitation-card';
import { FamilyRSVP } from './family-rsvp';
export default function RSVP({ token }: { token: string }) {
  const [state, setState] = useState<Data | null>(null),
    [answers, setAnswers] = useState<Data>({}),
    [guestData, setGuestData] = useState<Data>({}),
    [companions, setCompanions] = useState<string[]>([]),
    [sensitiveConsent, setSensitiveConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [lang, setLang] = useState('ro');
  const load = useCallback(async () => {
    const s = await api('public/' + token);
    setState(s);
    const a: Data = {};
    for (const i of s.invitations) {
      a[i.data.guest_id + ':' + i.data.subevent_id] =
        s.responses.find(
          (r: Entity) =>
            r.data.guest_id === i.data.guest_id &&
            r.data.subevent_id === i.data.subevent_id,
        )?.data.status || 'pending';
    }
    setAnswers(a);
    setGuestData(
      Object.fromEntries(s.guests.map((g: Entity) => [g.id, g.data])),
    );
  }, [token]);
  useEffect(() => {
    Promise.resolve().then(load).catch((e) => setError(e.message));
  }, [load]);
  const en = lang === 'en';
  if (!state)
    return (
      <div className="boot">
        <Heart />
        <h2>{error || 'Pregătim invitația voastră…'}</h2>
      </div>
    );
  const ed = {
    ...state.event,
    data: {
      date: state.event.date,
      partner1: state.event.partner1 || state.event.name.split('&')[0],
      partner2: state.event.partner2 || state.event.name.split('&')[1],
      venue:
        state.event.venue ||
        state.subevents.find((s: Entity) => /recep/i.test(s.data.name))?.data
          .venue,
      city: state.event.city,
    },
  };
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (companions.some((name) => !name.trim()))
        throw new Error(
          en
            ? 'Every additional person needs a name.'
            : 'Completează numele fiecărei persoane suplimentare.',
        );
      const responses = Object.entries(answers)
        .filter(([_, value]) => value !== 'pending')
        .map(([key, status]) => ({
          guest_id: key.split(':')[0],
          subevent_id: key.split(':')[1],
          status,
        }));
      await api('public/' + token, 'POST', {
        version: state.event.version,
        responses,
        guests: Object.entries(guestData).map(([id, data]) => ({
          id,
          ...data,
        })),
        companions,
        sensitive_consent: sensitiveConsent,
      });
      setSaved(true);
      setCompanions([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eroare la salvare.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="public-shell">
      {state.event.demo && (
        <div className="public-demo">
          DEMO · Persoane și eveniment fictive. Răspunsurile se salvează în
          evenimentul demonstrativ.
        </div>
      )}
      <div className="public-language">
        <Pick
          label="Language"
          value={lang}
          onChange={setLang}
          options={[
            { value: 'ro', label: 'Română' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>
      <InvitationCard
        event={ed}
        design={{
          ...state.invitation,
          message: en
            ? state.invitation.message_en || state.invitation.message
            : state.invitation.message,
        }}
      />
      <section className="public-form">
        <h2>
          {en
            ? 'We saved a place for you'
            : 'V-am păstrat un loc în povestea noastră'}
        </h2>
        {state.family.self_registration ? (
          <FamilyRSVP state={state} token={token} en={en} reload={load} />
        ) : (
          <>
            <p className="muted">
              {state.family.name} ·{' '}
              {en
                ? 'Please respond separately for each person and celebration.'
                : 'Răspundeți separat pentru fiecare persoană și moment.'}
            </p>
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
            {state.guests.map((g: Entity) => (
              <article className="panel public-person" key={g.id}>
                <h3>{g.data.name}</h3>
                {state.invitations
                  .filter((i: Entity) => i.data.guest_id === g.id)
                  .map((i: Entity) => {
                    const sub = state.subevents.find(
                      (s: Entity) => s.id === i.data.subevent_id,
                    );
                    const key = g.id + ':' + sub.id;
                    return (
                      <div className="public-subevent" key={i.id}>
                        <div>
                          <strong>{sub.data.name}</strong>
                          <small>
                            {sub.data.date} · {sub.data.start} ·{' '}
                            {sub.data.venue}
                          </small>
                          {sub.data.address && (
                            <a
                              href={
                                'https://www.google.com/maps/search/?api=1&query=' +
                                encodeURIComponent(sub.data.address)
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              {en ? 'View map' : 'Vezi harta'}
                            </a>
                          )}
                        </div>
                        <Pick
                          label={en ? 'Your response' : 'Răspunsul tău'}
                          value={answers[key]}
                          onChange={(v) => {
                            setAnswers({ ...answers, [key]: v });
                            setSaved(false);
                          }}
                          options={[
                            {
                              value: 'pending',
                              label: en
                                ? 'Choose an answer'
                                : 'Alege un răspuns',
                            },
                            {
                              value: 'confirmed',
                              label: en
                                ? 'Joyfully accept'
                                : 'Particip cu drag',
                            },
                            {
                              value: 'declined',
                              label: en
                                ? 'Regretfully decline'
                                : 'Nu pot participa',
                            },
                          ]}
                        />
                      </div>
                    );
                  })}
                {Object.entries(answers).some(
                  ([key, value]) =>
                    key.startsWith(g.id + ':') && value === 'confirmed',
                ) && (
                  <div className="form-grid">
                    <div className="form-field">
                      <label>{en ? 'Menu' : 'Meniu'}</label>
                      <Pick
                        label={en ? 'Choose a menu' : 'Alege meniul'}
                        value={guestData[g.id]?.menu_id || ''}
                        onChange={(v) =>
                          setGuestData({
                            ...guestData,
                            [g.id]: { ...guestData[g.id], menu_id: v },
                          })
                        }
                        options={[
                          {
                            value: '',
                            label: en ? 'No preference' : 'Fără preferință',
                          },
                          ...state.menus.map((m: Entity) => ({
                            value: m.id,
                            label: m.data.name,
                          })),
                        ]}
                      />
                    </div>
                    {[
                      {
                        key: 'allergies',
                        label: en
                          ? 'Allergies (optional)'
                          : 'Alergii (opțional)',
                      },
                      {
                        key: 'needs',
                        label: en
                          ? 'Accessibility or other needs'
                          : 'Accesibilitate sau alte nevoi',
                      },
                      {
                        key: 'transport',
                        label: en
                          ? 'I need transport'
                          : 'Am nevoie de transport',
                        type: 'boolean',
                      },
                      {
                        key: 'accommodation',
                        label: en
                          ? 'I need accommodation'
                          : 'Am nevoie de cazare',
                        type: 'boolean',
                      },
                    ].map((f) => (
                      <FieldControl
                        key={f.key}
                        field={f}
                        value={guestData[g.id]?.[f.key]}
                        onChange={(v) =>
                          setGuestData({
                            ...guestData,
                            [g.id]: { ...guestData[g.id], [f.key]: v },
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </article>
            ))}
            {
              <section className="panel public-person">
                <h3>{en ? 'Companions' : 'Însoțitori'}</h3>
                <p className="muted">
                  {en
                    ? 'New companions can respond after saving.'
                    : 'După adăugare, însoțitorii pot răspunde individual.'}
                </p>
                {companions.map((v, i) => (
                  <div key={i} className="account-actions">
                    <Input
                      aria-label={en ? 'Companion name' : 'Nume însoțitor'}
                      value={v}
                      required
                      onChange={(e) =>
                        setCompanions(
                          companions.map((x, j) =>
                            i === j ? e.target.value : x,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        setCompanions(companions.filter((_, j) => i !== j))
                      }
                    >
                      {en ? 'Remove' : 'Elimină'}
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  disabled={
                    busy || companions.length + state.guests.length >= 100
                  }
                  onClick={() => setCompanions([...companions, ''])}
                >
                  {en ? 'Add companion' : 'Adaugă însoțitor'}
                </Button>
              </section>
            }
            {state.invitation.faq && (
              <section className="panel public-person">
                <h3>
                  {en ? 'Frequently asked questions' : 'Întrebări frecvente'}
                </h3>
                <p>{state.invitation.faq}</p>
              </section>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            {saved && (
              <output className="info-banner">
                <CheckCircle2 />
                {en
                  ? 'Thank you! Your response has been saved.'
                  : 'Mulțumim! Răspunsul vostru a fost salvat.'}
              </output>
            )}
            <Button className="auth-submit" disabled={busy} onClick={submit}>
              {busy ? <Loader2 className="spin" /> : <Heart />}
              {en ? 'Save our responses' : 'Salvează răspunsurile noastre'}
            </Button>
          </>
        )}
        {state.family.self_registration && state.invitation.faq && (
          <section className="panel public-person">
            <h3>{en ? 'Frequently asked questions' : 'Întrebări frecvente'}</h3>
            <p>{state.invitation.faq}</p>
          </section>
        )}
        <p className="public-footer">
          {en
            ? 'You may update your response until'
            : 'Puteți modifica răspunsul până la'}{' '}
          {state.invitation.rsvp_deadline || 'data comunicată de organizatori'}.
          <br />
          {state.invitation.help}
        </p>
      </section>
      <footer className="public-footer">
        {en
          ? 'Your information is used by the organizers only to prepare your participation, menus and requested services. Contact the organizers to request correction or deletion.'
          : 'Informațiile sunt folosite de organizatori pentru participare, meniuri și serviciile solicitate. Contactați organizatorii pentru corectarea sau ștergerea datelor.'}
        {' '}
        <a href={`/confidentialitate?lang=${en ? 'en' : 'ro'}`}>
          {en ? 'Privacy notice.' : 'Nota de confidențialitate.'}
        </a>
        <br />
        Planora · {en ? 'Together, with care.' : 'Totul, împreună.'}
      </footer>
    </main>
  );
}
