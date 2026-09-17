'use client';
import { memo, ReactNode } from 'react';
import { Archive, Check, Palette, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Data } from '@/lib/domain';
import { userThemes } from '@/lib/themes';
import { Badge } from '../controls';

const formatDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(value + 'T12:00:00'))
    : 'De stabilit';

export const SettingsPage = memo(function SettingsPage({
  event,
  me,
  subevents,
  editEvent,
  verifyEmail,
  closeSessions,
  openAudit,
  openTrash,
  changeTheme,
}: {
  event: Data;
  me: Data;
  subevents: ReactNode;
  editEvent: () => void;
  verifyEmail: () => void;
  closeSessions: () => void;
  openAudit: () => void;
  openTrash: () => void;
  changeTheme: (theme: string) => void;
}) {
  const data = event.data || {};
  return (
    <div className="settings-grid">
      <section className="panel theme-panel full">
        <div className="panel-heading">
          <div>
            <h3><Palette /> Tema aplicației</h3>
            <p>Culorile sunt salvate în contul tău și te urmează pe orice dispozitiv.</p>
          </div>
        </div>
        <div className="theme-options" role="radiogroup" aria-label="Tema aplicației">
          {userThemes.map((theme) => {
            const selected = (me.theme || 'sand') === theme.id;
            return (
              <label
                className={`theme-option${selected ? ' selected' : ''}`}
                key={theme.id}
              >
                <input
                  type="radio"
                  name="user-theme"
                  value={theme.id}
                  checked={selected}
                  onChange={() => changeTheme(theme.id)}
                />
                <span className="theme-swatches" aria-hidden="true">
                  {theme.colors.map((color) => (
                    <i key={color} style={{ backgroundColor: color }} />
                  ))}
                </span>
                <span>
                  <strong>{theme.name}</strong>
                  <small>{theme.description}</small>
                </span>
                {selected && <Check className="theme-check" aria-hidden="true" />}
              </label>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div><h3>Evenimentul vostru</h3><p>Datele care țin totul împreună.</p></div>
          <Button variant="outline" onClick={editEvent}>Editează</Button>
        </div>
        <dl className="settings-list">
          <div><dt>Nume</dt><dd>{event.name}</dd></div>
          <div><dt>Data</dt><dd>{formatDate(data.date)}</dd></div>
          <div><dt>Locație</dt><dd>{data.venue || 'De stabilit'}</dd></div>
          <div><dt>Fus orar</dt><dd>{data.timezone}</dd></div>
          <div><dt>Moneda</dt><dd>{data.currency}</dd></div>
          <div><dt>Numele platformei</dt><dd>{data.app_name || 'Planora'}</dd></div>
          <div><dt>Operator date</dt><dd>{data.privacy_operator || 'De configurat'}</dd></div>
          <div><dt>Contact confidențialitate</dt><dd>{data.privacy_contact || 'De configurat'}</dd></div>
        </dl>
      </section>
      <section className="panel">
        <div className="panel-heading"><h3>Cont & siguranță</h3></div>
        <div className="settings-actions">
          <p>{me.email}</p>
          <Badge value={me.demo ? 'Cont demonstrativ' : me.verified ? 'Email verificat' : 'Email neverificat'} />
          {!me.demo && !me.verified && <Button variant="outline" onClick={verifyEmail}>Verifică emailul</Button>}
          <Button variant="outline" onClick={closeSessions}>Închide toate sesiunile</Button>
          <Button variant="outline" onClick={openAudit}><ShieldCheck />Jurnal de audit</Button>
          <Button variant="outline" onClick={openTrash}><Archive />Elemente șterse</Button>
        </div>
      </section>
      <div className="full"><h3 className="subheading">Momentele evenimentului</h3>{subevents}</div>
    </div>
  );
});
