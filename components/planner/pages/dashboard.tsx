'use client';
import { memo, ReactNode, useMemo } from 'react';
import {
  Armchair,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Heart,
  Mail,
  MapPin,
  Plus,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Data, Entity, list, money } from '@/lib/domain';

const formatDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(value + 'T12:00:00'))
    : 'Data nu este stabilită';

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
      <div className="metric-top"><span>{label}</span><span className={'metric-icon ' + accent}>{icon}</span></div>
      <strong className="metric-number">{value}</strong>
      {progress !== undefined && <Progress value={Math.min(100, progress)} className={'metric-progress ' + accent} />}
      <span className="metric-caption">{caption}</span>
    </button>
  );
}

export const DashboardPage = memo(function DashboardPage({
  event,
  entities,
  stats,
  today,
  jobs,
  edit,
  navigate,
  setTab,
  completeTask,
}: {
  event: Data;
  entities: Entity[];
  stats: Data;
  today: number;
  jobs: Data[];
  edit: (kind: string, record?: Entity) => void;
  navigate: (page: string, filter?: string) => void;
  setTab: (tab: string) => void;
  completeTask: (task: Entity) => void;
}) {
  const eventData = event.data || {};
  const tasks = useMemo(() => list(entities, 'task'), [entities]);
  const expenses = useMemo(() => list(entities, 'expense'), [entities]);
  const schedules = useMemo(() => list(entities, 'schedule'), [entities]);
  const done = useMemo(() => tasks.filter((task) => task.data.status === 'done').length, [tasks]);
  const total = tasks.length;
  const days = eventData.date ? Math.ceil((Date.parse(eventData.date) - today) / 86400000) : null;
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
            {(eventData.partner1 || event.name)[0]}
            <span>&</span>
            {(eventData.partner2 || 'A')[0]}
          </div>
          <div className="event-banner-copy">
            <div className="eyebrow">NE CĂSĂTORIM</div>
            <h2>{event.name}</h2>
            <div className="event-details">
              <span>
                <CalendarDays />
                {formatDate(eventData.date)}
              </span>
              <span>
                <MapPin />
                {eventData.venue || eventData.city || 'Locație de stabilit'}
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
            value={stats.confirmed}
            caption={`din ${stats.total} persoane invitate`}
            icon={<Users />}
            accent="sage"
            onClick={() => navigate('guest', 'confirmed')}
            progress={stats.total ? (stats.confirmed / stats.total) * 100 : 0}
          />
          <Metric
            label="Buget planificat"
            value={money(eventData.budget, eventData.currency)}
            caption={`${money(stats.paid, eventData.currency)} plăți nete înregistrate`}
            icon={<Wallet />}
            accent="sand"
            onClick={() => navigate('expense')}
            progress={eventData.budget ? (stats.paid / eventData.budget) * 100 : 0}
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
            value={stats.unseated}
            caption="invitați confirmați fără masă"
            icon={<Armchair />}
            accent="lavender"
            onClick={() => navigate('guest', 'unseated')}
            progress={
              stats.confirmed ? ((stats.confirmed - stats.unseated) / stats.confirmed) * 100 : 0
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
                  background: `conic-gradient(#66836b 0 ${stats.total ? (stats.confirmed / stats.total) * 100 : 0}%, #d8bea1 0 ${stats.total ? ((stats.confirmed + stats.pending) / stats.total) * 100 : 0}%, #e4e7e1 0)`,
                }}
              >
                <div>
                  <strong>{stats.total}</strong>
                  <span>persoane invitate</span>
                </div>
              </div>
              <div className="legend">
                {[
                  ['confirmed', stats.confirmed, 'Au confirmat'],
                  ['pending', stats.pending, 'Așteptăm răspuns'],
                  ['declined', stats.declined, 'Nu pot participa'],
                ].map(([v, n, t]) => (
                  <button key={v} onClick={() => navigate('guest', String(v))}>
                    <span className={'dot dot-' + v} />
                    <span>{t}</span>
                    <strong>{n}</strong>
                    <ChevronRight size={14} />
                  </button>
                ))}
                <div className="people-totals">
                  {stats.adults} adulți <span>·</span> {stats.children} copii{' '}
                  <span>·</span> {stats.households} familii
                </div>
              </div>
            </div>
            <div className="panel-bottom">
              <Mail size={17} />
              <span>
                {
                  (jobs || []).filter((j: Data) => j.status === 'queued')
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
              {tasks
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
                        completeTask(t)
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
                        {t.data.due ? formatDate(t.data.due) : 'Fără termen'}
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
              {expenses
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
                                (x.data.contracted / (eventData.budget || 1)) * 200,
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
                Contractat <strong>{money(stats.contracted, eventData.currency)}</strong>
              </span>
              <span>
                Rămas de achitat{' '}
                <strong>{money(stats.remaining, eventData.currency)}</strong>
              </span>
            </div>
          </section>
          <section className="panel next-moment">
            <div className="eyebrow">URMĂTORUL MOMENT IMPORTANT</div>
            <CalendarDays className="moment-icon" />
            <h3>
              {schedules.sort((a, b) =>
                a.data.due.localeCompare(b.data.due),
              )[0]?.data.name || 'Scrieți următorul capitol'}
            </h3>
            <p>
              {schedules[0]
                ? formatDate(
                    schedules.sort((a, b) =>
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

});
