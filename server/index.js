import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");
const PDFDocument = require("pdfkit");

const rootDir = resolve(process.cwd());
const dataDir = join(rootDir, "data");
const uploadsDir = join(dataDir, "uploads");
const dbPath = join(dataDir, "wedding.sqlite");
const port = Number(process.env.PORT || 4000);
const sessionTtlMs = 1000 * 60 * 60 * 24 * 7;

for (const dir of [dataDir, uploadsDir]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

function id(prefix = "id") {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function token() {
  return randomBytes(20).toString("base64url");
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: createHash("sha256").update(`${salt}:${password}`).digest("hex") };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return timingSafeEqual(Buffer.from(hash), Buffer.from(user.password_hash));
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
      expires_at INTEGER NOT NULL,
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
  `);

  addColumn("users", "is_super_admin", "INTEGER NOT NULL DEFAULT 0");
  addColumn("users", "status", "TEXT NOT NULL DEFAULT 'active'");
  addColumn("media_uploads", "seen_at", "TEXT");
  addColumn("activity_events", "seen_at", "TEXT");
  addColumn("weddings", "wedding_time", "TEXT");
  addColumn("weddings", "profile_image_url", "TEXT");
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
    sessions: [["active_wedding_id", "TEXT"]]
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

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").filter(Boolean).map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, decodeURIComponent(rest.join("="))];
  }));
}

function send(res, status, payload, extraHeaders = {}) {
  const body = payload === null ? "" : JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders });
  res.end(body);
}

function sendText(res, status, body, fileName) {
  res.writeHead(status, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendFile(res, filePath, mimeType = "application/octet-stream", downloadName = "") {
  const headers = { "Content-Type": mimeType, "Cache-Control": "private, max-age=60" };
  if (downloadName) headers["Content-Disposition"] = `attachment; filename="${downloadName}"`;
  res.writeHead(200, headers);
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

function getSession(req) {
  const sessionId = parseCookies(req.headers.cookie).session;
  if (!sessionId) return null;
  const session = db.prepare(`
    SELECT sessions.id, sessions.expires_at, sessions.active_wedding_id, users.id AS user_id, users.name, users.email, users.is_super_admin
    FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = ?
  `).get(sessionId);
  if (!session || session.expires_at < Date.now()) {
    if (session) db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }
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
      SELECT users.id, users.name, users.email, wedding_users.role
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

  if (req.method === "GET" && url.pathname === "/api/session") {
    const session = getSession(req);
    if (!session) return send(res, 200, { user: null });
    send(res, 200, {
      user: { id: session.user_id, name: session.name, email: session.email, isSuperAdmin: Boolean(session.is_super_admin) },
      weddings: weddingsForUser(session.user_id),
      activeWeddingId: currentWedding(session)?.id || null
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || password.length < 6 || !body.couple) {
      send(res, 422, { message: "Completeaza email, parola de minimum 6 caractere si numele mirilor." });
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
    const sessionId = id("ses");
    db.prepare("INSERT INTO sessions (id, user_id, active_wedding_id, expires_at) VALUES (?, ?, ?, ?)")
      .run(sessionId, userId, weddingId, Date.now() + sessionTtlMs);
    send(res, 201, { user: { id: userId, name: String(body.name || body.couple), email } }, {
      "Set-Cookie": `session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(sessionTtlMs / 1000)}`
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readBody(req);
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(body.email || "").toLowerCase());
    if (!user || user.status === "inactive" || !verifyPassword(String(body.password || ""), user)) {
      send(res, 401, { message: "Email sau parola incorecta." });
      return;
    }
    const active = weddingsForUser(user.id)[0]?.id || null;
    const sessionId = id("ses");
    db.prepare("INSERT INTO sessions (id, user_id, active_wedding_id, expires_at) VALUES (?, ?, ?, ?)")
      .run(sessionId, user.id, active, Date.now() + sessionTtlMs);
    send(res, 200, { user: { id: user.id, name: user.name, email: user.email, isSuperAdmin: Boolean(user.is_super_admin) } }, {
      "Set-Cookie": `session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(sessionTtlMs / 1000)}`
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.session) db.prepare("DELETE FROM sessions WHERE id = ?").run(cookies.session);
    send(res, 200, { ok: true }, { "Set-Cookie": "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/invite/")) {
    const inviteToken = url.pathname.split("/").pop();
    const guest = db.prepare("SELECT * FROM guests WHERE invitation_token = ?").get(inviteToken);
    if (!guest) return send(res, 404, { message: "Invitatia nu a fost gasita." });
    send(res, 200, { wedding: parseWedding(db.prepare("SELECT * FROM weddings WHERE id = ?").get(guest.wedding_id)), guest });
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/invite/")) {
    const inviteToken = url.pathname.split("/").pop();
    const body = await readBody(req);
    const guest = db.prepare("SELECT * FROM guests WHERE invitation_token = ?").get(inviteToken);
    if (!guest) return send(res, 404, { message: "Invitatia nu a fost gasita." });
    if (guest.response_locked || guest.status !== "In asteptare") return send(res, 409, { message: "Raspunsul a fost deja trimis si nu mai poate fi modificat." });
    const status = ["Confirmat", "Refuzat", "In asteptare"].includes(body.status) ? body.status : "In asteptare";
    db.prepare(`
      UPDATE guests SET status = ?, seats = ?, meal_choice = ?, allergies = ?, guest_message = ?, response_locked = 1, updated_at = CURRENT_TIMESTAMP
      WHERE invitation_token = ?
    `).run(status, Math.max(1, Math.min(10, Number(body.seats) || 1)), String(body.meal_choice || ""), String(body.allergies || ""), String(body.guest_message || ""), inviteToken);
    const seats = Math.max(1, Math.min(10, Number(body.seats) || 1));
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
      const match = String(file.dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
      if (!match) continue;
      const [, mimeType, encoded] = match;
      const buffer = Buffer.from(encoded, "base64");
      const cleanName = basename(String(file.name || "fisier").replace(/[^\w.\- ]/g, "_"));
      const fileName = `${Date.now()}_${cleanName}`;
      const filePath = join(targetDir, fileName);
      await writeFile(filePath, buffer);
      db.prepare("INSERT INTO media_uploads (id, wedding_id, guest_name, file_name, file_path, mime_type, size) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(id("upl"), wedding.id, String(body.guest_name || ""), cleanName, filePath, mimeType, buffer.length);
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
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) return send(res, 409, { message: "Clientul exista deja." });
    const password = String(body.password || "client123");
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
    const { hash, salt } = hashPassword(String(body.password || "client123"));
    db.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").run(hash, salt, userId);
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
    const body = await readBody(req, 20_000_000);
    const match = String(body.dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
    if (!match || !match[1].startsWith("image/")) return send(res, 422, { message: "Incarca o imagine valida." });
    const [, mimeType, encoded] = match;
    const ext = mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg";
    const targetDir = join(uploadsDir, wedding.id, "hero");
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
    const fileName = `hero_${Date.now()}${ext}`;
    const filePath = join(targetDir, fileName);
    await writeFile(filePath, Buffer.from(encoded, "base64"));
    const heroUrl = `/api/public-media/${wedding.id}/${fileName}`;
    db.prepare("UPDATE weddings SET hero_image_url = ? WHERE id = ?").run(heroUrl, wedding.id);
    send(res, 200, dashboard(parseWedding(db.prepare("SELECT * FROM weddings WHERE id = ?").get(wedding.id)), origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/profile-upload") {
    const body = await readBody(req, 20_000_000);
    const match = String(body.dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
    if (!match || !match[1].startsWith("image/")) return send(res, 422, { message: "Incarca o imagine valida." });
    const [, mimeType, encoded] = match;
    const ext = mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg";
    const targetDir = join(uploadsDir, wedding.id, "profile");
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
    const fileName = `profile_${Date.now()}${ext}`;
    const filePath = join(targetDir, fileName);
    await writeFile(filePath, Buffer.from(encoded, "base64"));
    const profileUrl = `/api/public-media/${wedding.id}/profile/${fileName}`;
    db.prepare("UPDATE weddings SET profile_image_url = ? WHERE id = ?").run(profileUrl, wedding.id);
    send(res, 200, dashboard(parseWedding(db.prepare("SELECT * FROM weddings WHERE id = ?").get(wedding.id)), origin, session.user_id));
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/settings") {
    const body = await readBody(req);
    db.prepare(`
      UPDATE weddings SET couple = ?, wedding_date = ?, wedding_time = ?, venue = ?, venue_address = ?, map_url = ?, dress_code = ?,
      hero_image_url = ?, profile_image_url = ?, theme_color = ?, invitation_template = ?, invite_intro = ?, menu_options_json = ?, program_json = ?, whatsapp_message = ? WHERE id = ?
    `).run(
      String(body.couple || "Nunta"),
      String(body.wedding_date || ""),
      String(body.wedding_time || ""),
      String(body.venue || ""),
      String(body.venue_address || ""),
      String(body.map_url || ""),
      String(body.dress_code || ""),
      String(body.hero_image_url || ""),
      String(body.profile_image_url || ""),
      ["sage", "rose", "navy", "dark"].includes(body.theme_color) ? body.theme_color : "sage",
      "custom",
      String(body.invite_intro || ""),
      JSON.stringify((Array.isArray(body.menu_options) ? body.menu_options : []).filter(Boolean)),
      JSON.stringify(Array.isArray(body.program) ? body.program : []),
      String(body.whatsapp_message || "Buna, {name}! Confirma aici: {link}"),
      wedding.id
    );
    send(res, 200, dashboard(parseWedding(db.prepare("SELECT * FROM weddings WHERE id = ?").get(wedding.id)), origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/team") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const role = ["owner", "planner", "viewer"].includes(body.role) ? body.role : "viewer";
    let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) {
      const { hash, salt } = hashPassword("parola123");
      db.prepare("INSERT INTO users (id, name, email, password_hash, salt) VALUES (?, ?, ?, ?, ?)")
        .run(id("usr"), String(body.name || email), email, hash, salt);
      user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    }
    db.prepare("INSERT OR REPLACE INTO wedding_users (wedding_id, user_id, role) VALUES (?, ?, ?)").run(wedding.id, user.id, role);
    send(res, 201, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/suppliers") {
    const body = await readBody(req, 20_000_000);
    let contractName = "";
    let contractPath = "";
    const match = String(body.contract_data_url || "").match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const targetDir = join(uploadsDir, wedding.id, "contracts");
      if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
      contractName = basename(String(body.contract_name || "contract.pdf").replace(/[^\w.\- ]/g, "_"));
      contractPath = join(targetDir, `${Date.now()}_${contractName}`);
      await writeFile(contractPath, Buffer.from(match[2], "base64"));
    }
    db.prepare("INSERT INTO suppliers (id, wedding_id, name, category, phone, email, contract_name, contract_path, advance, total, due, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id("sup"), wedding.id, String(body.name || "Furnizor"), String(body.category || ""), String(body.phone || ""), String(body.email || ""), contractName, contractPath, Number(body.advance) || 0, Number(body.total) || 0, String(body.due || ""), String(body.notes || ""));
    addActivity(wedding.id, "supplier", `Furnizor adaugat: ${String(body.name || "Furnizor")}`, `Total contract: ${Number(body.total) || 0} RON`);
    send(res, 201, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/suppliers/")) {
    const supplierId = url.pathname.split("/").pop();
    const supplier = db.prepare("SELECT name FROM suppliers WHERE id = ? AND wedding_id = ?").get(supplierId, wedding.id);
    db.prepare("DELETE FROM suppliers WHERE id = ? AND wedding_id = ?").run(supplierId, wedding.id);
    if (supplier) addActivity(wedding.id, "supplier", `Furnizor sters: ${supplier.name}`, "");
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/room-tables/")) {
    const tableId = url.pathname.split("/").pop();
    const body = await readBody(req);
    db.prepare("INSERT OR REPLACE INTO room_tables (table_id, wedding_id, x, y, shape) VALUES (?, ?, ?, ?, ?)")
      .run(tableId, wedding.id, Math.max(0, Number(body.x) || 0), Math.max(0, Number(body.y) || 0), ["round", "rect"].includes(body.shape) ? body.shape : "round");
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/guests") {
    const body = await readBody(req);
    db.prepare(`
      INSERT INTO guests (id, wedding_id, name, phone, side, group_name, status, meal_choice, allergies, seats, invitation_token, table_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id("gst"), wedding.id, String(body.name || "Invitat"), String(body.phone || ""), String(body.side || "Comun"), String(body.group_name || ""), String(body.status || "In asteptare"), String(body.meal_choice || ""), String(body.allergies || ""), Math.max(1, Number(body.seats) || 1), token(), String(body.table_id || ""));
    send(res, 201, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/guests/")) {
    const body = await readBody(req);
    const guestId = url.pathname.split("/").pop();
    db.prepare(`
      UPDATE guests SET status = COALESCE(?, status), table_id = ?, invitation_sent = COALESCE(?, invitation_sent), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND wedding_id = ?
    `).run(body.status ?? null, String(body.table_id || ""), body.invitation_sent === undefined ? null : Number(Boolean(body.invitation_sent)), guestId, wedding.id);
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/guests/")) {
    db.prepare("DELETE FROM guests WHERE id = ? AND wedding_id = ?").run(url.pathname.split("/").pop(), wedding.id);
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tables") {
    const body = await readBody(req);
    db.prepare("INSERT INTO seating_tables (id, wedding_id, name, capacity, notes) VALUES (?, ?, ?, ?, ?)")
      .run(id("tbl"), wedding.id, String(body.name || "Masa"), Math.max(1, Number(body.capacity) || 8), String(body.notes || ""));
    send(res, 201, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/tables/")) {
    const tableId = url.pathname.split("/").pop();
    db.prepare("UPDATE guests SET table_id = '' WHERE table_id = ? AND wedding_id = ?").run(tableId, wedding.id);
    db.prepare("DELETE FROM seating_tables WHERE id = ? AND wedding_id = ?").run(tableId, wedding.id);
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/budget") {
    const body = await readBody(req);
    db.prepare("INSERT INTO budget_items (id, wedding_id, item, supplier, planned, paid, status, due) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id("bdg"), wedding.id, String(body.item || "Element"), String(body.supplier || ""), Number(body.planned) || 0, Number(body.paid) || 0, String(body.status || "De platit"), String(body.due || ""));
    send(res, 201, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/budget/")) {
    db.prepare("DELETE FROM budget_items WHERE id = ? AND wedding_id = ?").run(url.pathname.split("/").pop(), wedding.id);
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    const body = await readBody(req);
    db.prepare("INSERT INTO tasks (id, wedding_id, title, due, owner, stage, priority, done) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id("tsk"), wedding.id, String(body.title || "Sarcina"), String(body.due || ""), String(body.owner || "Amandoi"), String(body.stage || "General"), String(body.priority || "Medie"), body.done ? 1 : 0);
    send(res, 201, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/tasks/")) {
    const body = await readBody(req);
    db.prepare("UPDATE tasks SET done = ? WHERE id = ? AND wedding_id = ?").run(body.done ? 1 : 0, url.pathname.split("/").pop(), wedding.id);
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/tasks/")) {
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
    db.prepare("UPDATE media_uploads SET seen_at = CURRENT_TIMESTAMP WHERE wedding_id = ? AND seen_at IS NULL").run(wedding.id);
    send(res, 200, dashboard(wedding, origin, session.user_id));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/rsvp-acceptances/seen") {
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
        return { ...guest, first_name: firstName || "", last_name: lastName.join(" ") };
      });
      return sendText(res, 200, toCsv(guests, [
        { key: "first_name", label: "Nume" }, { key: "last_name", label: "Prenume" }, { key: "phone", label: "Telefon" },
        { key: "status", label: "Status" }, { key: "seats", label: "Locuri" }, { key: "meal_choice", label: "Meniu" },
        { key: "allergies", label: "Alergii" }, { key: "table_label", label: "Masa" }, { key: "inviteUrl", label: "Link invitatie" }
      ]), "invitati.csv");
    }
    if (type === "menu") {
      return sendText(res, 200, toCsv(listGuests(wedding, origin).filter((guest) => guest.status === "Confirmat"), [
        { key: "name", label: "Nume" }, { key: "seats", label: "Locuri" }, { key: "meal_choice", label: "Meniu" }, { key: "allergies", label: "Alergii" }, { key: "guest_message", label: "Mesaj" }
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
      return sendText(res, 200, toCsv(dashboard(wedding, origin).budget, [
        { key: "item", label: "Element" }, { key: "supplier", label: "Furnizor" }, { key: "planned", label: "Planificat" }, { key: "paid", label: "Platit" }, { key: "status", label: "Status" }, { key: "due", label: "Scadenta" }
      ]), "buget.csv");
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
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

async function serveStatic(req, res, url) {
  const distDir = join(rootDir, "dist");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = join(distDir, pathname);
  const safePath = filePath.startsWith(distDir) ? filePath : join(distDir, "index.html");
  try {
    const file = await readFile(safePath);
    res.writeHead(200, { "Content-Type": mimeTypes[extname(safePath)] || "application/octet-stream" });
    res.end(file);
  } catch {
    try {
      const fallback = await readFile(join(distDir, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fallback);
    } catch {
      send(res, 200, { message: "API pornit. Ruleaza si `npm run dev` pentru interfata React." });
    }
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    await serveStatic(req, res, url);
  } catch (error) {
    send(res, 500, { message: error.message || "Eroare server." });
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`API disponibil pe portul ${port}`);
});
