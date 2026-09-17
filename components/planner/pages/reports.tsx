'use client';
import { memo, useMemo } from 'react';
import { CalendarDays, Download, FileText, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Data, Entity, list, schemas } from '@/lib/domain';
import { Badge } from '../controls';

export const ReportsPage = memo(function ReportsPage({
  entities,
  summary,
  canExport,
  exportList,
  guestStatus,
}: {
  entities: Entity[];
  summary: Data;
  canExport: (kind: string) => boolean;
  exportList: (kind: string) => void;
  guestStatus: (guest: Entity) => string;
}) {
  const data = useMemo(
    () => ({
      menus: list(entities, 'menu'),
      subevents: list(entities, 'subevent'),
      invitations: list(entities, 'guest_invitation'),
      responses: list(entities, 'rsvp'),
      guests: list(entities, 'guest'),
    }),
    [entities],
  );
  return (
    <>
      <div className="report-grid">
        {data.subevents.map((sub) => {
          const invited = data.invitations.filter(
            (invitation) => invitation.data.subevent_id === sub.id,
          );
          return (
            <section className="panel report-card" key={sub.id}>
              <CalendarDays />
              <h3>{sub.data.name}</h3>
              <strong>{invited.length}<small> persoane invitate</small></strong>
              <div className="report-values">
                {['confirmed', 'declined', 'pending'].map((status) => (
                  <div key={status}>
                    <Badge value={status} />
                    <b>{invited.filter((invitation) =>
                      (data.responses.find((response) =>
                        response.data.subevent_id === sub.id &&
                        response.data.guest_id === invitation.data.guest_id,
                      )?.data.status || 'pending') === status,
                    ).length}</b>
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
          <Button variant="outline" onClick={() => window.print()}><Download />Tipărește / PDF</Button>
        </div>
        <div className="report-menus">
          {data.menus.map((menu) => (
            <div key={menu.id}>
              <Utensils /><span>{menu.data.name}</span>
              <strong>{data.guests.filter((guest) => guest.data.menu_id === menu.id && guestStatus(guest) === 'confirmed').length}</strong>
            </div>
          ))}
        </div>
        <div className="panel-bottom">
          <span>{summary.unseated} invitați confirmați fără loc la masă</span>
          <Button variant="outline" onClick={() => exportList('guest')}><Download />Lista invitaților cu mese</Button>
        </div>
      </section>
      <div className="report-grid mt-5">
        {['guest', 'expense', 'payment', 'vendor', 'task', 'transport_assignment', 'room_assignment']
          .filter(canExport)
          .map((kind) => (
            <button className="panel export-card" key={kind} onClick={() => exportList(kind)}>
              <FileText /><span>{schemas[kind].label}<small>Export CSV</small></span><Download size={18} />
            </button>
          ))}
      </div>
    </>
  );
});
