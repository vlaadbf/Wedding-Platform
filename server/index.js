import { createServer } from "node:http";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");
const PDFDocument = require("pdfkit");

const rootDir = resolve(process.cwd());
const dataDir = join(rootDir, "data");
const uploadsDir = join(dataDir, "uploads");
const dbPath = join(dataDir, "wedding.sqlite");
const port = Number(process.env.PORT || 4000);
const sessionTtlMs = 1000 * 60 * 60 * 24 * 7;
const sessionIdleMs = 1000 * 60 * 60 * 2;
const loginWindowMs = 1000 * 60 * 10;
const loginMaxFailures = 5;
const apiWindowMs = 1000 * 60;
const apiMaxRequests = 240;
const loginFailures = new Map();
const apiHits = new Map();

for (const dir of [dataDir, uploadsDir]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

async function backupDatabase() {
  if (!existsSync(dbPath)) return;
  const backupDir = join(dataDir, "backups");
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const target = join(backupDir, `wedding-${stamp}.sqlite`);
  if (!existsSync(target)) await copyFile(dbPath, target);
}

function id(prefix = "id") {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function token() {
  return randomBytes(32).toString("base64url");
}

function passwordPolicyError(password) {
  const value = String(password || "");
  if (value.length < 10) return "Parola trebuie sa aiba minimum 10 caractere.";
  if (!/[A-Z]/.test(value)) return "Parola trebuie sa contina cel putin o litera mare.";
  if (!/\d/.test(value)) return "Parola trebuie sa contina cel putin o cifra.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Parola trebuie sa contina cel putin un simbol.";
  return "";
}

function hashPassword(password) {
  return { salt: "bcrypt", hash: bcrypt.hashSync(String(password), 12) };
}

function verifyPassword(password, user) {
  if (!user?.password_hash) return { ok: false, needsRehash: false };
  if (user.salt === "bcrypt" || String(user.password_hash).startsWith("$2")) {
    return { ok: bcrypt.compareSync(String(password), user.password_hash), needsRehash: false };
  }
  const legacyHash = createHash("sha256").update(`${user.salt}:${password}`).digest("hex");
  const ok = legacyHash.length === user.password_hash.length && timingSafeEqual(Buffer.from(legacyHash), Buffer.from(user.password_hash));
  return { ok, needsRehash: ok };
}

function tableColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}

function addColumn(table, column, definition) {
  if (!tableColumns(table).includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      is_super_admin INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS weddings (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      couple TEXT NOT NULL,
      wedding_date TEXT,
      wedding_time TEXT,
      venue TEXT,
      venue_address TEXT,
      map_url TEXT,
      dress_code TEXT,
      hero_image_url TEXT,
      invite_secondary_image_url TEXT,
      profile_image_url TEXT,
      theme_color TEXT NOT NULL DEFAULT 'sage',
      invitation_template TEXT NOT NULL DEFAULT 'custom',
      brand_name TEXT NOT NULL DEFAULT 'Gestionare Nunta',
      brand_logo_url TEXT,
      invite_intro TEXT,
      menu_options_json TEXT NOT NULL DEFAULT '["Carne","Peste","Vegetarian","Copil"]',
      program_json TEXT NOT NULL DEFAULT '[]',
      whatsapp_message TEXT NOT NULL,
      media_token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wedding_users (
      wedding_id TEXT NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'owner',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (wedding_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      active_wedding_id TEXT,
      csrf_token TEXT,
      expires_at INTEGER NOT NULL,
      last_seen_at INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS guests (
      id TEXT PRIMARY KEY,
      wedding_id TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      side TEXT NOT NULL DEFAULT 'Comun',
      group_name TEXT,
      status TEXT NOT NULL DEFAULT 'In asteptare',
      meal TEXT,
      meal_choice TEXT,
      meal_choices_json TEXT NOT NULL DEFAULT '[]',
      allergies TEXT,
      guest_message TEXT,
      seats INTEGER NOT NULL DEFAULT 1,
      invitation_token TEXT NOT NULL UNIQUE,
      response_locked INTEGER NOT NULL DEFAULT 0,
      table_id TEXT,
      table_name TEXT,
      invitation_sent INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS seating_tables (
      id TEXT PRIMARY KEY,
      wedding_id TEXT NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 8,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS budget_items (
      id TEXT PRIMARY KEY,
      wedding_id TEXT,
      item TEXT NOT NULL,
      supplier TEXT,
      planned INTEGER NOT NULL DEFAULT 0,
      paid INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'De platit',
      due TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      wedding_id TEXT,
      title TEXT NOT NULL,
      due TEXT,
      owner TEXT NOT NULL DEFAULT 'Amandoi',
      stage TEXT NOT NULL DEFAULT 'General',
      priority TEXT NOT NULL DEFAULT 'Medie',
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS media_uploads (
      id TEXT PRIMARY KEY,
      wedding_id TEXT NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
      guest_name TEXT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      seen_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      wedding_id TEXT NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT,
      phone TEXT,
      email TEXT,
      contract_name TEXT,
      contract_path TEXT,
      advance INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      due TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS room_tables (
      table_id TEXT PRIMARY KEY REFERENCES seating_tables(id) ON DELETE CASCADE,
      wedding_id TEXT NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
      x INTEGER NOT NULL DEFAULT 40,
      y INTEGER NOT NULL DEFAULT 40,
      shape TEXT NOT NULL DEFAULT 'round'
    );

    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      wedding_id TEXT NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT,
      seen_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS login_events (
      id TEXT PRIMARY KEY,
      email TEXT,
      ip TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      wedding_id TEXT,
      user_id TEXT,
      role TEXT,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  addColumn("users", "is_super_admin", "INTEGER NOT NULL DEFAULT 0");
  addColumn("users", "status", "TEXT NOT NULL DEFAULT 'active'");
  addColumn("users", "first_name", "TEXT");
  addColumn("users", "last_name", "TEXT");
  addColumn("users", "phone", "TEXT");
  addColumn("media_uploads", "seen_at", "TEXT");
  addColumn("activity_events", "seen_at", "TEXT");
  addColumn("weddings", "wedding_time", "TEXT");
  addColumn("weddings", "profile_image_url", "TEXT");
  addColumn("weddings", "invite_secondary_image_url", "TEXT");
  addColumn("weddings", "theme_color", "TEXT NOT NULL DEFAULT 'sage'");
  addColumn("weddings", "invitation_template", "TEXT NOT NULL DEFAULT 'custom'");
  addColumn("weddings", "brand_name", "TEXT NOT NULL DEFAULT 'Gestionare Nunta'");
  addColumn("weddings", "brand_logo_url", "TEXT");
  addColumn("weddings", "menu_options_json", "TEXT NOT NULL DEFAULT '[\"Carne\",\"Peste\",\"Vegetarian\",\"Copil\"]'");

  for (const [table, columns] of Object.entries({
    guests: [
      ["wedding_id", "TEXT"],
      ["group_name", "TEXT"],
      ["meal_choice", "TEXT"],
      ["meal_choices_json", "TEXT NOT NULL DEFAULT '[]'"],
      ["allergies", "TEXT"],
      ["guest_message", "TEXT"],
      ["response_locked", "INTEGER NOT NULL DEFAULT 0"],
      ["table_id", "TEXT"],
      ["invitation_sent", "INTEGER NOT NULL DEFAULT 0"]
    ],
    budget_items: [
      ["wedding_id", "TEXT"],
      ["supplier", "TEXT"],
      ["due", "TEXT"]
    ],
    tasks: [
      ["wedding_id", "TEXT"],
      ["stage", "TEXT NOT NULL DEFAULT 'General'"],
      ["priority", "TEXT NOT NULL DEFAULT 'Medie'"]
    ],
    sessions: [["active_wedding_id", "TEXT"], ["csrf_token", "TEXT"], ["last_seen_at", "INTEGER"]]
  })) {
    for (const [column, definition] of columns) addColumn(table, column, definition);
  }

  seed();
}

function addActivity(weddingId, type, title, detail = "") {
  db.prepare("INSERT INTO activity_events (id, wedding_id, type, title, detail) VALUES (?, ?, ?, ?, ?)")
    .run(id("act"), weddingId, type, title, detail);
}

function seed() {
  let user = db.prepare("SELECT * FROM users ORDER BY created_at LIMIT 1").get();
  if (!user) {
    const { hash, salt } = hashPassword("admin123");
    const userId = id("usr");
    db.prepare("INSERT INTO users (id, name, email, password_hash, salt) VALUES (?, ?, ?, ?, ?)")
      .run(userId, "Ana si Mihai", "admin@nunta.local", hash, salt);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  }

  if (!db.prepare("SELECT id FROM users WHERE email = ?").get("superadmin@platform.local")) {
    const { hash, salt } = hashPassword("superadmin123");
    db.prepare("INSERT INTO users (id, name, email, password_hash, salt, is_super_admin) VALUES (?, ?, ?, ?, ?, 1)")
      .run(id("usr"), "Super Admin", "superadmin@platform.local", hash, salt);
  }

  let wedding = db.prepare("SELECT * FROM weddings ORDER BY created_at LIMIT 1").get();
  if (!wedding) {
    const weddingId = id("wed");
    db.prepare(`
      INSERT INTO weddings (
        id, owner_id, couple, wedding_date, venue, venue_address, map_url, dress_code,
        hero_image_url, invite_intro, program_json, whatsapp_message, media_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      weddingId,
      user.id,
      "Ana & Mihai",
      "",
      "Restaurant",
      "",
      "",
      "Elegant",
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=80",
      "Va asteptam cu drag sa sarbatorim impreuna.",
      JSON.stringify([
        { time: "15:00", title: "Cununie civila" },
        { time: "17:00", title: "Ceremonie" },
        { time: "19:00", title: "Petrecere" }
      ]),
      "Buna, {name}! Te invitam cu drag la nunta noastra. Confirma aici: {link}",
      token()
    );
    db.prepare("INSERT OR IGNORE INTO wedding_users (wedding_id, user_id, role) VALUES (?, ?, 'owner')").run(weddingId, user.id);
    wedding = db.prepare("SELECT * FROM weddings WHERE id = ?").get(weddingId);
  }

  db.prepare("INSERT OR IGNORE INTO wedding_users (wedding_id, user_id, role) VALUES (?, ?, 'owner')").run(wedding.id, user.id);
  db.prepare("UPDATE guests SET wedding_id = ? WHERE wedding_id IS NULL").run(wedding.id);
  db.prepare("UPDATE budget_items SET wedding_id = ? WHERE wedding_id IS NULL").run(wedding.id);
  db.prepare("UPDATE tasks SET wedding_id = ? WHERE wedding_id IS NULL").run(wedding.id);

  const guests = db.prepare("SELECT COUNT(*) AS total FROM guests WHERE wedding_id = ?").get(wedding.id).total;
  if (!guests) {
    const insert = db.prepare(`
      INSERT INTO guests (id, wedding_id, name, phone, side, group_name, status, meal_choice, allergies, seats, invitation_token, table_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(id("gst"), wedding.id, "Maria Popescu", "40740123456", "Mireasa", "Familie", "Confirmat", "Vegetarian", "", 1, token(), "Masa 1");
    insert.run(id("gst"), wedding.id, "Andrei Ionescu", "40722987654", "Mire", "Prieteni", "In asteptare", "", "", 2, token(), "");
  }

  const tables = db.prepare("SELECT COUNT(*) AS total FROM seating_tables WHERE wedding_id = ?").get(wedding.id).total;
  if (!tables) {
    db.prepare("INSERT INTO seating_tables (id, wedding_id, name, capacity) VALUES (?, ?, ?, ?)").run(id("tbl"), wedding.id, "Masa 1", 8);
    db.prepare("INSERT INTO seating_tables (id, wedding_id, name, capacity) VALUES (?, ?, ?, ?)").run(id("tbl"), wedding.id, "Masa 2", 10);
  }

  const budget = db.prepare("SELECT COUNT(*) AS total FROM budget_items WHERE wedding_id = ?").get(wedding.id).total;
  if (!budget) {
    const insert = db.prepare("INSERT INTO budget_items (id, wedding_id, item, supplier, planned, paid, status, due) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    insert.run(id("bdg"), wedding.id, "Restaurant", "Restaurant", 42000, 10000, "Avans", "");
    insert.run(id("bdg"), wedding.id, "Foto video", "Studio foto", 6500, 6500, "Achitat", "");
  }

  const tasks = db.prepare("SELECT COUNT(*) AS total FROM tasks WHERE wedding_id = ?").get(wedding.id).total;
  if (!tasks) {
    const insert = db.prepare("INSERT INTO tasks (id, wedding_id, title, due, owner, stage, priority, done) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    insert.run(id("tsk"), wedding.id, "Confirma meniul final", "", "Amandoi", "Restaurant", "Mare", 0);
    insert.run(id("tsk"), wedding.id, "Trimite invitatiile pe WhatsApp", "", "Mireasa", "Invitatii", "Medie", 0);
  }
}

migrate();
backupDatabase().catch((error) => console.warn(`Backup baza de date esuat: ${error.message}`));

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").filter(Boolean).map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, decodeURIComponent(rest.join("="))];
  }));
}

function securityHeaders(extra = {}) {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data: https: blob:; media-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    ...extra
  };
}

function send(res, status, payload, extraHeaders = {}) {
  const body = payload === null ? "" : JSON.stringify(payload);
  res.writeHead(status, securityHeaders({ "Content-Type": "application/json; charset=utf-8", ...extraHeaders }));
  res.end(body);
}

function sendText(res, status, body, fileName) {
  res.writeHead(status, securityHeaders({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`
  }));
  res.end(body);
}

function sendFile(res, filePath, mimeType = "application/octet-stream", downloadName = "") {
  const headers = { "Content-Type": mimeType, "Cache-Control": "private, max-age=60" };
  if (downloadName) headers["Content-Disposition"] = `attachment; filename="${downloadName}"`;
  res.writeHead(200, securityHeaders(headers));
  createReadStream(filePath).pipe(res);
}

function readBody(req, maxBytes = 30_000_000) {
  return new Promise((resolveBody, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) {
        reject(new Error("Payload prea mare."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolveBody({});
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        reject(new Error("JSON invalid."));
      }
    });
  });
}

function publicOrigin(req) {
  const host = req.headers.host?.replace(":4000", ":5173");
  return `${req.headers["x-forwarded-proto"] || "http"}://${host}`;
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const current = new URL(`http://${req.headers.host}`);
    const incoming = new URL(origin);
    return incoming.hostname === current.hostname && ["5173", "4000", current.port].includes(incoming.port || (incoming.protocol === "https:" ? "443" : "80"));
  } catch {
    return false;
  }
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function isHttps(req) {
  return req.headers["x-forwarded-proto"] === "https";
}

function sessionCookie(name, value, req, maxAge) {
  const secure = isHttps(req) ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function publicCookie(name, value, req, maxAge) {
  const secure = isHttps(req) ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function rateLimit(map, key, limit, windowMs) {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || entry.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

function tooManyLoginFailures(key) {
  const entry = loginFailures.get(key);
  return Boolean(entry && entry.resetAt > Date.now() && entry.count >= loginMaxFailures);
}

function rememberLoginFailure(key) {
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || entry.resetAt <= now) loginFailures.set(key, { count: 1, resetAt: now + loginWindowMs });
  else entry.count += 1;
}

function clearLoginFailures(key) {
  loginFailures.delete(key);
}

function logLogin(email, ip, success, reason = "") {
  db.prepare("INSERT INTO login_events (id, email, ip, success, reason) VALUES (?, ?, ?, ?, ?)")
    .run(id("log"), String(email || "").toLowerCase(), ip, success ? 1 : 0, reason);
}

function addAudit(weddingId, userId, role, action, target = "", detail = "") {
  db.prepare("INSERT INTO audit_events (id, wedding_id, user_id, role, action, target, detail) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id("aud"), weddingId || "", userId || "", role || "", action, target, detail);
}

function isPublicMutation(url) {
  return url.pathname.startsWith("/api/invite/") || url.pathname.startsWith("/api/media/");
}

function safeDataUpload(dataUrl, allowedPrefixes) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  if (!allowedPrefixes.some((prefix) => mimeType === prefix || mimeType.startsWith(prefix))) return null;
  return { mimeType, encoded: match[2], buffer: Buffer.from(match[2], "base64") };
}

function mediaExtension(mimeType) {
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("mp4")) return ".mp4";
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("quicktime")) return ".mov";
  if (mimeType.includes("pdf")) return ".pdf";
  if (mimeType.includes("wordprocessingml")) return ".docx";
  if (mimeType.includes("msword")) return ".doc";
  return ".jpg";
}

function getSession(req) {
  const sessionId = parseCookies(req.headers.cookie).session;
  if (!sessionId) return null;
  const session = db.prepare(`
    SELECT sessions.id, sessions.expires_at, sessions.last_seen_at, sessions.csrf_token, sessions.active_wedding_id, users.id AS user_id, users.name, users.email, users.is_super_admin
    FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = ?
  `).get(sessionId);
  const now = Date.now();
  if (!session || session.expires_at < now || (session.last_seen_at && now - session.last_seen_at > sessionIdleMs)) {
    if (session) db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }
  db.prepare("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?").run(now, Math.min(now + sessionTtlMs, session.expires_at), session.id);
  return session;
}

function requireAuth(req, res) {
  const session = getSession(req);
  if (!session) {
    send(res, 401, { message: "Autentificare necesara." });
    return null;
  }
  return session;
}

function requireCsrf(req, res, url) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return true;
  if (["/api/login", "/api/register", "/api/logout"].includes(url.pathname) || isPublicMutation(url)) return true;
  const session = getSession(req);
  const header = String(req.headers["x-csrf-token"] || "");
  if (!session?.csrf_token || header !== session.csrf_token) {
    send(res, 403, { message: "Token CSRF invalid." });
    return false;
  }
  return true;
}

function weddingsForUser(userId) {
  const user = db.prepare("SELECT is_super_admin FROM users WHERE id = ?").get(userId);
  if (user?.is_super_admin) return db.prepare(`
    SELECT weddings.*, 'super_admin' AS role
    FROM weddings
    ORDER BY weddings.created_at DESC
  `).all().map(parseWedding);

  return db.prepare(`
    SELECT weddings.*, wedding_users.role
    FROM weddings JOIN wedding_users ON wedding_users.wedding_id = weddings.id
    WHERE wedding_users.user_id = ?
    ORDER BY weddings.created_at DESC
  `).all(userId).map(parseWedding);
}

function parseWedding(row) {
  return {
    ...row,
    program: JSON.parse(row.program_json || "[]"),
    menu_options: JSON.parse(row.menu_options_json || '["Carne","Peste","Vegetarian","Copil"]')
  };
}

function currentWedding(session) {
  const weddings = weddingsForUser(session.user_id);
  if (!weddings.length) return null;
  return weddings.find((wedding) => wedding.id === session.active_wedding_id) || weddings[0];
}

function isSuperAdmin(session) {
  return Boolean(session?.is_super_admin);
}

function roleRank(role) {
  return ({ viewer: 1, planner: 2, owner: 3, super_admin: 4 })[role] || 0;
}

function hasRole(wedding, required) {
  return roleRank(wedding?.role) >= roleRank(required);
}

function requireRole(res, wedding, required) {
  if (hasRole(wedding, required)) return true;
  send(res, 403, { message: "Nu ai permisiunea necesara pentru aceasta actiune." });
  return false;
}

function requireSuperAdmin(req, res) {
  const session = requireAuth(req, res);
  if (!session) return null;
  if (!isSuperAdmin(session)) {
    send(res, 403, { message: "Doar super adminul are acces aici." });
    return null;
  }
  return session;
}

function requireWedding(req, res) {
  const session = requireAuth(req, res);
  if (!session) return null;
  const wedding = currentWedding(session);
  if (!wedding) {
    send(res, 404, { message: "Nu exista nicio nunta pentru acest cont." });
    return null;
  }
  return { session, wedding };
}

function guestRow(row, wedding, origin) {
  const inviteUrl = `${origin}/invite/${row.invitation_token}`;
  const message = wedding.whatsapp_message
    .replaceAll("{name}", row.name)
    .replaceAll("{link}", inviteUrl)
    .replaceAll("{couple}", wedding.couple);
  const phone = String(row.phone || "").replace(/\D/g, "");
  return {
    ...row,
    meal_choices: JSON.parse(row.meal_choices_json || "[]"),
    inviteUrl,
    whatsappUrl: `https://wa.me/${phone || ""}?text=${encodeURIComponent(message)}`
  };
}

function listGuests(wedding, origin) {
  return db.prepare(`
    SELECT guests.*, seating_tables.name AS table_label
    FROM guests LEFT JOIN seating_tables ON seating_tables.id = guests.table_id
    WHERE guests.wedding_id = ?
    ORDER BY guests.created_at DESC
  `).all(wedding.id).map((row) => guestRow(row, wedding, origin));
}

function dashboard(wedding, origin, userId = wedding.owner_id) {
  const role = wedding.role || (isSuperAdmin(db.prepare("SELECT is_super_admin FROM users WHERE id = ?").get(userId)) ? "super_admin" : db.prepare("SELECT role FROM wedding_users WHERE wedding_id = ? AND user_id = ?").get(wedding.id, userId)?.role || "viewer");
  return {
    wedding: { ...wedding, role },
    weddings: weddingsForUser(userId),
    guests: listGuests(wedding, origin),
    tables: db.prepare("SELECT * FROM seating_tables WHERE wedding_id = ? ORDER BY created_at DESC").all(wedding.id),
    budget: db.prepare("SELECT * FROM budget_items WHERE wedding_id = ? ORDER BY created_at DESC").all(wedding.id),
    suppliers: db.prepare("SELECT id, name, category, phone, email, contract_name, advance, total, due, notes, created_at FROM suppliers WHERE wedding_id = ? ORDER BY created_at DESC").all(wedding.id),
    tasks: db.prepare("SELECT * FROM tasks WHERE wedding_id = ? ORDER BY done ASC, due ASC, created_at DESC").all(wedding.id)
      .map((task) => ({ ...task, done: Boolean(task.done) })),
    roomTables: db.prepare("SELECT * FROM room_tables WHERE wedding_id = ?").all(wedding.id),
    team: db.prepare(`
      SELECT users.id, users.name, users.first_name, users.last_name, users.phone, users.email, wedding_users.role
      FROM wedding_users JOIN users ON users.id = wedding_users.user_id
      WHERE wedding_users.wedding_id = ?
      ORDER BY wedding_users.created_at ASC
    `).all(wedding.id),
    mediaUrl: `${origin}/media/${wedding.media_token}`,
    mediaUploads: db.prepare("SELECT id, guest_name, file_name, mime_type, size, seen_at, created_at FROM media_uploads WHERE wedding_id = ? ORDER BY created_at DESC").all(wedding.id)
      .map((upload) => ({ ...upload, url: `/api/media-files/${upload.id}`, is_new: !upload.seen_at })),
    notifications: {
      newAcceptances: db.prepare("SELECT COUNT(*) AS total FROM activity_events WHERE wedding_id = ? AND type = 'rsvp_confirmed' AND seen_at IS NULL").get(wedding.id).total,
      newUploads: db.prepare("SELECT COUNT(*) AS total FROM media_uploads WHERE wedding_id = ? AND seen_at IS NULL").get(wedding.id).total,
      openTasks: db.prepare("SELECT COUNT(*) AS total FROM tasks WHERE wedding_id = ? AND done = 0 AND due IS NOT NULL AND due != '' AND date(due) <= date('now', '+7 day')").get(wedding.id).total,
      duePayments: db.prepare("SELECT COUNT(*) AS total FROM budget_items WHERE wedding_id = ? AND status != 'Achitat' AND due IS NOT NULL AND due != '' AND date(due) <= date('now', '+14 day')").get(wedding.id).total
    },
    recentAcceptances: db.prepare("SELECT id, title, detail, seen_at, created_at FROM activity_events WHERE wedding_id = ? AND type = 'rsvp_confirmed' ORDER BY created_at DESC LIMIT 5").all(wedding.id)
  };
}

function adminDashboard(origin) {
  const weddings = db.prepare(`
    SELECT weddings.*, users.name AS owner_name, users.email AS owner_email, users.status
    FROM weddings JOIN users ON users.id = weddings.owner_id
    ORDER BY weddings.created_at DESC
  `).all();
  const rows = weddings.map((wedding) => {
    const guests = db.prepare("SELECT COUNT(*) AS total FROM guests WHERE wedding_id = ?").get(wedding.id).total;
    const confirmed = db.prepare("SELECT COALESCE(SUM(seats), 0) AS total FROM guests WHERE wedding_id = ? AND status = 'Confirmat'").get(wedding.id).total;
    const uploads = db.prepare("SELECT COUNT(*) AS total FROM media_uploads WHERE wedding_id = ?").get(wedding.id).total;
    const newUploads = db.prepare("SELECT COUNT(*) AS total FROM media_uploads WHERE wedding_id = ? AND seen_at IS NULL").get(wedding.id).total;
    const planned = db.prepare("SELECT COALESCE(SUM(planned), 0) AS total FROM budget_items WHERE wedding_id = ?").get(wedding.id).total;
    const paid = db.prepare("SELECT COALESCE(SUM(paid), 0) AS total FROM budget_items WHERE wedding_id = ?").get(wedding.id).total;
    return { ...wedding, guests, confirmed, uploads, newUploads, planned, paid, status: wedding.status || "active", publicInviteBase: `${origin}/invite/` };
  });
  return {
    totals: {
      weddings: rows.length,
      clients: db.prepare("SELECT COUNT(*) AS total FROM users WHERE is_super_admin = 0").get().total,
      guests: rows.reduce((sum, row) => sum + row.guests, 0),
      uploads: rows.reduce((sum, row) => sum + row.uploads, 0),
      newUploads: rows.reduce((sum, row) => sum + row.newUploads, 0),
      planned: rows.reduce((sum, row) => sum + row.planned, 0),
      paid: rows.reduce((sum, row) => sum + row.paid, 0)
    },
    weddings: rows
  };
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function toCsv(rows, columns) {
  return [
    columns.map((column) => csvEscape(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column.key])).join(","))
  ].join("\n");
}

async function handleApi(req, res, url) {
  const origin = publicOrigin(req);
  const ip = clientIp(req);

  if (rateLimit(apiHits, ip, apiMaxRequests, apiWindowMs)) {
    send(res, 429, { message: "Prea multe cereri. Incearca din nou mai tarziu." });
    return;
  }

  if (!requireCsrf(req, res, url)) return;

  if (req.method === "GET" && url.pathname === "/api/session") {
    const session = getSession(req);
    if (!session) return send(res, 200, { user: null });
    let csrfToken = session.csrf_token;
    const extraHeaders = {};
    if (!csrfToken) {
      csrfToken = token();
      db.prepare("UPDATE sessions SET csrf_token = ? WHERE id = ?").run(csrfToken, session.id);
      extraHeaders["Set-Cookie"] = publicCookie("csrf_token", csrfToken, req, Math.floor(sessionTtlMs / 1000));
    }
    send(res, 200, {
      user: { id: session.user_id, name: session.name, email: session.email, isSuperAdmin: Boolean(session.is_super_admin) },
      weddings: weddingsForUser(session.user_id),
      activeWeddingId: currentWedding(session)?.id || null
    }, extraHeaders);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const passwordError = passwordPolicyError(password);
    if (!email || !body.couple) {
      send(res, 422, { message: "Completeaza email, parola si numele mirilor." });
      return;
    }
    if (passwordError) {
      send(res, 422, { message: passwordError });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      send(res, 422, { message: "Email invalid." });
      return;
    }
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
      send(res, 409, { message: "Exista deja un cont cu acest email." });
      return;
    }
    const userId = id("usr");
    const weddingId = id("wed");
    const { hash, salt } = hashPassword(password);
    db.prepare("INSERT INTO users (id, name, email, password_hash, salt) VALUES (?, ?, ?, ?, ?)")
      .run(userId, String(body.name || body.couple), email, hash, salt);
    db.prepare(`
      INSERT INTO weddings (id, owner_id, couple, wedding_date, venue, venue_address, map_url, dress_code, hero_image_url, invite_intro, program_json, whatsapp_message, media_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      weddingId,
      userId,
      String(body.couple),
      String(body.wedding_date || ""),
      String(body.venue || ""),
      "",
      "",
      "Elegant",
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=80",
      "Va asteptam cu drag sa sarbatorim impreuna.",
      "[]",
      "Buna, {name}! Te invitam cu drag la nunta noastra. Confirma aici: {link}",
      token()
    );
    db.prepare("INSERT INTO wedding_users (wedding_id, user_id, role) VALUES (?, ?, 'owner')").run(weddingId, userId);
    send(res, 201, { ok: true, message: "Contul a fost creat. Te poti conecta." });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readBody(req);
    const email = String(body.email || "").toLowerCase();
    const failureKey = `${ip}:${email}`;
    if (tooManyLoginFailures(failureKey)) {
      logLogin(email, ip, false, "rate_limited");
      send(res, 429, { message: "Prea multe incercari. Incearca din nou peste cateva minute." });
      return;
    }
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    const verification = verifyPassword(String(body.password || ""), user);
    if (!user || user.status === "inactive" || !verification.ok) {
      rememberLoginFailure(failureKey);
      logLogin(email, ip, false, !user ? "unknown_email" : user.status === "inactive" ? "inactive" : "bad_password");
      send(res, 401, { message: "Email sau parola incorecta." });
      return;
    }
    if (verification.needsRehash) {
      const { hash, salt } = hashPassword(String(body.password || ""));
      db.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").run(hash, salt, user.id);
    }
    clearLoginFailures(failureKey);
    logLogin(email, ip, true, "");
    const active = weddingsForUser(user.id)[0]?.id || null;
    const sessionId = id("ses");
    const csrfToken = token();
    db.prepare("INSERT INTO sessions (id, user_id, active_wedding_id, csrf_token, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(sessionId, user.id, active, csrfToken, Date.now() + sessionTtlMs, Date.now());
    send(res, 200, { user: { id: user.id, name: user.name, email: user.email, isSuperAdmin: Boolean(user.is_super_admin) } }, {
      "Set-Cookie": [
        sessionCookie("session", sessionId, req, Math.floor(sessionTtlMs / 1000)),
        publicCookie("csrf_token", csrfToken, req, Math.floor(sessionTtlMs / 1000))
      ]
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.session) db.prepare("DELETE FROM sessions WHERE id = ?").run(cookies.session);
    send(res, 200, { ok: true }, { "Set-Cookie": ["session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0", "csrf_token=; SameSite=Lax; Path=/; Max-Age=0"] });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/invite/")) {
    const inviteToken = url.pathname.split("/").pop();
    const guest = db.prepare("SELECT * FROM guests WHERE invitation_token = ?").get(inviteToken);
    if (!guest) return send(res, 404, { message: "Invitatia nu a fost gasita." });
    send(res, 200, { wedding: parseWedding(db.prepare("SELECT * FROM weddings WHERE id = ?").get(guest.wedding_id)), guest: { ...guest, meal_choices: JSON.parse(guest.meal_choices_json || "[]") } });
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/invite/")) {
    const inviteToken = url.pathname.split("/").pop();
    const body = await readBody(req);
    const guest = db.prepare("SELECT * FROM guests WHERE invitation_token = ?").get(inviteToken);
    if (!guest) return send(res, 404, { message: "Invitatia nu a fost gasita." });
    if (guest.status !== "In asteptare") return send(res, 409, { message: "Raspunsul a fost deja trimis si nu mai poate fi modificat." });
    const status = ["Confirmat", "Refuzat"].includes(body.status) ? body.status : "Confirmat";
    const seats = Math.max(1, Math.min(10, Number(body.seats) || 1));
    const mealChoices = Array.isArray(body.meal_choices)
      ? body.meal_choices.slice(0, seats).map((item) => String(item || "").trim())
      : [];
    while (mealChoices.length < seats) mealChoices.push("");
    const primaryMeal = mealChoices.find(Boolean) || String(body.meal_choice || "");
    db.prepare(`
      UPDATE guests SET status = ?, seats = ?, meal_choice = ?, meal_choices_json = ?, allergies = ?, guest_message = ?, response_locked = 1, updated_at = CURRENT_TIMESTAMP
      WHERE invitation_token = ?
    `).run(status, seats, primaryMeal, JSON.stringify(mealChoices), String(body.allergies || ""), String(body.guest_message || ""), inviteToken);
    const activityType = status === "Confirmat" ? "rsvp_confirmed" : status === "Refuzat" ? "rsvp_declined" : "rsvp";
    const activityTitle = status === "Confirmat" ? `${guest.name} a acceptat invitatia` : `${guest.name} a trimis raspuns`;
    addActivity(guest.wedding_id, activityType, activityTitle, `${status} - ${seats} locuri`);
    send(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/media/")) {
    const mediaToken = url.pathname.split("/").pop();
    const wedding = db.prepare("SELECT * FROM weddings WHERE media_token = ?").get(mediaToken);
    if (!wedding) return send(res, 404, { message: "Pagina media nu exista." });
    send(res, 200, { wedding: parseWedding(wedding) });
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/media/")) {
    const mediaToken = url.pathname.split("/").pop();
    const wedding = db.prepare("SELECT * FROM weddings WHERE media_token = ?").get(mediaToken);
    if (!wedding) return send(res, 404, { message: "Pagina media nu exista." });
    const body = await readBody(req, 60_000_000);
    const files = Array.isArray(body.files) ? body.files.slice(0, 8) : [];
    const targetDir = join(uploadsDir, wedding.id);
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
    let savedFiles = 0;
    for (const file of files) {
      const upload = safeDataUpload(file.dataUrl, ["image/", "video/"]);
      if (!upload) continue;
      const cleanName = basename(String(file.name || "fisier").replace(/[^\w.\- ]/g, "_")).replace(/\.(exe|js|html?|bat|cmd|ps1)$/i, "");
      const fileName = `${id("media")}_${cleanName}${mediaExtension(upload.mimeType)}`;
      const filePath = join(targetDir, fileName);
      await writeFile(filePath, upload.buffer);
      db.prepare("INSERT INTO media_uploads (id, wedding_id, guest_name, file_name, file_path, mime_type, size) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(id("upl"), wedding.id, String(body.guest_name || ""), cleanName, filePath, upload.mimeType, upload.buffer.length);
      savedFiles += 1;
    }
    if (savedFiles) addActivity(wedding.id, "upload", `${body.guest_name || "Un invitat"} a incarcat fisiere`, `${savedFiles} fisiere noi in galerie`);
    send(res, 201, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/public-media/")) {
    const [, , , weddingId, maybeFolder, ...rest] = url.pathname.split("/");
    const folder = rest.length ? maybeFolder : "hero";
    const fileName = basename((rest.length ? rest : [maybeFolder]).join("/"));
    const filePath = join(uploadsDir, weddingId, folder, fileName);
    if (!existsSync(filePath)) return send(res, 404, { message: "Fisierul nu exista." });
    sendFile(res, filePath, mimeTypes[extname(filePath)] || "application/octet-stream");
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/dashboard") {
    const session = requireSuperAdmin(req, res);
    if (!session) return;
    send(res, 200, adminDashboard(origin));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/clients") {
    const session = requireSuperAdmin(req, res);
    if (!session) return;
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !body.couple) return send(res, 422, { message: "Email si nume miri sunt obligatorii." });
    const passwordError = passwordPolicyError(String(body.password || ""));
    if (passwordError) return send(res, 422, { message: passwordError });
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) return send(res, 409, { message: "Clientul exista deja." });
    const password = String(body.password);
    const { hash, salt } = hashPassword(password);
    const userId = id("usr");
    const weddingId = id("wed");
    db.prepare("INSERT INTO users (id, name, email, password_hash, salt) VALUES (?, ?, ?, ?, ?)").run(userId, String(body.name || body.couple), email, hash, salt);
    db.prepare("INSERT INTO weddings (id, owner_id, couple, wedding_date, wedding_time, venue, venue_address, map_url, dress_code, hero_image_url, invite_intro, program_json, whatsapp_message, media_token) VALUES (?, ?, ?, ?, ?, ?, '', '', 'Elegant', '', 'Va asteptam cu drag.', '[]', 'Buna, {name}! Confirma aici: {link}', ?)")
      .run(weddingId, userId, String(body.couple), String(body.wedding_date || ""), String(body.wedding_time || ""), String(body.venue || ""), token());
    db.prepare("INSERT INTO wedding_users (wedding_id, user_id, role) VALUES (?, ?, 'owner')").run(weddingId, userId);
    send(res, 201, adminDashboard(origin));
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/admin/users/") && url.pathname.endsWith("/reset-password")) {
    const session = requireSuperAdmin(req, res);
    if (!session) return;
    const userId = url.pathname.split("/")[4];
    const body = await readBody(req);
    const passwordError = passwordPolicyError(String(body.password || ""));
    if (passwordError) return send(res, 422, { message: passwordError });
    const { hash, salt } = hashPassword(String(body.password));
    db.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").run(hash, salt, userId);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    addAudit("", session.user_id, "super_admin", "reset_password", userId, "");
    send(res, 200, adminDashboard(origin));
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/admin/users/") && url.pathname.endsWith("/status")) {
    const session = requireSuperAdmin(req, res);
    if (!session) return;
    const userId = url.pathname.split("/")[4];
    const body = await readBody(req);
    db.prepare("UPDATE users SET status = ? WHERE id = ?").run(body.status === "inactive" ? "inactive" : "active", userId);
    send(res, 200, adminDashboard(origin));
    return;
  }

  const context = requireWedding(req, res);
  if (!context) return;
  const { session, wedding } = context;

  if (req.method === "GET" && url.pathname === "/api/dashboard") {
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/weddings") {
    if (!isSuperAdmin(session)) return send(res, 403, { message: "Doar super adminul poate adauga nunti manual. Mirii isi primesc nunta la crearea contului." });
    const body = await readBody(req);
    const weddingId = id("wed");
    db.prepare(`
      INSERT INTO weddings (id, owner_id, couple, wedding_date, venue, venue_address, map_url, dress_code, hero_image_url, invite_intro, program_json, whatsapp_message, media_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(weddingId, session.user_id, String(body.couple || "Nunta noua"), String(body.wedding_date || ""), String(body.venue || ""), "", "", "Elegant", "", "Va asteptam cu drag.", "[]", "Buna, {name}! Confirma aici: {link}", token());
    db.prepare("INSERT INTO wedding_users (wedding_id, user_id, role) VALUES (?, ?, 'owner')").run(weddingId, session.user_id);
    db.prepare("UPDATE sessions SET active_wedding_id = ? WHERE id = ?").run(weddingId, session.id);
    send(res, 201, dashboard(parseWedding(db.prepare("SELECT * FROM weddings WHERE id = ?").get(weddingId)), origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/weddings/") && url.pathname.endsWith("/select")) {
    const weddingId = url.pathname.split("/")[3];
    const hasAccess = isSuperAdmin(session) || db.prepare("SELECT 1 FROM wedding_users WHERE wedding_id = ? AND user_id = ?").get(weddingId, session.user_id);
    if (!hasAccess) return send(res, 403, { message: "Nu ai acces la aceasta nunta." });
    db.prepare("UPDATE sessions SET active_wedding_id = ? WHERE id = ?").run(weddingId, session.id);
    send(res, 200, dashboard(parseWedding(db.prepare("SELECT * FROM weddings WHERE id = ?").get(weddingId)), origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/hero-upload") {
    if (!requireRole(res, wedding, "owner")) return;
    const body = await readBody(req, 80_000_000);
    const upload = safeDataUpload(body.dataUrl, ["image/", "video/"]);
    if (!upload) return send(res, 422, { message: "Incarca o imagine sau un video valid." });
    const ext = mediaExtension(upload.mimeType);
    const targetDir = join(uploadsDir, wedding.id, "hero");
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
    const slot = body.slot === "secondary" ? "secondary" : "hero";
    const fileName = `${slot}_${Date.now()}${ext}`;
    const filePath = join(targetDir, fileName);
    await writeFile(filePath, upload.buffer);
    const heroUrl = `/api/public-media/${wedding.id}/${fileName}`;
    if (slot === "secondary") {
      db.prepare("UPDATE weddings SET invite_secondary_image_url = ? WHERE id = ?").run(heroUrl, wedding.id);
    } else {
      db.prepare("UPDATE weddings SET hero_image_url = ? WHERE id = ?").run(heroUrl, wedding.id);
    }
    addAudit(wedding.id, session.user_id, wedding.role, "upload_invitation_media", slot, heroUrl);
    send(res, 200, dashboard(parseWedding(db.prepare("SELECT * FROM weddings WHERE id = ?").get(wedding.id)), origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/profile-upload") {
    if (!requireRole(res, wedding, "owner")) return;
    const body = await readBody(req, 20_000_000);
    const upload = safeDataUpload(body.dataUrl, ["image/"]);
    if (!upload) return send(res, 422, { message: "Incarca o imagine valida." });
    const ext = mediaExtension(upload.mimeType);
    const targetDir = join(uploadsDir, wedding.id, "profile");
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
    const fileName = `profile_${Date.now()}${ext}`;
    const filePath = join(targetDir, fileName);
    await writeFile(filePath, upload.buffer);
    const profileUrl = `/api/public-media/${wedding.id}/profile/${fileName}`;
    db.prepare("UPDATE weddings SET profile_image_url = ? WHERE id = ?").run(profileUrl, wedding.id);
    addAudit(wedding.id, session.user_id, wedding.role, "upload_profile_image", "wedding", profileUrl);
    send(res, 200, dashboard(parseWedding(db.prepare("SELECT * FROM weddings WHERE id = ?").get(wedding.id)), origin, session.user_id));
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/settings") {
    if (!requireRole(res, wedding, "owner")) return;
    const body = await readBody(req);
    db.prepare(`
      UPDATE weddings SET couple = ?, wedding_date = ?, wedding_time = ?, venue = ?, venue_address = ?, map_url = ?, dress_code = ?,
      hero_image_url = ?, invite_secondary_image_url = ?, profile_image_url = ?, theme_color = ?, invitation_template = ?, invite_intro = ?, menu_options_json = ?, program_json = ?, whatsapp_message = ? WHERE id = ?
    `).run(
      String(body.couple || "Nunta"),
      String(body.wedding_date || ""),
      String(body.wedding_time || ""),
      String(body.venue || ""),
      String(body.venue_address || ""),
      String(body.map_url || ""),
      String(body.dress_code || ""),
      String(body.hero_image_url || ""),
      String(body.invite_secondary_image_url || ""),
      String(body.profile_image_url || ""),
      ["sage", "rose", "navy", "dark"].includes(body.theme_color) ? body.theme_color : "sage",
      String(body.invitation_template || "custom"),
      String(body.invite_intro || ""),
      JSON.stringify((Array.isArray(body.menu_options) ? body.menu_options : []).filter(Boolean)),
      JSON.stringify(Array.isArray(body.program) ? body.program : []),
      String(body.whatsapp_message || "Buna, {name}! Confirma aici: {link}"),
      wedding.id
    );
    addAudit(wedding.id, session.user_id, wedding.role, "update_settings", "wedding", wedding.id);
    send(res, 200, dashboard(parseWedding(db.prepare("SELECT * FROM weddings WHERE id = ?").get(wedding.id)), origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/team") {
    if (!requireRole(res, wedding, "owner")) return;
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = ["planner", "viewer"].includes(body.role) ? body.role : "viewer";
    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const displayName = `${firstName} ${lastName}`.trim() || String(body.name || email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 422, { message: "Email invalid." });
    const passwordError = passwordPolicyError(password);
    if (passwordError) return send(res, 422, { message: passwordError });
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) return send(res, 409, { message: "Exista deja un cont cu acest email." });
    const userId = id("usr");
    const { hash, salt } = hashPassword(password);
    db.prepare("INSERT INTO users (id, name, first_name, last_name, phone, email, password_hash, salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(userId, displayName, firstName, lastName, String(body.phone || ""), email, hash, salt);
    db.prepare("INSERT INTO wedding_users (wedding_id, user_id, role) VALUES (?, ?, ?)").run(wedding.id, userId, role);
    addAudit(wedding.id, session.user_id, wedding.role, "create_team_account", userId, `${role}:${email}`);
    send(res, 201, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/team/")) {
    if (!requireRole(res, wedding, "owner")) return;
    const body = await readBody(req);
    const userId = url.pathname.split("/").pop();
    const link = db.prepare("SELECT role FROM wedding_users WHERE wedding_id = ? AND user_id = ?").get(wedding.id, userId);
    if (!link || link.role === "owner") return send(res, 404, { message: "Contul nu poate fi editat." });
    const email = String(body.email || "").trim().toLowerCase();
    const existing = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, userId);
    const role = ["planner", "viewer"].includes(body.role) ? body.role : link.role;
    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const displayName = `${firstName} ${lastName}`.trim() || String(body.name || email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 422, { message: "Email invalid." });
    if (existing) return send(res, 409, { message: "Exista deja un cont cu acest email." });
    if (String(body.password || "")) {
      const passwordError = passwordPolicyError(String(body.password));
      if (passwordError) return send(res, 422, { message: passwordError });
    }
    db.prepare("UPDATE users SET name = ?, first_name = ?, last_name = ?, phone = ?, email = ? WHERE id = ?")
      .run(displayName, firstName, lastName, String(body.phone || ""), email, userId);
    db.prepare("UPDATE wedding_users SET role = ? WHERE wedding_id = ? AND user_id = ?").run(role, wedding.id, userId);
    if (String(body.password || "")) {
      const { hash, salt } = hashPassword(String(body.password));
      db.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").run(hash, salt, userId);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    }
    addAudit(wedding.id, session.user_id, wedding.role, "update_team_account", userId, `${role}:${email}`);
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/suppliers") {
    if (!requireRole(res, wedding, "planner")) return;
    const body = await readBody(req, 20_000_000);
    let contractName = "";
    let contractPath = "";
    const upload = safeDataUpload(body.contract_data_url, ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/"]);
    if (upload) {
      const targetDir = join(uploadsDir, wedding.id, "contracts");
      if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
      const original = basename(String(body.contract_name || "contract").replace(/[^\w.\- ]/g, "_"));
      contractName = `${id("contract")}_${original.replace(/\.(exe|js|html?|bat|cmd|ps1)$/i, "")}${mediaExtension(upload.mimeType)}`;
      contractPath = join(targetDir, contractName);
      await writeFile(contractPath, upload.buffer);
    } else if (body.contract_data_url) {
      return send(res, 422, { message: "Contractul trebuie sa fie PDF, DOC, DOCX sau imagine." });
    }
    db.prepare("INSERT INTO suppliers (id, wedding_id, name, category, phone, email, contract_name, contract_path, advance, total, due, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id("sup"), wedding.id, String(body.name || "Furnizor"), String(body.category || ""), String(body.phone || ""), String(body.email || ""), contractName, contractPath, Number(body.advance) || 0, Number(body.total) || 0, String(body.due || ""), String(body.notes || ""));
    addActivity(wedding.id, "supplier", `Furnizor adaugat: ${String(body.name || "Furnizor")}`, `Total contract: ${Number(body.total) || 0} RON`);
    addAudit(wedding.id, session.user_id, wedding.role, "create_supplier", "supplier", String(body.name || ""));
    send(res, 201, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/suppliers/")) {
    if (!requireRole(res, wedding, "planner")) return;
    const supplierId = url.pathname.split("/").pop();
    const current = db.prepare("SELECT * FROM suppliers WHERE id = ? AND wedding_id = ?").get(supplierId, wedding.id);
    if (!current) return send(res, 404, { message: "Furnizorul nu exista." });
    const body = await readBody(req, 20_000_000);
    let contractName = current.contract_name || "";
    let contractPath = current.contract_path || "";
    const upload = safeDataUpload(body.contract_data_url, ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/"]);
    if (upload) {
      const targetDir = join(uploadsDir, wedding.id, "contracts");
      if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
      const original = basename(String(body.contract_name || "contract").replace(/[^\w.\- ]/g, "_"));
      contractName = `${id("contract")}_${original.replace(/\.(exe|js|html?|bat|cmd|ps1)$/i, "")}${mediaExtension(upload.mimeType)}`;
      contractPath = join(targetDir, contractName);
      await writeFile(contractPath, upload.buffer);
    } else if (body.contract_data_url) {
      return send(res, 422, { message: "Contractul trebuie sa fie PDF, DOC, DOCX sau imagine." });
    }
    db.prepare(`
      UPDATE suppliers SET name = ?, phone = ?, email = ?, contract_name = ?, contract_path = ?, advance = ?, total = ?, notes = ?
      WHERE id = ? AND wedding_id = ?
    `).run(
      String(body.name || "Furnizor"),
      String(body.phone || ""),
      String(body.email || ""),
      contractName,
      contractPath,
      Number(body.advance) || 0,
      Number(body.total) || 0,
      String(body.notes || ""),
      supplierId,
      wedding.id
    );
    addActivity(wedding.id, "supplier", `Furnizor editat: ${String(body.name || current.name)}`, `Total contract: ${Number(body.total) || 0} RON`);
    addAudit(wedding.id, session.user_id, wedding.role, "update_supplier", supplierId, String(body.name || current.name));
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/suppliers/")) {
    if (!requireRole(res, wedding, "planner")) return;
    const supplierId = url.pathname.split("/").pop();
    const supplier = db.prepare("SELECT name FROM suppliers WHERE id = ? AND wedding_id = ?").get(supplierId, wedding.id);
    db.prepare("DELETE FROM suppliers WHERE id = ? AND wedding_id = ?").run(supplierId, wedding.id);
    if (supplier) addActivity(wedding.id, "supplier", `Furnizor sters: ${supplier.name}`, "");
    addAudit(wedding.id, session.user_id, wedding.role, "delete_supplier", supplierId, supplier?.name || "");
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/room-tables/")) {
    if (!requireRole(res, wedding, "planner")) return;
    const tableId = url.pathname.split("/").pop();
    const body = await readBody(req);
    db.prepare("INSERT OR REPLACE INTO room_tables (table_id, wedding_id, x, y, shape) VALUES (?, ?, ?, ?, ?)")
      .run(tableId, wedding.id, Math.max(0, Number(body.x) || 0), Math.max(0, Number(body.y) || 0), ["round", "rect"].includes(body.shape) ? body.shape : "round");
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/guests") {
    if (!requireRole(res, wedding, "planner")) return;
    const body = await readBody(req);
    db.prepare(`
      INSERT INTO guests (id, wedding_id, name, phone, side, group_name, status, meal_choice, allergies, seats, invitation_token, table_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id("gst"), wedding.id, String(body.name || "Invitat"), String(body.phone || ""), String(body.side || "Comun"), String(body.group_name || ""), String(body.status || "In asteptare"), String(body.meal_choice || ""), String(body.allergies || ""), Math.max(1, Number(body.seats) || 1), token(), String(body.table_id || ""));
    addAudit(wedding.id, session.user_id, wedding.role, "create_guest", "guest", String(body.name || "Invitat"));
    send(res, 201, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/guests/")) {
    if (!requireRole(res, wedding, "planner")) return;
    const body = await readBody(req);
    const guestId = url.pathname.split("/").pop();
    const current = db.prepare("SELECT * FROM guests WHERE id = ? AND wedding_id = ?").get(guestId, wedding.id);
    if (!current) return send(res, 404, { message: "Invitatul nu exista." });
    db.prepare(`
      UPDATE guests SET name = ?, phone = ?, side = ?, status = ?, meal_choice = ?, allergies = ?, seats = ?, table_id = ?, invitation_sent = COALESCE(?, invitation_sent), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND wedding_id = ?
    `).run(
      body.name === undefined ? current.name : String(body.name || "Invitat"),
      body.phone === undefined ? current.phone : String(body.phone || ""),
      body.side === undefined ? current.side : String(body.side || "Comun"),
      body.status === undefined ? current.status : String(body.status || "In asteptare"),
      body.meal_choice === undefined ? current.meal_choice : String(body.meal_choice || ""),
      body.allergies === undefined ? current.allergies : String(body.allergies || ""),
      body.seats === undefined ? current.seats : Math.max(1, Number(body.seats) || 1),
      body.table_id === undefined ? current.table_id : String(body.table_id || ""),
      body.invitation_sent === undefined ? null : Number(Boolean(body.invitation_sent)),
      guestId,
      wedding.id
    );
    addAudit(wedding.id, session.user_id, wedding.role, "update_guest", guestId, body.name === undefined ? current.name : String(body.name || "Invitat"));
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/guests/")) {
    if (!requireRole(res, wedding, "planner")) return;
    db.prepare("DELETE FROM guests WHERE id = ? AND wedding_id = ?").run(url.pathname.split("/").pop(), wedding.id);
    addAudit(wedding.id, session.user_id, wedding.role, "delete_guest", url.pathname.split("/").pop(), "");
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tables") {
    if (!requireRole(res, wedding, "planner")) return;
    const body = await readBody(req);
    db.prepare("INSERT INTO seating_tables (id, wedding_id, name, capacity, notes) VALUES (?, ?, ?, ?, ?)")
      .run(id("tbl"), wedding.id, String(body.name || "Masa"), Math.max(1, Number(body.capacity) || 8), String(body.notes || ""));
    send(res, 201, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/tables/")) {
    if (!requireRole(res, wedding, "planner")) return;
    const tableId = url.pathname.split("/").pop();
    db.prepare("UPDATE guests SET table_id = '' WHERE table_id = ? AND wedding_id = ?").run(tableId, wedding.id);
    db.prepare("DELETE FROM seating_tables WHERE id = ? AND wedding_id = ?").run(tableId, wedding.id);
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/budget") {
    if (!requireRole(res, wedding, "planner")) return;
    const body = await readBody(req);
    db.prepare("INSERT INTO budget_items (id, wedding_id, item, supplier, planned, paid, status, due) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id("bdg"), wedding.id, String(body.item || "Element"), String(body.supplier || ""), Number(body.planned) || 0, Number(body.paid) || 0, String(body.status || "De platit"), String(body.due || ""));
    send(res, 201, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/budget/")) {
    if (!requireRole(res, wedding, "planner")) return;
    db.prepare("DELETE FROM budget_items WHERE id = ? AND wedding_id = ?").run(url.pathname.split("/").pop(), wedding.id);
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    if (!requireRole(res, wedding, "planner")) return;
    const body = await readBody(req);
    db.prepare("INSERT INTO tasks (id, wedding_id, title, due, owner, stage, priority, done) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id("tsk"), wedding.id, String(body.title || "Sarcina"), String(body.due || ""), String(body.owner || "Amandoi"), String(body.stage || "General"), String(body.priority || "Medie"), body.done ? 1 : 0);
    send(res, 201, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/tasks/")) {
    if (!requireRole(res, wedding, "planner")) return;
    const body = await readBody(req);
    db.prepare("UPDATE tasks SET done = ? WHERE id = ? AND wedding_id = ?").run(body.done ? 1 : 0, url.pathname.split("/").pop(), wedding.id);
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/tasks/")) {
    if (!requireRole(res, wedding, "planner")) return;
    db.prepare("DELETE FROM tasks WHERE id = ? AND wedding_id = ?").run(url.pathname.split("/").pop(), wedding.id);
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/media-files/")) {
    const uploadId = url.pathname.split("/").pop();
    const upload = db.prepare("SELECT * FROM media_uploads WHERE id = ?").get(uploadId);
    if (!upload || upload.wedding_id !== wedding.id) return send(res, 404, { message: "Fisierul nu exista." });
    if (!existsSync(upload.file_path)) return send(res, 404, { message: "Fisierul lipseste de pe disc." });
    sendFile(res, upload.file_path, upload.mime_type, url.searchParams.get("download") ? upload.file_name : "");
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/media-uploads/seen") {
    if (!requireRole(res, wedding, "planner")) return;
    db.prepare("UPDATE media_uploads SET seen_at = CURRENT_TIMESTAMP WHERE wedding_id = ? AND seen_at IS NULL").run(wedding.id);
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/rsvp-acceptances/seen") {
    if (!requireRole(res, wedding, "planner")) return;
    db.prepare("UPDATE activity_events SET seen_at = CURRENT_TIMESTAMP WHERE wedding_id = ? AND type = 'rsvp_confirmed' AND seen_at IS NULL").run(wedding.id);
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/media-uploads/zip") {
    const uploads = db.prepare("SELECT * FROM media_uploads WHERE wedding_id = ? ORDER BY created_at DESC").all(wedding.id);
    const zip = new AdmZip();
    for (const upload of uploads) {
      if (existsSync(upload.file_path)) {
        zip.addLocalFile(upload.file_path, "", `${upload.guest_name || "invitat"}_${upload.file_name}`.replace(/[^\w.\- ]/g, "_"));
      }
    }
    const buffer = zip.toBuffer();
    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${wedding.couple.replace(/[^\w-]+/g, "_")}_uploaduri.zip"`,
      "Cache-Control": "no-store"
    });
    res.end(buffer);
    db.prepare("UPDATE media_uploads SET seen_at = CURRENT_TIMESTAMP WHERE wedding_id = ? AND seen_at IS NULL").run(wedding.id);
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/export/")) {
    const type = url.pathname.split("/").pop();
    if (type === "guests") {
      const guests = listGuests(wedding, origin).map((guest) => {
        const [firstName, ...lastName] = String(guest.name || "").split(" ");
        const mealDetails = (Array.isArray(guest.meal_choices) && guest.meal_choices.length ? guest.meal_choices : [guest.meal_choice || ""])
          .map((choice, index) => `${index + 1}. ${choice || "Neales"}`)
          .join("; ");
        return { ...guest, first_name: firstName || "", last_name: lastName.join(" "), meal_details: mealDetails };
      });
      return sendText(res, 200, toCsv(guests, [
        { key: "first_name", label: "Nume" }, { key: "last_name", label: "Prenume" }, { key: "phone", label: "Telefon" },
        { key: "status", label: "Status" }, { key: "seats", label: "Locuri" }, { key: "meal_details", label: "Meniu" },
        { key: "allergies", label: "Alergii" }, { key: "table_label", label: "Masa" }, { key: "inviteUrl", label: "Link invitatie" }
      ]), "invitati.csv");
    }
    if (type === "menu") {
      const guests = listGuests(wedding, origin).filter((guest) => guest.status === "Confirmat").map((guest) => ({
        ...guest,
        meal_details: (Array.isArray(guest.meal_choices) && guest.meal_choices.length ? guest.meal_choices : [guest.meal_choice || ""])
          .map((choice, index) => `${index + 1}. ${choice || "Neales"}`)
          .join("; ")
      }));
      return sendText(res, 200, toCsv(guests, [
        { key: "name", label: "Nume" }, { key: "seats", label: "Locuri" }, { key: "meal_details", label: "Meniu" }, { key: "allergies", label: "Alergii" }, { key: "guest_message", label: "Mesaj" }
      ]), "meniuri.csv");
    }
    if (type === "tables") {
      return sendText(res, 200, toCsv(listGuests(wedding, origin).filter((guest) => guest.table_id), [
        { key: "table_label", label: "Masa" }, { key: "name", label: "Invitat" }, { key: "seats", label: "Locuri" }
      ]), "mese.csv");
    }
    if (type === "tables-pdf") {
      const guests = listGuests(wedding, origin);
      const confirmed = guests
        .filter((guest) => guest.status === "Confirmat")
        .sort((a, b) => a.name.localeCompare(b.name, "ro", { sensitivity: "base" }));
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${wedding.couple.replace(/[^\w-]+/g, "_")}_asezare_mese.pdf"`,
        "Cache-Control": "no-store"
      });
      const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
      doc.pipe(res);

      function drawPageFrame() {
        doc.rect(18, 18, doc.page.width - 36, doc.page.height - 36).strokeColor("#d7c08a").lineWidth(1.2).stroke();
        doc.rect(24, 24, doc.page.width - 48, doc.page.height - 48).strokeColor("#efe0b6").lineWidth(0.6).stroke();
        doc.font("Times-Bold").fontSize(30).fillColor("#202529").text(wedding.couple, 0, 32, { align: "center" });
        doc.font("Times-Roman").fontSize(11).fillColor("#65747e").text("VA UREAZA BINE ATI VENIT", 0, 65, { align: "center" });
        const subtitle = [wedding.venue, wedding.wedding_date, wedding.wedding_time ? `ora ${wedding.wedding_time}` : ""].filter(Boolean).join(" - ");
        doc.fontSize(9).fillColor("#8a743d").text(subtitle || "Asezare mese", 0, 82, { align: "center" });
      }

      function guestLine(guest) {
        const persons = Number(guest.seats || 1);
        const table = guest.table_label || guest.table_name || "FARA MASA";
        const plus = persons > 1 ? ` - ${persons} PERS` : "";
        return `${guest.name.toUpperCase()}${plus} - ${table.toUpperCase()}`;
      }

      const columnCount = 4;
      const top = 116;
      const bottom = doc.page.height - 42;
      const left = 42;
      const gap = 18;
      const columnWidth = (doc.page.width - left * 2 - gap * (columnCount - 1)) / columnCount;
      const lineHeight = 10.4;
      const maxRows = Math.floor((bottom - top) / lineHeight);

      drawPageFrame();
      let column = 0;
      let row = 0;
      let currentInitial = "";

      confirmed.forEach((guest) => {
        if (row >= maxRows) {
          column += 1;
          row = 0;
        }
        if (column >= columnCount) {
          doc.addPage();
          drawPageFrame();
          column = 0;
          row = 0;
          currentInitial = "";
        }

        const initial = guest.name.trim().charAt(0).toUpperCase();
        if (initial && initial !== currentInitial) {
          if (row > maxRows - 3) {
            column += 1;
            row = 0;
            if (column >= columnCount) {
              doc.addPage();
              drawPageFrame();
              column = 0;
            }
          }
          currentInitial = initial;
          const x = left + column * (columnWidth + gap);
          const y = top + row * lineHeight;
          doc.font("Times-BoldItalic").fontSize(14).fillColor("#8a743d").text(initial, x, y, { width: columnWidth });
          row += 1.5;
        }

        const x = left + column * (columnWidth + gap);
        const y = top + row * lineHeight;
        doc.font("Helvetica-Bold").fontSize(6.8).fillColor("#202529").text(guestLine(guest), x, y, {
          width: columnWidth,
          lineBreak: false,
          ellipsis: true
        });
        row += 1;
      });

      if (!confirmed.length) {
        doc.font("Times-Roman").fontSize(16).fillColor("#65747e").text("Nu exista invitati confirmati.", 0, 180, { align: "center" });
      }
      doc.end();
      return;
    }
    if (type === "budget") {
      const rows = db.prepare("SELECT name, phone, email, contract_name, advance, total, notes, created_at FROM suppliers WHERE wedding_id = ? ORDER BY created_at DESC").all(wedding.id)
        .map((supplier) => ({
          ...supplier,
          contact: [supplier.phone, supplier.email].filter(Boolean).join(" / "),
          remaining: Math.max(0, Number(supplier.total || 0) - Number(supplier.advance || 0)),
          status: Number(supplier.advance || 0) >= Number(supplier.total || 0) && Number(supplier.total || 0) > 0 ? "Achitat" : Number(supplier.advance || 0) > 0 ? "Avans" : "De platit"
        }));
      return sendText(res, 200, toCsv(rows, [
        { key: "name", label: "Furnizor" },
        { key: "contact", label: "Contact" },
        { key: "advance", label: "Avans platit" },
        { key: "total", label: "Total contract" },
        { key: "remaining", label: "De plata" },
        { key: "status", label: "Status" },
        { key: "contract_name", label: "Contract" },
        { key: "notes", label: "Observatii" }
      ]), "costuri.csv");
    }
    if (type === "tasks") {
      return sendText(res, 200, toCsv(dashboard(wedding, origin).tasks, [
        { key: "title", label: "Sarcina" }, { key: "due", label: "Termen" }, { key: "owner", label: "Responsabil" }, { key: "stage", label: "Etapa" }, { key: "priority", label: "Prioritate" }, { key: "done", label: "Finalizat" }
      ]), "checklist.csv");
    }
  }

  send(res, 404, { message: "Ruta nu exista." });
}

const mimeTypes = {
   ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime"
};

async function serveStatic(req, res, url) {
  const distDir = join(rootDir, "dist");

  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/") {
    pathname = "/index.html";
  }

  // Eliminam slash-ul de la inceput ca path.join sa nu ignore distDir
  const relativePath = pathname.replace(/^\/+/, "");
  const filePath = resolve(distDir, relativePath);

  // Protectie path traversal
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403, securityHeaders({
      "Content-Type": "text/plain; charset=utf-8"
    }));
    res.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();

    res.writeHead(200, securityHeaders({
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=31536000"
    }));

    res.end(file);
  } catch {
    if (pathname.startsWith("/assets/") || extname(pathname)) {
      res.writeHead(404, securityHeaders({
        "Content-Type": "text/plain; charset=utf-8"
      }));
      res.end("File not found");
      return;
    }

    const fallback = await readFile(join(distDir, "index.html"));

    res.writeHead(200, securityHeaders({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }));

    res.end(fallback);
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  try {
    if (!isAllowedOrigin(req)) return send(res, 403, { message: "Origine nepermisa." });
    if (req.method === "OPTIONS") return send(res, 204, null);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    await serveStatic(req, res, url);
  } catch (error) {
    send(res, 500, { message: error.message || "Eroare server." });
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`API disponibil pe portul ${port}`);
});
