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
