import { AppError, Data, uid } from '../lib/domain';
import { all, bindings, db, hash, now, one, stmt, token } from './store';
import { rate, secureEqual } from './auth';
import { integrationConfig } from './integration-settings';
import { integrationStatus } from './integrations';

export async function bootstrapAdmin(
  req: Request,
  body: Data,
  origin: string,
) {
  await rate(req, 'admin-bootstrap', 3, 3600);
  const secret = bindings().BOOTSTRAP_SECRET;
  if (!secret)
    throw new AppError(503, 'Bootstrap-ul administratorului nu este configurat.');
  if (
    !secureEqual(
      req.headers.get('authorization') || '',
      'Bearer ' + secret,
    )
  )
    throw new AppError(401, 'Secret de bootstrap invalid.');
  if (await one("SELECT id FROM users WHERE platform_role='super_admin'"))
    throw new AppError(409, 'Super adminul a fost deja configurat.');
  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  const name = String(body.name || 'Super admin').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new AppError(400, 'Adresa de email nu este validă.');
  if (!name || name.length > 100)
    throw new AppError(400, 'Numele administratorului nu este valid.');
  if (await one('SELECT id FROM users WHERE email=?', email))
    throw new AppError(409, 'Adresa este deja folosită de un cont.');
  const id = uid(),
    raw = token(),
    createdAt = now(),
    expiresAt = new Date(Date.now() + 3600000).toISOString();
  try {
    await db().batch([
      stmt(
        "INSERT INTO maintenance(key,ran_at) VALUES('admin-bootstrap',?)",
        createdAt,
      ),
      stmt(
        "INSERT INTO users(id,email,name,verified,demo,created_at,approval_status,platform_role,reviewed_by,reviewed_at) VALUES(?,?,?,1,0,?,'approved','super_admin',?,?)",
        id,
        email,
        name,
        createdAt,
        id,
        createdAt,
      ),
      stmt(
        "INSERT INTO account_tokens(hash,user_id,purpose,expires_at) VALUES(?,?, 'setup',?)",
        await hash(raw),
        id,
        expiresAt,
      ),
      stmt(
        'INSERT INTO platform_audit(id,actor_id,action,detail,created_at) VALUES(?,?,?,?,?)',
        uid(),
        id,
        'admin.bootstrap',
        JSON.stringify({ email }),
        createdAt,
      ),
    ]);
  } catch (error) {
    if (
      (await one("SELECT id FROM users WHERE platform_role='super_admin'")) ||
      (await one("SELECT key FROM maintenance WHERE key='admin-bootstrap'"))
    )
      throw new AppError(409, 'Super adminul a fost deja configurat.');
    throw error;
  }
  return {
    ok: true,
    email,
    expires_at: expiresAt,
    activation_url: `${origin}/?account_token=${raw}&purpose=setup`,
  };
}

export async function adminAccounts(
  u: Data,
  parts: string[],
  method: string,
  body: Data,
  url: URL,
) {
  if (u.demo || u.platform_role !== 'super_admin')
    throw new AppError(403, 'Doar super adminul poate administra conturile.');
  if (parts[1] === 'integrations' && parts.length === 2) {
    const result = await integrationConfig(u, method, body);
    return method === 'GET'
      ? { ...result, integrations: await integrationStatus() }
      : result;
  }
  if (parts[1] !== 'accounts') throw new AppError(404, 'Pagină indisponibilă.');
  if (method === 'GET' && parts.length === 2) {
    const status = url.searchParams.get('status') || 'all';
    if (!['all', 'pending', 'approved', 'rejected'].includes(status))
      throw new AppError(400, 'Status invalid.');
    const page = Math.max(
      1,
      Math.floor(Number(url.searchParams.get('page')) || 1),
    );
    const offset = (page - 1) * 50;
    const accounts =
      status === 'all'
        ? await all(
            "SELECT id,name,email,approval_status,platform_role,created_at,reviewed_at FROM users WHERE demo=0 AND platform_role='user' ORDER BY created_at DESC,id LIMIT 51 OFFSET ?",
            offset,
          )
        : await all(
            "SELECT id,name,email,approval_status,platform_role,created_at,reviewed_at FROM users WHERE demo=0 AND platform_role='user' AND approval_status=? ORDER BY created_at DESC,id LIMIT 51 OFFSET ?",
            status,
            offset,
          );
    return {
      accounts: accounts.slice(0, 50),
      hasMore: accounts.length > 50,
      page,
    };
  }
  if (method === 'POST' && parts.length === 3) {
    if (!['approved', 'rejected'].includes(body.status))
      throw new AppError(400, 'Alege aprobarea sau respingerea.');
    if (parts[2] === u.id)
      throw new AppError(400, 'Nu poți modifica propriul acces.');
    const result = await stmt(
      "UPDATE users SET approval_status=?,reviewed_by=?,reviewed_at=? WHERE id=? AND demo=0 AND platform_role='user' AND approval_status='pending' RETURNING id,approval_status",
      body.status,
      u.id,
      now(),
      parts[2],
    ).first();
    if (!result)
      throw new AppError(
        409,
        'Contul nu mai este în așteptare sau nu poate fi modificat. Reîncarcă lista.',
      );
    return { account: result };
  }
  throw new AppError(404, 'Acțiune indisponibilă.');
}
