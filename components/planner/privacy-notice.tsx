'use client';
import { useState } from 'react';
import { Pick } from './controls';
import { PRIVACY_NOTICE_VERSION } from '@/lib/privacy';
import Link from 'next/link';

export function PrivacyNotice({ initialLanguage }: { initialLanguage: 'ro' | 'en' }) {
  const [language, setLanguage] = useState(initialLanguage);
  const en = language === 'en';
  return (
    <main className="public-shell privacy-page">
      <div className="public-language">
        <Pick
          label="Language"
          value={language}
          onChange={(value) => setLanguage(value === 'en' ? 'en' : 'ro')}
          options={[
            { value: 'ro', label: 'Română' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>
      {/* TEXT NEVALIDAT JURIDIC — A SE ÎNLOCUI */}
      <article className="panel privacy-document">
        <div className="form-error" role="note">
          {en
            ? 'LEGAL TEXT NOT VALIDATED — this draft must be replaced or approved by a lawyer before launch.'
            : 'TEXT NEVALIDAT JURIDIC — acest proiect trebuie înlocuit sau aprobat de un avocat înainte de lansare.'}
        </div>
        <p className="eyebrow">{en ? 'Privacy' : 'Confidențialitate'}</p>
        <h1>{en ? 'How RSVP information is used' : 'Cum sunt folosite datele RSVP'}</h1>
        <p>
          {en
            ? 'The data controller is the organizer named on the RSVP form. Their privacy contact is displayed next to the consent request and in the invitation.'
            : 'Operatorul datelor este organizatorul indicat în formularul RSVP. Contactul său pentru confidențialitate este afișat lângă cererea de consimțământ și în invitație.'}
        </p>
        <h2>{en ? 'Purpose and data' : 'Scop și date'}</h2>
        <p>
          {en
            ? 'Names, attendance, menu choices, transport and accommodation requests are used to organize the event. Allergy and accessibility details are sensitive information and are processed only with explicit consent to prepare menus and requested services.'
            : 'Numele, participarea, meniurile, transportul și cazarea sunt folosite pentru organizarea evenimentului. Alergiile și nevoile de accesibilitate sunt informații sensibile și sunt prelucrate numai cu consimțământ explicit, pentru meniuri și serviciile solicitate.'}
        </p>
        <h2>{en ? 'Storage and withdrawal' : 'Păstrare și retragere'}</h2>
        <p>
          {en
            ? 'Information remains in the organizer account while the event is being managed and until the organizer deletes it. Ask the privacy contact for the exact retention period, access, correction, deletion or withdrawal of consent. Withdrawal does not affect processing performed before it.'
            : 'Informațiile rămân în contul organizatorului pe durata gestionării evenimentului și până când acesta le șterge. Cere contactului de confidențialitate termenul exact, accesul, corectarea, ștergerea sau retragerea consimțământului. Retragerea nu afectează prelucrarea realizată anterior.'}
        </p>
        <h2>{en ? 'External map service' : 'Serviciu extern de hărți'}</h2>
        <p>
          {en
            ? 'If you choose “View map”, the address opens on Google Maps. Google then receives the usual connection information under its own privacy terms.'
            : 'Dacă alegi „Vezi harta”, adresa se deschide în Google Maps. Google primește atunci informațiile obișnuite ale conexiunii, conform propriilor condiții de confidențialitate.'}
        </p>
        <p className="muted">
          {en ? 'Notice version' : 'Versiunea notei'}: {PRIVACY_NOTICE_VERSION}
        </p>
        <Link href="/">{en ? 'Return to NuntaNoastră' : 'Înapoi la NuntaNoastră'}</Link>
      </article>
    </main>
  );
}
