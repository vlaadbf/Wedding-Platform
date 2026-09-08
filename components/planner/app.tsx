'use client';
import { useEffect, useState, useCallback, useRef, ReactNode } from 'react';
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
  Plug,
  UserRoundPlus,
  Bell,
  Search,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Download,
  Upload,
  MoreHorizontal,
  Check,
  Clock,
  MapPin,
  LogOut,
  FileText,
  Send,
  Link as LinkIcon,
  Copy,
  Trash2,
  RotateCcw,
  Grip,
  SlidersHorizontal,
  Utensils,
  Flower2,
  ShieldCheck,
  Loader2,
  X,
  Eye,
  PanelLeft,
  Calendar,
  MessageSquare,
  Archive,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Coins,
  LayoutGrid,
  List,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
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
import { Progress } from '@/components/ui/progress';
import {
  Data,
  Entity,
  schemas,
  labels,
  list,
  summary,
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
} from './controls';
import { QRCode, QRScanner, ColumnMapping, readSpreadsheet } from './files';
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
      ['integrations', 'Integrări', Plug],
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
  const can = (kind: string, action = 'view') =>
    permission(state?.role, kind, action, state?.grants || {});
  const refresh = useCallback(async (id: string) => {
    if (!id) return;
    const data = await api('events/' + id);
    setState(data);
  }, []);
  const loadEvents = useCallback(async (preferred?: string) => {
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
        app_name: 'NuntaNoastră',
        ...JSON.parse(sessionStorage.getItem('event-draft') || '{}'),
      });
      setModal({ type: 'event' });
    }
  }, []);
  useEffect(() => {
    api('me')
      .then((d) => {
        setMe(d.user);
        if (d.user) {
          loadEvents();
          const t = new URLSearchParams(location.search).get('team_token');
          if (t)
            api('team-accept', 'POST', { token: t })
              .then((r) => {
                loadEvents(r.event_id);
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
      refresh(eventId).catch((e) => setError(e.message));
      setSelection([]);
      setQ('');
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
      setPage(hash);
  }, []);
  const run = async (
    fn: () => Promise<any>,
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
    setTab('');
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
    window.location.href =
      '/api/' +
      base +
      '/export?kind=' +
      kind +
      '&format=' +
      format +
      '&q=' +
      encodeURIComponent(q) +
      (filter !== 'all' ? '&status=' + filter : '');
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
  const GuestTable = () => {
    let guests = list(es, 'guest').filter(
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
  function Dashboard() {
    const done = list(es, 'task').filter(
        (t) => t.data.status === 'done',
      ).length,
      total = list(es, 'task').length;
    const days = ed.date
      ? Math.ceil((Date.parse(ed.date) - Date.now()) / 86400000)
      : null;
    return (
      <>
        <div className="dashboard-heading">
          <div>
            <div className="eyebrow">FIECARE DETALIU, CU DRAG</div>
            <h1>
              Ziua voastră prinde contur<span>.</span>
            </h1>
            <p>Toate planurile într-un singur loc. Mai mult timp pentru voi.</p>
          </div>
          <Button onClick={() => edit('guest')}>
            <Plus />
            Adaugă invitat
          </Button>
        </div>
        <div className="event-banner">
          <div className="event-monogram">
            {(ed.partner1 || event.name)[0]}
            <span>&</span>
            {(ed.partner2 || 'A')[0]}
          </div>
          <div className="event-banner-copy">
            <div className="eyebrow">NE CĂSĂTORIM</div>
            <h2>{event.name}</h2>
            <div className="event-details">
              <span>
                <CalendarDays />
                {date(ed.date)}
              </span>
              <span>
                <MapPin />
                {ed.venue || ed.city || 'Locație de stabilit'}
              </span>
            </div>
          </div>
          <div className="countdown">
            <strong>
              {days === null ? '∞' : days < 0 ? Math.abs(days) : days}
            </strong>
            <span>
              {days === null
                ? 'toate la timpul lor'
                : days < 0
                  ? 'zile de la nuntă'
                  : 'zile până la „Da”'}
            </span>
          </div>
          <button
            className="banner-edit"
            aria-label="Editează evenimentul"
            onClick={() => navigate('settings')}
          >
            <ArrowUpRight />
          </button>
        </div>
        <div className="metric-grid">
          <Metric
            label="Invitați confirmați"
            value={s.confirmed}
            caption={`din ${s.total} persoane invitate`}
            icon={<Users />}
            accent="sage"
            onClick={() => navigate('guest', 'confirmed')}
            progress={s.total ? (s.confirmed / s.total) * 100 : 0}
          />
          <Metric
            label="Buget planificat"
            value={money(ed.budget, ed.currency)}
            caption={`${money(s.paid, ed.currency)} plăți nete înregistrate`}
            icon={<Wallet />}
            accent="sand"
            onClick={() => navigate('expense')}
            progress={ed.budget ? (s.paid / ed.budget) * 100 : 0}
          />
          <Metric
            label="Sarcini finalizate"
            value={
              <>
                {done}
                <em> / {total}</em>
              </>
            }
            caption={
              total
                ? `${Math.round((done / total) * 100)}% din planul vostru`
                : 'Planul începe cu voi'
            }
            icon={<CheckSquare />}
            accent="rose"
            onClick={() => navigate('task')}
            progress={total ? (done / total) * 100 : 0}
          />
          <Metric
            label="Locuri de repartizat"
            value={s.unseated}
            caption="invitați confirmați fără masă"
            icon={<Armchair />}
            accent="lavender"
            onClick={() => navigate('guest', 'unseated')}
            progress={
              s.confirmed ? ((s.confirmed - s.unseated) / s.confirmed) * 100 : 0
            }
          />
        </div>
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Invitații voștri</h3>
                <p>Un „da” mai aproape de ziua cea mare.</p>
              </div>
              <button className="text-link" onClick={() => navigate('guest')}>
                Vezi invitații <ArrowRight size={15} />
              </button>
            </div>
            <div className="rsvp-chart">
              <div
                className="donut"
                style={{
                  background: `conic-gradient(#66836b 0 ${s.total ? (s.confirmed / s.total) * 100 : 0}%, #d8bea1 0 ${s.total ? ((s.confirmed + s.pending) / s.total) * 100 : 0}%, #e4e7e1 0)`,
                }}
              >
                <div>
                  <strong>{s.total}</strong>
                  <span>persoane invitate</span>
                </div>
              </div>
              <div className="legend">
                {[
                  ['confirmed', s.confirmed, 'Au confirmat'],
                  ['pending', s.pending, 'Așteptăm răspuns'],
                  ['declined', s.declined, 'Nu pot participa'],
                ].map(([v, n, t]) => (
                  <button key={v} onClick={() => navigate('guest', String(v))}>
                    <span className={'dot dot-' + v} />
                    <span>{t}</span>
                    <strong>{n}</strong>
                    <ChevronRight size={14} />
                  </button>
                ))}
                <div className="people-totals">
                  {s.adults} adulți <span>·</span> {s.children} copii{' '}
                  <span>·</span> {s.households} familii
                </div>
              </div>
            </div>
            <div className="panel-bottom">
              <Mail size={17} />
              <span>
                {
                  (state!.jobs || []).filter((j: Data) => j.status === 'queued')
                    .length
                }{' '}
                mesaje în coadă
              </span>
              <button
                className="text-link"
                onClick={() => {
                  navigate('invitation');
                  setTab('campaigns');
                }}
              >
                Gestionează invitațiile <ArrowRight size={15} />
              </button>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Următorii pași</h3>
                <p>Lucrurile mici care fac diferența.</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Adaugă sarcină"
                onClick={() => edit('task')}
              >
                <Plus />
              </Button>
            </div>
            <div className="task-preview">
              {list(es, 'task')
                .filter((t) => t.data.status !== 'done')
                .sort((a, b) =>
                  (a.data.due || 'z').localeCompare(b.data.due || 'z'),
                )
                .slice(0, 4)
                .map((t) => (
                  <div className="task-line" key={t.id}>
                    <Checkbox
                      aria-label={'Finalizează ' + t.data.name}
                      checked={false}
                      onCheckedChange={() =>
                        run(() => update(t, { status: 'done' }))
                      }
                    />
                    <button onClick={() => edit('task', t)}>
                      <strong>{t.data.name}</strong>
                      <small
                        className={
                          t.data.due &&
                          t.data.due < new Date().toISOString().slice(0, 10)
                            ? 'overdue'
                            : ''
                        }
                      >
                        {t.data.due ? date(t.data.due) : 'Fără termen'}
                        {t.data.assignee ? ' · ' + t.data.assignee : ''}
                      </small>
                    </button>
                  </div>
                ))}
            </div>
            <button
              className="panel-footer-link"
              onClick={() => navigate('task')}
            >
              Vezi toate sarcinile <ArrowRight size={15} />
            </button>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Bugetul, sub control</h3>
                <p>Estimări, contracte și plăți — fiecare cu locul său.</p>
              </div>
              <button className="text-link" onClick={() => navigate('expense')}>
                Vezi bugetul <ArrowRight size={15} />
              </button>
            </div>
            <div className="budget-preview">
              {list(es, 'expense')
                .sort((a, b) => b.data.contracted - a.data.contracted)
                .slice(0, 4)
                .map((x, i) => (
                  <button
                    key={x.id}
                    onClick={() => {
                      navigate('expense');
                      edit('expense', x);
                    }}
                  >
                    <span>{x.data.category}</span>
                    <div className="budget-track">
                      <i
                        style={{
                          width:
                            Math.max(
                              3,
                              Math.min(
                                100,
                                (x.data.contracted / (ed.budget || 1)) * 200,
                              ),
                            ) + '%',
                          background: [
                            '#72866b',
                            '#b99c78',
                            '#8f9e9c',
                            '#c5a29a',
                          ][i],
                        }}
                      />
                    </div>
                    <strong>{money(x.data.contracted, x.data.currency)}</strong>
                  </button>
                ))}
            </div>
            <div className="budget-caption">
              <span>
                Contractat <strong>{money(s.contracted, ed.currency)}</strong>
              </span>
              <span>
                Rămas de achitat{' '}
                <strong>{money(s.remaining, ed.currency)}</strong>
              </span>
            </div>
          </section>
          <section className="panel next-moment">
            <div className="eyebrow">URMĂTORUL MOMENT IMPORTANT</div>
            <CalendarDays className="moment-icon" />
            <h3>
              {list(es, 'schedule').sort((a, b) =>
                a.data.due.localeCompare(b.data.due),
              )[0]?.data.name || 'Scrieți următorul capitol'}
            </h3>
            <p>
              {list(es, 'schedule')[0]
                ? date(
                    list(es, 'schedule').sort((a, b) =>
                      a.data.due.localeCompare(b.data.due),
                    )[0].data.due,
                  )
                : 'Adăugați un termen în calendar.'}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                navigate('expense');
                setTab('schedule');
              }}
            >
              Vezi scadențele <ArrowUpRight />
            </Button>
          </section>
        </div>
        <div className="dashboard-note">
          <Heart size={15} /> Nu trebuie să fie totul perfect astăzi. Un pas mic
          e suficient.
        </div>
      </>
    );
  }
  function Generic({ kind }: { kind: string }) {
    const data = list(es, kind).filter(
      (r) =>
        !q || JSON.stringify(r.data).toLowerCase().includes(q.toLowerCase()),
    );
    const fields =
      schemas[kind]?.fields
        .filter(
          (f) =>
            ![
              'notes',
              'description',
              'message',
              'message_en',
              'faq',
              'logistics',
              'color',
              'needs',
              'allergies',
              'relative_days',
              'dependency_id',
            ].includes(f.key),
        )
        .slice(0, 6) || [];
    return (
      <>
        <div className="section-toolbar">
          <div className="search-control">
            <Search size={17} />
            <Input
              aria-label="Caută în listă"
              placeholder="Caută în listă…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {can(kind, 'export') && (
            <Button variant="outline" onClick={() => exportList(kind)}>
              <Download />
              Export CSV
            </Button>
          )}
          {can(kind, 'create') && (
            <Button onClick={() => edit(kind)}>
              <Plus />
              Adaugă {schemas[kind]?.singular.toLowerCase()}
            </Button>
          )}
        </div>
        {data.length ? (
          <div className="panel table-panel">
            <Table>
              <TableHeader>
                <TableRow>
                  {fields.map((f) => (
                    <TableHead key={f.key}>{f.label}</TableHead>
                  ))}
                  <TableHead>Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r.id}>
                    {fields.map((f, i) => (
                      <TableCell key={f.key}>
                        {f.type === 'money' ? (
                          money(r.data[f.key], r.data.currency || ed.currency)
                        ) : f.ref ? (
                          nameOf(r.data[f.key])
                        ) : f.type === 'boolean' ? (
                          r.data[f.key] ? (
                            'Da'
                          ) : (
                            'Nu'
                          )
                        ) : f.options ? (
                          <Badge value={r.data[f.key]} />
                        ) : (
                          <span className={i === 0 ? 'cell-title' : ''}>
                            {String(r.data[f.key] || '—')}
                          </span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="row-actions">
                        {can(kind, 'edit') && (
                          <Button variant="ghost" onClick={() => edit(kind, r)}>
                            Editează
                          </Button>
                        )}
                        {can(kind, 'delete') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={
                              'Șterge ' +
                              (r.data.name || schemas[kind].singular)
                            }
                            onClick={() => remove(kind, r.id)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty
            title="Lista este încă goală"
            text="Adaugă prima înregistrare pentru acest eveniment."
          />
        )}
      </>
    );
  }
  function Budget() {
    const current = tab || 'expense';
    return (
      <>
        <div className="metric-grid budget-metrics">
          <Metric
            label="Buget planificat"
            value={money(ed.budget, ed.currency)}
            icon={<Wallet />}
            caption="Limita pe care v-ați propus-o"
            accent="sage"
          />
          <Metric
            label="Estimat"
            value={money(s.estimated, ed.currency)}
            caption="Include costurile per persoană"
            icon={<ChartNoAxesCombined />}
            accent="sand"
          />
          <Metric
            label="Contractat"
            value={money(s.contracted, ed.currency)}
            caption="Valoarea angajată"
            icon={<FileText />}
            accent="rose"
          />
          <Metric
            label="Plătit net"
            value={money(s.paid, ed.currency)}
            caption="Plăți minus rambursări"
            icon={<Coins />}
            accent="lavender"
          />
        </div>
        {s.estimated > ed.budget && (
          <div className="warning-banner">
            <AlertCircle />
            Estimarea depășește bugetul cu{' '}
            {money(s.estimated - ed.budget, ed.currency)}.
          </div>
        )}
        <TabBar
          value={current}
          onChange={setTab}
          items={[
            'expense',
            'schedule',
            'payment',
            'refund',
            'contribution',
          ].map((v) => ({ value: v, label: schemas[v].label }))}
        />
        {current === 'payment' ||
        current === 'refund' ||
        current === 'contribution' ? (
          <div className="info-banner">
            <ShieldCheck size={18} />
            Înregistrări manuale de evidență. Aceste acțiuni nu transferă bani.
          </div>
        ) : null}
        {Generic({ kind: current })}
      </>
    );
  }
  function Tasks() {
    const view = tab || 'kanban';
    return (
      <>
        <TabBar
          value={view}
          onChange={setTab}
          items={[
            { value: 'kanban', label: 'Panou Kanban' },
            { value: 'list', label: 'Listă' },
            { value: 'calendar', label: 'Calendar' },
          ]}
        />
        {view === 'list' ? (
          Generic({ kind: 'task' })
        ) : view === 'calendar' ? (
          <CalendarView
            rows={list(es, 'task')}
            onEdit={(r) => edit('task', r)}
          />
        ) : (
          <div className="kanban">
            {['todo', 'progress', 'done'].map((status) => (
              <section
                key={status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const r = es.find(
                    (x) => x.id === e.dataTransfer.getData('text/plain'),
                  );
                  if (r?.kind === 'task') run(() => update(r, { status }));
                }}
              >
                <div className="kanban-title">
                  <Badge value={status} />
                  <span>
                    {
                      list(es, 'task').filter((t) => t.data.status === status)
                        .length
                    }
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={'Adaugă în ' + labels[status]}
                    onClick={() => edit('task', undefined, { status })}
                  >
                    <Plus />
                  </Button>
                </div>
                {list(es, 'task')
                  .filter((t) => t.data.status === status)
                  .map((t) => (
                    <article
                      className="task-card"
                      key={t.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData('text/plain', t.id)
                      }
                    >
                      <div className="task-card-top">
                        <Badge value={t.data.priority} />
                        <button
                          aria-label="Editează sarcina"
                          onClick={() => edit('task', t)}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
                      <h3>
                        <button onClick={() => edit('task', t)}>
                          {t.data.name}
                        </button>
                      </h3>
                      {t.data.description && <p>{t.data.description}</p>}
                      <div className="task-card-bottom">
                        <span>
                          <Calendar size={14} />
                          {t.data.due ? date(t.data.due) : 'Fără termen'}
                        </span>
                        <span className="avatar">
                          {(t.data.assignee || 'N')[0]}
                        </span>
                      </div>
                    </article>
                  ))}
                <button
                  className="kanban-add"
                  onClick={() => edit('task', undefined, { status })}
                >
                  <Plus size={16} />
                  Adaugă o sarcină
                </button>
              </section>
            ))}
          </div>
        )}
      </>
    );
  }
  function Invitations() {
    const mode = tab || 'design';
    const design = list(es, 'invitation')[0];
    return (
      <>
        <TabBar
          value={mode}
          onChange={setTab}
          items={[
            { value: 'design', label: 'Designul invitației' },
            { value: 'campaigns', label: 'Campanii & livrare' },
            { value: 'automation', label: 'Automatizări' },
            { value: 'rsvp', label: 'Răspunsuri RSVP' },
          ]}
        />
        {mode === 'design' ? (
          design ? (
            <div className="invitation-workspace">
              <section className="panel invitation-controls">
                <div className="panel-heading">
                  <div>
                    <h3>O invitație cu povestea voastră</h3>
                    <p>Personalizează, previzualizează și publică.</p>
                  </div>
                </div>
                <div className="invitation-controls-body">
                  <Badge
                    value={
                      design.data.published_at
                        ? 'Publicată · draft editabil'
                        : 'Draft'
                    }
                  />
                  <h4>{design.data.name}</h4>
                  <p>
                    Șablon {design.data.style}. O nouă publicare păstrează
                    linkurile trimise.
                  </p>
                  <div className="template-swatches">
                    {[
                      'Elegant',
                      'Minimalist',
                      'Floral',
                      'Modern',
                      'Rustic',
                      'Clasic',
                    ].map((style, i) => (
                      <button
                        className={
                          design.data.style === style ? 'selected' : ''
                        }
                        key={style}
                        onClick={() => run(() => update(design, { style }))}
                      >
                        <span className={'swatch swatch-' + i}>Aa</span>
                        {style}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => edit('invitation', design)}
                  >
                    <SlidersHorizontal />
                    Personalizează invitația
                  </Button>
                  <Button
                    onClick={() =>
                      run(
                        () =>
                          api(base + '/publish', 'POST', {
                            id: design.id,
                            version: event.version,
                          }),
                        'Invitația a fost publicată.',
                      )
                    }
                  >
                    <Check />
                    Publică această versiune
                  </Button>
                  <div className="divider" />
                  <label>Link personal pentru familie</label>
                  <Pick
                    label="Alege familia"
                    value={extras.family || ''}
                    onChange={(family) => setExtras({ ...extras, family })}
                    options={list(es, 'household').map((h) => ({
                      value: h.id,
                      label: h.data.name,
                    }))}
                  />
                  <Button
                    variant="outline"
                    disabled={!extras.family}
                    onClick={() => run(() => publicLink(extras.family), '')}
                  >
                    <LinkIcon />
                    Creează link RSVP
                  </Button>
                </div>
              </section>
              <section className="preview-zone">
                <div className="preview-label">
                  <span>PREVIZUALIZARE INVITAȚIE</span>
                  <button
                    onClick={() =>
                      setExtras({ ...extras, mobile: !extras.mobile })
                    }
                  >
                    {extras.mobile ? 'Desktop' : 'Telefon'}
                  </button>
                </div>
                <InvitationCard
                  event={event}
                  design={design.data}
                  mobile={extras.mobile}
                />
              </section>
            </div>
          ) : (
            blank
          )
        ) : mode === 'campaigns' ? (
          <>
            <div className="section-toolbar">
              <p className="muted">
                Răspunsul RSVP și livrarea mesajului sunt urmărite separat.
              </p>
              <Button
                onClick={() => {
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
              >
                <Send />
                Campanie nouă
              </Button>
            </div>
            {list(es, 'campaign').map((c) => (
              <div className="panel campaign-card" key={c.id}>
                <div>
                  <span className="eyebrow">
                    {c.data.channel?.toUpperCase()}
                  </span>
                  <h3>{c.data.name}</h3>
                </div>
                <Badge value={c.data.status} />
                <div className="row-actions">
                  <Button
                    variant="outline"
                    onClick={() =>
                      run(() =>
                        api(base + '/job-action', 'POST', {
                          campaign_id: c.id,
                          action: 'pause',
                          version: event.version,
                        }),
                      )
                    }
                  >
                    <Pause />
                    Pauză
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      run(() =>
                        api(base + '/job-action', 'POST', {
                          campaign_id: c.id,
                          action: 'resume',
                          version: event.version,
                        }),
                      )
                    }
                  >
                    <Play />
                    Reia
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setConfirmation(() => async () => {
                        await api(base + '/job-action', 'POST', {
                          campaign_id: c.id,
                          action: 'cancel',
                          version: event.version,
                        });
                      })
                    }
                  >
                    <X />
                    Anulează
                  </Button>
                </div>
              </div>
            ))}
            {ed.demo && (
              <Button
                variant="outline"
                onClick={() =>
                  run(
                    () => api(base + '/process-demo', 'POST', {}),
                    'Procesarea demo a fost executată; niciun mesaj real nu a plecat.',
                  )
                }
              >
                <Play />
                Procesează mesajele scadente în demo
              </Button>
            )}
            <div className="panel table-panel mt-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Familie</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Programare</TableHead>
                    <TableHead>Stare</TableHead>
                    <TableHead>Detalii</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state!.jobs.map((j: Data) => (
                    <TableRow key={j.id}>
                      <TableCell>{nameOf(j.household_id)}</TableCell>
                      <TableCell>{j.channel}</TableCell>
                      <TableCell>
                        {new Date(j.due_at).toLocaleString('ro-RO', {
                          timeZone: ed.timezone,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge value={j.status} />
                      </TableCell>
                      <TableCell>{j.error || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          Generic({ kind: mode === 'rsvp' ? 'rsvp' : 'automation' })
        )}
      </>
    );
  }
  function Checkin() {
    const sub = extras.sub || s.reception;
    const guests = list(es, 'guest').filter(
      (g) =>
        (!q || g.data.name.toLowerCase().includes(q.toLowerCase())) &&
        list(es, 'guest_invitation').some(
          (i) => i.data.guest_id === g.id && i.data.subevent_id === sub,
        ),
    );
    return (
      <>
        <div className="checkin-stats">
          <strong>
            {
              list(es, 'checkin').filter((c) => c.data.subevent_id === sub)
                .length
            }
            <span> persoane sosite</span>
          </strong>
          <Pick
            label="Subeveniment"
            value={sub}
            onChange={(v) => setExtras({ ...extras, sub: v })}
            options={list(es, 'subevent').map((s) => ({
              value: s.id,
              label: s.data.name,
            }))}
          />
        </div>
        <div className="search-control checkin-search">
          <Search />
          <Input
            autoFocus
            placeholder="Caută numele invitatului…"
            aria-label="Caută pentru check-in"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="section-toolbar">
          <QRScanner
            onCode={(qr) =>
              run(
                () =>
                  api(base + '/checkin', 'POST', {
                    qr,
                    subevent_id: sub,
                    version: event.version,
                  }),
                'Familie identificată și înregistrată prin QR.',
              )
            }
          />
          <Input
            aria-label="Cod QR de la cititor"
            placeholder="Scanează cu cititorul extern și apasă Enter"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value) {
                const qr = e.currentTarget.value;
                e.currentTarget.value = '';
                run(() =>
                  api(base + '/checkin', 'POST', {
                    qr,
                    subevent_id: sub,
                    version: event.version,
                  }),
                );
              }
            }}
          />
        </div>
        <div className="checkin-grid">
          {guests.slice(0, q ? 100 : 24).map((g) => {
            const check = list(es, 'checkin').find(
              (c) => c.data.guest_id === g.id && c.data.subevent_id === sub,
            );
            const a = list(es, 'assignment').find(
              (a) => a.data.guest_id === g.id && a.data.subevent_id === sub,
            );
            const r =
              list(es, 'rsvp').find(
                (r) => r.data.guest_id === g.id && r.data.subevent_id === sub,
              )?.data.status || 'pending';
            return (
              <article
                key={g.id}
                className={'panel checkin-card ' + (check ? 'arrived' : '')}
              >
                <div>
                  <h3>{g.data.name}</h3>
                  <p>{nameOf(g.data.household_id)}</p>
                  <span className="table-chip">
                    <Armchair size={15} />
                    {a
                      ? nameOf(a.data.table_id) + ' · loc ' + a.data.seat
                      : 'Fără masă'}
                  </span>
                  <Badge value={r} />
                  {check && (
                    <small>
                      Sosit la{' '}
                      {new Date(check.data.arrived_at).toLocaleTimeString(
                        'ro-RO',
                        { timeZone: ed.timezone },
                      )}
                    </small>
                  )}
                </div>
                <div>
                  <Button
                    variant={check ? 'outline' : 'default'}
                    disabled={!online}
                    onClick={() =>
                      run(
                        () =>
                          api(base + '/checkin', 'POST', {
                            guest_id: g.id,
                            subevent_id: sub,
                            undo: !!check,
                            version: event.version,
                          }),
                        check ? 'Check-in anulat.' : 'Sosire înregistrată.',
                      )
                    }
                  >
                    <Check />
                    {check ? 'Anulează' : 'A sosit'}
                  </Button>
                  {!check && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        run(
                          () =>
                            api(base + '/checkin', 'POST', {
                              household_id: g.data.household_id,
                              subevent_id: sub,
                              version: event.version,
                            }),
                          'Familia a fost înregistrată.',
                        )
                      }
                    >
                      Toată familia
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </>
    );
  }
  function Reports() {
    const menus = list(es, 'menu');
    return (
      <>
        <div className="report-grid">
          {list(es, 'subevent').map((sub) => {
            const invited = list(es, 'guest_invitation').filter(
              (i) => i.data.subevent_id === sub.id,
            );
            return (
              <section className="panel report-card" key={sub.id}>
                <CalendarDays />
                <h3>{sub.data.name}</h3>
                <strong>
                  {invited.length}
                  <small> persoane invitate</small>
                </strong>
                <div className="report-values">
                  {['confirmed', 'declined', 'pending'].map((status) => (
                    <div key={status}>
                      <Badge value={status} />
                      <b>
                        {
                          invited.filter(
                            (i) =>
                              (list(es, 'rsvp').find(
                                (r) =>
                                  r.data.subevent_id === sub.id &&
                                  r.data.guest_id === i.data.guest_id,
                              )?.data.status || 'pending') === status,
                          ).length
                        }
                      </b>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <section className="panel">
          <div className="panel-heading">
            <h3>Centralizator pentru locație</h3>
            <Button variant="outline" onClick={() => window.print()}>
              <Download />
              Tipărește / PDF
            </Button>
          </div>
          <div className="report-menus">
            {menus.map((m) => (
              <div key={m.id}>
                <Utensils />
                <span>{m.data.name}</span>
                <strong>
                  {
                    list(es, 'guest').filter(
                      (g) => g.data.menu_id === m.id && stat(g) === 'confirmed',
                    ).length
                  }
                </strong>
              </div>
            ))}
          </div>
          <div className="panel-bottom">
            <span>{s.unseated} invitați confirmați fără loc la masă</span>
            <Button variant="outline" onClick={() => exportList('guest')}>
              <Download />
              Lista invitaților cu mese
            </Button>
          </div>
        </section>
        <div className="report-grid mt-5">
          {[
            'guest',
            'expense',
            'payment',
            'vendor',
            'task',
            'transport_assignment',
            'room_assignment',
          ]
            .filter((k) => can(k, 'export'))
            .map((k) => (
              <button
                className="panel export-card"
                key={k}
                onClick={() => exportList(k)}
              >
                <FileText />
                <span>
                  {schemas[k].label}
                  <small>Export CSV</small>
                </span>
                <Download size={18} />
              </button>
            ))}
        </div>
      </>
    );
  }
  function SettingsPage() {
    return (
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Evenimentul vostru</h3>
              <p>Datele care țin totul împreună.</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setForm({ ...ed, name: event.name, budget: ed.budget / 100 });
                setModal({ type: 'event', id: eventId });
              }}
            >
              Editează
            </Button>
          </div>
          <dl className="settings-list">
            <div>
              <dt>Nume</dt>
              <dd>{event.name}</dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>{date(ed.date)}</dd>
            </div>
            <div>
              <dt>Locație</dt>
              <dd>{ed.venue || 'De stabilit'}</dd>
            </div>
            <div>
              <dt>Fus orar</dt>
              <dd>{ed.timezone}</dd>
            </div>
            <div>
              <dt>Moneda</dt>
              <dd>{ed.currency}</dd>
            </div>
            <div>
              <dt>Numele platformei</dt>
              <dd>{ed.app_name || 'NuntaNoastră'}</dd>
            </div>
          </dl>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>Cont & siguranță</h3>
          </div>
          <div className="settings-actions">
            <p>{me!.email}</p>
            <Badge
              value={
                me!.demo
                  ? 'Cont demonstrativ'
                  : me!.verified
                    ? 'Email verificat'
                    : 'Email neverificat'
              }
            />
            {!me!.demo && !me!.verified && (
              <Button
                variant="outline"
                onClick={() =>
                  run(
                    () => api('auth/verify', 'POST', {}),
                    'Cererea de verificare a fost acceptată.',
                  )
                }
              >
                Verifică emailul
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() =>
                setConfirmation(() => async () => {
                  await api('sessions', 'DELETE');
                  setMe(null);
                  setState(null);
                })
              }
            >
              Închide toate sesiunile
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                run(async () => {
                  setExtras(await api(base + '/audit'));
                  setModal({ type: 'audit' });
                }, '')
              }
            >
              <ShieldCheck />
              Jurnal de audit
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                run(async () => {
                  setExtras(await api(base + '/trash'));
                  setModal({ type: 'trash' });
                }, '')
              }
            >
              <Archive />
              Elemente șterse
            </Button>
          </div>
        </section>
        <div className="full">
          <h3 className="subheading">Momentele evenimentului</h3>
          {Generic({ kind: 'subevent' })}
        </div>
      </div>
    );
  }
  function Team() {
    return (
      <>
        <div className="info-banner">
          <ShieldCheck />
          Permisiunile sunt verificate pe server pentru fiecare operațiune.
        </div>
        <section className="panel">
          <div className="panel-heading">
            <h3>Echipa voastră</h3>
            <Button onClick={add}>
              <UserRoundPlus />
              Invită un membru
            </Button>
          </div>
          <div className="team-row">
            <span className="avatar">{me!.name[0]}</span>
            <div>
              <strong>{me!.name}</strong>
              <small>{me!.email}</small>
            </div>
            <Badge
              value={state!.role === 'owner' ? 'Proprietar' : state!.role}
            />
          </div>
          {extras.members?.map((m: Data) => (
            <div className="team-row" key={m.user_id}>
              <span className="avatar">{m.name[0]}</span>
              <div>
                <strong>{m.name}</strong>
                <small>{m.email}</small>
              </div>
              <Badge value={m.role} />
              <Button
                variant="ghost"
                onClick={() =>
                  setConfirmation(() => async () => {
                    await api(base + '/team', 'DELETE', {
                      user_id: m.user_id,
                      version: event.version,
                    });
                    setExtras(await api(base + '/team'));
                  })
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {extras.invites?.map((m: Data, i: number) => (
            <div className="team-row" key={i}>
              <Mail />
              <div>
                <strong>{m.email}</strong>
                <small>
                  {m.used_at ? 'Acceptată' : 'Link creat · în așteptare'}
                </small>
              </div>
              <Badge value={m.role} />
            </div>
          ))}
        </section>
      </>
    );
  }
  function Documents() {
    return (
      <>
        <div className="info-banner">
          <ShieldCheck />
          Fișiere private. O copie de contract încărcată nu reprezintă o
          semnătură electronică.
        </div>
        <div className="section-toolbar">
          <p>Oferte, contracte și detaliile importante.</p>
          <Button onClick={add}>
            <Upload />
            Încarcă document
          </Button>
        </div>
        <div className="report-grid">
          {extras.items?.map((d: Data) => (
            <a
              className="panel export-card"
              key={d.id}
              href={'/api/' + base + '/documents/' + d.id}
            >
              <FileText />
              <span>
                {d.name}
                <small>
                  {Math.ceil(d.size / 1024)} KB · versiunea {d.version}
                </small>
              </span>
              <Download />
            </a>
          ))}
        </div>
        {!extras.items?.length && (
          <Empty
            title="Toate documentele, în siguranță"
            text="Adaugă primul PDF, JPG, PNG sau TXT (maximum 5 MB)."
          />
        )}
      </>
    );
  }
  const renderPage = () => {
    if (!state)
      return (
        <div className="boot">
          <Loader2 className="spin" />
          <p>Încărcăm evenimentul…</p>
        </div>
      );
    if (page === 'dashboard') return Dashboard();
    if (page === 'guest')
      return (
        <>
          <TabBar
            value={tab || 'guest'}
            onChange={setTab}
            items={[
              { value: 'guest', label: `Persoane (${s.total})` },
              { value: 'household', label: `Familii (${s.households})` },
              {
                value: 'guest_invitation',
                label: 'Invitații pe subevenimente',
              },
            ]}
          />
          {!tab || tab === 'guest' ? GuestTable() : Generic({ kind: tab })}
        </>
      );
    if (page === 'expense') return Budget();
    if (page === 'task') return Tasks();
    if (page === 'invitation') return Invitations();
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
    if (page === 'checkin') return Checkin();
    if (page === 'reports') return Reports();
    if (page === 'settings') return SettingsPage();
    if (page === 'team') return Team();
    if (page === 'document') return Documents();
    if (page === 'integrations')
      return (
        <div className="integration-grid">
          {state.integrations.map((i: Data) => (
            <section className="panel integration-card" key={i.id}>
              <div className="integration-logo">
                {i.id === 'email' ? (
                  <Mail />
                ) : i.id === 'stripe' ? (
                  <Coins />
                ) : i.id === 'worker' ? (
                  <Clock />
                ) : (
                  <MessageSquare />
                )}
              </div>
              <h3>{i.name}</h3>
              <Badge
                value={i.configured ? 'Configurată' : 'Integrare neconfigurată'}
              />
              <p>{i.description}</p>
              <details>
                <summary>Cerințe de configurare</summary>
                <p>{i.required}</p>
                <p>
                  Configurarea secretelor se face pe server, de către
                  administrator.
                </p>
              </details>
            </section>
          ))}
        </div>
      );
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
              {Generic({ kind: tab || 'timeline' })}
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
          {Generic({ kind })}
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
    return Generic({ kind: page });
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
              {ed.app_name || 'NuntaNoastră'}
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
          <button
            className="new-event"
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
          <span>{ed.app_name || 'NuntaNoastră'}</span>
          <span>Planificat cu grijă. Trăit cu bucurie.</span>
          <Heart size={13} />
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 />
          {toast}
        </div>
      )}
      {busy && (
        <div className="busy-indicator" role="status">
          <Loader2 className="spin" />
          Se salvează…
        </div>
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
                run(saveEntity);
              }}
            >
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
                run(async () => {
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
                run(async () => {
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
                run(fn);
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
function Metric({
  label,
  value,
  caption,
  icon,
  accent,
  onClick,
  progress,
}: {
  label: string;
  value: ReactNode;
  caption?: string;
  icon: ReactNode;
  accent: string;
  onClick?: () => void;
  progress?: number;
}) {
  return (
    <button className="panel metric" onClick={onClick} disabled={!onClick}>
      <div className="metric-top">
        <span>{label}</span>
        <span className={'metric-icon ' + accent}>{icon}</span>
      </div>
      <strong className="metric-number">{value}</strong>
      {progress !== undefined && (
        <Progress
          value={Math.min(100, progress)}
          className={'metric-progress ' + accent}
        />
      )}
      <span className="metric-caption">{caption}</span>
    </button>
  );
}
function AuthScreen({
  error,
  busy,
  onAction,
}: {
  error: string;
  busy: boolean;
  onAction: (mode: string, d: Data) => Promise<any>;
}) {
  const [mode, setMode] = useState('login'),
    [form, setForm] = useState<Data>({});
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('account_token')) {
      setMode('consume');
      setForm({ token: params.get('account_token') });
    }
  }, []);
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-icon">
            <Heart />
          </span>
          NuntaNoastră
        </div>
        <div>
          <div className="eyebrow">UN NOU CAPITOL, ÎMPREUNĂ</div>
          <h1>
            Voi vă iubiți.
            <br />
            Planurile își
            <br />
            găsesc locul.
          </h1>
          <p>
            Invitați, momente, oameni dragi și toate detaliile dintre ele. Un
            singur spațiu pentru ziua voastră.
          </p>
          <div className="auth-features">
            <span>
              <Users />
              Invitați & RSVP
            </span>
            <span>
              <Armchair />
              Planul meselor
            </span>
            <span>
              <Wallet />
              Buget & plăți
            </span>
          </div>
        </div>
        <small>Planificat cu grijă. Trăit cu bucurie.</small>
      </section>
      <section className="auth-form-area">
        <div className="auth-form">
          <Heart className="auth-heart" />
          <h2>
            {mode === 'register'
              ? 'Povestea voastră începe aici'
              : mode === 'recover'
                ? 'Recuperează accesul'
                : mode === 'consume'
                  ? 'Confirmă accesul'
                  : 'Bine ai revenit'}
          </h2>
          <p>
            {mode === 'register'
              ? 'Creează un cont și organizează prima voastră nuntă.'
              : 'Un loc pentru toate planurile voastre.'}
          </p>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAction(mode, form);
            }}
          >
            {mode === 'register' && (
              <FieldControl
                field={{ key: 'name', label: 'Numele tău', required: true }}
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
            )}{' '}
            {mode !== 'consume' && (
              <FieldControl
                field={{
                  key: 'email',
                  label: 'Adresa de email',
                  type: 'email',
                  required: true,
                }}
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
            )}{' '}
            {mode !== 'recover' && (
              <FieldControl
                field={{
                  key: 'password',
                  label:
                    mode === 'register' || mode === 'consume'
                      ? 'Parolă (minimum 12 caractere)'
                      : 'Parolă',
                  type: 'password',
                  required: true,
                }}
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
              />
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
          <div className="auth-links">
            <button
              onClick={() =>
                setMode(mode === 'register' ? 'login' : 'register')
              }
            >
              {mode === 'register'
                ? 'Ai deja cont? Autentifică-te'
                : 'Nu ai cont? Înregistrează-te'}
            </button>
            <button onClick={() => setMode('recover')}>Ai uitat parola?</button>
          </div>
          <div className="or-divider">
            <span>sau descoperă aplicația</span>
          </div>
          <Button
            className="demo-button"
            variant="outline"
            disabled={busy}
            onClick={() => onAction('demo', {})}
          >
            <Flower2 />
            Explorează nunta Sofiei & a lui Andrei
          </Button>
          <p className="auth-note">
            Demo cu date fictive și salvare reală.
            <br />
            Nu trimite mesaje și nu procesează bani.
          </p>
        </div>
      </section>
    </div>
  );
}
export function InvitationCard({
  event,
  design,
  mobile = false,
}: {
  event: Data;
  design: Data;
  mobile?: boolean;
}) {
  return (
    <div
      className={
        'invitation-card style-' +
        design.style?.toLowerCase() +
        (mobile ? ' mobile-preview' : '')
      }
      style={
        { '--invite-color': design.color || '#536b57' } as React.CSSProperties
      }
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
        <div className="invitation-date">
          {event.data.date ? date(event.data.date) : 'O dată de neuitat'}
        </div>
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
  entities: es,
  reception,
  busy,
  onEdit,
  onMove,
  onAssign,
  onExport,
}: {
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
        <Button variant="outline" onClick={() => onEdit('decor')}>
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
                          disabled={busy}
                          onDoubleClick={() => onEdit('table', t)}
                          onPointerDown={(e) => {
                            if (t.data.locked) return;
                            e.currentTarget.setPointerCapture(e.pointerId);
                            drag.current = {
                              id: t.id,
                              x: t.data.x,
                              y: t.data.y,
                              cx: e.clientX,
                              cy: e.clientY,
                            };
                          }}
                          onPointerMove={(e) => {
                            const d = drag.current;
                            if (d?.id === t.id)
                              setMoving({
                                id: t.id,
                                x: Math.max(
                                  0,
                                  Math.min(
                                    850,
                                    Math.round(
                                      (d.x + (e.clientX - d.cx) / zoom) / 10,
                                    ) * 10,
                                  ),
                                ),
                                y: Math.max(
                                  0,
                                  Math.min(
                                    750,
                                    Math.round(
                                      (d.y + (e.clientY - d.cy) / zoom) / 10,
                                    ) * 10,
                                  ),
                                ),
                              });
                          }}
                          onPointerUp={() => {
                            if (moving?.id === t.id)
                              onMove(t, moving.x, moving.y);
                            drag.current = null;
                            setMoving(null);
                          }}
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
                      style={{
                        left: d.data.x,
                        top: d.data.y,
                        width: d.data.width,
                        height: d.data.height,
                      }}
                      onClick={() => onEdit('decor', d)}
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
            <span>Trage mesele pe grilă. Dublu clic pentru detalii.</span>
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
    'PRODID:-//NuntaNoastra//RO',
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
