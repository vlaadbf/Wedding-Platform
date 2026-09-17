import { mkdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const dataDir = resolve(process.env.DATA_DIR || '.render-state');
const port = process.env.PORT || '3000';
const config = resolve('wrangler.render.jsonc');
const wrangler = resolve(
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler',
);

mkdirSync(dataDir, { recursive: true });

const migration = spawnSync(
  wrangler,
  [
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--persist-to',
    dataDir,
    '--config',
    config,
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);

if (migration.status !== 0) {
  process.exit(migration.status || 1);
}

const variableNames = [
  'APP_ORIGIN',
  'BOOTSTRAP_SECRET',
  'CONFIG_ENCRYPTION_KEY',
  'DEMO_GLOBAL_CAP',
  'DEMO_LIMIT_PER_HOUR',
  'EMAIL_FROM',
  'JOB_SECRET',
  'RESEND_API_KEY',
  'RESEND_WEBHOOK_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_FROM',
  'WHATSAPP_CONTENT_SID',
  'WHATSAPP_FROM',
];
const variables = variableNames.flatMap((name) =>
  process.env[name] ? ['--var', `${name}:${process.env[name]}`] : [],
);

const server = spawn(
  wrangler,
  [
    'dev',
    '--local',
    '--config',
    config,
    '--ip',
    '0.0.0.0',
    '--port',
    port,
    '--persist-to',
    dataDir,
    '--log-level',
    'info',
    '--show-interactive-dev-session=false',
    ...variables,
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}

server.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

async function provisionSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const secret = process.env.BOOTSTRAP_SECRET;
  if (!email && !password) return;
  if (!email || !password || !secret)
    throw new Error(
      'SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD and BOOTSTRAP_SECRET must be configured together.',
    );

  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
  }
  if (!ready) throw new Error('The application did not become ready for admin provisioning.');

  const bootstrap = await fetch(`${origin}/api/admin/bootstrap`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, name: 'Vlad Bulau' }),
  });
  if (bootstrap.status === 409) {
    console.log(`Super admin already provisioned: ${email}`);
    return;
  }
  if (!bootstrap.ok)
    throw new Error(`Super admin bootstrap failed with status ${bootstrap.status}.`);

  const result = await bootstrap.json();
  const activation = new URL(result.activation_url);
  const token = activation.searchParams.get('account_token');
  const consume = await fetch(`${origin}/api/auth/consume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!consume.ok)
    throw new Error(`Super admin activation failed with status ${consume.status}.`);
  console.log(`Super admin provisioned: ${email}`);
}

provisionSuperAdmin().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  server.kill('SIGTERM');
  process.exitCode = 1;
});
