'use client';
import { useEffect, useState } from 'react';
import { CalendarDays, Clock, Heart, MapPin } from 'lucide-react';
import { Data } from '@/lib/domain';
import { api } from './controls';
import { InvitationCard } from './invitation-card';

const formatDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat('ro-RO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(`${value}T12:00:00`))
    : 'Data va fi anunțată';

export default function PublicEvent({ eventId }: { eventId: string }) {
  const [state, setState] = useState<Data | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`public-event/${eventId}`)
      .then(setState)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Eveniment indisponibil.'),
      );
  }, [eventId]);
  if (error)
    return (
      <main className="public-event-status">
        <Heart aria-hidden="true" />
        <h1>Pagina nu este disponibilă</h1>
        <p>{error}</p>
      </main>
    );
  if (!state)
    return (
      <main className="public-event-status">
        <Heart className="spin-heart" aria-hidden="true" />
        <p>Pregătim evenimentul…</p>
      </main>
    );
  if (!state.published)
    return (
      <main className="public-event-status">
        <Heart aria-hidden="true" />
        <h1>Invitația va apărea în curând</h1>
        <p>Organizatorii pregătesc ultimele detalii. Revino puțin mai târziu.</p>
        <small>Planora · Totul, împreună.</small>
      </main>
    );
  return (
    <main className="public-event-shell">
      <InvitationCard event={state.event} design={state.invitation} />
      {!!state.subevents?.length && (
        <section className="public-event-program">
          <p className="eyebrow">PROGRAMUL EVENIMENTULUI</p>
          <h1>Ne bucurăm să vă avem alături.</h1>
          <div className="public-event-moments">
            {state.subevents.map((moment: Data) => (
              <article className="public-event-moment" key={moment.id}>
                <div className="public-event-moment-icon" aria-hidden="true">
                  <Heart />
                </div>
                <div>
                  <h2>{moment.data.name}</h2>
                  <p><CalendarDays /> {formatDate(moment.data.date)}</p>
                  {(moment.data.start || moment.data.end) && (
                    <p><Clock /> {moment.data.start || '—'}{moment.data.end ? ` – ${moment.data.end}` : ''}</p>
                  )}
                  {moment.data.venue && <p><MapPin /> {moment.data.venue}</p>}
                  {moment.data.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(moment.data.address)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Deschide adresa în hartă
                    </a>
                  )}
                  {moment.data.instructions && <small>{moment.data.instructions}</small>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <footer className="public-event-footer">
        <Heart aria-hidden="true" /> Planora · Totul, împreună.
      </footer>
    </main>
  );
}
