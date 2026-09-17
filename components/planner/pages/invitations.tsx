'use client';
import { memo, ReactNode, useMemo } from 'react';
import { Pause, Play, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Data, Entity, list } from '@/lib/domain';
import { Badge, TabBar } from '../controls';
import { InvitationStudio } from '../invitation-studio';

export const InvitationsPage = memo(function InvitationsPage({
  mode,
  event,
  entities,
  jobs,
  blank,
  alternateContent,
  canEdit,
  setTab,
  openCampaign,
  save,
  publish,
  createLink,
  jobAction,
  confirmCancel,
  processDemo,
  nameOf,
}: {
  mode: string;
  event: Data;
  entities: Entity[];
  jobs: Data[];
  blank: ReactNode;
  alternateContent: ReactNode;
  canEdit: boolean;
  setTab: (value: string) => void;
  openCampaign: () => void;
  save: (design: Entity, data: Data) => Promise<Data>;
  publish: (design: Entity, data: Data) => Promise<Data>;
  createLink: (id: string) => Promise<void>;
  jobAction: (campaignId: string, action: string) => void;
  confirmCancel: (campaignId: string) => void;
  processDemo: () => void;
  nameOf: (id: string) => string;
}) {
  const design = useMemo(() => list(entities, 'invitation')[0], [entities]);
  const families = useMemo(() => list(entities, 'household'), [entities]);
  const campaigns = useMemo(() => list(entities, 'campaign'), [entities]);
  const data = event.data || {};
  return (
    <>
      <TabBar value={mode} onChange={setTab} items={[
        { value: 'design', label: 'Designul invitației' },
        { value: 'campaigns', label: 'Campanii & livrare' },
        { value: 'automation', label: 'Automatizări' },
        { value: 'rsvp', label: 'Răspunsuri RSVP' },
      ]} />
      {mode === 'design' ? design ? (
        <InvitationStudio
          key={design.id + ':' + design.version}
          event={event}
          design={design}
          readOnly={!canEdit}
          families={families}
          onSave={(updated) => save(design, updated)}
          onPublish={(updated) => publish(design, updated)}
          onLink={createLink}
        />
      ) : blank : mode === 'campaigns' ? (
        <>
          <div className="section-toolbar">
            <p className="muted">Răspunsul RSVP și livrarea mesajului sunt urmărite separat.</p>
            <Button onClick={openCampaign}><Send />Campanie nouă</Button>
          </div>
          {campaigns.map((campaign) => (
            <div className="panel campaign-card" key={campaign.id}>
              <div><span className="eyebrow">{campaign.data.channel?.toUpperCase()}</span><h3>{campaign.data.name}</h3></div>
              <Badge value={campaign.data.status} />
              <div className="row-actions">
                <Button variant="outline" onClick={() => jobAction(campaign.id, 'pause')}><Pause />Pauză</Button>
                <Button variant="outline" onClick={() => jobAction(campaign.id, 'resume')}><Play />Reia</Button>
                <Button variant="ghost" onClick={() => confirmCancel(campaign.id)}><X />Anulează</Button>
              </div>
            </div>
          ))}
          {data.demo && <Button variant="outline" onClick={processDemo}><Play />Procesează mesajele scadente în demo</Button>}
          <div className="panel table-panel mt-5">
            <Table>
              <TableHeader><TableRow><TableHead>Familie</TableHead><TableHead>Canal</TableHead><TableHead>Programare</TableHead><TableHead>Stare</TableHead><TableHead>Detalii</TableHead></TableRow></TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{nameOf(job.household_id)}</TableCell>
                    <TableCell>{job.channel}</TableCell>
                    <TableCell>{new Date(job.due_at).toLocaleString('ro-RO', { timeZone: data.timezone })}</TableCell>
                    <TableCell><Badge value={job.status} /></TableCell>
                    <TableCell>{job.error || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : alternateContent}
    </>
  );
});
