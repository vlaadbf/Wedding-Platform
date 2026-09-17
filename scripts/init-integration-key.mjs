import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const file = '.dev.vars';
const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
if (/^CONFIG_ENCRYPTION_KEY=.+$/m.test(current))
  console.log('Integration encryption key already configured.');
else {
  appendFileSync(
    file,
    '\nCONFIG_ENCRYPTION_KEY=' + randomBytes(32).toString('base64') + '\n',
    { mode: 0o600 },
  );
  console.log('Integration encryption key initialized locally.');
}
