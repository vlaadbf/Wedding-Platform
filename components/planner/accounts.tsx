'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import { ShieldCheck, Clock, LogOut, Eye, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Data } from '@/lib/domain';
import { api } from './controls';

export function AccountGate({
  me,
  onRefresh,
  onLogout,
}: {
  me: Data;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rejected = me.approval_status === 'rejected';
  const refreshRef = useRef(onRefresh);
  useEffect(() => { refreshRef.current = onRefresh; }, [onRefresh]);
  useEffect(() => {
    if (rejected) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        await refreshRef.current();
        if (!stopped) setError('');
      } catch {
        if (!stopped)
          setError('Conexiunea este întreruptă. Verificarea se reia automat.');
      }
      if (!stopped) timer = setTimeout(poll, 5000);
    };
    timer = setTimeout(poll, 5000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [rejected]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reîncearcă.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-gate">
      <section className="panel account-card">
        <Clock size={32} aria-hidden="true" />
        <h1>
          {rejected
            ? 'Cererea de acces a fost respinsă'
            : 'În așteptarea aprobării'}
        </h1>
        <p>
          Contul <strong>{me.email}</strong> a fost creat.
        </p>
        <p>
          {rejected
            ? 'Super adminul nu a aprobat cererea ta. Contactează administratorul pentru detalii.'
            : 'Super adminul trebuie să îți aprobe contul. Pagina se actualizează automat imediat ce aprobarea este disponibilă.'}
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="account-actions">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => action(onLogout)}
          >
            <LogOut />
            Deconectare
          </Button>
        </div>
      </section>
    </main>
  );
}

export function AdminAccounts({
  me,
  onEvents,
  onLogout,
  onAccount,
  onIntegrations,
}: {
  me: Data;
  onEvents: () => void;
  onLogout: () => Promise<void>;
  onAccount: (account: Data) => Promise<void>;
  onIntegrations: () => void;
}) {
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Data>({ accounts: [], hasMore: false });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [decision, setDecision] = useState<Data | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api(`admin/accounts?status=${status}&page=${page}`));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Lista nu a putut fi încărcată.',
      );
    } finally {
      setLoading(false);
    }
  }, [status, page]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  async function decide() {
    if (!decision || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api('admin/accounts/' + decision.id, 'POST', {
        status: decision.status,
      });
      setMessage(
        decision.status === 'approved'
          ? 'Contul a fost aprobat. Utilizatorul poate intra în aplicație.'
          : 'Cererea a fost respinsă.',
      );
      setDecision(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operațiunea a eșuat.');
    } finally {
      setBusy(false);
    }
  }
  const accounts = data.accounts.filter((account: Data) =>
    [account.name, account.email]
      .join(' ')
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const statusLabel: Record<string, string> = {
    pending: 'În așteptare',
    approved: 'Aprobat',
    rejected: 'Respins',
  };
  return (
    <main className="account-admin">
      <header className="account-admin-header">
        <div>
          <p className="eyebrow">
            <ShieldCheck size={18} /> SUPER ADMIN
          </p>
          <h1>Administrare conturi</h1>
          <p>{me.email}</p>
        </div>
        <div className="account-actions">
          <Button variant="outline" onClick={onEvents}>
            Eveniment propriu (opțional)
          </Button>
          <Button variant="outline" onClick={onIntegrations}>Integrări</Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await onLogout();
              } catch {
                setError('Deconectarea nu a reușit.');
              }
            }}
          >
            Deconectare
          </Button>
        </div>
      </header>
      <section className="panel account-card">
        <h2>Conturi clienți</h2>
        <p>
          Găsește clientul și apasă <strong>Deschide contul</strong> pentru a-i
          consulta evenimentele. Bara de sus te aduce oricând înapoi la această
          listă.
        </p>
        <div className="account-search">
          <Search size={18} aria-hidden="true" />
          <Input
            aria-label="Caută un cont"
            placeholder="Caută după nume sau email…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="account-actions" aria-label="Filtre conturi">
          {[
            ['all', 'Toate conturile'],
            ['pending', 'În așteptare'],
            ['approved', 'Aprobate'],
            ['rejected', 'Respinse'],
          ].map(([value, label]) => (
            <Button
              key={value}
              variant={status === value ? 'default' : 'outline'}
              disabled={busy}
              aria-pressed={status === value}
              onClick={() => {
                setStatus(value);
                setPage(1);
                setDecision(null);
                setMessage('');
              }}
            >
              {label}
            </Button>
          ))}
          <Button variant="ghost" disabled={loading || busy} onClick={load}>
            Reîncarcă
          </Button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && <output>{message}</output>}
        {decision && (
          <fieldset
            className="account-decision"
            aria-label="Confirmarea deciziei"
          >
            <p>
              {decision.status === 'approved'
                ? 'Aprobi accesul pentru'
                : 'Respingi cererea pentru'}{' '}
              <strong>{decision.email}</strong>?
            </p>
            <div className="account-actions">
              <Button disabled={busy} onClick={decide}>
                {busy ? 'Se salvează…' : 'Confirmă'}
              </Button>
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => setDecision(null)}
              >
                Anulează
              </Button>
            </div>
          </fieldset>
        )}
        {loading ? (
          <output>Încărcăm conturile…</output>
        ) : (
          <>
            {!accounts.length && !error && (
              <p>
                {query
                  ? 'Nu am găsit niciun cont pentru această căutare.'
                  : 'Nu există conturi în această categorie.'}
              </p>
            )}
            <div className="account-list">
              {accounts.map((account: Data) => (
                <article key={account.id} className="account-row">
                  <div>
                    <strong>{account.name}</strong>
                    <p>{account.email}</p>
                    <small>
                      <span className={`account-status account-status-${account.approval_status}`}>
                        {statusLabel[account.approval_status] || account.approval_status}
                      </span>
                      {' · '}
                      Creat:{' '}
                      {new Date(account.created_at).toLocaleString('ro-RO')}
                    </small>
                  </div>
                  <div className="account-row-actions">
                    <Button
                      variant={account.approval_status === 'approved' ? 'default' : 'outline'}
                      disabled={busy}
                      aria-label={`Deschide contul ${account.name}`}
                      onClick={async () => {
                        setBusy(true);
                        setError('');
                        try {
                          await onAccount(account);
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : 'Contul nu a putut fi deschis.',
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Eye />
                      Deschide contul
                    </Button>
                    {account.approval_status === 'pending' && (
                      <div className="account-actions">
                      <Button
                        disabled={busy}
                        onClick={() =>
                          setDecision({ ...account, status: 'approved' })
                        }
                      >
                        Aprobă
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          setDecision({ ...account, status: 'rejected' })
                        }
                      >
                        Respinge
                      </Button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <div className="account-actions">
              <Button
                variant="outline"
                disabled={page === 1 || busy}
                onClick={() => setPage(page - 1)}
              >
                Înapoi
              </Button>
              <span>Pagina {page}</span>
              <Button
                variant="outline"
                disabled={!data.hasMore || busy}
                onClick={() => setPage(page + 1)}
              >
                Înainte
              </Button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
