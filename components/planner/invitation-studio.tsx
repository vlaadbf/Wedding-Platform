'use client';
import { useState } from 'react';
import { Data, Entity } from '@/lib/domain';
import {
  invitationTemplates,
  templateCategories,
  applyTemplate,
  templateFor,
} from '@/lib/invitation-templates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldControl, Pick } from './controls';
import { InvitationCard } from './invitation-card';

export function InvitationStudio({
  event,
  design,
  readOnly,
  onSave,
  onPublish,
  families,
  onLink,
}: {
  event: Data;
  design: Entity;
  readOnly: boolean;
  onSave: (data: Data) => Promise<unknown>;
  onPublish: (data: Data) => Promise<unknown>;
  families: Entity[];
  onLink: (id: string) => Promise<unknown>;
}) {
  const initialDraft = () =>
    design.data.template_id
      ? design.data
      : applyTemplate(design.data, templateFor(design.data).id);
  const [draft, setDraft] = useState<Data>(initialDraft);
  const [category, setCategory] = useState('Toate');
  const [query, setQuery] = useState('');
  const [mobile, setMobile] = useState(false);
  const [family, setFamily] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const template = templateFor(draft);
  const templates = invitationTemplates.filter(
    (t) =>
      (category === 'Toate' || t.category === category) &&
      `${t.name} ${t.description}`
        .toLocaleLowerCase('ro')
        .includes(query.toLocaleLowerCase('ro')),
  );
  function change(key: string, value: string | number | boolean) {
    setDraft({ ...draft, [key]: value });
    setDirty(true);
    setMessage('');
  }
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operațiunea nu a reușit.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="invitation-studio">
      <section className="template-library">
        <header className="template-library-header">
          <div>
            <p className="eyebrow">COLECȚIA PLANORA</p>
            <h2>O invitație la fel de unică precum voi.</h2>
            <p>10 modele · 5 categorii · personalizare în timp real</p>
          </div>
          <Input
            aria-label="Caută un model de invitație"
            placeholder="Caută un model…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </header>
        <div
          className="template-category-filter"
          aria-label="Categorii de invitații"
        >
          {['Toate', ...templateCategories].map((c) => (
            <Button
              key={c}
              variant={category === c ? 'default' : 'outline'}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c}
            </Button>
          ))}
        </div>
        <div className="template-gallery">
          {templates.map((t) => (
            <button
              className={
                'template-choice' + (template.id === t.id ? ' selected' : '')
              }
              key={t.id}
              disabled={readOnly || busy}
              aria-pressed={template.id === t.id}
              onClick={() => {
                setDraft(applyTemplate(draft, t.id));
                setDirty(true);
                setMessage('');
              }}
            >
              <div className="template-miniature" aria-hidden="true">
                <InvitationCard
                  event={event}
                  design={applyTemplate(
                    {
                      message:
                        'Să celebrăm împreună începutul poveștii noastre.',
                      partner1: draft.partner1,
                      partner2: draft.partner2,
                    },
                    t.id,
                  )}
                />
              </div>
              <div className="template-choice-caption">
                <small>{t.category}</small>
                <strong>{t.name}</strong>
                <span>{t.description}</span>
                <b>{template.id === t.id ? 'SELECTAT' : 'ALEGE MODELUL'}</b>
              </div>
            </button>
          ))}
        </div>
        {!templates.length && (
          <p>Niciun model găsit. Încearcă altă categorie sau alt nume.</p>
        )}
      </section>
      <div className="invitation-editor-workspace">
        <section className="panel invitation-editor">
          <h3>Personalizează „{template.name}”</h3>
          <p>
            Modelul schimbă aspectul. Mesajul, termenul RSVP și datele voastre
            se păstrează.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {message && (
            <output className="info-banner">
              {message}
            </output>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(
                () => onSave(draft),
                'Designul a fost salvat. Publică-l când este gata.',
              );
            }}
          >
            <fieldset disabled={readOnly || busy}>
              <div className="form-grid">
                {[
                  {
                    key: 'partner1',
                    label: 'Primul prenume',
                    default: event.data.partner1 || '',
                  },
                  {
                    key: 'partner2',
                    label: 'Al doilea prenume',
                    default: event.data.partner2 || '',
                  },
                  {
                    key: 'headline',
                    label: 'Titlu creativ',
                    default: template.headline,
                  },
                  ...(['editorial', 'festival', 'ticket'].includes(
                    template.layout,
                  )
                    ? [
                        {
                          key: 'masthead',
                          label: 'Titlu afiș / revistă',
                          type: 'textarea',
                        },
                      ]
                    : []),
                  {
                    key: 'eyebrow',
                    label: 'Text introductiv',
                    default: 'VĂ INVITĂM LA NUNTA NOASTRĂ',
                  },
                  {
                    key: 'message',
                    label: 'Mesajul vostru',
                    type: 'textarea',
                    required: true,
                  },
                  {
                    key: 'message_en',
                    label: 'Mesaj în engleză',
                    type: 'textarea',
                  },
                  {
                    key: 'location',
                    label: 'Locația afișată',
                    default: event.data.venue || event.data.city || '',
                  },
                  {
                    key: 'closing',
                    label: 'Text de încheiere',
                    default: 'Vă așteptăm cu drag.',
                  },
                  { key: 'dress_code', label: 'Dress code' },
                  { key: 'rsvp_deadline', label: 'Termen RSVP', type: 'date' },
                  { key: 'help', label: 'Contact pentru invitați' },
                  {
                    key: 'faq',
                    label: 'Întrebări frecvente',
                    type: 'textarea',
                  },
                  {
                    key: 'logistics',
                    label: 'Transport și cazare',
                    type: 'textarea',
                  },
                  {
                    key: 'color',
                    label: 'Culoare accent',
                    type: 'color',
                    default: template.color,
                  },
                  {
                    key: 'background',
                    label: 'Culoare fundal',
                    type: 'color',
                    default: template.background,
                  },
                  {
                    key: 'text_color',
                    label: 'Culoare text',
                    type: 'color',
                    default: template.text_color,
                  },
                ].map((f) => (
                  <FieldControl
                    key={f.key}
                    field={f}
                    value={draft[f.key] ?? f.default ?? ''}
                    onChange={(value) => change(f.key, value)}
                  />
                ))}
                <div className="form-field">
                  <span>Stilul literelor</span>
                  <Pick
                    label="Stilul literelor"
                    value={draft.font || template.font}
                    onChange={(v) => change('font', v)}
                    options={[
                      { value: 'serif', label: 'Elegant' },
                      { value: 'modern', label: 'Modern' },
                      { value: 'editorial', label: 'Editorial' },
                      { value: 'romantic', label: 'Romantic' },
                    ]}
                  />
                </div>
                <div className="form-field">
                  <span>Imagine</span>
                  <Pick
                    label="Imaginea invitației"
                    value={draft.artwork || 'auto'}
                    onChange={(v) => change('artwork', v)}
                    options={[
                      { value: 'auto', label: 'Imaginea modelului' },
                      { value: 'none', label: 'Fără imagine' },
                      { value: 'botanical', label: 'Flori pictate' },
                      { value: 'riviera', label: 'Lumină mediteraneană' },
                      { value: 'afterglow', label: 'Flori după apus' },
                    ]}
                  />
                </div>
              </div>
              <p className="muted">
                Data nunții se actualizează din setările evenimentului.
                Fotografiile sunt imagini artistice generate, fără legătură cu
                locația reală.
              </p>
              <div className="account-actions">
                <Button type="submit">Salvează designul</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    action(
                      () => onPublish(draft),
                      'Invitația a fost publicată. Linkurile familiilor folosesc noua versiune.',
                    )
                  }
                >
                  Salvează și publică
                </Button>
              </div>
            </fieldset>
          </form>
          {dirty && <output>Ai modificări nesalvate.</output>}
          <div className="divider" />
          <h4>Link personal pentru familie</h4>
          <Pick
            label="Alege familia"
            value={family}
            onChange={setFamily}
            options={families.map((f) => ({ value: f.id, label: f.data.name }))}
          />
          <Button
            variant="outline"
            disabled={!family || readOnly || busy}
            onClick={() => action(() => onLink(family), '')}
          >
            Deschide linkul RSVP
          </Button>
        </section>
        <section className="invitation-live-preview">
          <div className="preview-label">
            <span>PREVIZUALIZARE LIVE</span>
            <Button variant="ghost" onClick={() => setMobile(!mobile)}>
              {mobile ? 'Mărime normală' : 'Vezi pe telefon'}
            </Button>
          </div>
          <InvitationCard event={event} design={draft} mobile={mobile} />
          <p className="muted">
            Așa va arăta invitația. Formularul familiei apare sub ea.
          </p>
        </section>
      </div>
    </div>
  );
}
