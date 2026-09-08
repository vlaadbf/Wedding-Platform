'use client';
import { ReactNode } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field, Data, Entity, labels, schemas } from '@/lib/domain';
export function Pick({
  value,
  onChange,
  options,
  label,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <Select
      value={value || '__empty'}
      onValueChange={(v) => onChange(v === '__empty' ? '' : String(v))}
    >
      <SelectTrigger aria-label={label} className={'picker ' + className}>
        <SelectValue>
          {options.find((o) => o.value === value)?.label || label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.length ? (
          options.map((o) => (
            <SelectItem key={o.value || '__empty'} value={o.value || '__empty'}>
              {o.label}
            </SelectItem>
          ))
        ) : (
          <SelectItem value="__empty">Nicio opțiune</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
export function FieldControl({
  field: f,
  value,
  onChange,
  entities = [],
}: {
  field: Field;
  value: any;
  onChange: (v: any) => void;
  entities?: Entity[];
}) {
  if (f.type === 'boolean')
    return (
      <label className="check-label">
        <Checkbox checked={!!value} onCheckedChange={onChange} />
        {f.label}
      </label>
    );
  const control =
    f.type === 'select' || f.type === 'ref' ? (
      <Pick
        value={String(value || '')}
        onChange={onChange}
        label={f.label}
        options={
          f.options?.map((v) => ({ value: v, label: labels[v] || v })) || [
            { value: '', label: 'Selectează…' },
            ...entities
              .filter((x) => x.kind === f.ref)
              .map((x) => ({ value: x.id, label: x.data.name || x.id })),
          ]
        }
      />
    ) : f.type === 'textarea' ? (
      <Textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        required={f.required}
        rows={4}
        id={'field-' + f.key}
      />
    ) : (
      <Input
        id={'field-' + f.key}
        value={value ?? ''}
        type={f.type === 'money' ? 'number' : f.type || 'text'}
        min={f.type === 'number' || f.type === 'money' ? 0 : undefined}
        max={f.max}
        step={f.type === 'money' ? '0.01' : undefined}
        onChange={(e) => onChange(e.target.value)}
        required={f.required}
      />
    );
  return (
    <div className={'form-field ' + (f.type === 'textarea' ? 'full' : '')}>
      <label htmlFor={'field-' + f.key}>
        {f.label}
        {f.required && <span aria-label="obligatoriu"> *</span>}
      </label>
      {control}
    </div>
  );
}
export function Fields({
  kind,
  data,
  setData,
  entities,
}: {
  kind: string;
  data: Data;
  setData: (v: Data) => void;
  entities: Entity[];
}) {
  return (
    <div className="form-grid">
      {schemas[kind].fields.map((f) => (
        <FieldControl
          key={f.key}
          field={f}
          value={data[f.key]}
          entities={entities}
          onChange={(v) => setData({ ...data, [f.key]: v })}
        />
      ))}
    </div>
  );
}
export function TabBar({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(String(v))}>
      <TabsList variant="line" className="tabbar">
        {items.map((i) => (
          <TabsTrigger key={i.value} value={i.value}>
            {i.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
export function Empty({
  title = 'Nimic de afișat',
  text,
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-symbol">✧</span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span className={'status status-' + value}>{labels[value] || value}</span>
  );
}
export async function api(path: string, method = 'GET', body?: any) {
  const r = await fetch('/api/' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = (await r.json()) as Data;
  if (!r.ok) throw new Error(d.error?.message || 'Operațiunea nu a reușit.');
  return d;
}
