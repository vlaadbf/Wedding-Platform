export type Data = Record<string, any>;
export type Entity = {
  id: string;
  event_id: string;
  kind: string;
  data: Data;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};
export type Field = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
  ref?: string;
  default?: any;
  max?: number;
};
const f = (
  key: string,
  label: string,
  type = 'text',
  extra: Partial<Field> = {},
): Field => ({ key, label, type, ...extra });
const currency = () =>
  f('currency', 'Moneda', 'select', {
    options: ['RON', 'EUR', 'USD'],
    default: 'RON',
  });
const ref = (key: string, label: string, kind: string, required = true) =>
  f(key, label, 'ref', { ref: kind, required });
const name = (label = 'Denumire') =>
  f('name', label, 'text', { required: true });
const amount = (key = 'amount', label = 'Suma') =>
  f(key, label, 'money', { default: 0, required: true });
export const schemas: Record<
  string,
  { label: string; singular: string; fields: Field[] }
> = {
  household: {
    label: 'Familii',
    singular: 'Familie',
    fields: [
      name('Numele familiei'),
      f('email', 'Email', 'email'),
      f('phone', 'Telefon', 'tel'),
      f('max_companions', 'Însoțitori permiși', 'number', {
        default: 0,
        max: 10,
      }),
      f('language', 'Limba', 'select', {
        options: ['ro', 'en'],
        default: 'ro',
      }),
      f('opt_out', 'Nu trimite comunicări', 'boolean'),
    ],
  },
  guest: {
    label: 'Invitați',
    singular: 'Invitat',
    fields: [
      name('Nume și prenume'),
      ref('household_id', 'Familie', 'household'),
      f('email', 'Email', 'email'),
      f('phone', 'Telefon', 'tel'),
      f('age', 'Categorie', 'select', {
        options: ['adult', 'copil'],
        default: 'adult',
      }),
      f('relationship', 'Din partea', 'select', {
        options: ['Mireasă', 'Mire', 'Prieteni comuni', 'Familie'],
        default: 'Prieteni comuni',
      }),
      f('tags', 'Etichete'),
      ref('menu_id', 'Meniu', 'menu', false),
      f('allergies', 'Alergii'),
      f('needs', 'Accesibilitate / alte nevoi'),
      f('transport', 'Solicită transport', 'boolean'),
      f('accommodation', 'Solicită cazare', 'boolean'),
      f('notes', 'Observații interne', 'textarea'),
    ],
  },
  subevent: {
    label: 'Subevenimente',
    singular: 'Subeveniment',
    fields: [
      name(),
      f('date', 'Data', 'date'),
      f('start', 'Început', 'time'),
      f('end', 'Sfârșit', 'time'),
      f('venue', 'Locație'),
      f('address', 'Adresă'),
      f('instructions', 'Instrucțiuni', 'textarea'),
    ],
  },
  guest_invitation: {
    label: 'Participări',
    singular: 'Participare',
    fields: [
      ref('guest_id', 'Invitat', 'guest'),
      ref('subevent_id', 'Subeveniment', 'subevent'),
    ],
  },
  rsvp: {
    label: 'Răspunsuri RSVP',
    singular: 'Răspuns RSVP',
    fields: [
      ref('guest_id', 'Invitat', 'guest'),
      ref('subevent_id', 'Subeveniment', 'subevent'),
      f('status', 'Răspuns', 'select', {
        options: ['confirmed', 'declined', 'pending'],
        default: 'pending',
      }),
      f('source', 'Sursă', 'select', {
        options: ['organizer', 'guest', 'import'],
        default: 'organizer',
      }),
      f('message', 'Mesaj', 'textarea'),
    ],
  },
  menu: {
    label: 'Meniuri',
    singular: 'Meniu',
    fields: [
      name(),
      f('description', 'Descriere', 'textarea'),
      amount('price', 'Preț / persoană'),
      currency(),
    ],
  },
  table: {
    label: 'Mese',
    singular: 'Masă',
    fields: [
      name('Nume / număr'),
      ref('subevent_id', 'Subeveniment', 'subevent'),
      f('shape', 'Formă', 'select', {
        options: ['round', 'rectangle', 'oval', 'head'],
        default: 'round',
      }),
      f('capacity', 'Locuri', 'number', {
        default: 8,
        required: true,
        max: 50,
      }),
      f('x', 'Poziție X', 'number', { default: 100, max: 2000 }),
      f('y', 'Poziție Y', 'number', { default: 100, max: 2000 }),
      f('rotation', 'Rotire (grade)', 'number', { default: 0, max: 360 }),
      f('locked', 'Blochează poziția', 'boolean'),
      f('notes', 'Observații', 'textarea'),
    ],
  },
  assignment: {
    label: 'Repartizări',
    singular: 'Repartizare',
    fields: [
      ref('guest_id', 'Invitat', 'guest'),
      ref('table_id', 'Masă', 'table'),
      f('seat', 'Loc', 'number', { required: true, default: 1, max: 50 }),
      f('provisional', 'Rezervare provizorie', 'boolean'),
    ],
  },
  decor: {
    label: 'Elemente sală',
    singular: 'Element',
    fields: [
      name(),
      f('type', 'Tip', 'select', {
        options: [
          'Ring de dans',
          'Scenă',
          'Bar',
          'Intrare',
          'Ieșire',
          'Decor',
          'Obstacol',
        ],
        default: 'Ring de dans',
      }),
      f('x', 'Poziție X', 'number', { default: 300, max: 2000 }),
      f('y', 'Poziție Y', 'number', { default: 300, max: 2000 }),
      f('width', 'Lățime', 'number', { default: 160, max: 800 }),
      f('height', 'Înălțime', 'number', { default: 100, max: 800 }),
    ],
  },
  expense: {
    label: 'Buget',
    singular: 'Cheltuială',
    fields: [
      name('Cheltuială'),
      f('category', 'Categorie', 'select', {
        options: [
          'Locație',
          'Catering',
          'Băuturi',
          'Foto/video',
          'Muzică',
          'Flori și decor',
          'Ținute',
          'Verighete',
          'Papetărie',
          'Transport',
          'Cazare',
          'Ceremonii',
          'Organizare',
          'Diverse',
          'Rezervă',
        ],
        default: 'Locație',
      }),
      ref('vendor_id', 'Furnizor', 'vendor', false),
      amount('estimated', 'Estimat'),
      amount('contracted', 'Contractat'),
      currency(),
      amount('per_person', 'Cost per persoană'),
      f('notes', 'Observații', 'textarea'),
    ],
  },
  schedule: {
    label: 'Scadențe',
    singular: 'Scadență',
    fields: [
      name('Descriere'),
      ref('expense_id', 'Cheltuială', 'expense'),
      amount(),
      currency(),
      f('due', 'Scadență', 'date', { required: true }),
    ],
  },
  payment: {
    label: 'Plăți',
    singular: 'Plată manuală',
    fields: [
      name('Descriere'),
      ref('expense_id', 'Cheltuială', 'expense'),
      amount(),
      currency(),
      f('date', 'Data', 'date', { required: true }),
      f('method', 'Metoda', 'select', {
        options: ['Transfer bancar', 'Numerar', 'Card'],
        default: 'Transfer bancar',
      }),
      f('payer', 'Plătitor'),
      f('beneficiary', 'Beneficiar'),
      f('notes', 'Dovadă / referință', 'textarea'),
    ],
  },
  refund: {
    label: 'Rambursări',
    singular: 'Rambursare manuală',
    fields: [
      name('Motiv'),
      ref('payment_id', 'Plată inițială', 'payment'),
      amount(),
      currency(),
      f('date', 'Data', 'date', { required: true }),
    ],
  },
  contribution: {
    label: 'Contribuții',
    singular: 'Contribuție manuală',
    fields: [
      name('Contributor'),
      amount(),
      currency(),
      f('date', 'Data', 'date', { required: true }),
      f('notes', 'Observații private', 'textarea'),
    ],
  },
  vendor: {
    label: 'Furnizori',
    singular: 'Furnizor',
    fields: [
      name(),
      f('category', 'Servicii'),
      f('contact', 'Persoană de contact'),
      f('email', 'Email', 'email'),
      f('phone', 'Telefon', 'tel'),
      f('website', 'Website', 'url'),
      f('status', 'Stadiu', 'select', {
        options: [
          'prospect',
          'contacted',
          'offer',
          'selected',
          'contracted',
          'completed',
          'cancelled',
        ],
        default: 'prospect',
      }),
      amount('price', 'Oferta'),
      currency(),
      f('notes', 'Servicii incluse și condiții', 'textarea'),
    ],
  },
  task: {
    label: 'Sarcini',
    singular: 'Sarcină',
    fields: [
      name('Titlu'),
      f('description', 'Descriere / checklist', 'textarea'),
      f('assignee', 'Responsabil'),
      f('category', 'Categorie'),
      f('due', 'Termen', 'date'),
      f('relative_days', 'Zile înainte de nuntă', 'number', { max: 1000 }),
      f('priority', 'Prioritate', 'select', {
        options: ['low', 'normal', 'high'],
        default: 'normal',
      }),
      f('status', 'Stadiu', 'select', {
        options: ['todo', 'progress', 'done'],
        default: 'todo',
      }),
      ref('dependency_id', 'Depinde de', 'task', false),
      ref('vendor_id', 'Furnizor asociat', 'vendor', false),
    ],
  },
  timeline: {
    label: 'Programul zilei',
    singular: 'Moment',
    fields: [
      name('Activitate'),
      f('date', 'Data', 'date', { required: true }),
      f('start', 'Început', 'time', { required: true }),
      f('end', 'Sfârșit', 'time', { required: true }),
      f('venue', 'Locație'),
      f('assignee', 'Responsabil'),
      f('contact', 'Contact'),
      f('notes', 'Note interne', 'textarea'),
      f('public_notes', 'Note partajabile', 'textarea'),
    ],
  },
  transport: {
    label: 'Transport',
    singular: 'Traseu',
    fields: [
      name('Traseu / vehicul'),
      f('pickup', 'Punct de preluare'),
      f('date', 'Data', 'date'),
      f('time', 'Plecare', 'time'),
      f('capacity', 'Capacitate', 'number', { default: 20, max: 200 }),
      f('contact', 'Contact șofer'),
    ],
  },
  transport_assignment: {
    label: 'Pasageri',
    singular: 'Repartizare transport',
    fields: [
      ref('guest_id', 'Invitat', 'guest'),
      ref('transport_id', 'Traseu', 'transport'),
    ],
  },
  accommodation: {
    label: 'Cazare',
    singular: 'Cameră / unitate',
    fields: [
      name('Unitate / cameră'),
      f('address', 'Adresă'),
      f('start', 'Check-in', 'date'),
      f('end', 'Check-out', 'date'),
      f('capacity', 'Capacitate', 'number', { default: 2, max: 100 }),
      f('payer', 'Cine achită'),
      amount('price', 'Cost'),
      currency(),
    ],
  },
  room_assignment: {
    label: 'Repartizări cazare',
    singular: 'Repartizare cazare',
    fields: [
      ref('guest_id', 'Invitat', 'guest'),
      ref('accommodation_id', 'Cameră', 'accommodation'),
    ],
  },
  comment: {
    label: 'Comentarii',
    singular: 'Comentariu',
    fields: [
      name('Mesaj'),
      f('context_id', 'Resursa asociată'),
      f('mention', 'Mențiune (email)', 'email'),
    ],
  },
  constraint: {
    label: 'Reguli așezare',
    singular: 'Regulă',
    fields: [
      ref('guest_id', 'Invitat', 'guest'),
      ref('other_guest_id', 'Al doilea invitat', 'guest'),
      f('rule', 'Regulă', 'select', {
        options: ['together', 'apart'],
        default: 'together',
      }),
    ],
  },
  invitation: {
    label: 'Invitații',
    singular: 'Design invitație',
    fields: [
      name('Titlu'),
      f('style', 'Șablon', 'select', {
        options: [
          'Elegant',
          'Minimalist',
          'Floral',
          'Modern',
          'Rustic',
          'Clasic',
        ],
        default: 'Elegant',
      }),
      f('message', 'Mesaj în română', 'textarea', { required: true }),
      f('message_en', 'Mesaj în engleză', 'textarea'),
      f('color', 'Culoare accent', 'color', { default: '#536b57' }),
      f('dress_code', 'Dress code'),
      f('rsvp_deadline', 'Termen RSVP', 'date'),
      f('help', 'Contact pentru ajutor'),
      f('faq', 'Întrebări frecvente', 'textarea'),
      f('logistics', 'Transport și cazare', 'textarea'),
    ],
  },
  automation: {
    label: 'Automatizări',
    singular: 'Regulă',
    fields: [
      name(),
      f('type', 'Tip', 'select', {
        options: ['rsvp_reminder', 'logistics', 'thanks'],
        default: 'rsvp_reminder',
      }),
      f('date', 'Data', 'date', { required: true }),
      f('time', 'Ora locală', 'time', { default: '10:00' }),
      f('channel', 'Canal', 'select', {
        options: ['email', 'sms', 'whatsapp'],
        default: 'email',
      }),
      f('message', 'Mesaj · {family} {couple} {link}', 'textarea', {
        required: true,
      }),
      f('active', 'Activează explicit', 'boolean'),
    ],
  },
  notification: {
    label: 'Notificări',
    singular: 'Notificare',
    fields: [name('Mesaj'), f('read', 'Citită', 'boolean')],
  },
  checkin: { label: 'Sosiri', singular: 'Check-in', fields: [] },
  campaign: { label: 'Campanii', singular: 'Campanie', fields: [] },
  document: { label: 'Documente', singular: 'Document', fields: [] },
};
export const labels: Record<string, string> = {
  confirmed: 'Confirmat',
  declined: 'Nu participă',
  pending: 'Fără răspuns',
  todo: 'De făcut',
  progress: 'În lucru',
  done: 'Finalizat',
  high: 'Ridicată',
  normal: 'Normală',
  low: 'Scăzută',
  prospect: 'De contactat',
  contacted: 'Contactat',
  offer: 'Ofertă primită',
  selected: 'Selectat',
  contracted: 'Contractat',
  completed: 'Finalizat',
  cancelled: 'Anulat',
  round: 'Rotundă',
  rectangle: 'Dreptunghiulară',
  oval: 'Ovală',
  head: 'Masa mirilor',
  queued: 'În coadă',
  accepted: 'Acceptat de furnizor',
  delivered: 'Livrat',
  failed: 'Eșuat',
  unknown: 'Necunoscut',
  unconfigured: 'Neconfigurat',
  simulated: 'Simulare demo',
  paused: 'Pauză',
  skipped: 'Exclus',
  organizer: 'Organizator / telefon',
  guest: 'Invitat',
  import: 'Import',
  together: 'Împreună',
  apart: 'Separat',
};
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'validation',
  ) {
    super(message);
  }
}
export const uid = () => crypto.randomUUID();
export function money(value: number, currency = 'RON', locale = 'ro-RO') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format((value || 0) / 100);
}
export function parseMoney(s: unknown) {
  const v = String(s ?? '0').replace(',', '.');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(v))
    throw new AppError(400, 'Suma trebuie să aibă cel mult două zecimale.');
  const [a, b = ''] = v.split('.');
  return Number(a) * 100 + Number(b.padEnd(2, '0'));
}
export function validate(kind: string, input: Data): Data {
  const schema = schemas[kind];
  if (!schema) throw new AppError(400, 'Modul necunoscut.');
  const out: Data = {};
  for (const field of schema.fields) {
    let v = input[field.key] ?? field.default ?? '';
    if (field.type === 'boolean') {
      out[field.key] = v === true;
      continue;
    }
    if (field.type === 'number' || field.type === 'money') {
      if (v === '' && !field.required) {
        out[field.key] = field.default ?? 0;
        continue;
      }
      v = Number(v);
      if (!Number.isSafeInteger(v) || v < 0 || v > (field.max ?? 1000000000000))
        throw new AppError(400, `${field.label}: valoare invalidă.`);
    } else {
      v = String(v).trim();
      if (v.length > 10000)
        throw new AppError(400, `${field.label}: text prea lung.`);
      if (field.required && !v)
        throw new AppError(400, `${field.label} este obligatoriu.`);
      if (v && field.type === 'email') {
        v = v.toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
          throw new AppError(400, 'Email invalid.');
      }
      if (v && field.type === 'tel') {
        v = v.replace(/[\s().-]/g, '');
        if (!/^\+?\d{8,15}$/.test(v))
          throw new AppError(
            400,
            'Telefon invalid. Folosește prefixul internațional.',
          );
      }
      if (v && field.type === 'url' && !/^https?:\/\//.test(v))
        throw new AppError(400, 'URL invalid.');
      if (
        v &&
        field.type === 'date' &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          !Number.isFinite(Date.parse(v)) ||
          new Date(v).toISOString().slice(0, 10) !== v)
      )
        throw new AppError(400, 'Data nu este validă.');
      if (v && field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
        throw new AppError(400, 'Ora nu este validă.');
      if (field.options && !field.options.includes(v))
        throw new AppError(400, `${field.label}: opțiune invalidă.`);
      if (field.type === 'color' && !/^#[\da-fA-F]{6}$/.test(v))
        throw new AppError(400, 'Culoare invalidă.');
    }
    out[field.key] = v;
  }
  return out;
}
export const financialKinds = [
  'expense',
  'schedule',
  'payment',
  'refund',
  'contribution',
];
export function permission(
  role: string,
  kind: string,
  action = 'view',
  grants: Data = {},
) {
  if (['owner', 'partner', 'planner'].includes(role)) return true;
  if (role === 'finance')
    return (
      [...financialKinds, 'vendor', 'document', 'comment'].includes(kind) &&
      action !== 'send'
    );
  if (role === 'checkin')
    return action === 'view'
      ? [
          'guest',
          'household',
          'subevent',
          'guest_invitation',
          'rsvp',
          'table',
          'assignment',
          'checkin',
        ].includes(kind)
      : kind === 'checkin' && ['create', 'edit', 'delete'].includes(action);
  return Array.isArray(grants[kind]) && grants[kind].includes(action);
}
export const list = (rows: Entity[], kind: string) =>
  rows.filter((r) => r.kind === kind && !r.deleted_at);
export function summary(rows: Entity[], event: Data) {
  const guests = list(rows, 'guest'),
    subs = list(rows, 'subevent');
  const reception =
    event.reception_id ||
    subs.find((x) => /recep|petrec/i.test(x.data.name))?.id ||
    subs[0]?.id;
  const invitations = list(rows, 'guest_invitation').filter(
      (x) => x.data.subevent_id === reception,
    ),
    responses = list(rows, 'rsvp').filter(
      (x) => x.data.subevent_id === reception,
    );
  const status = (id: string) =>
    responses.find((r) => r.data.guest_id === id)?.data.status || 'pending';
  const confirmed = guests.filter(
    (g) =>
      invitations.some((i) => i.data.guest_id === g.id) &&
      status(g.id) === 'confirmed',
  );
  const paid =
    list(rows, 'payment')
      .filter((p) => p.data.currency === event.currency)
      .reduce((s, p) => s + p.data.amount, 0) -
    list(rows, 'refund')
      .filter((p) => p.data.currency === event.currency)
      .reduce((s, p) => s + p.data.amount, 0);
  const expenses = list(rows, 'expense').filter(
    (x) => x.data.currency === event.currency,
  );
  const contracted = expenses.reduce((s, x) => s + x.data.contracted, 0),
    estimated = expenses.reduce(
      (s, x) =>
        s + x.data.estimated + (x.data.per_person || 0) * confirmed.length,
      0,
    );
  const assigned = list(rows, 'assignment').filter((a) =>
    list(rows, 'table').some(
      (t) => t.id === a.data.table_id && t.data.subevent_id === reception,
    ),
  );
  return {
    total: guests.length,
    households: list(rows, 'household').length,
    adults: guests.filter((g) => g.data.age === 'adult').length,
    children: guests.filter((g) => g.data.age === 'copil').length,
    confirmed: confirmed.length,
    declined: guests.filter((g) => status(g.id) === 'declined').length,
    pending: invitations.filter((i) => status(i.data.guest_id) === 'pending')
      .length,
    unseated: confirmed.filter(
      (g) => !assigned.some((a) => a.data.guest_id === g.id),
    ).length,
    estimated,
    contracted,
    paid,
    remaining: contracted - paid,
    reception,
    arrived: list(rows, 'checkin').filter(
      (c) => c.data.subevent_id === reception,
    ).length,
  };
}
export function csv(rows: Data[], fields: string[]) {
  const cell = (v: any) => {
    let s = String(v ?? '');
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return (
    '\uFEFF' +
    [
      fields.map(cell).join(','),
      ...rows.map((r) => fields.map((f) => cell(r[f])).join(',')),
    ].join('\r\n')
  );
}
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if (c === '\n' && !quoted) {
      row.push(value.replace(/\r$/, ''));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else value += c;
  }
  if (quoted) throw new AppError(400, 'CSV: ghilimele neînchise.');
  row.push(value.replace(/\r$/, ''));
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
