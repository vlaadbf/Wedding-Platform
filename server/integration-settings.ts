import { AppError, Data } from '../lib/domain';
import { bindings, one, stmt, now } from './store';

export const integrationFields = [
  {
    key: 'RESEND_API_KEY',
    label: 'Cheie API Resend',
    group: 'Email',
    secret: true,
  },
  {
    key: 'EMAIL_FROM',
    label: 'Adresa expeditorului verificat',
    group: 'Email',
    secret: false,
  },
  {
    key: 'RESEND_WEBHOOK_SECRET',
    label: 'Secret webhook Resend',
    group: 'Email',
    secret: true,
  },
  {
    key: 'TWILIO_ACCOUNT_SID',
    label: 'Twilio Account SID',
    group: 'SMS și WhatsApp',
    secret: true,
  },
  {
    key: 'TWILIO_AUTH_TOKEN',
    label: 'Twilio Auth Token',
    group: 'SMS și WhatsApp',
    secret: true,
  },
  {
    key: 'TWILIO_FROM',
    label: 'Număr expeditor SMS (+40...)',
    group: 'SMS și WhatsApp',
    secret: false,
  },
  {
    key: 'WHATSAPP_FROM',
    label: 'Expeditor WhatsApp (whatsapp:+40...)',
    group: 'SMS și WhatsApp',
    secret: false,
  },
  {
    key: 'WHATSAPP_CONTENT_SID',
    label: 'SID șablon WhatsApp aprobat',
    group: 'SMS și WhatsApp',
    secret: true,
  },
  {
    key: 'JOB_SECRET',
    label: 'Cheie pentru procesarea automată (minimum 32 caractere)',
    group: 'Procesare automată',
    secret: true,
  },
  {
    key: 'DEMO_LIMIT_PER_HOUR',
    label: 'Conturi demo noi pe oră și adresă IP',
    group: 'Control demo',
    secret: false,
  },
  {
    key: 'DEMO_GLOBAL_CAP',
    label: 'Plafon global de conturi demo active',
    group: 'Control demo',
    secret: false,
  },
];
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
async function encryptionKey() {
  const value = bindings().CONFIG_ENCRYPTION_KEY;
  if (!value)
    throw new AppError(
      503,
      'Protecția configurării nu este inițializată pe server.',
    );
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = decode(value);
  } catch {
    throw new AppError(503, 'Cheia de protecție a configurării este invalidă.');
  }
  if (bytes.length !== 32)
    throw new AppError(503, 'Cheia de protecție a configurării este invalidă.');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}
async function storedSettings(row: Data): Promise<Data> {
  if (!row.payload) return {};
  try {
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: decode(row.iv),
        additionalData: new TextEncoder().encode(
          'NuntaNoastra/integrations/v1',
        ),
      },
      await encryptionKey(),
      decode(row.payload),
    );
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new AppError(
      503,
      'Configurarea salvată nu poate fi deschisă. Verifică cheia serverului.',
    );
  }
}
export async function runtimeSettings(): Promise<Data> {
  const row = await one('SELECT * FROM integration_settings WHERE id=1');
  if (!row)
    throw new AppError(503, 'Configurarea integrărilor nu este inițializată.');
  const environment = bindings() as unknown as Record<string, unknown>;
  const effective = { ...environment, ...(await storedSettings(row)) };
  return Object.fromEntries(integrationFields.map(({ key }) => [key, effective[key]]));
}
export async function integrationConfig(u: Data, method: string, body: Data) {
  if (u.demo || u.platform_role !== 'super_admin')
    throw new AppError(
      403,
      'Integrările sunt administrate numai de super admin.',
    );
  const row = await one('SELECT * FROM integration_settings WHERE id=1');
  if (!row)
    throw new AppError(503, 'Configurarea integrărilor nu este inițializată.');
  const stored = await storedSettings(row);
  if (method === 'GET') {
    const environment = bindings() as unknown as Record<string, unknown>;
    const effective = { ...environment, ...stored };
    return {
      revision: row.revision,
      protected: !!bindings().CONFIG_ENCRYPTION_KEY,
      fields: integrationFields.map((f) => ({
        ...f,
        configured: !!effective[f.key],
        value: f.secret ? '' : effective[f.key] || '',
        source: Object.hasOwn(stored, f.key)
          ? 'application'
          : effective[f.key]
            ? 'server'
            : 'empty',
      })),
    };
  }
  if (method !== 'POST') throw new AppError(405, 'Metodă neacceptată.');
  if (!Number.isSafeInteger(body.revision) || body.revision !== row.revision)
    throw new AppError(
      409,
      'Configurarea a fost modificată. Reîncarcă pagina.',
    );
  if (
    !body.values ||
    Array.isArray(body.values) ||
    typeof body.values !== 'object' ||
    !Array.isArray(body.clear || [])
  )
    throw new AppError(400, 'Configurare invalidă.');
  const known = new Set(integrationFields.map((f) => f.key));
  for (const key of [...Object.keys(body.values), ...(body.clear || [])])
    if (!known.has(key))
      throw new AppError(400, 'Câmp de configurare necunoscut.');
  const next = { ...stored };
  for (const [key, raw] of Object.entries(body.values)) {
    if (typeof raw !== 'string' || raw.length > 4096)
      throw new AppError(400, 'Valoare invalidă.');
    const value = raw.trim();
    if (!value) continue;
    if (/[\r\n]/.test(value))
      throw new AppError(400, 'Valorile trebuie completate pe un singur rând.');
    if (key === 'EMAIL_FROM' && !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value))
      throw new AppError(400, 'Completează o adresă validă pentru expeditor.');
    if (key === 'TWILIO_FROM' && !/^\+\d{8,15}$/.test(value))
      throw new AppError(
        400,
        'Numărul SMS trebuie să includă prefixul internațional.',
      );
    if (key === 'WHATSAPP_FROM' && !/^whatsapp:\+\d{8,15}$/.test(value))
      throw new AppError(400, 'Folosește formatul whatsapp:+40...');
    if (key === 'TWILIO_ACCOUNT_SID' && !/^AC[0-9a-f]{32}$/i.test(value))
      throw new AppError(400, 'Twilio Account SID invalid.');
    if (key === 'WHATSAPP_CONTENT_SID' && !/^HX[0-9a-f]{32}$/i.test(value))
      throw new AppError(400, 'SID șablon WhatsApp invalid.');
    if (key === 'JOB_SECRET' && value.length < 32)
      throw new AppError(
        400,
        'Cheia procesării trebuie să aibă minimum 32 caractere.',
      );
    if (key === 'DEMO_LIMIT_PER_HOUR' && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 100))
      throw new AppError(400, 'Limita demo pe oră trebuie să fie între 1 și 100.');
    if (key === 'DEMO_GLOBAL_CAP' && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 10000))
      throw new AppError(400, 'Plafonul demo trebuie să fie între 1 și 10000.');
    next[key] = value;
  }
  for (const key of body.clear || []) next[key] = '';
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: new TextEncoder().encode('NuntaNoastra/integrations/v1'),
    },
    await encryptionKey(),
    new TextEncoder().encode(JSON.stringify(next)),
  );
  const changed = await stmt(
    'UPDATE integration_settings SET payload=?,iv=?,revision=revision+1,updated_by=?,updated_at=? WHERE id=1 AND revision=? RETURNING revision',
    encode(new Uint8Array(payload)),
    encode(iv),
    u.id,
    now(),
    body.revision,
  ).first<Data>();
  if (!changed)
    throw new AppError(
      409,
      'Configurarea a fost modificată. Reîncarcă pagina.',
    );
  return { ok: true, revision: changed.revision };
}
