'use client';
import { memo } from 'react';
import { Mail, ShieldCheck, Trash2, UserRoundPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Data } from '@/lib/domain';
import { Badge } from '../controls';

export const TeamPage = memo(function TeamPage({
  me,
  role,
  data,
  add,
  remove,
}: {
  me: Data;
  role: string;
  data: Data;
  add: () => void;
  remove: (userId: string) => void;
}) {
  return <>
    <div className="info-banner"><ShieldCheck />Permisiunile sunt verificate pe server pentru fiecare operațiune.</div>
    <section className="panel">
      <div className="panel-heading"><h3>Echipa voastră</h3><Button onClick={add}><UserRoundPlus />Invită un membru</Button></div>
      <div className="team-row">
        <span className="avatar">{me.name[0]}</span><div><strong>{me.name}</strong><small>{me.email}</small></div>
        <Badge value={role === 'owner' ? 'Proprietar' : role} />
      </div>
      {data.members?.map((member: Data) => (
        <div className="team-row" key={member.user_id}>
          <span className="avatar">{member.name[0]}</span><div><strong>{member.name}</strong><small>{member.email}</small></div>
          <Badge value={member.role} />
          <Button variant="ghost" onClick={() => remove(member.user_id)}><Trash2 /></Button>
        </div>
      ))}
      {data.invites?.map((invite: Data, index: number) => (
        <div className="team-row" key={index}>
          <Mail /><div><strong>{invite.email}</strong><small>{invite.used_at ? 'Acceptată' : 'Link creat · în așteptare'}</small></div><Badge value={invite.role} />
        </div>
      ))}
    </section>
  </>;
});
