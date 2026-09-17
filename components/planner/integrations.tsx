'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Data } from '@/lib/domain';
import { api } from './controls';

export function AdminIntegrations({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [values, setValues] = useState<Data>({});
  const [clear, setClear] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    const result = await api('admin/integrations');
    setData(result);
    setValues({});
    setClear([]);
  }
  useEffect(() => {
    Promise.resolve().then(load).catch((e) => setError(e.message));
  }, []);
  return (
    <main className="account-admin">
      <header className="account-admin-header">
        <div>
          <p className="eyebrow">SUPER ADMIN</p>
          <h1>Integrări</h1>
          <p>Configurarea serviciilor pentru întreaga aplicație.</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Înapoi la conturi
        </Button>
      </header>
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
      {!data ? (
        <p>Încărcăm configurarea…</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setMessage('');
            try {
              await api('admin/integrations', 'POST', {
                revision: data.revision,
                values,
                clear,
              });
              await load();
              setMessage(
                'Configurarea a fost salvată. Cheile sunt ascunse și se folosesc la următoarea operațiune.',
              );
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'Salvarea nu a reușit.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {!data.protected && (
            <p role="alert">
              Salvarea necesită inițializarea protecției pe server.
            </p>
          )}
          <p className="info-banner">
            Completează valorile primite de la furnizori. Câmpurile lăsate goale
            păstrează configurarea existentă. Cheile salvate nu pot fi afișate;
            le poți înlocui sau șterge.
          </p>
          {['Email', 'SMS și WhatsApp', 'Procesare automată', 'Control demo'].map((group) => (
            <section
              key={group}
              className="panel account-card integration-settings-group"
            >
              <h2>{group}</h2>
              {group === 'Email' && (
                <p>
                  Verifică domeniul expeditorului în Resend. Adresa webhookului
                  pentru livrări:{' '}
                  <code>
                    {typeof location === 'undefined' ? '' : location.origin}
                    /api/webhooks/resend
                  </code>
                  .
                </p>
              )}
              {group === 'SMS și WhatsApp' && (
                <p>
                  Folosește expeditorii activați în Twilio și șablonul WhatsApp
                  aprobat. Callback pentru livrări:{' '}
                  <code>
                    {typeof location === 'undefined' ? '' : location.origin}
                    /api/webhooks/twilio
                  </code>
                  .
                </p>
              )}
              {group === 'Procesare automată' && (
                <p>
                  Configurează separat un proces care apelează POST{' '}
                  <code>/api/jobs</code> în fiecare minut, cu antetul{' '}
                  <code>Authorization: Bearer</code> urmat de cheia de mai jos.
                  Salvarea cheii nu pornește acel proces.
                </p>
              )}
              {group === 'Control demo' && (
                <p>
                  Limitează crearea automată de conturi demonstrative. Valorile implicite
                  sunt 3 conturi pe oră pentru fiecare adresă IP și maximum 200 de conturi
                  demo cu sesiune activă.
                </p>
              )}
              <div className="form-grid">
                {data.fields
                  .filter((f: Data) => f.group === group)
                  .map((f: Data) => (
                    <div className="form-field" key={f.key}>
                      <label htmlFor={'integration-' + f.key}>{f.label}</label>
                      <Input
                        id={'integration-' + f.key}
                        type={f.secret ? 'password' : 'text'}
                        autoComplete="off"
                        spellCheck={false}
                        value={values[f.key] ?? (f.secret ? '' : f.value)}
                        disabled={busy || clear.includes(f.key)}
                        placeholder={
                          f.secret && f.configured
                            ? 'Valoare salvată · lasă gol pentru păstrare'
                            : ''
                        }
                        onChange={(e) =>
                          setValues({ ...values, [f.key]: e.target.value })
                        }
                      />
                      <small>
                        {f.configured ? 'Valoare configurată' : 'Neconfigurat'}
                      </small>
                      {f.configured && (
                        <label className="integration-clear">
                          <input
                            type="checkbox"
                            checked={clear.includes(f.key)}
                            disabled={busy}
                            onChange={(e) =>
                              setClear(
                                e.target.checked
                                  ? [...clear, f.key]
                                  : clear.filter((key) => key !== f.key),
                              )
                            }
                          />
                          Șterge valoarea salvată
                        </label>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          ))}
          <section className="panel account-card integration-settings-group">
            <h2>Starea configurării</h2>
            {data.integrations.map((i: Data) => (
              <p key={i.id}>
                <strong>{i.name}</strong> ·{' '}
                {i.configured
                  ? 'Date necesare completate'
                  : 'Configurare incompletă'}
                {i.id === 'stripe' &&
                  ' — plățile online nu sunt încă implementate.'}
              </p>
            ))}
            <p>
              Completarea datelor nu confirmă validitatea cheilor sau livrarea
              mesajelor. Această pagină nu trimite mesaje de test.
            </p>
          </section>
          <div className="account-actions">
            <Button type="submit" disabled={busy || !data.protected}>
              {busy ? 'Se salvează…' : 'Salvează configurarea'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setError('');
                load().catch((e) => setError(e.message));
              }}
            >
              Reîncarcă valorile salvate
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
