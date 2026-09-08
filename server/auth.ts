import { Data, AppError, uid } from '../lib/domain';
import { one, stmt, hash, token, now, db, bindings } from './store';
export async function rate(req: Request, scope: string, limit = 30) {
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  const bucket = Math.floor(Date.now() / 60000);
  const key = await hash(scope + ':' + ip + ':' + bucket);
  const r = await stmt(
    'INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
    key,
    bucket * 60 + 120,
  ).first<Data>();
  if (r!.count > limit)
    throw new AppError(429, 'Prea multe încercări. Reîncearcă peste un minut.');
}
export async function password(value: string, salt = token()) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(value),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return (
    salt +
    ':' +
    Array.from(new Uint8Array(bits), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('')
  );
}
export function secureEqual(a: string, b: string) {
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return mismatch === 0;
}
export async function user(req: Request) {
  const raw = req.headers
    .get('cookie')
    ?.match(/(?:^|;\s*)nn_session=([^;]+)/)?.[1];
  if (!raw) return null;
  return await one(
    'SELECT u.id,u.email,u.name,u.verified,u.demo FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires_at>?',
    await hash(raw),
    now(),
  );
}
export async function requireUser(req: Request) {
  const u = await user(req);
  if (!u) throw new AppError(401, 'Autentifică-te pentru a continua.');
  return u;
}
export async function session(u: Data, req: Request) {
  const raw = token(),
    date = now();
  await stmt(
    'INSERT INTO sessions(hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',
    await hash(raw),
    u.id,
    new Date(Date.now() + 7 * 86400000).toISOString(),
    date,
  ).run();
  return `nn_session=${raw}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export async function auth(
  req: Request,
  path: string,
  body: Data,
): Promise<{ body: Data; cookie?: string }> {
  await rate(req, 'auth', 15);
  if (path === 'logout') {
    const raw = req.headers.get('cookie')?.match(/nn_session=([^;]+)/)?.[1];
    if (raw)
      await stmt('DELETE FROM sessions WHERE hash=?', await hash(raw)).run();
    return {
      body: { ok: true },
      cookie: 'nn_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
    };
  }
  if (path === 'demo') {
    const u = {
      id: uid(),
      email: `${uid()}@demo.invalid`,
      name: 'Sofia & Andrei',
      verified: 1,
      demo: 1,
    };
    await stmt(
      'INSERT INTO users(id,email,name,verified,demo,created_at) VALUES(?,?,?,?,?,?)',
      u.id,
      u.email,
      u.name,
      1,
      1,
      now(),
    ).run();
    return { body: { user: u }, cookie: await session(u, req) };
  }
  if (path === 'register') {
    const email = String(body.email || '')
        .trim()
        .toLowerCase(),
      name = String(body.name || '').trim(),
      pw = String(body.password || '');
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !name ||
      name.length > 200 ||
      pw.length < 12 ||
      pw.length > 256
    )
      throw new AppError(
        400,
        'Completează numele, un email valid și o parolă de minimum 12 caractere.',
      );
    if (await one('SELECT id FROM users WHERE email=?', email))
      throw new AppError(
        409,
        'Acest cont există deja. Folosește autentificarea sau recuperarea accesului.',
      );
    const u = { id: uid(), email, name, demo: 0, verified: 0 };
    await stmt(
      'INSERT INTO users(id,email,name,password,created_at) VALUES(?,?,?,?,?)',
      u.id,
      email,
      name,
      await password(pw),
      now(),
    ).run();
    return { body: { user: u }, cookie: await session(u, req) };
  }
  if (path === 'login') {
    const u = await one(
      'SELECT * FROM users WHERE email=? AND demo=0',
      String(body.email || '')
        .toLowerCase()
        .trim(),
    );
    const p = String(body.password || '');
    if (p.length > 256) throw new AppError(400, 'Parolă invalidă.');
    const result = await password(
      p,
      u?.password?.split(':')[0] || 'invalid-salt',
    );
    if (!u?.password || !secureEqual(result, u.password))
      throw new AppError(401, 'Emailul sau parola nu sunt corecte.');
    delete u.password;
    return { body: { user: u }, cookie: await session(u, req) };
  }
  if (path === 'recover' || path === 'verify') {
    const u =
      path === 'verify'
        ? await requireUser(req)
        : await one(
            'SELECT * FROM users WHERE email=?',
            String(body.email || '')
              .trim()
              .toLowerCase(),
          );
    if (!bindings().RESEND_API_KEY || !bindings().EMAIL_FROM)
      throw new AppError(
        503,
        'Integrarea email nu este configurată. Contactează administratorul pentru activare.',
        'integration_unconfigured',
      );
    if (u) {
      const raw = token();
      await stmt(
        'INSERT INTO account_tokens(hash,user_id,purpose,expires_at) VALUES(?,?,?,?)',
        await hash(raw),
        u.id,
        path,
        new Date(Date.now() + 3600000).toISOString(),
      ).run();
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bindings().RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': uid(),
        },
        body: JSON.stringify({
          from: bindings().EMAIL_FROM,
          to: [u.email],
          subject:
            path === 'verify'
              ? 'Verifică adresa de email'
              : 'Recuperează accesul',
          text: `Deschide ${new URL(req.url).origin}/?account_token=${raw}&purpose=${path}. Linkul expiră într-o oră.`,
        }),
      });
      if (!response.ok)
        throw new AppError(
          502,
          'Furnizorul email nu a acceptat mesajul. Reîncearcă mai târziu.',
        );
    }
    return {
      body: {
        ok: true,
        message:
          'Dacă adresa este eligibilă, cererea a fost acceptată de furnizorul email.',
      },
    };
  }
  if (path === 'consume') {
    const h = await hash(String(body.token || '')),
      t = await one(
        'SELECT * FROM account_tokens WHERE hash=? AND expires_at>? AND used_at IS NULL',
        h,
        now(),
      );
    if (!t) throw new AppError(400, 'Linkul a expirat sau a fost folosit.');
    let sql;
    if (t.purpose === 'verify')
      sql = stmt('UPDATE users SET verified=1 WHERE id=?', t.user_id);
    else {
      if (
        String(body.password || '').length < 12 ||
        String(body.password).length > 256
      )
        throw new AppError(400, 'Parola trebuie să aibă 12–256 caractere.');
      sql = stmt(
        'UPDATE users SET password=? WHERE id=?',
        await password(body.password),
        t.user_id,
      );
    }
    const claimed = await stmt(
      'UPDATE account_tokens SET used_at=? WHERE hash=? AND used_at IS NULL RETURNING hash',
      now(),
      h,
    ).first();
    if (!claimed) throw new AppError(409, 'Link deja folosit.');
    await db().batch([
      sql,
      stmt('DELETE FROM sessions WHERE user_id=?', t.user_id),
    ]);
    return { body: { ok: true } };
  }
  throw new AppError(404, 'Acțiune necunoscută.');
}
