import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { localDatabase } from './local-db.mjs';

const email = String(process.argv[2] || '')
  .trim()
  .toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error('Usage: node scripts/provision-admin.mjs email');
const database = localDatabase();
try {
  database.exec('BEGIN IMMEDIATE');
  let account = database
    .prepare('SELECT id,password,demo,platform_role FROM users WHERE email=?')
    .get(email);
  if (account?.demo)
    throw new Error('A demo account cannot become super admin.');
  const date = new Date().toISOString();
  if (account?.password) {
    database
      .prepare(
        "UPDATE users SET platform_role='super_admin',approval_status='approved',reviewed_by=id,reviewed_at=? WHERE id=?",
      )
      .run(date, account.id);
    database.exec('COMMIT');
    console.log('Super admin configured. Sign in with the existing password.');
  } else {
    if (!account) {
      account = { id: randomUUID() };
      database
        .prepare(
          "INSERT INTO users(id,email,name,created_at,platform_role) VALUES(?,?,'Super admin',?,'super_admin')",
        )
        .run(account.id, email, date);
    } else
      database
        .prepare("UPDATE users SET platform_role='super_admin' WHERE id=?")
        .run(account.id);
    database
      .prepare('DELETE FROM account_tokens WHERE user_id=?')
      .run(account.id);
    const raw = randomBytes(32).toString('hex');
    database
      .prepare(
        "INSERT INTO account_tokens(hash,user_id,purpose,expires_at) VALUES(?,?,'setup',?)",
      )
      .run(
        createHash('sha256').update(raw).digest('hex'),
        account.id,
        new Date(Date.now() + 86400000).toISOString(),
      );
    mkdirSync('outputs', { recursive: true });
    writeFileSync(
      'outputs/super-admin-activation.txt',
      `Cont: ${email}\n\nSetează parola folosind linkul de mai jos. Linkul poate fi folosit o singură dată și expiră în 24 de ore. Nu îl distribui.\n\nhttp://localhost:3000/?account_token=${raw}&purpose=setup\n`,
      { mode: 0o600 },
    );
    database.exec('COMMIT');
    console.log(
      'Super admin reserved. One-time activation link saved in outputs/super-admin-activation.txt. No email was sent.',
    );
  }
} catch (error) {
  try {
    database.exec('ROLLBACK');
  } catch {}
  throw error;
} finally {
  database.close();
}
