'use client';
import { memo, useMemo } from 'react';
import { Armchair, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Entity, list } from '@/lib/domain';
import { Badge, Pick } from '../controls';
import { QRScanner } from '../files';

export const CheckinPage = memo(function CheckinPage({
  entities,
  subeventId,
  query,
  timezone,
  online,
  setSubevent,
  setQuery,
  nameOf,
  scan,
  toggleGuest,
  checkHousehold,
}: {
  entities: Entity[];
  subeventId: string;
  query: string;
  timezone: string;
  online: boolean;
  setSubevent: (id: string) => void;
  setQuery: (query: string) => void;
  nameOf: (id: string) => string;
  scan: (qr: string, subeventId: string) => void;
  toggleGuest: (guest: Entity, subeventId: string, undo: boolean) => void;
  checkHousehold: (householdId: string, subeventId: string) => void;
}) {
  const guests = useMemo(() => {
    const invitations = list(entities, 'guest_invitation');
    const normalized = query.toLowerCase();
    return list(entities, 'guest').filter(
      (guest) =>
        (!normalized || guest.data.name.toLowerCase().includes(normalized)) &&
        invitations.some(
          (invitation) => invitation.data.guest_id === guest.id && invitation.data.subevent_id === subeventId,
        ),
    );
  }, [entities, query, subeventId]);
  const checkins = useMemo(() => list(entities, 'checkin'), [entities]);
  const assignments = useMemo(() => list(entities, 'assignment'), [entities]);
  const rsvps = useMemo(() => list(entities, 'rsvp'), [entities]);
  const subevents = useMemo(() => list(entities, 'subevent'), [entities]);
  return (
    <>
      <div className="checkin-stats">
        <strong>{checkins.filter((record) => record.data.subevent_id === subeventId).length}<span> persoane sosite</span></strong>
        <Pick label="Subeveniment" value={subeventId} onChange={setSubevent} options={subevents.map((record) => ({ value: record.id, label: record.data.name }))} />
      </div>
      <div className="search-control checkin-search">
        <Search />
        <Input placeholder="Caută numele invitatului…" aria-label="Caută pentru check-in" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="section-toolbar">
        <QRScanner onCode={(qr) => scan(qr, subeventId)} />
        <Input aria-label="Cod QR de la cititor" placeholder="Scanează cu cititorul extern și apasă Enter" onKeyDown={(event) => {
          if (event.key === 'Enter' && event.currentTarget.value) {
            const qr = event.currentTarget.value;
            event.currentTarget.value = '';
            scan(qr, subeventId);
          }
        }} />
      </div>
      <div className="checkin-grid">
        {guests.slice(0, query ? 100 : 24).map((guest) => {
          const checkin = checkins.find((record) => record.data.guest_id === guest.id && record.data.subevent_id === subeventId);
          const assignment = assignments.find((record) => record.data.guest_id === guest.id && record.data.subevent_id === subeventId);
          const status = rsvps.find((record) => record.data.guest_id === guest.id && record.data.subevent_id === subeventId)?.data.status || 'pending';
          return (
            <article key={guest.id} className={'panel checkin-card ' + (checkin ? 'arrived' : '')}>
              <div>
                <h3>{guest.data.name}</h3>
                <p>{nameOf(guest.data.household_id)}</p>
                <span className="table-chip"><Armchair size={15} />{assignment ? nameOf(assignment.data.table_id) + ' · loc ' + assignment.data.seat : 'Fără masă'}</span>
                <Badge value={status} />
                {checkin && <small>Sosit la {new Date(checkin.data.arrived_at).toLocaleTimeString('ro-RO', { timeZone: timezone })}</small>}
              </div>
              <div>
                <Button variant={checkin ? 'outline' : 'default'} disabled={!online} onClick={() => toggleGuest(guest, subeventId, !!checkin)}><Check />{checkin ? 'Anulează' : 'A sosit'}</Button>
                {!checkin && <Button variant="ghost" onClick={() => checkHousehold(guest.data.household_id, subeventId)}>Toată familia</Button>}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
});
