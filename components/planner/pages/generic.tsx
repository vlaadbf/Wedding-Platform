'use client';
import { memo, useMemo } from 'react';
import { Download, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Entity, list, money, schemas } from '@/lib/domain';
import { Badge, Empty } from '../controls';

export const GenericPage = memo(function GenericPage({
  kind,
  entities,
  query,
  currency,
  setQuery,
  can,
  exportList,
  edit,
  remove,
  nameOf,
  invitationLink,
}: {
  kind: string;
  entities: Entity[];
  query: string;
  currency: string;
  setQuery: (query: string) => void;
  can: (kind: string, action?: string) => boolean;
  exportList: (kind: string) => void;
  edit: (kind: string, record?: Entity) => void;
  remove: (kind: string, id: string) => void;
  nameOf: (id: string) => string;
  invitationLink: (householdId: string) => void;
}) {
  const data = useMemo(
    () =>
      list(entities, kind).filter(
        (record) =>
          !query ||
          JSON.stringify(record.data).toLowerCase().includes(query.toLowerCase()),
      ),
    [entities, kind, query],
  );
  const fields = useMemo(
    () =>
      schemas[kind]?.fields
        .filter(
          (field) =>
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
            ].includes(field.key),
        )
        .slice(0, 6) || [],
    [kind],
  );
  return (
    <>
      <div className="section-toolbar">
        <div className="search-control">
          <Search size={17} />
          <Input
            aria-label="Caută în listă"
            placeholder="Caută în listă…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {can(kind, 'export') && (
          <Button variant="outline" onClick={() => exportList(kind)}>
            <Download />Export CSV
          </Button>
        )}
        {can(kind, 'create') && (
          <Button onClick={() => edit(kind)}>
            <Plus />Adaugă {schemas[kind]?.singular.toLowerCase()}
          </Button>
        )}
      </div>
      {data.length ? (
        <div className="panel table-panel">
          <Table>
            <TableHeader>
              <TableRow>
                {fields.map((field) => (
                  <TableHead key={field.key}>{field.label}</TableHead>
                ))}
                <TableHead>Acțiuni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((record) => (
                <TableRow key={record.id}>
                  {fields.map((field, index) => (
                    <TableCell key={field.key}>
                      {field.type === 'money' ? (
                        money(record.data[field.key], record.data.currency || currency)
                      ) : field.ref ? (
                        nameOf(record.data[field.key])
                      ) : field.type === 'boolean' ? (
                        record.data[field.key] ? 'Da' : 'Nu'
                      ) : field.options ? (
                        <Badge value={record.data[field.key]} />
                      ) : (
                        <span className={index === 0 ? 'cell-title' : ''}>
                          {String(record.data[field.key] || '—')}
                        </span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="row-actions">
                      {kind === 'household' && can('invitation', 'edit') && (
                        <Button variant="outline" onClick={() => invitationLink(record.id)}>
                          Link invitație
                        </Button>
                      )}
                      {can(kind, 'edit') && (
                        <Button variant="ghost" onClick={() => edit(kind, record)}>Editează</Button>
                      )}
                      {can(kind, 'delete') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={'Șterge ' + (record.data.name || schemas[kind].singular)}
                          onClick={() => remove(kind, record.id)}
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
        <Empty title="Lista este încă goală" text="Adaugă prima înregistrare pentru acest eveniment." />
      )}
    </>
  );
});
