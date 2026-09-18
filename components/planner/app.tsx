'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Heart,
  LayoutDashboard,
  Users,
  Mail,
  Armchair,
  Wallet,
  Store,
  CheckSquare,
  CalendarDays,
  Truck,
  Hotel,
  ClipboardCheck,
  ChartNoAxesCombined,
  Settings,
  UserRoundPlus,
  Bell,
  Search,
  Plus,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Download,
  Upload,
  MoreHorizontal,
  Check,
  LogOut,
  FileText,
  Send,
  Link as LinkIcon,
  Copy,
  Trash2,
  RotateCcw,
  Grip,
  Utensils,
  Flower2,
  ShieldCheck,
  Loader2,
  X,
  Eye,
  EyeOff,
  LockKeyhole,
  UserRound,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Data,
  Entity,
  schemas,
  labels,
  list,
  money,
  parseMoney,
  parseCSV,
  permission,
} from '@/lib/domain';
import {
  Pick,
  Fields,
  FieldControl,
  TabBar,
  Empty,
  Badge,
  api,
  setAccountScope,
  scopedUrl,
} from './controls';
import { QRCode, ColumnMapping, readSpreadsheet } from './files';
import { AccountGate, AdminAccounts } from './accounts';
import { AdminIntegrations } from './integrations';
import { floorPosition } from '@/lib/floor-geometry';
import { ReportsPage } from './pages/reports';
import { TeamPage } from './pages/team';
import { DocumentsPage } from './pages/documents';
import { GenericPage } from './pages/generic';
import { SettingsPage } from './pages/settings';
import { BudgetPage } from './pages/budget';
import { TasksPage } from './pages/tasks';
import { InvitationsPage } from './pages/invitations';
import { CheckinPage } from './pages/checkin';
import { DashboardPage } from './pages/dashboard';
const navGroups = [
  {
    label: 'PLANIFICARE',
    items: [
      ['dashboard', 'Privire de ansamblu', LayoutDashboard],
      ['guest', 'Invitați', Users],
      ['invitation', 'Invitații digitale', Mail],
      ['floor', 'Planul meselor', Armchair],
      ['expense', 'Buget & plăți', Wallet],
      ['vendor', 'Furnizori', Store],
      ['task', 'Sarcini', CheckSquare],
    ],
  },
  {
    label: 'ZIUA NOASTRĂ',
    items: [
      ['timeline', 'Program & calendar', CalendarDays],
      ['menu', 'Meniuri', Utensils],
      ['transport', 'Transport', Truck],
      ['accommodation', 'Cazare', Hotel],
      ['checkin', 'Check-in', ClipboardCheck],
    ],
  },
  {
    label: 'ORGANIZARE',
    items: [
      ['reports', 'Rapoarte', ChartNoAxesCombined],
      ['document', 'Documente', FileText],
      ['team', 'Echipă', UserRoundPlus],
      ['settings', 'Setări', Settings],
    ],
  },
];
const date = (s: string) =>
  s
    ? new Intl.DateTimeFormat('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(s + 'T12:00:00'))
    : 'Data nu este stabilită';
export default function Planner() {
  const [today] = useState(() => Date.now());
  const [adminView, setAdminView] = useState(true);
  const [adminIntegrations, setAdminIntegrations] = useState(false);
  const [viewedAccount, setViewedAccount] = useState<Data | null>(null);
  const [me, setMe] = useState<Data | null | undefined>(undefined),
    [events, setEvents] = useState<Data[]>([]),
    [eventId, setEventId] = useState(''),
    [state, setState] = useState<Data | null>(null),
    [page, setPage] = useState('dashboard'),
    [tab, setTab] = useState(''),
    [q, setQ] = useState(''),
    [filter, setFilter] = useState('all'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [modal, setModal] = useState<Data | null>(null),
    [form, setForm] = useState<Data>({}),
    [confirmation, setConfirmation] = useState<null | (() => Promise<void>)>(
      null,
    ),
    [extras, setExtras] = useState<Data>({}),
    [selection, setSelection] = useState<string[]>([]),
    [pageNumber, setPageNumber] = useState(1),
    [online, setOnline] = useState(true);
  const es: Entity[] = state?.entities || [],
    event = state?.event,
    ed = event?.data || {},
    s = state?.summary || {},
    base = 'events/' + eventId;
  useEffect(() => {
    document.documentElement.dataset.theme = String(me?.theme || 'sand');
  }, [me?.theme]);
  const can = (kind: string, action = 'view') =>
    (!viewedAccount || ['view', 'export'].includes(action)) &&
    permission(state?.role, kind, action, state?.grants || {});
  const refresh = useCallback(async (id: string) => {
    if (!id) return;
    const data = await api('events/' + id);
    setState(data);
  }, []);
  const loadEvents = useCallback(async (preferred?: string, createWhenEmpty = true) => {
    const d = await api('events');
    setEvents(d.events);
    if (d.events.length) {
      const id =
        preferred || sessionStorage.getItem('nn_event') || d.events[0].id;
      setEventId(d.events.some((e: Data) => e.id === id) ? id : d.events[0].id);
    } else {
      setForm({
        currency: 'RON',
        timezone: 'Europe/Bucharest',
        language: 'ro',
        budget: 0,
        app_name: 'Planora',
        ...JSON.parse(sessionStorage.getItem('event-draft') || '{}'),
      });
      setModal(createWhenEmpty ? { type: 'event' } : null);
    }
  }, []);
  useEffect(() => {
    if (new URLSearchParams(location.search).has('account_token')) {
      queueMicrotask(() => setMe(null));
      return;
    }
    api('me')
      .then((d) => {
        setMe(d.user);
        if (
          d.user &&
          (d.user.demo || d.user.approval_status === 'approved') &&
          d.user.platform_role !== 'super_admin'
        ) {
          void loadEvents();
          const t = new URLSearchParams(location.search).get('team_token');
          if (t)
            api('team-accept', 'POST', { token: t })
              .then((r) => {
                void loadEvents(r.event_id);
                history.replaceState(null, '', '/');
              })
              .catch((e) => setError(e.message));
        }
      })
      .catch((e) => {
        setError(e.message);
        setMe(null);
      });
    const change = () => setOnline(navigator.onLine);
    window.addEventListener('online', change);
    window.addEventListener('offline', change);
    change();
    return () => {
      window.removeEventListener('online', change);
      window.removeEventListener('offline', change);
    };
  }, [loadEvents]);
  useEffect(() => {
    if (eventId) {
      sessionStorage.setItem('nn_event', eventId);
      void Promise.resolve().then(async () => { await refresh(eventId); setSelection([]); setQ(''); }).catch((e) => setError(e.message));
    }
  }, [eventId, refresh]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (navGroups.some((g) => g.items.some((i) => i[0] === hash)))
      queueMicrotask(() => setPage(hash));
  }, []);
  const run = async <T,>(
    fn: () => Promise<T>,
    message = 'Modificările au fost salvate.',
  ) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await fn();
      if (eventId && me)
        await refresh(eventId).catch((e) => {
          if (!e.message.startsWith('Autentifică-te')) throw e;
        });
      if (message) setToast(message);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operațiunea nu a reușit.');
      return null;
    } finally {
      setBusy(false);
    }
  };
  function navigate(p: string, f = 'all') {
    setPage(p);
    setTab(p === 'guest' ? (f === 'all' ? 'household' : 'guest') : '');
    setQ('');
    setFilter(f);
    setSelection([]);
    setPageNumber(1);
    setExtras({});
    window.location.hash = p;
    if (['team', 'document'].includes(p))
      api(base + '/' + (p === 'document' ? 'documents' : 'team'))
        .then(setExtras)
        .catch((e) => setError(e.message));
  }
  const edit = (kind: string, record?: Entity, defaults: Data = {}) => {
    const d: Data = {};
    for (const f of schemas[kind].fields)
      d[f.key] = record?.data[f.key] ?? defaults[f.key] ?? f.default ?? '';
    if (
      kind === 'household' &&
      record &&
      record.data.self_registration === undefined
    )
      d.self_registration = false;
    for (const f of schemas[kind].fields)
      if (f.type === 'money') d[f.key] = String((d[f.key] || 0) / 100);
    if (!record) {
      const saved = sessionStorage.getItem(`draft:${eventId}:${kind}`);
      if (saved)
        try {
          Object.assign(d, JSON.parse(saved), defaults);
        } catch {}
    }
    setForm(d);
    setModal({ type: 'entity', kind, id: record?.id });
  };
  const saveEntity = async () => {
    const data = { ...form };
    for (const f of schemas[modal!.kind].fields)
      if (f.type === 'money') data[f.key] = parseMoney(data[f.key]);
    const r = await api(
      base + '/records/' + modal!.kind + (modal!.id ? '/' + modal!.id : ''),
      modal!.id ? 'PATCH' : 'POST',
      { data, version: event.version },
    );
    sessionStorage.removeItem(`draft:${eventId}:${modal!.kind}`);
    setModal(null);
    return r;
  };
  const setDraft = (d: Data) => {
    setForm(d);
    if (modal?.type === 'entity' && !modal.id)
      sessionStorage.setItem(
        `draft:${eventId}:${modal.kind}`,
        JSON.stringify(d),
      );
  };
  const remove = (kind: string, id: string) =>
    setConfirmation(() => async () => {
      await api(base + '/records/' + kind + '/' + id, 'DELETE', {
        version: event.version,
      });
    });
  const update = async (r: Entity, changes: Data) =>
    api(base + '/records/' + r.kind + '/' + r.id, 'PATCH', {
      data: { ...r.data, ...changes },
      version: event.version,
    });
  const title =
    (navGroups
      .flatMap((g) => g.items)
      .find((i) => i[0] === page)?.[1] as string) || 'Notificări';
  const primaryKind =
    (
      {
        dashboard: 'guest',
        guest: tab || 'household',
        floor: 'table',
        checkin: 'guest',
        reports: 'guest',
        settings: 'subevent',
        invitation:
          tab === 'campaigns'
            ? 'campaign'
            : tab === 'automation'
              ? 'automation'
              : 'invitation',
      } as Data
    )[page] || page;
  function add() {
    if (primaryKind === 'campaign') {
      setForm({
        channel: 'email',
        type: 'invitation',
        name: 'Invitația noastră',
        message:
          'Dragă {family}, vă invităm la nunta {couple}, pe {date}. Confirmați aici: {link}',
        date: '',
        time: '10:00',
      });
      setExtras({});
      setModal({ type: 'campaign' });
    } else if (page === 'team') {
      setForm({ role: 'partner', email: '' });
      setModal({ type: 'team' });
    } else if (page === 'document') {
      setModal({ type: 'document' });
    } else edit(primaryKind);
  }
  const exportList = (kind: string, format = 'csv') => {
    window.location.assign(scopedUrl(
      base +
        '/export?kind=' +
        kind +
        '&format=' +
        format +
        '&q=' +
        encodeURIComponent(q) +
        (filter !== 'all' ? '&status=' + filter : ''),
    ));
  };
  const publicLink = async (household_id: string) => {
    const r = await api(base + '/invite-link', 'POST', {
      household_id,
      version: event.version,
    });
    setExtras({ link: r.url });
    setModal({ type: 'link' });
  };
  const stat = (g: Entity) =>
    list(es, 'rsvp').find(
      (r) => r.data.guest_id === g.id && r.data.subevent_id === s.reception,
    )?.data.status || 'pending';
  const nameOf = (id: string) => es.find((e) => e.id === id)?.data.name || '—';
  const blank = (
    <Empty
      title="Încă nu ai adăugat nimic aici"
      text="Fiecare detaliu bun începe cu un prim pas."
      action={
        can(primaryKind, 'create') ? (
          <Button onClick={add}>
            <Plus />
            Adaugă
          </Button>
        ) : undefined
      }
    />
  );
  const genericPage = (kind: string) => (
    <GenericPage
      kind={kind}
      entities={es}
      query={q}
      currency={ed.currency}
      setQuery={setQ}
      can={can}
      exportList={exportList}
      edit={edit}
      remove={remove}
      nameOf={nameOf}
      invitationLink={(householdId) =>
        void run(() => publicLink(householdId), '')
      }
    />
  );
  if (me === undefined)
    return (
      <div className="boot">
        <Heart />
        <p>Pregătim spațiul vostru…</p>
      </div>
    );
  if (!me)
    return (
      <AuthScreen
        error={error}
        busy={busy}
        onAction={(mode: string, d: Data) =>
          run(async () => {
            const r = await api('auth/' + mode, 'POST', d);
            if (r.user) {
              setMe(r.user);
              setAdminView(true);
              if (
                (!r.user.demo && r.user.approval_status !== 'approved') ||
                r.user.platform_role === 'super_admin'
              )
                return r;
              await loadEvents(r.event_id);
              const t = new URLSearchParams(location.search).get('team_token');
              if (t) {
                const accepted = await api('team-accept', 'POST', { token: t });
                await loadEvents(accepted.event_id);
                history.replaceState(null, '', '/');
              }
            }
            return r;
          }, '')
        }
      />
    );
  const logoutAccount = async () => {
    await api('auth/logout', 'POST', {});
    setMe(null);
    setState(null);
    setEventId('');
    setEvents([]);
    setModal(null);
    setAccountScope('');
    setViewedAccount(null);
  };
  if (!me.demo && me.approval_status !== 'approved')
    return (
      <AccountGate
        me={me}
        onLogout={logoutAccount}
        onRefresh={async () => {
          const d = await api('me');
          setMe(d.user);
          if (
            d.user?.approval_status === 'approved' &&
            d.user.platform_role !== 'super_admin'
          ) {
            const t = new URLSearchParams(location.search).get('team_token');
            if (t) {
              const accepted = await api('team-accept', 'POST', { token: t });
              await loadEvents(accepted.event_id);
              history.replaceState(null, '', '/');
            } else await loadEvents();
          }
        }}
      />
    );
  if (!me.demo && me.platform_role === 'super_admin' && adminView)
    if (adminIntegrations)
      return <AdminIntegrations onBack={() => setAdminIntegrations(false)} />;
  if (!me.demo && me.platform_role === 'super_admin' && adminView)
    return (
      <AdminAccounts
        me={me}
        onIntegrations={() => setAdminIntegrations(true)}
        onLogout={logoutAccount}
        onAccount={async (account) => {
          setAccountScope(account.id);
          try {
            const d = await api('events');
            setViewedAccount(account);
            setState(null);
            setExtras({});
            setModal(null);
            setEvents(d.events);
            setEventId(d.events[0]?.id || '');
            setPage('dashboard');
            setTab('');
            setError('');
            setAdminView(false);
          } catch (e) {
            setAccountScope('');
            throw e;
          }
        }}
        onEvents={() => {
          setAccountScope('');
          setViewedAccount(null);
          setEventId('');
          setState(null);
          setAdminView(false);
          loadEvents(undefined, false).catch((e) => setError(e.message));
        }}
      />
    );
  const GuestTable = () => {
    const guests = list(es, 'guest').filter(
      (g) =>
        (!q ||
          [g.data.name, g.data.email, nameOf(g.data.household_id), g.data.tags]
            .join(' ')
            .toLowerCase()
            .includes(q.toLowerCase())) &&
        (filter === 'all' || filter === 'unseated'
          ? filter !== 'unseated' ||
            (stat(g) === 'confirmed' &&
              !list(es, 'assignment').some(
                (a) =>
                  a.data.guest_id === g.id &&
                  a.data.subevent_id === s.reception,
              ))
          : stat(g) === filter),
    );
    guests.sort((a, b) => a.data.name.localeCompare(b.data.name, 'ro'));
    const pages = Math.max(1, Math.ceil(guests.length / 12));
    return (
      <>
        <div className="section-toolbar">
          <div className="search-control">
            <Search size={17} />
            <Input
              aria-label="Caută un invitat"
              placeholder="Caută nume, familie sau etichetă…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPageNumber(1);
              }}
            />
          </div>
          <Pick
            label="Status RSVP"
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPageNumber(1);
            }}
            options={[
              { value: 'all', label: 'Toate răspunsurile' },
              ...['confirmed', 'pending', 'declined', 'unseated'].map(
                (value) => ({
                  value,
                  label: labels[value] || 'Fără loc la masă',
                }),
              ),
            ]}
          />
          {can('guest', 'export') && (
            <div className="row-actions">
              <Button variant="outline" onClick={() => exportList('guest')}>
                <Download />
                CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => exportList('guest', 'xlsx')}
              >
                XLSX
              </Button>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setModal({ type: 'import' });
              setForm({
                text: 'name,family,email,age\nAna Exemplu,Familia Exemplu,ana@example.invalid,adult\nMihai Exemplu,Familia Exemplu,,adult',
                duplicate_policy: 'skip',
              });
              setExtras({});
            }}
          >
            <Upload />
            Importă
          </Button>
        </div>
        {selection.length > 0 && (
          <div className="selection-bar">
            {selection.length} persoane selectate{' '}
            <Button
              variant="outline"
              onClick={() => {
                setModal({ type: 'bulk' });
                setForm({ status: 'confirmed' });
              }}
            >
              Înregistrează RSVP
            </Button>
            <Button variant="ghost" onClick={() => setSelection([])}>
              Anulează selecția
            </Button>
          </div>
        )}
        {guests.length ? (
          <div className="panel table-panel">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="check-cell">
                    <Checkbox
                      aria-label="Selectează pagina"
                      checked={guests
                        .slice((pageNumber - 1) * 12, pageNumber * 12)
                        .every((g) => selection.includes(g.id))}
                      onCheckedChange={(v) =>
                        setSelection(
                          v
                            ? guests
                                .slice((pageNumber - 1) * 12, pageNumber * 12)
                                .map((g) => g.id)
                            : [],
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>Invitat</TableHead>
                  <TableHead>Din partea</TableHead>
                  <TableHead>Confirmare</TableHead>
                  <TableHead>Meniu</TableHead>
                  <TableHead>Masă</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests
                  .slice((pageNumber - 1) * 12, pageNumber * 12)
                  .map((g, i) => {
                    const a = list(es, 'assignment').find(
                      (a) =>
                        a.data.guest_id === g.id &&
                        a.data.subevent_id === s.reception,
                    );
                    return (
                      <TableRow key={g.id}>
                        <TableCell>
                          <Checkbox
                            aria-label={'Selectează ' + g.data.name}
                            checked={selection.includes(g.id)}
                            onCheckedChange={(v) =>
                              setSelection(
                                v
                                  ? [...selection, g.id]
                                  : selection.filter((id) => id !== g.id),
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            className="person-button"
                            onClick={() => edit('guest', g)}
                          >
                            <span className={'avatar avatar-' + (i % 4)}>
                              {g.data.name
                                .split(' ')
                                .map((x: string) => x[0])
                                .slice(0, 2)
                                .join('')}
                            </span>
                            <span>
                              <strong>{g.data.name}</strong>
                              <small>
                                {nameOf(g.data.household_id)}
                                {g.data.age === 'copil' ? ' · Copil' : ''}
                              </small>
                            </span>
                          </button>
                        </TableCell>
                        <TableCell>{g.data.relationship}</TableCell>
                        <TableCell>
                          <button
                            onClick={() =>
                              edit(
                                'rsvp',
                                list(es, 'rsvp').find(
                                  (r) =>
                                    r.data.guest_id === g.id &&
                                    r.data.subevent_id === s.reception,
                                ),
                                { guest_id: g.id, subevent_id: s.reception },
                              )
                            }
                          >
                            <Badge value={stat(g)} />
                          </button>
                        </TableCell>
                        <TableCell>{nameOf(g.data.menu_id)}</TableCell>
                        <TableCell>
                          {a ? (
                            <span className="table-chip">
                              <Armchair size={14} />
                              {nameOf(a.data.table_id)}
                            </span>
                          ) : (
                            <span className="muted">Nerepartizat</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={'Detalii ' + g.data.name}
                            onClick={() => {
                              setModal({ type: 'guest-detail', guest: g });
                              setExtras({});
                            }}
                          >
                            <MoreHorizontal />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
            <div className="pagination-row">
              <span>
                {guests.length} persoane · {list(es, 'household').length}{' '}
                familii
              </span>
              <div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Pagina precedentă"
                  disabled={pageNumber === 1}
                  onClick={() => setPageNumber((n) => n - 1)}
                >
                  <ChevronLeft />
                </Button>
                <span>
                  {pageNumber} / {pages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Pagina următoare"
                  disabled={pageNumber >= pages}
                  onClick={() => setPageNumber((n) => n + 1)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          blank
        )}
      </>
    );
  };
  const renderPage = () => {
    if (viewedAccount && !eventId)
      return (
        <Empty
          title="Acest cont nu are încă evenimente"
          text={viewedAccount.email}
        />
      );
    if (!eventId && !me.demo && me.platform_role === 'super_admin')
      return (
        <Empty
          title="Nu ai un eveniment personal"
          text="Crearea unui eveniment este opțională pentru contul de super admin. Poți administra conturile și integrările fără un eveniment propriu."
          action={
            <Button
              onClick={() => {
                setForm({
                  currency: 'RON',
                  timezone: 'Europe/Bucharest',
                  language: 'ro',
                  budget: 0,
                  app_name: 'Planora',
                });
                setModal({ type: 'event' });
              }}
            >
              <Plus />
              Creează un eveniment personal
            </Button>
          }
        />
      );
    if (!state)
      return (
        <div className="boot">
          <Loader2 className="spin" />
          <p>Încărcăm evenimentul…</p>
        </div>
      );
    if (page === 'dashboard')
      return (
        <DashboardPage
          event={event}
          entities={es}
          stats={s}
          today={today}
          jobs={state.jobs || []}
          edit={edit}
          navigate={navigate}
          setTab={setTab}
          completeTask={(task) => void run(() => update(task, { status: 'done' }))}
        />
      );
    if (page === 'guest')
      return (
        <>
          <TabBar
            value={tab || 'household'}
            onChange={setTab}
            items={[
              { value: 'household', label: `Familii (${s.households})` },
              { value: 'guest', label: `Persoane (${s.total})` },
              {
                value: 'guest_invitation',
                label: 'Invitații pe subevenimente',
              },
            ]}
          />
          {(!tab || tab === 'household') && (
            <p className="info-banner">
              Adaugă familia, datele de contact și locurile rezervate. Invitatul
              completează persoanele în invitație; acestea apar apoi în fila
              Persoane, pentru meniuri și mese.
            </p>
          )}
          {tab === 'guest'
            ? GuestTable()
            : genericPage(tab || 'household')}
        </>
      );
    if (page === 'expense') {
      const current = tab || 'expense';
      return (
        <BudgetPage
          current={current}
          currency={ed.currency}
          budget={ed.budget}
          estimated={s.estimated}
          contracted={s.contracted}
          paid={s.paid}
          content={genericPage(current)}
          setTab={setTab}
          formatMoney={money}
        />
      );
    }
    if (page === 'task')
      return (
        <TasksPage
          view={tab || 'kanban'}
          tasks={list(es, 'task')}
          listContent={genericPage('task')}
          setTab={setTab}
          edit={(record, initial) => edit('task', record, initial)}
          move={(record, status) => void run(() => update(record, { status }))}
          formatDate={date}
        />
      );
    if (page === 'invitation') {
      const mode = tab || 'design';
      return (
        <InvitationsPage
          mode={mode}
          event={event}
          entities={es}
          jobs={state.jobs || []}
          blank={blank}
          alternateContent={genericPage(mode === 'rsvp' ? 'rsvp' : 'automation')}
          canEdit={can('invitation', 'edit')}
          setTab={setTab}
          openCampaign={() => {
            setTab('campaigns');
            setForm({
              channel: 'email',
              type: 'invitation',
              name: 'Invitația noastră',
              message:
                'Dragă {family}, vă invităm la nunta {couple}, pe {date}. Confirmați aici: {link}',
              date: '',
              time: '10:00',
            });
            setModal({ type: 'campaign' });
            setExtras({});
          }}
          save={async (design, data) => {
            const result = await api(
              base + '/records/invitation/' + design.id,
              'PATCH',
              { data, version: event.version },
            );
            await refresh(eventId);
            return result;
          }}
          publish={async (design, data) => {
            const saved = await api(
              base + '/records/invitation/' + design.id,
              'PATCH',
              { data, version: event.version },
            );
            const result = await api(base + '/publish', 'POST', {
              id: design.id,
              version: saved.version,
            });
            await refresh(eventId);
            return result;
          }}
          createLink={async (id) => {
            await publicLink(id);
            await refresh(eventId);
          }}
          jobAction={(campaignId, action) =>
            void run(() =>
              api(base + '/job-action', 'POST', {
                campaign_id: campaignId,
                action,
                version: event.version,
              }),
            )
          }
          confirmCancel={(campaignId) =>
            setConfirmation(() => async () => {
              await api(base + '/job-action', 'POST', {
                campaign_id: campaignId,
                action: 'cancel',
                version: event.version,
              });
            })
          }
          processDemo={() =>
            void run(
              () => api(base + '/process-demo', 'POST', {}),
              'Procesarea demo a fost executată; niciun mesaj real nu a plecat.',
            )
          }
          nameOf={nameOf}
        />
      );
    }
    if (page === 'floor')
      return (
        <>
          <div className="section-toolbar">
            <Button
              variant="outline"
              onClick={() =>
                run(
                  () =>
                    api(base + '/floor', 'POST', {
                      action: 'save',
                      version: event.version,
                    }),
                  'Versiunea planului a fost salvată.',
                )
              }
            >
              Salvează versiune
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                run(async () => {
                  setExtras(await api(base + '/floor'));
                  setModal({ type: 'floor-history' });
                }, '')
              }
            >
              Versiuni & restaurare
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                run(async () => {
                  setExtras(
                    await api(base + '/floor', 'POST', {
                      action: 'suggest',
                      preview: true,
                      version: event.version,
                    }),
                  );
                  setModal({ type: 'seating-suggestions' });
                }, '')
              }
            >
              Sugerează repartizarea
            </Button>
            <Button variant="outline" onClick={() => edit('constraint')}>
              Regulă împreună / separat
            </Button>
          </div>
          <FloorPlan
            readOnly={!!viewedAccount || !can('table', 'edit')}
            entities={es}
            reception={s.reception}
            busy={busy}
            onEdit={edit}
            onMove={(t, x, y) => run(() => update(t, { x, y }))}
            onAssign={(g) => edit('assignment', undefined, { guest_id: g })}
            onExport={() => window.print()}
          />
        </>
      );
    if (page === 'checkin') {
      const subeventId = extras.sub || s.reception;
      return (
        <CheckinPage
          entities={es}
          subeventId={subeventId}
          query={q}
          timezone={ed.timezone}
          online={online}
          setSubevent={(id) => setExtras({ ...extras, sub: id })}
          setQuery={setQ}
          nameOf={nameOf}
          scan={(qr, subevent) =>
            void run(
              () =>
                api(base + '/checkin', 'POST', {
                  qr,
                  subevent_id: subevent,
                  version: event.version,
                }),
              'Familie identificată și înregistrată prin QR.',
            )
          }
          toggleGuest={(guest, subevent, undo) =>
            void run(
              () =>
                api(base + '/checkin', 'POST', {
                  guest_id: guest.id,
                  subevent_id: subevent,
                  undo,
                  version: event.version,
                }),
              undo ? 'Check-in anulat.' : 'Sosire înregistrată.',
            )
          }
          checkHousehold={(householdId, subevent) =>
            void run(
              () =>
                api(base + '/checkin', 'POST', {
                  household_id: householdId,
                  subevent_id: subevent,
                  version: event.version,
                }),
              'Familia a fost înregistrată.',
            )
          }
        />
      );
    }
    if (page === 'reports')
      return (
        <ReportsPage
          entities={es}
          summary={s}
          canExport={(kind) => can(kind, 'export')}
          exportList={exportList}
          guestStatus={stat}
        />
      );
    if (page === 'settings')
      return (
        <SettingsPage
          event={event}
          me={me!}
          subevents={genericPage('subevent')}
          editEvent={() => {
            setForm({ ...ed, name: event.name, budget: ed.budget / 100 });
            setModal({ type: 'event', id: eventId });
          }}
          verifyEmail={() =>
            void run(
              () => api('auth/verify', 'POST', {}),
              'Cererea de verificare a fost acceptată.',
            )
          }
          closeSessions={() =>
            setConfirmation(() => async () => {
              await api('sessions', 'DELETE');
              setMe(null);
              setState(null);
            })
          }
          openAudit={() =>
            void run(async () => {
              setExtras(await api(base + '/audit'));
              setModal({ type: 'audit' });
            }, '')
          }
          openTrash={() =>
            void run(async () => {
              setExtras(await api(base + '/trash'));
              setModal({ type: 'trash' });
            }, '')
          }
          changeTheme={(theme) =>
            void run(async () => {
              const result = await api('me/theme', 'PATCH', { theme });
              setMe(result.user);
            }, 'Tema a fost salvată.')
          }
        />
      );
    if (page === 'team')
      return (
        <TeamPage
          me={me!}
          role={state!.role}
          data={extras}
          add={add}
          remove={(userId) =>
            setConfirmation(() => async () => {
              await api(base + '/team', 'DELETE', {
                user_id: userId,
                version: event.version,
              });
              setExtras(await api(base + '/team'));
            })
          }
        />
      );
    if (page === 'document')
      return <DocumentsPage data={extras} base={base} add={add} />;
    if (page === 'timeline')
      return (
        <>
          <TabBar
            value={tab || 'timeline'}
            onChange={setTab}
            items={[
              { value: 'timeline', label: 'Programul zilei' },
              { value: 'calendar', label: 'Calendar' },
              { value: 'subevent', label: 'Subevenimente' },
            ]}
          />
          {tab === 'calendar' ? (
            <CalendarView
              rows={[...list(es, 'task'), ...list(es, 'timeline')]}
              onEdit={(r) => edit(r.kind, r)}
            />
          ) : (
            <>
              <TimelineWarnings entities={es} />
              {genericPage(tab || 'timeline')}
              <Button variant="outline" onClick={() => downloadICS(event, es)}>
                <Download />
                Adaugă în calendar (.ics)
              </Button>
            </>
          )}
        </>
      );
    if (page === 'transport' || page === 'accommodation') {
      const kind = tab || page;
      return (
        <>
          <TabBar
            value={kind}
            onChange={setTab}
            items={[
              { value: page, label: schemas[page].label },
              {
                value:
                  page === 'transport'
                    ? 'transport_assignment'
                    : 'room_assignment',
                label: 'Repartizări',
              },
            ]}
          />
          {genericPage(kind)}
        </>
      );
    }
    if (page === 'notifications')
      return (
        <div className="panel">
          {list(es, 'notification').map((n) => (
            <div className="notification-row" key={n.id}>
              <Bell />
              <div>
                <strong>{n.data.name}</strong>
                <small>{new Date(n.created_at).toLocaleString('ro-RO')}</small>
              </div>
              <Button
                variant="ghost"
                onClick={() => run(() => update(n, { read: !n.data.read }))}
              >
                {n.data.read ? 'Marchează necitită' : 'Marchează citită'}
              </Button>
            </div>
          ))}
        </div>
      );
    return genericPage(page);
  };
  const modalTitle =
    modal?.type === 'entity'
      ? (modal.id ? 'Editează ' : 'Adaugă ') +
        schemas[modal.kind].singular.toLowerCase()
      : (
          {
            event: modal?.id ? 'Setările evenimentului' : 'Un nou început',
            import: 'Importă invitați',
            campaign: 'Programează invitațiile',
            team: 'Invită în echipă',
            link: 'Linkul personal este pregătit',
            document: 'Adaugă un document',
            audit: 'Jurnal de audit',
            trash: 'Elemente șterse',
            bulk: 'Înregistrează răspunsuri',
            'guest-detail': 'Detalii invitat',
            'floor-history': 'Versiunile planului',
            'seating-suggestions': 'Sugestii de repartizare',
          } as Data
        )[modal?.type || ''] || '';
  return (
    <SidebarProvider
      style={{ '--sidebar-width': '248px' } as React.CSSProperties}
    >
      <Sidebar className="planner-sidebar">
        <SidebarHeader>
          <a
            className="brand"
            href="#dashboard"
            onClick={() => navigate('dashboard')}
          >
            <span className="brand-icon">
              <Heart size={21} />
            </span>
            <span>
              {ed.app_name || 'Planora'}
              <small>TOTUL, ÎMPREUNĂ</small>
            </span>
          </a>
          <div className="event-picker">
            <span className="avatar">{(event?.name || 'N')[0]}</span>
            <Pick
              label="Alege evenimentul"
              value={eventId}
              onChange={(v) => {
                setState(null);
                setEventId(v);
              }}
              options={events.map((e) => ({ value: e.id, label: e.name }))}
            />
          </div>
        </SidebarHeader>
        <SidebarContent>
          {navGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items
                  .filter(
                    ([p]) =>
                      ['dashboard', 'settings', 'integrations'].includes(
                        String(p),
                      ) ||
                      can(
                        (
                          {
                            floor: 'table',
                            reports: 'guest',
                            team: 'team',
                          } as Data
                        )[String(p)] || String(p),
                      ),
                  )
                  .map(([p, label, Icon]) => (
                    <SidebarMenuItem key={String(p)}>
                      <SidebarMenuButton
                        isActive={page === p}
                        onClick={() => navigate(String(p))}
                      >
                        <Icon size={18} />
                        <span>{String(label)}</span>
                        {p === 'guest' && (
                          <span className="nav-count">{s.total || 0}</span>
                        )}
                        {p === 'task' && <span className="nav-dot" />}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          {!me.demo && me.platform_role === 'super_admin' && (
            <Button
              variant="outline"
              onClick={() => {
                setModal(null);
                setAccountScope('');
                setViewedAccount(null);
                setEventId('');
                setState(null);
                setAdminView(true);
              }}
            >
              <ShieldCheck />
              Administrare conturi
            </Button>
          )}
          <button
            className="new-event"
            disabled={!!viewedAccount}
            onClick={() => {
              setForm({
                currency: 'RON',
                timezone: 'Europe/Bucharest',
                budget: 0,
                workspace_id: event?.workspace_id,
              });
              setModal({ type: 'event' });
            }}
          >
            <Plus size={16} />
            Adaugă un eveniment
          </button>
          <div className="user-profile">
            <span className="avatar">{me.name[0]}</span>
            <span>
              <strong>{me.name}</strong>
              <small>
                {me.demo ? 'Spațiu demonstrativ' : 'Spațiul vostru'}
              </small>
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Deconectare"
              onClick={() =>
                run(async () => {
                  await api('auth/logout', 'POST', {});
                  setMe(null);
                  setAccountScope('');
                  setViewedAccount(null);
                  setState(null);
                  setEventId('');
                }, '')
              }
            >
              <LogOut size={17} />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <main className="main-shell">
        {viewedAccount && (
          <div className="info-banner account-view-banner">
            <ShieldCheck />
            <span>
              Consultare cont: <strong>{viewedAccount.name}</strong> ·{' '}
              {viewedAccount.email}
            </span>
            <Button
              variant="outline"
              onClick={() => {
                setAccountScope('');
                setViewedAccount(null);
                setEventId('');
                setState(null);
                setModal(null);
                setAdminView(true);
              }}
            >
              Înapoi la conturi
            </Button>
          </div>
        )}
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger />
            <span>Evenimentul nostru</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="saved-state">
              <span />
              Salvat în siguranță
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Caută invitați"
              onClick={() => navigate('guest')}
            >
              <Search size={19} />
            </Button>
            <Button
              className="notification-button"
              variant="ghost"
              size="icon"
              aria-label="Notificări"
              onClick={() => navigate('notifications')}
            >
              <Bell size={19} />
              {list(es, 'notification').some((n) => !n.data.read) && <i />}
            </Button>
            <span className="avatar small">{me.name[0]}</span>
          </div>
        </header>
        {ed.demo && (
          <div className="demo-strip">
            <span>DEMO</span>Date fictive, salvate în spațiul tău. Mesajele și
            plățile reale sunt dezactivate.
          </div>
        )}
        {!online && (
          <div className="error-banner" role="alert">
            <AlertCircle />
            Nu ai conexiune. Modificările nu pot fi salvate offline.
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <AlertCircle />
            <span>{error}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Închide eroarea"
              onClick={() => setError('')}
            >
              <X />
            </Button>
          </div>
        )}
        <div className="page-content">
          {page !== 'dashboard' && (
            <div className="page-heading">
              <div>
                <div className="eyebrow">{event?.name || 'SPAȚIUL VOSTRU'}</div>
                <h1>{title}</h1>
              </div>
              {state &&
                can(primaryKind, 'create') &&
                !['settings', 'integrations', 'reports', 'checkin'].includes(
                  page,
                ) && (
                  <Button onClick={add}>
                    <Plus />
                    {page === 'team'
                      ? 'Invită un membru'
                      : page === 'document'
                        ? 'Încarcă document'
                        : 'Adaugă'}
                  </Button>
                )}
            </div>
          )}
          {renderPage()}
        </div>
        <footer className="app-footer">
          <span>{ed.app_name || 'Planora'}</span>
          <span>Planificat cu grijă. Trăit cu bucurie.</span>
          <Heart size={13} />
        </footer>
      </main>
      {toast && (
        <output className="toast">
          <CheckCircle2 />
          {toast}
        </output>
      )}
      {busy && (
        <output className="busy-indicator">
          <Loader2 className="spin" />
          Se salvează…
        </output>
      )}
      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogContent
          className={
            'planner-dialog ' +
            (['import', 'entity', 'event', 'guest-detail', 'audit'].includes(
              modal?.type || '',
            )
              ? 'wide-dialog'
              : '')
          }
        >
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            <DialogDescription>
              {modal?.type === 'entity'
                ? 'Completează detaliile. Modificările sunt salvate după confirmare.'
                : modal?.type === 'import'
                  ? 'Previzualizează datele și alege cum tratezi duplicatele.'
                  : 'Fiecare detaliu rămâne în acest eveniment.'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {modal?.type === 'entity' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(saveEntity);
              }}
            >
              {modal.kind === 'household' && form.self_registration && (
                <p className="info-banner">
                  Invitatul va completa persoanele și răspunsurile pentru
                  momentele evenimentului. Tu rezervi doar numărul de locuri
                  pentru familie.
                </p>
              )}
              <Fields
                kind={modal.kind}
                data={form}
                setData={setDraft}
                entities={es}
              />
              <div className="dialog-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModal(null)}
                >
                  Înapoi
                </Button>
                <Button type="submit" disabled={busy}>
                  <Check />
                  Salvează
                </Button>
              </div>
            </form>
          )}
          {modal?.type === 'event' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const data = {
                    ...form,
                    budget: parseMoney(form.budget || 0),
                    version: event?.version,
                  };
                  if (modal.id) await api(base, 'PATCH', data);
                  else {
                    const r = await api('events', 'POST', data);
                    await loadEvents(r.id);
                  }
                  setModal(null);
                });
              }}
            >
              <div className="form-grid">
                {[
                  {
                    key: 'name',
                    label: 'Numele evenimentului',
                    required: true,
                  },
                  { key: 'partner1', label: 'Prenumele primului partener' },
                  {
                    key: 'partner2',
                    label: 'Prenumele celui de-al doilea partener',
                  },
                  {
                    key: 'date',
                    label: 'Data nunții (poate rămâne liberă)',
                    type: 'date',
                  },
                  { key: 'city', label: 'Oraș' },
                  { key: 'venue', label: 'Locație' },
                  {
                    key: 'expected',
                    label: 'Număr estimat de persoane',
                    type: 'number',
                  },
                  { key: 'budget', label: 'Buget orientativ', type: 'money' },
                  {
                    key: 'currency',
                    label: 'Moneda',
                    type: 'select',
                    options: ['RON', 'EUR', 'USD'],
                  },
                  { key: 'timezone', label: 'Fus orar' },
                  {
                    key: 'language',
                    label: 'Limba invitației',
                    type: 'select',
                    options: ['ro', 'en'],
                  },
                  { key: 'app_name', label: 'Numele platformei' },
                  {
                    key: 'privacy_operator',
                    label: 'Operator date (nume persoană / organizație)',
                  },
                  {
                    key: 'privacy_contact',
                    label: 'Contact pentru confidențialitate',
                  },
                ].map((f) => (
                  <FieldControl
                    key={f.key}
                    field={f}
                    value={form[f.key]}
                    onChange={(v) => {
                      const d = { ...form, [f.key]: v };
                      setForm(d);
                      sessionStorage.setItem('event-draft', JSON.stringify(d));
                    }}
                  />
                ))}
              </div>
              <div className="dialog-actions">
                <Button type="submit" disabled={busy}>
                  Salvează evenimentul
                  <ArrowRight />
                </Button>
              </div>
            </form>
          )}
          {modal?.type === 'import' && (
            <>
              <label htmlFor="csv-input">Date CSV (UTF-8)</label>
              <Textarea
                id="csv-input"
                rows={7}
                value={form.text}
                onChange={(e) => {
                  setForm({ ...form, text: e.target.value });
                  setExtras({});
                }}
              />
              <Input
                aria-label="Încarcă CSV"
                type="file"
                accept=".csv,.xlsx,text/csv"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    try {
                      setForm({
                        ...form,
                        text: await readSpreadsheet(f),
                        mapping: {},
                      });
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : 'Fișier invalid.',
                      );
                    }
                    setExtras({});
                  }
                }}
              />
              <p className="muted">
                Coloane: name, family, email, phone, age. Aceeași familie pe mai
                multe rânduri păstrează gruparea.
              </p>
              <ColumnMapping
                text={form.text}
                mapping={form.mapping || {}}
                onChange={(mapping) => {
                  setForm({ ...form, mapping });
                  setExtras({});
                }}
              />
              <Pick
                label="Politica duplicatelor"
                value={form.duplicate_policy}
                onChange={(v) => setForm({ ...form, duplicate_policy: v })}
                options={[
                  { value: 'skip', label: 'Ignoră posibilele duplicate' },
                  {
                    value: 'create',
                    label: 'Creează separat, inclusiv duplicatele',
                  },
                ]}
              />
              {extras.report && (
                <div className="import-preview">
                  <strong>{extras.report.length} rânduri analizate</strong>
                  {extras.report.map((r: Data) => (
                    <div key={r.row}>
                      <span>
                        {r.row}. {r.data?.name || 'Rând invalid'}
                      </span>
                      <span>
                        {r.error || r.duplicates.length + ' posibile duplicate'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="dialog-actions">
                <Button
                  variant="outline"
                  onClick={() =>
                    run(async () => {
                      const parsed = parseCSV(form.text.replace(/^\uFEFF/, ''));
                      const header = parsed.shift()!;
                      const rows = parsed.map((row) =>
                        Object.fromEntries(
                          ['name', 'family', 'email', 'phone', 'age'].map(
                            (key) => [
                              key,
                              row[header.indexOf(form.mapping?.[key] ?? key)] ||
                                '',
                            ],
                          ),
                        ),
                      );
                      setExtras({
                        ...(await api(base + '/import', 'POST', {
                          rows,
                          preview: true,
                        })),
                        rows,
                      });
                    }, '')
                  }
                >
                  <Eye />
                  Previzualizează
                </Button>
                <Button
                  disabled={
                    !extras.report ||
                    extras.report.some((r: Data) => r.error) ||
                    busy
                  }
                  onClick={() =>
                    run(async () => {
                      const r = await api(base + '/import', 'POST', {
                        rows: extras.rows,
                        duplicate_policy: form.duplicate_policy,
                        version: event.version,
                        key: crypto.randomUUID(),
                      });
                      setModal(null);
                      setToast(
                        `${r.created} persoane adăugate · ${r.skipped} ignorate.`,
                      );
                    }, '')
                  }
                >
                  Importă în eveniment
                </Button>
              </div>
            </>
          )}
          {modal?.type === 'campaign' && (
            <>
              <div className="form-grid">
                {[
                  { key: 'name', label: 'Numele campaniei' },
                  {
                    key: 'channel',
                    label: 'Canal',
                    type: 'select',
                    options: ['email', 'sms', 'whatsapp'],
                  },
                  {
                    key: 'type',
                    label: 'Tip',
                    type: 'select',
                    options: [
                      'invitation',
                      'rsvp_reminder',
                      'logistics',
                      'thanks',
                    ],
                  },
                  { key: 'date', label: 'Data (gol = imediat)', type: 'date' },
                  { key: 'time', label: 'Ora în ' + ed.timezone, type: 'time' },
                  { key: 'message', label: 'Mesaj', type: 'textarea' },
                ].map((f) => (
                  <FieldControl
                    key={f.key}
                    field={f}
                    value={form[f.key]}
                    onChange={(v) => {
                      setForm({ ...form, [f.key]: v });
                      setExtras({});
                    }}
                  />
                ))}
              </div>
              {extras.count !== undefined && (
                <div className="info-banner">
                  {extras.count} familii eligibile · {extras.excluded} excluse.{' '}
                  {extras.demo
                    ? 'Doar simulare.'
                    : extras.configured
                      ? 'Integrare configurată.'
                      : 'Integrare neconfigurată.'}
                </div>
              )}
              <div className="dialog-actions">
                <Button
                  variant="outline"
                  onClick={() =>
                    run(
                      async () =>
                        setExtras(
                          await api(base + '/campaigns', 'POST', {
                            ...form,
                            preview: true,
                          }),
                        ),
                      '',
                    )
                  }
                >
                  <Eye />
                  Verifică destinatarii
                </Button>
                <Button
                  disabled={
                    extras.count === undefined ||
                    busy ||
                    (!extras.demo && !extras.configured)
                  }
                  onClick={() =>
                    run(async () => {
                      await api(base + '/campaigns', 'POST', {
                        ...form,
                        activate: true,
                        version: event.version,
                      });
                      setModal(null);
                    }, 'Campania a fost programată.')
                  }
                >
                  <Send />
                  {ed.demo ? 'Programează simularea' : 'Activează programarea'}
                </Button>
              </div>
            </>
          )}
          {modal?.type === 'team' && (
            <>
              <FieldControl
                field={{
                  key: 'email',
                  label: 'Email destinatar',
                  type: 'email',
                }}
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
              <Pick
                label="Rol"
                value={form.role}
                onChange={(v) => setForm({ ...form, role: v })}
                options={[
                  { value: 'partner', label: 'Partener / coorganizator' },
                  { value: 'planner', label: 'Wedding planner' },
                  { value: 'finance', label: 'Financiar' },
                  { value: 'checkin', label: 'Recepție / check-in' },
                ]}
              />
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await api(base + '/team', 'POST', {
                      ...form,
                      version: event.version,
                    });
                    setExtras({ link: r.url });
                    setModal({ type: 'link' });
                  }, 'Link de colaborare creat. Niciun email nu a fost trimis.')
                }
              >
                <LinkIcon />
                Creează linkul de acces
              </Button>
            </>
          )}
          {modal?.type === 'link' && (
            <>
              <div className="info-banner">
                <LinkIcon />
                Linkul oferă acces destinatarului. Partajează-l doar cu acesta.
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <QRCode value={extras.link} />
              </div>
              <Input aria-label="Link personal" readOnly value={extras.link} />
              <div className="dialog-actions">
                <Button
                  variant="outline"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(extras.link)
                      .then(() => setToast('Link copiat.'))
                      .catch(() =>
                        setError('Selectează și copiază manual linkul.'),
                      )
                  }
                >
                  <Copy />
                  Copiază
                </Button>
                <a
                  href={extras.link}
                  target="_blank"
                  rel="noreferrer"
                  className="button-link"
                >
                  Deschide
                  <ExternalLink size={16} />
                </a>
              </div>
            </>
          )}
          {modal?.type === 'guest-detail' && (
            <GuestDetail
              guest={modal.guest}
              entities={es}
              onEdit={() => edit('guest', modal.guest)}
              onLink={() =>
                run(() => publicLink(modal.guest.data.household_id), '')
              }
              onDelete={() => remove('guest', modal.guest.id)}
              onRevoke={() =>
                setConfirmation(() => async () => {
                  await api(base + '/revoke-links', 'POST', {
                    household_id: modal.guest.data.household_id,
                    version: event.version,
                  });
                })
              }
            />
          )}
          {modal?.type === 'bulk' && (
            <>
              <p>
                {selection.length} persoane · {nameOf(s.reception)}
              </p>
              <Pick
                label="Răspuns"
                value={form.status}
                onChange={(v) => setForm({ status: v })}
                options={['confirmed', 'declined', 'pending'].map((value) => ({
                  value,
                  label: labels[value],
                }))}
              />
              <Button
                onClick={() =>
                  run(async () => {
                    let currentVersion = event.version;
                    for (const id of selection) {
                      const old = list(es, 'rsvp').find(
                        (r) =>
                          r.data.guest_id === id &&
                          r.data.subevent_id === s.reception,
                      );
                      const r = await api(
                        base + '/records/rsvp' + (old ? '/' + old.id : ''),
                        old ? 'PATCH' : 'POST',
                        {
                          version: currentVersion,
                          data: {
                            guest_id: id,
                            subevent_id: s.reception,
                            status: form.status,
                            source: 'organizer',
                          },
                        },
                      );
                      currentVersion = r.version;
                    }
                    setModal(null);
                    setSelection([]);
                  })
                }
              >
                Aplică răspunsurile
              </Button>
            </>
          )}
          {modal?.type === 'document' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                data.set('version', event.version);
                void run(async () => {
                  const r = await fetch('/api/' + base + '/documents', {
                    method: 'POST',
                    body: data,
                  });
                  const body = (await r.json()) as Data;
                  if (!r.ok) throw new Error(body.error?.message);
                  setExtras(await api(base + '/documents'));
                  setModal(null);
                });
              }}
            >
              <Input
                name="file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                required
                aria-label="Alege documentul"
              />
              <p className="muted">PDF, PNG, JPG sau TXT · maximum 5 MB</p>
              <div className="dialog-actions">
                <Button type="submit" disabled={busy}>
                  <Upload />
                  Încarcă
                </Button>
              </div>
            </form>
          )}
          {modal?.type === 'floor-history' && (
            <div>
              {extras.versions?.length ? (
                extras.versions.map((v: Data) => (
                  <div className="notification-row" key={v.id}>
                    <span>
                      {v.name}
                      <small>{v.count} elemente</small>
                    </span>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setConfirmation(() => async () => {
                          await api(base + '/floor', 'POST', {
                            action: 'restore',
                            id: v.id,
                            version: event.version,
                          });
                          setModal(null);
                        })
                      }
                    >
                      Restaurează
                    </Button>
                  </div>
                ))
              ) : (
                <Empty title="Nicio versiune salvată" />
              )}
            </div>
          )}
          {modal?.type === 'seating-suggestions' && (
            <>
              <p>{extras.proposed?.length} repartizări propuse.</p>
              {extras.conflicts?.map((c: string) => (
                <p className="warning-banner" key={c}>
                  {c}
                </p>
              ))}
              <div className="audit-list">
                {extras.proposed?.map((p: Data) => (
                  <div key={p.guest_id}>
                    <span>
                      <strong>
                        {p.guest_name} → {p.table_name}, loc {p.seat}
                      </strong>
                      <small>{p.reason}</small>
                    </span>
                  </div>
                ))}
              </div>
              <Button
                disabled={busy || !extras.proposed?.length}
                onClick={() =>
                  run(async () => {
                    await api(base + '/floor', 'POST', {
                      action: 'suggest',
                      confirm: true,
                      version: event.version,
                    });
                    setModal(null);
                  })
                }
              >
                Aplică sugestiile previzualizate
              </Button>
            </>
          )}
          {modal?.type === 'audit' && (
            <div className="audit-list">
              {extras.items?.map((x: Data) => (
                <div key={x.id}>
                  <ShieldCheck size={17} />
                  <span>
                    <strong>{x.action}</strong>
                    <small>
                      {x.actor_name || 'Invitat / sistem'} ·{' '}
                      {new Date(x.created_at).toLocaleString('ro-RO')}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          )}
          {modal?.type === 'trash' && (
            <div>
              {extras.items?.length ? (
                extras.items.map((r: Entity) => (
                  <div className="notification-row" key={r.id}>
                    <span>{r.data.name || schemas[r.kind]?.singular}</span>
                    <Button
                      variant="outline"
                      onClick={() =>
                        run(async () => {
                          await api(base + '/restore', 'POST', {
                            id: r.id,
                            version: event.version,
                          });
                          setExtras(await api(base + '/trash'));
                        })
                      }
                    >
                      <RotateCcw />
                      Restaurează
                    </Button>
                  </div>
                ))
              ) : (
                <Empty title="Coșul este gol" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(v) => {
          if (!v) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmi această acțiune?</AlertDialogTitle>
            <AlertDialogDescription>
              Verifică selecția înainte de a continua. Înregistrările șterse pot
              fi recuperate din Setări → Elemente șterse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Renunță</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => {
                const fn = confirmation!;
                setConfirmation(null);
                void run(fn);
              }}
            >
              Confirmă
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
function AuthScreen({
  error,
  busy,
  onAction,
}: {
  error: string;
  busy: boolean;
  onAction: (mode: string, d: Data) => Promise<Data | null | undefined>;
}) {
  const [mode, setMode] = useState('login'),
    [form, setForm] = useState<Data>({}),
    [notice, setNotice] = useState(''),
    [showPassword, setShowPassword] = useState(false);
  const switchMode = (nextMode: string) => {
    setMode(nextMode);
    setForm({});
    setNotice('');
    setShowPassword(false);
  };
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('account_token')) {
      queueMicrotask(() => { setMode('consume'); setForm({ token: params.get('account_token') }); });
    }
  }, []);
  const title =
    mode === 'register'
      ? 'Începeți povestea voastră'
      : mode === 'recover'
        ? 'Recuperează accesul'
        : mode === 'consume'
          ? 'Alege o parolă nouă'
          : 'Bine ai revenit';
  const description =
    mode === 'register'
      ? 'Contul va fi activ după aprobarea administratorului.'
      : mode === 'recover'
        ? 'Îți trimitem un link sigur pentru a reveni în cont.'
        : mode === 'consume'
          ? 'Setează parola cu care vei intra de acum înainte.'
          : 'Continuăm de unde ai rămas.';
  return (
    <div className="auth-shell">
      <aside className="auth-visual" aria-hidden="true">
        <div className="auth-visual-copy">
          <span>PLANURI FRUMOASE, ÎMPREUNĂ</span>
          <h2>Fiecare detaliu își găsește locul.</h2>
          <p>De la prima idee până la ultimul dans.</p>
        </div>
      </aside>
      <main className="auth-panel">
        <header className="auth-brand">
          <span className="brand-icon">
            <Heart strokeWidth={1.7} />
          </span>
          <span>Planora</span>
        </header>

        <section className="auth-intro">
          <span className="auth-rule" aria-hidden="true" />
          <h1>{title}</h1>
          <p>{description}</p>
        </section>

        {(mode === 'login' || mode === 'register') && (
          <div className="auth-mode-switch" role="tablist" aria-label="Tipul de acces">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
            >
              Intră în cont
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
            >
              Creează cont
            </button>
          </div>
        )}

        <section className="auth-form">
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setNotice('');
              const r = await onAction(mode, form);
              if (r?.ok) {
                setNotice(
                  mode === 'consume'
                    ? 'Parola a fost setată. Autentifică-te cu adresa ta de email și noua parolă.'
                    : r.message || 'Cererea a fost salvată.',
                );
                if (mode === 'consume') {
                  setMode('login');
                  setForm({});
                  history.replaceState(null, '', '/');
                }
              }
            }}
          >
            {notice && <output>{notice}</output>}
            {mode === 'register' && (
              <div className="auth-field">
                <label htmlFor="auth-name">Numele tău</label>
                <span className="auth-input-wrap">
                  <UserRound aria-hidden="true" />
                  <Input
                    id="auth-name"
                    name="name"
                    autoComplete="name"
                    required
                    placeholder="ex. Andrei Popescu"
                    value={String(form.name || '')}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </span>
              </div>
            )}
            {mode !== 'consume' && (
              <div className="auth-field">
                <label htmlFor="auth-email">Adresa de email</label>
                <span className="auth-input-wrap">
                  <Mail aria-hidden="true" />
                  <Input
                    id="auth-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    placeholder="ex. nume@exemplu.ro"
                    value={String(form.email || '')}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </span>
              </div>
            )}
            {mode !== 'recover' && (
              <div className="auth-field">
                <label htmlFor="auth-password">{mode === 'register' || mode === 'consume' ? 'Parolă (minimum 12 caractere)' : 'Parolă'}</label>
                <span className="auth-input-wrap">
                  <LockKeyhole aria-hidden="true" />
                  <Input
                    id="auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={12}
                    required
                    placeholder="Introdu parola ta"
                    value={String(form.password || '')}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Ascunde parola' : 'Arată parola'}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </span>
              </div>
            )}
            <Button className="auth-submit" type="submit" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" />
              ) : mode === 'register' ? (
                'Creează cont'
              ) : mode === 'recover' ? (
                'Trimite linkul'
              ) : mode === 'consume' ? (
                'Confirmă'
              ) : (
                'Intră în cont'
              )}
              <ArrowRight />
            </Button>
          </form>

          {mode === 'login' && (
            <button className="auth-text-link auth-recover" type="button" onClick={() => switchMode('recover')}>
              Ai uitat parola?
            </button>
          )}
          {(mode === 'recover' || mode === 'consume') && (
            <button className="auth-text-link auth-back" type="button" onClick={() => switchMode('login')}>
              Înapoi la autentificare
            </button>
          )}

          {(mode === 'login' || mode === 'register') && (
            <>
              <div className="or-divider" aria-hidden="true">
                <Heart />
              </div>
              <p className="auth-alternate">
                {mode === 'register' ? 'Ai deja cont?' : 'Nu ai încă un cont?'}{' '}
                <button type="button" onClick={() => switchMode(mode === 'register' ? 'login' : 'register')}>
                  {mode === 'register' ? 'Intră în cont' : 'Creează cont'}
                </button>
              </p>
              <Button
                className="demo-button"
                variant="outline"
                disabled={busy}
                onClick={() => onAction('demo', {})}
              >
                <Flower2 />
                Explorează evenimentul demonstrativ
              </Button>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
function GuestDetail({
  guest: g,
  entities: es,
  onEdit,
  onLink,
  onDelete,
  onRevoke,
}: {
  guest: Entity;
  entities: Entity[];
  onEdit: () => void;
  onLink: () => void;
  onDelete: () => void;
  onRevoke: () => void;
}) {
  return (
    <>
      <div className="guest-detail-header">
        <span className="avatar large">{g.data.name[0]}</span>
        <div>
          <h2>{g.data.name}</h2>
          <p>{es.find((x) => x.id === g.data.household_id)?.data.name}</p>
        </div>
        <Button variant="outline" onClick={onEdit}>
          Editează
        </Button>
      </div>
      <div className="detail-grid">
        {schemas.guest.fields
          .filter((f) => g.data[f.key] && !f.ref)
          .map((f) => (
            <div key={f.key}>
              <span>{f.label}</span>
              <strong>{String(g.data[f.key])}</strong>
            </div>
          ))}
      </div>
      <h3>Răspunsuri pe subevenimente</h3>
      {list(es, 'guest_invitation')
        .filter((i) => i.data.guest_id === g.id)
        .map((i) => (
          <div key={i.id} className="notification-row">
            <span>
              {es.find((s) => s.id === i.data.subevent_id)?.data.name}
            </span>
            <Badge
              value={
                list(es, 'rsvp').find(
                  (r) =>
                    r.data.guest_id === g.id &&
                    r.data.subevent_id === i.data.subevent_id,
                )?.data.status || 'pending'
              }
            />
          </div>
        ))}
      <div className="dialog-actions">
        <Button variant="ghost" onClick={onDelete}>
          <Trash2 />
          Șterge
        </Button>
        <Button variant="outline" onClick={onRevoke}>
          Revocă linkurile
        </Button>
        <Button onClick={onLink}>
          <LinkIcon />
          Link RSVP
        </Button>
      </div>
    </>
  );
}
function FloorPlan({
  readOnly,
  entities: es,
  reception,
  busy,
  onEdit,
  onMove,
  onAssign,
  onExport,
}: {
  readOnly: boolean;
  entities: Entity[];
  reception: string;
  busy: boolean;
  onEdit: (kind: string, r?: Entity, defaults?: Data) => void;
  onMove: (r: Entity, x: number, y: number) => void;
  onAssign: (id: string) => void;
  onExport: () => void;
}) {
  const [sub, setSub] = useState(reception),
    [zoom, setZoom] = useState(0.8),
    [view, setView] = useState('visual'),
    [q, setQ] = useState('');
  const tables = list(es, 'table').filter((t) => t.data.subevent_id === sub),
    assignments = list(es, 'assignment').filter(
      (a) => a.data.subevent_id === sub,
    );
  const unassigned = list(es, 'guest').filter(
    (g) =>
      list(es, 'rsvp').some(
        (r) =>
          r.data.guest_id === g.id &&
          r.data.subevent_id === sub &&
          r.data.status === 'confirmed',
      ) &&
      !assignments.some((a) => a.data.guest_id === g.id) &&
      (!q || g.data.name.toLowerCase().includes(q.toLowerCase())),
  );
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    cx: number;
    cy: number;
  } | null>(null);
  const [moving, setMoving] = useState<Data | null>(null);
  const size = (r: Entity) =>
    r.kind === 'decor' ? [r.data.width, r.data.height] : [150, 150];
  function position(r: Entity, clientX: number, clientY: number) {
    const d = drag.current!;
    const [width, height] = size(r);
    return floorPosition(
      d.x,
      d.y,
      clientX - d.cx,
      clientY - d.cy,
      zoom,
      width,
      height,
    );
  }
  function startDrag(e: React.PointerEvent<HTMLButtonElement>, r: Entity) {
    if (busy || readOnly || r.data.locked || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: r.id,
      x: r.data.x,
      y: r.data.y,
      cx: e.clientX,
      cy: e.clientY,
    };
  }
  function moveDrag(e: React.PointerEvent<HTMLButtonElement>, r: Entity) {
    if (drag.current?.id === r.id)
      setMoving({ id: r.id, ...position(r, e.clientX, e.clientY) });
  }
  function finishDrag(e: React.PointerEvent<HTMLButtonElement>, r: Entity) {
    if (drag.current?.id === r.id) {
      const point = position(r, e.clientX, e.clientY);
      if (
        Math.hypot(e.clientX - drag.current.cx, e.clientY - drag.current.cy) >
          3 &&
        (point.x !== r.data.x || point.y !== r.data.y)
      )
        onMove(r, point.x, point.y);
    }
    drag.current = null;
    setMoving(null);
  }
  function cancelDrag() {
    drag.current = null;
    setMoving(null);
  }
  function keyboardMove(e: React.KeyboardEvent<HTMLButtonElement>, r: Entity) {
    if (busy || readOnly) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      onEdit(r.kind, r);
      return;
    }
    if (
      r.data.locked ||
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
    )
      return;
    e.preventDefault();
    const step = e.shiftKey ? 50 : 10;
    const [width, height] = size(r);
    const p = floorPosition(
      r.data.x,
      r.data.y,
      e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0,
      e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0,
      1,
      width,
      height,
    );
    if (p.x !== r.data.x || p.y !== r.data.y) onMove(r, p.x, p.y);
  }
  return (
    <>
      <div className="section-toolbar">
        <Pick
          label="Subeveniment"
          value={sub}
          onChange={setSub}
          options={list(es, 'subevent').map((s) => ({
            value: s.id,
            label: s.data.name,
          }))}
        />
        <TabBar
          value={view}
          onChange={setView}
          items={[
            { value: 'visual', label: 'Plan vizual' },
            { value: 'list', label: 'Listă accesibilă' },
          ]}
        />
        <Button
          variant="outline"
          disabled={readOnly || busy}
          onClick={() => onEdit('decor')}
        >
          <Plus />
          Element sală
        </Button>
        <Button variant="outline" onClick={onExport}>
          <Download />
          Tipărește / PDF
        </Button>
      </div>
      <div className="floor-workspace">
        <aside className="panel seating-pool">
          <h3>
            De așezat <span>{unassigned.length}</span>
          </h3>
          <div className="search-control">
            <Search size={16} />
            <Input
              aria-label="Caută invitat nerepartizat"
              placeholder="Caută un invitat…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <p>Confirmările fără loc la masă.</p>
          {unassigned.map((g) => (
            <button
              className="pool-guest"
              key={g.id}
              onClick={() => onAssign(g.id)}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('guest', g.id)}
            >
              <Grip size={15} />
              <span>
                {g.data.name}
                <small>
                  {es.find((x) => x.id === g.data.household_id)?.data.name}
                </small>
              </span>
              <Plus size={15} />
            </button>
          ))}
          {!unassigned.length && <Empty title="Toți și-au găsit locul" />}
        </aside>
        <div className="panel floor-canvas-container">
          <div className="floor-canvas-toolbar">
            <span>
              <span className="dot dot-confirmed" />
              {assignments.length} locuri ocupate ·{' '}
              {tables.reduce((s, t) => s + t.data.capacity, 0)} disponibile în
              plan
            </span>
            <div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Micșorează"
                onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
              >
                <ZoomOut />
              </Button>
              <span>{Math.round(zoom * 100)}%</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Mărește"
                onClick={() => setZoom((z) => Math.min(1.3, z + 0.1))}
              >
                <ZoomIn />
              </Button>
            </div>
          </div>
          {view === 'visual' ? (
            <div className="floor-scroll">
              <div
                className="floor-canvas"
                style={{ width: 1000 * zoom, height: 850 * zoom }}
              >
                <div
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: '0 0',
                    width: 1000,
                    height: 850,
                  }}
                >
                  {tables.map((t) => {
                    const seated = assignments.filter(
                      (a) => a.data.table_id === t.id,
                    );
                    const position = moving?.id === t.id ? moving : t.data;
                    return (
                      <div
                        key={t.id}
                        className={'floor-table ' + t.data.shape}
                        style={{
                          left: position.x,
                          top: position.y,
                          transform: `rotate(${t.data.rotation}deg)`,
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const guest = e.dataTransfer.getData('guest');
                          if (guest)
                            onEdit('assignment', undefined, {
                              guest_id: guest,
                              table_id: t.id,
                              seat:
                                Array.from(
                                  { length: t.data.capacity },
                                  (_, i) => i + 1,
                                ).find(
                                  (n) => !seated.some((a) => a.data.seat === n),
                                ) || 1,
                            });
                        }}
                      >
                        <button
                          className="table-face"
                          disabled={busy || readOnly}
                          onDoubleClick={() => onEdit('table', t)}
                          onPointerDown={(e) => startDrag(e, t)}
                          onPointerMove={(e) => moveDrag(e, t)}
                          onPointerUp={(e) => finishDrag(e, t)}
                          onPointerCancel={cancelDrag}
                          onLostPointerCapture={cancelDrag}
                          onKeyDown={(e) => keyboardMove(e, t)}
                          aria-label={`${t.data.name}, ${seated.length} din ${t.data.capacity} locuri. Dublu clic pentru editare.`}
                        >
                          <strong>{t.data.name}</strong>
                          <span>
                            {seated.length} / {t.data.capacity}
                          </span>
                          <Armchair size={16} />
                        </button>
                        {Array.from({ length: t.data.capacity }, (_, i) => {
                          const angle = (i / t.data.capacity) * Math.PI * 2;
                          const a = seated.find((a) => a.data.seat === i + 1);
                          return (
                            <button
                              aria-label={
                                'Loc ' +
                                (i + 1) +
                                (a
                                  ? ' · ' +
                                    es.find((g) => g.id === a.data.guest_id)
                                      ?.data.name
                                  : ' · liber')
                              }
                              className={'seat ' + (a ? 'occupied' : '')}
                              key={i}
                              style={{
                                left: 65 + Math.cos(angle) * 85,
                                top: 65 + Math.sin(angle) * 85,
                              }}
                              onClick={() =>
                                a
                                  ? onEdit('assignment', a)
                                  : onEdit('assignment', undefined, {
                                      table_id: t.id,
                                      seat: i + 1,
                                    })
                              }
                            >
                              {i + 1}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                  {list(es, 'decor').map((d) => (
                    <button
                      key={d.id}
                      className="floor-decor"
                      disabled={busy || readOnly}
                      style={{
                        left: moving?.id === d.id ? moving.x : d.data.x,
                        top: moving?.id === d.id ? moving.y : d.data.y,
                        width: d.data.width,
                        height: d.data.height,
                      }}
                      onPointerDown={(e) => startDrag(e, d)}
                      onPointerMove={(e) => moveDrag(e, d)}
                      onPointerUp={(e) => finishDrag(e, d)}
                      onPointerCancel={cancelDrag}
                      onLostPointerCapture={cancelDrag}
                      onDoubleClick={() => onEdit('decor', d)}
                      onKeyDown={(e) => keyboardMove(e, d)}
                      aria-label={`${d.data.name}. Trage pentru mutare, săgeți pentru poziționare, Enter sau dublu clic pentru detalii.`}
                    >
                      {d.data.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="table-list-view">
              {tables.map((t) => (
                <section key={t.id}>
                  <h3>
                    <button onClick={() => onEdit('table', t)}>
                      {t.data.name}
                    </button>
                    <span>
                      {
                        assignments.filter((a) => a.data.table_id === t.id)
                          .length
                      }{' '}
                      / {t.data.capacity}
                    </span>
                  </h3>
                  {assignments
                    .filter((a) => a.data.table_id === t.id)
                    .sort((a, b) => a.data.seat - b.data.seat)
                    .map((a) => (
                      <button
                        key={a.id}
                        onClick={() => onEdit('assignment', a)}
                      >
                        {a.data.seat}.{' '}
                        {es.find((g) => g.id === a.data.guest_id)?.data.name}
                      </button>
                    ))}
                </section>
              ))}
            </div>
          )}
          <div className="panel-bottom">
            <span>
              Trage mesele și elementele sălii. Săgețile mută elementul
              selectat. Dublu clic pentru detalii.
            </span>
            <Button variant="ghost" onClick={() => onEdit('assignment')}>
              Repartizare din listă <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
function CalendarView({
  rows,
  onEdit,
}: {
  rows: Entity[];
  onEdit: (r: Entity) => void;
}) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const start = new Date(month + '-01T12:00:00'),
    days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate(),
    offset = (start.getDay() + 6) % 7;
  return (
    <section className="panel calendar-panel">
      <div className="panel-heading">
        <h3>
          {start.toLocaleString('ro-RO', { month: 'long', year: 'numeric' })}
        </h3>
        <Input
          type="month"
          value={month}
          aria-label="Luna calendarului"
          onChange={(e) => setMonth(e.target.value || month)}
        />
      </div>
      <div className="calendar-grid">
        {[
          'Luni',
          'Marți',
          'Miercuri',
          'Joi',
          'Vineri',
          'Sâmbătă',
          'Duminică',
        ].map((d) => (
          <div className="calendar-weekday" key={d}>
            {d}
          </div>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div className="calendar-day outside" key={'blank' + i} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = month + '-' + String(i + 1).padStart(2, '0');
          return (
            <div
              className={
                'calendar-day ' +
                (day === new Date().toISOString().slice(0, 10) ? 'today' : '')
              }
              key={day}
            >
              <span>{i + 1}</span>
              {rows
                .filter((r) => (r.data.due || r.data.date) === day)
                .map((r) => (
                  <button onClick={() => onEdit(r)} key={r.id}>
                    {r.data.start} {r.data.name}
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
function TimelineWarnings({ entities: es }: { entities: Entity[] }) {
  const items = list(es, 'timeline');
  const conflicts = items.filter((a, i) =>
    items
      .slice(i + 1)
      .some(
        (b) =>
          a.data.date === b.data.date &&
          a.data.start < b.data.end &&
          b.data.start < a.data.end &&
          ((a.data.assignee && a.data.assignee === b.data.assignee) ||
            (a.data.venue && a.data.venue === b.data.venue)),
      ),
  );
  return conflicts.length ? (
    <div className="warning-banner">
      <AlertCircle />
      {conflicts.length} suprapuneri de locație sau responsabil:{' '}
      {conflicts.map((x) => x.data.name).join(', ')}.
    </div>
  ) : null;
}
export function downloadICS(event: Data, entities: Entity[]) {
  const escape = (s: string) =>
    String(s)
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Planora//RO',
    'CALSCALE:GREGORIAN',
  ];
  for (const r of [...list(entities, 'timeline'), ...list(entities, 'task')]) {
    const date = r.data.date || r.data.due;
    if (!date) continue;
    lines.push(
      'BEGIN:VEVENT',
      'UID:' + r.id + '@nuntanoastra',
      'DTSTAMP:' +
        new Date().toISOString().replace(/[-:]/g, '').split('.')[0] +
        'Z',
      'SUMMARY:' + escape(r.data.name),
      'DTSTART;VALUE=DATE:' + date.replace(/-/g, ''),
      'DESCRIPTION:' +
        escape(
          (r.data.start || '') +
            ' ' +
            (r.data.venue || '') +
            ' · ' +
            event.data.timezone,
        ),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  const url = URL.createObjectURL(
    new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nunta-calendar.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
