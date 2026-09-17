'use client';
import { CSSProperties } from 'react';
import { Data } from '@/lib/domain';
import {
  invitationArt,
  invitationFonts,
  templateFor,
} from '@/lib/invitation-templates';
import { Heart } from 'lucide-react';

export function InvitationCard({
  event,
  design,
  mobile = false,
}: {
  event: Data;
  design: Data;
  mobile?: boolean;
}) {
  if (!design.template_id)
    return <LegacyInvitation event={event} design={design} mobile={mobile} />;
  const template = templateFor(design);
  const first =
    design.partner1 ||
    event.data.partner1 ||
    event.name.split('&')[0] ||
    'Prenume';
  const second =
    design.partner2 ||
    event.data.partner2 ||
    event.name.split('&')[1] ||
    'Prenume';
  const date = event.data.date
    ? new Intl.DateTimeFormat('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(event.data.date + 'T12:00:00'))
    : 'Data voastră specială';
  const artwork =
    design.artwork && design.artwork !== 'auto'
      ? design.artwork
      : template.artwork;
  const art = invitationArt[artwork as keyof typeof invitationArt];
  const styles = {
    '--invite-accent': design.color || template.color,
    '--invite-paper': design.background || template.background,
    '--invite-ink': design.text_color || template.text_color,
    '--invite-font':
      invitationFonts[design.font || template.font] || invitationFonts.serif,
  } as CSSProperties;
  return (
    <article
      className={`invitation-design template-${template.layout}${mobile ? ' invitation-phone' : ''}${art ? ' with-art' : ''}`}
      style={styles}
      data-template={template.id}
    >
      {art && (
        <picture className="invitation-art-picture">
          <source type="image/avif" srcSet={art.avif} sizes="(max-width: 640px) 100vw, 540px" />
          <source type="image/webp" srcSet={art.webp} sizes="(max-width: 640px) 100vw, 540px" />
          {/* Generated artwork is decorative and has explicit intrinsic dimensions. */}
          {/* oxlint-disable-next-line next/no-img-element */}
          <img
            className="invitation-art"
            src={art.fallback}
            alt=""
            width={1024}
            height={1536}
            loading="lazy"
            decoding="async"
          />
        </picture>
      )}
      <div className="invitation-design-content">
        {template.layout === 'editorial' && (
          <div className="invitation-masthead">
            {design.masthead || 'THE LOVE ISSUE'}
          </div>
        )}
        {template.layout === 'ticket' && (
          <div className="invitation-ticket-header">
            <span>{design.masthead || 'INVITAȚIE DE ÎMBARCARE'}</span>
            <span>ONE WAY · TOGETHER</span>
          </div>
        )}
        {template.layout === 'festival' && (
          <div className="invitation-festival-title">
            {design.masthead || 'LOVE\nFEST'}
          </div>
        )}
        <p className="invitation-eyebrow">
          {design.eyebrow || 'VĂ INVITĂM LA NUNTA NOASTRĂ'}
        </p>
        {template.layout === 'monogram' && (
          <div className="invitation-monogram" aria-hidden="true">
            <span>{first.trim()[0]}</span>
            <span>{second.trim()[0]}</span>
          </div>
        )}
        <h2 className="invitation-names">
          <span>{first.trim()}</span>
          <i>&</i>
          <span>{second.trim()}</span>
        </h2>
        <p className="invitation-headline">
          {design.headline || template.headline}
        </p>
        <div className="invitation-event-details">
          <p className="invitation-event-date">{date}</p>
          <p>
            {design.location ||
              event.data.venue ||
              event.data.city ||
              'Locul în care celebrăm iubirea'}
          </p>
        </div>
        <p className="invitation-message">
          {design.message ||
            'Ne-ar bucura să fiți alături de noi la începutul acestui nou capitol.'}
        </p>
        {design.dress_code && (
          <p className="invitation-dress">{design.dress_code}</p>
        )}
        <p className="invitation-closing">
          {design.closing || 'Vă așteptăm cu drag.'}
        </p>
        {design.rsvp_deadline && (
          <p className="invitation-deadline">
            Răspuns până la{' '}
            {new Intl.DateTimeFormat('ro-RO').format(
              new Date(design.rsvp_deadline + 'T12:00:00'),
            )}
          </p>
        )}
        {template.layout === 'ticket' && (
          <div className="invitation-ticket-footer">
            <span>FAMILIE & PRIETENI</span>
            <strong>{(first[0] + second[0]).toUpperCase()} · ÎMPREUNĂ</strong>
          </div>
        )}
      </div>
    </article>
  );
}

function LegacyInvitation({
  event,
  design,
  mobile,
}: {
  event: Data;
  design: Data;
  mobile: boolean;
}) {
  const date = event.data.date
    ? new Intl.DateTimeFormat('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(event.data.date + 'T12:00:00'))
    : 'O dată de neuitat';
  return (
    <div
      className={
        'invitation-card style-' +
        design.style?.toLowerCase() +
        (mobile ? ' mobile-preview' : '')
      }
      style={{ '--invite-color': design.color || '#536b57' } as CSSProperties}
    >
      <div className="invitation-border">
        <div className="invitation-kicker">
          CU DRAG, VĂ INVITĂM LA NUNTA NOASTRĂ
        </div>
        <div className="invitation-mark">
          <Heart size={26} />
        </div>
        <h2>
          {event.data.partner1 || event.name.split('&')[0]}
          <span>&</span>
          {event.data.partner2 || event.name.split('&')[1]}
        </h2>
        <p>{design.message}</p>
        <div className="invitation-date">{date}</div>
        <div className="invitation-place">
          {event.data.venue || event.data.city}
        </div>
        <div className="invitation-rule" />
        <small>{design.dress_code}</small>
        <div className="invite-rsvp-hint">
          Răspunsul vostru ne-ar bucura nespus.
        </div>
      </div>
    </div>
  );
}
