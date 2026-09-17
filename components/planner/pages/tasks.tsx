'use client';
import { memo, ReactNode, useMemo, useState } from 'react';
import { Calendar, MoreHorizontal, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Entity, labels } from '@/lib/domain';
import { Badge, TabBar } from '../controls';

function CalendarView({ rows, onEdit }: { rows: Entity[]; onEdit: (row: Entity) => void }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const start = new Date(month + '-01T12:00:00');
  const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const offset = (start.getDay() + 6) % 7;
  const byDay = useMemo(() => {
    const result = new Map<string, Entity[]>();
    for (const row of rows) {
      const day = row.data.due || row.data.date;
      if (!day) continue;
      result.set(day, [...(result.get(day) || []), row]);
    }
    return result;
  }, [rows]);
  return (
    <section className="panel calendar-panel">
      <div className="panel-heading">
        <h3>{start.toLocaleString('ro-RO', { month: 'long', year: 'numeric' })}</h3>
        <Input type="month" value={month} aria-label="Luna calendarului" onChange={(event) => setMonth(event.target.value || month)} />
      </div>
      <div className="calendar-grid">
        {['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
        {Array.from({ length: offset }, (_, index) => <div className="calendar-day outside" key={'blank' + index} />)}
        {Array.from({ length: days }, (_, index) => {
          const day = month + '-' + String(index + 1).padStart(2, '0');
          return (
            <div className={'calendar-day ' + (day === new Date().toISOString().slice(0, 10) ? 'today' : '')} key={day}>
              <span>{index + 1}</span>
              {(byDay.get(day) || []).map((row) => <button onClick={() => onEdit(row)} key={row.id}>{row.data.start} {row.data.name}</button>)}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const TasksPage = memo(function TasksPage({
  view,
  tasks,
  listContent,
  setTab,
  edit,
  move,
  formatDate,
}: {
  view: string;
  tasks: Entity[];
  listContent: ReactNode;
  setTab: (value: string) => void;
  edit: (record?: Entity, initial?: Record<string, unknown>) => void;
  move: (record: Entity, status: string) => void;
  formatDate: (value: string) => string;
}) {
  const grouped = useMemo(
    () => Object.fromEntries(['todo', 'progress', 'done'].map((status) => [status, tasks.filter((task) => task.data.status === status)])),
    [tasks],
  );
  return (
    <>
      <TabBar value={view} onChange={setTab} items={[
        { value: 'kanban', label: 'Panou Kanban' },
        { value: 'list', label: 'Listă' },
        { value: 'calendar', label: 'Calendar' },
      ]} />
      {view === 'list' ? listContent : view === 'calendar' ? (
        <CalendarView rows={tasks} onEdit={(record) => edit(record)} />
      ) : (
        <div className="kanban">
          {['todo', 'progress', 'done'].map((status) => (
            <section key={status} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
              event.preventDefault();
              const record = tasks.find((task) => task.id === event.dataTransfer.getData('text/plain'));
              if (record) move(record, status);
            }}>
              <div className="kanban-title">
                <Badge value={status} />
                <span>{grouped[status].length}</span>
                <Button variant="ghost" size="icon" aria-label={'Adaugă în ' + labels[status]} onClick={() => edit(undefined, { status })}><Plus /></Button>
              </div>
              {grouped[status].map((task) => (
                <article className="task-card" key={task.id}>
                  <div className="task-card-top">
                    <Badge value={task.data.priority} />
                    <button aria-label="Editează sarcina" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', task.id)} onClick={() => edit(task)}><MoreHorizontal size={18} /></button>
                  </div>
                  <h3><button onClick={() => edit(task)}>{task.data.name}</button></h3>
                  {task.data.description && <p>{task.data.description}</p>}
                  <div className="task-card-bottom">
                    <span><Calendar size={14} />{task.data.due ? formatDate(task.data.due) : 'Fără termen'}</span>
                    <span className="avatar">{(task.data.assignee || 'N')[0]}</span>
                  </div>
                </article>
              ))}
              <button className="kanban-add" onClick={() => edit(undefined, { status })}><Plus size={16} />Adaugă o sarcină</button>
            </section>
          ))}
        </div>
      )}
    </>
  );
});
