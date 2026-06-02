import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import {
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileArchive,
  ImageUp,
  LogOut,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  QrCode,
  Settings,
  Shirt,
  Table2,
  Trash2,
  UserPlus,
  Users,
  WalletCards,
  BarChart3,
  Bell,
  Camera,
  Clock,
  FileText,
  Search,
  ShieldCheck,
  X
} from "lucide-react";
import "./styles.css";
import templateOneIcon from "./invitatii-personalizate/Template 1/wedding-icon.svg";

const emptyGuest = {
  first_name: "",
  last_name: "",
  name: "",
  phone: "",
  side: "Comun",
  group_name: "",
  status: "In asteptare",
  meal_choice: "",
  allergies: "",
  seats: 1,
  table_id: ""
};

function splitGuestName(name = "") {
  const [firstName, ...rest] = String(name || "").trim().split(/\s+/).filter(Boolean);
  return { first_name: firstName || "", last_name: rest.join(" ") };
}

function prettyFileLabel(files, fallback = "Alege fisiere") {
  const list = Array.from(files || []);
  if (!list.length) return fallback;
  if (list.length === 1) return list[0].name;
  return `${list.length} fisiere selectate`;
}

function normalizeSeatCount(value) {
  return Math.max(1, Math.min(10, Number(value) || 1));
}

function mealChoicesForSeats(existing, seats, fallback = "") {
  const count = normalizeSeatCount(seats);
  const choices = Array.isArray(existing) ? existing.slice(0, count) : [];
  while (choices.length < count) choices.push(choices.length === 0 ? fallback : "");
  return choices;
}

function mealSummary(guest) {
  const choices = Array.isArray(guest.meal_choices) && guest.meal_choices.length ? guest.meal_choices.filter(Boolean) : [];
  if (!choices.length) return guest.meal_choice || "-";
  return choices.map((choice, index) => `${index + 1}. ${choice}`).join(", ");
}

function isVideoUrl(url = "") {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(String(url));
}

function roleLevel(role) {
  return ({ viewer: 1, planner: 2, owner: 3, super_admin: 4 })[role] || 0;
}

function canRole(role, required) {
  return roleLevel(role) >= roleLevel(required);
}

const invitationTemplates = [
  { key: "custom", title: "Template 1", description: "Layout cu 2 media, RSVP si program", resolution: "1920x1080 px", secondaryResolution: "1200x900 px", icon: templateOneIcon }
];

async function api(path, options = {}) {
  const csrfToken = document.cookie.split("; ").find((item) => item.startsWith("csrf_token="))?.split("=")[1] || "";
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(csrfToken ? { "X-CSRF-Token": decodeURIComponent(csrfToken) } : {}), ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Cererea a esuat.");
  return data;
}

function money(value) {
  return new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function dateLabel(value) {
  if (!value) return "Data necompletata";
  return new Date(`${value}T12:00:00`).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
}

const inviteImageResolution = "1920 x 1200 px";

function weddingDateTime(wedding) {
  if (!wedding.wedding_date) return null;
  return new Date(`${wedding.wedding_date}T${wedding.wedding_time || "12:00"}:00`);
}

function Countdown({ wedding }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const target = weddingDateTime(wedding);
  if (!target) return <Metric icon={<Clock />} label="Pana la nunta" value="-" detail="seteaza data si ora" />;
  const diff = Math.max(0, target.getTime() - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return <Metric icon={<Clock />} label="Pana la nunta" value={`${days}z ${hours}h`} detail={`${minutes} minute ramase`} />;
}

function SidebarCountdown({ wedding }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const target = weddingDateTime(wedding);
  if (!target) return <p className="sidebar-countdown"><Clock size={16} />Seteaza data si ora nuntii</p>;
  const diff = Math.max(0, target.getTime() - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return <p className="sidebar-countdown"><Clock size={16} /><span>{days} zile, {hours} ore, {minutes} min</span></p>;
}

function partyLabel(seats) {
  const count = Number(seats || 1);
  if (count <= 1) return "singur";
  return `+${count - 1}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function App() {
  const path = window.location.pathname;
  if (path.startsWith("/invite/")) return <InvitationPage token={path.split("/").pop()} />;
  if (path.startsWith("/media/")) return <MediaUploadPage token={path.split("/").pop()} />;

  const [session, setSession] = useState(undefined);
  useEffect(() => {
    api("/api/session").then(setSession).catch(() => setSession({ user: null }));
  }, []);

  if (session === undefined) return <ScreenLoader />;
  if (!session.user) return <AuthScreen onAuth={setSession} />;
  return <Dashboard session={session} onLogout={() => setSession({ user: null })} />;
}

function ScreenLoader() {
  return <main className="center-screen"><div className="wedding-loader"><span /> <strong>Se incarca platforma</strong></div></main>;
}

function ConfirmDialog({ title = "Esti sigur?", message, confirmLabel = "Sterge", onCancel, onConfirm }) {
  return (
    <div className="confirm-backdrop" role="dialog" aria-modal="true">
      <section className="confirm-dialog">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="row-actions">
          <button className="tool-button" onClick={onCancel} type="button">Anuleaza</button>
          <button className="tool-button danger-fill" onClick={onConfirm} type="button">{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

function AuthMotion({ type, message }) {
  const isSuccess = type === "success";
  const isRegister = type === "register";
  return (
    <div className={`auth-motion ${isSuccess ? "success" : isRegister ? "register" : "login"}`} role="status" aria-live="polite">
      <div className="auth-orbit" aria-hidden="true">
        <i />
        <i />
        <span>{isSuccess ? <Check size={30} /> : isRegister ? <UserPlus size={28} /> : <ShieldCheck size={30} />}</span>
      </div>
      <div>
        <strong>{message}</strong>
        <p>
          {isSuccess
            ? "Contul a fost creat. Revenim automat la conectare."
            : isRegister
              ? "Validam datele, cream nunta si pregatim contul."
              : "Verificam sesiunea si pregatim panoul tau."}
        </p>
      </div>
      <div className="auth-progress" aria-hidden="true"><span /></div>
    </div>
  );
}

function useConfirmDelete(mutate) {
  const [pending, setPending] = useState(null);
  const dialog = pending ? (
    <ConfirmDialog
      message={pending.message}
      onCancel={() => setPending(null)}
      onConfirm={async () => {
        const current = pending;
        setPending(null);
        await mutate(current.path, { method: "DELETE" });
      }}
    />
  ) : null;
  const askDelete = (path, message) => setPending({ path, message });
  return { askDelete, dialog };
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [login, setLogin] = useState({ email: "admin@nunta.local", password: "admin123" });
  const [register, setRegister] = useState({ name: "", email: "", password: "", couple: "", wedding_date: "", venue: "" });
  const [error, setError] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function submitLogin(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoadingMessage("Se verifica datele contului...");
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify(login) });
      const session = await api("/api/session");
      setLoadingMessage("Se incarca platforma...");
      window.setTimeout(() => onAuth(session), 700);
    } catch (err) {
      setLoadingMessage("");
      setError(err.message);
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoadingMessage("Se creeaza contul...");
    try {
      await api("/api/register", { method: "POST", body: JSON.stringify(register) });
      setLoadingMessage("");
      setSuccessMessage("Cont inregistrat cu succes. Te trimitem la conectare.");
      setRegister({ name: "", email: "", password: "", couple: "", wedding_date: "", venue: "" });
      window.setTimeout(() => {
        setMode("login");
        setSuccessMessage("");
      }, 1400);
    } catch (err) {
      setLoadingMessage("");
      setError(err.message);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel wide">
        <div>
          <p className="eyebrow">Platforma pentru miri</p>
          <h1>{mode === "login" ? "Autentificare" : "Creeaza cont si nunta"}</h1>
        </div>
        <div className="segmented">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); setSuccessMessage(""); }} type="button">Login</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); setSuccessMessage(""); }} type="button">Cont nou</button>
        </div>
        {loadingMessage ? <AuthMotion type={mode} message={loadingMessage} /> : null}
        {successMessage ? <AuthMotion type="success" message={successMessage} /> : null}
        {mode === "login" ? (
          <form className="login-form" onSubmit={submitLogin}>
            <label>Email<input value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} /></label>
            <label>Parola<input type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></label>
            {error ? <p className="form-error">{error}</p> : null}
            <button disabled={Boolean(loadingMessage)} type="submit">Intra in platforma</button>
          </form>
        ) : (
          <form className="login-form register-grid" onSubmit={submitRegister}>
            <label>Nume cont<input required value={register.name} onChange={(event) => setRegister({ ...register, name: event.target.value })} /></label>
            <label>Email<input required type="email" value={register.email} onChange={(event) => setRegister({ ...register, email: event.target.value })} /></label>
            <label>Parola<input required type="password" minLength="10" value={register.password} onChange={(event) => setRegister({ ...register, password: event.target.value })} /><span className="field-hint">Minim 10 caractere, litera mare, cifra si simbol.</span></label>
            <label>Mireasa & Mire<input required value={register.couple} onChange={(event) => setRegister({ ...register, couple: event.target.value })} /></label>
            <label>Data nuntii<input type="date" value={register.wedding_date} onChange={(event) => setRegister({ ...register, wedding_date: event.target.value })} /></label>
            <label>Locatie<input value={register.venue} onChange={(event) => setRegister({ ...register, venue: event.target.value })} /></label>
            {error ? <p className="form-error span-2">{error}</p> : null}
            <button className="span-2" disabled={Boolean(loadingMessage)} type="submit">Creeaza contul</button>
          </form>
        )}
      </section>
    </main>
  );
}

function Dashboard({ session, onLogout }) {
  const [data, setData] = useState(null);
  const [active, setActive] = useState("guests");
  const [error, setError] = useState("");
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (active === "room") setActive("tables");
  }, [active]);

  async function refresh() {
    setError("");
    try {
      setData(await api("/api/dashboard"));
    } catch (err) {
      setError(err.message);
    }
  }

  async function mutate(path, options) {
    setError("");
    try {
      setData(await api(path, options));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  async function logout() {
    try {
      await api("/api/logout", { method: "POST" });
    } finally {
      onLogout();
    }
  }

  if (!data) return <ScreenLoader />;

  const confirmedSeats = data.guests.filter((guest) => guest.status === "Confirmat").reduce((sum, guest) => sum + Number(guest.seats || 0), 0);
  const paid = data.suppliers.reduce((sum, item) => sum + Number(item.advance || 0), 0);
  const planned = data.suppliers.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const done = data.tasks.filter((task) => task.done).length;
  const role = data.wedding.role || "viewer";
  const tabs = [
    ...(session.user.isSuperAdmin ? [["admin", "Super Admin", ShieldCheck]] : []),
    ["progress", "Progres", BarChart3],
    ["guests", "Invitati", Users],
    ["tables", "Mese", Table2],
    ["suppliers", "Financiar", WalletCards],
    ["calendar", "Calendar", CalendarDays],
    ["invitation", "Invitatie", FileText],
    ["exports", "Export", Download],
    ["media", "QR Media", QrCode],
    ["photos", "Poze", Camera],
    ...(canRole(role, "owner") ? [["team", "Roluri", UserPlus], ["settings", "Setari", Settings]] : [])
  ].filter(([key]) => canRole(role, "owner") || !["invitation"].includes(key));

  return (
    <div className={`app-shell theme-${data.wedding.theme_color || "sage"}`}>
      <aside className="sidebar">
        <div className="brand">
          {data.wedding.profile_image_url ? <img className="profile-photo" src={data.wedding.profile_image_url} alt={data.wedding.couple} /> : <span>GN</span>}
          <div>
            <strong>{data.wedding.couple}</strong>
            <small>{data.wedding.venue || "Nunta activa"}</small>
          </div>
        </div>
        <SidebarCountdown wedding={data.wedding} />
        <WeddingSwitcher data={data} mutate={mutate} />
        <nav>
          {tabs.map(([key, label, Icon]) => (
            <button className={active === key ? "active" : ""} key={key} onClick={() => {
              setActive(key);
              if (canRole(data.wedding.role, "planner") && key === "guests" && data.notifications?.newAcceptances) mutate("/api/rsvp-acceptances/seen", { method: "POST" });
              if (canRole(data.wedding.role, "planner") && key === "photos" && data.notifications?.newUploads) mutate("/api/media-uploads/seen", { method: "POST" });
            }} type="button">
              <Icon size={18} />{label}
              {key === "guests" && data.notifications?.newAcceptances ? <span className="nav-badge">{data.notifications.newAcceptances}</span> : null}
              {key === "photos" && data.notifications?.newUploads ? <span className="nav-badge">{data.notifications.newUploads}</span> : null}
            </button>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Panou organizatori</p>
            <h1>{data.wedding.couple}</h1>
          </div>
          <div className="user-tools">
            <span>{session.user.name}</span>
            <button className="icon-button" onClick={() => setLogoutConfirm(true)} title="Deconectare" type="button"><LogOut size={18} /></button>
          </div>
        </header>

        {error ? <p className="form-error">{error}</p> : null}

        {active === "progress" ? (
          <section className="metrics-grid">
            <Metric icon={<Users />} label="Persoane confirmate" value={confirmedSeats} detail={`${data.guests.length} invitati in lista`} />
            <Metric icon={<Table2 />} label="Mese" value={data.tables.length} detail="cu capacitate si repartizare" />
            <Metric icon={<WalletCards />} label="Buget platit" value={money(paid)} detail={`${money(planned)} planificat`} />
            <Metric icon={<ClipboardList />} label="Task-uri bifate" value={`${done}/${data.tasks.length}`} detail="organizare curenta" />
          </section>
        ) : null}

        {active === "admin" ? <SuperAdmin mutate={mutate} /> : null}
        {active === "progress" ? <ProgressReports data={data} /> : null}
        {active === "guests" ? <Guests data={data} mutate={mutate} /> : null}
        {active === "tables" ? <SeatingSection data={data} mutate={mutate} /> : null}
        {active === "suppliers" ? <Suppliers data={data} mutate={mutate} /> : null}
        {active === "calendar" ? <CalendarView data={data} mutate={mutate} /> : null}
        {active === "invitation" ? <InvitationSettings data={data} mutate={mutate} /> : null}
        {active === "exports" ? <Exports /> : null}
        {active === "media" ? <MediaQr data={data} /> : null}
        {active === "photos" ? <Photos data={data} /> : null}
        {active === "team" ? <Team data={data} mutate={mutate} /> : null}
        {active === "settings" ? <SettingsPanel data={data} mutate={mutate} /> : null}
        {logoutConfirm ? (
          <ConfirmDialog
            confirmLabel="Deconectare"
            message="Esti sigur ca vrei sa te deconectezi?"
            onCancel={() => setLogoutConfirm(false)}
            onConfirm={logout}
          />
        ) : null}
      </main>
    </div>
  );
}

function WeddingSwitcher({ data, mutate }) {
  const [form, setForm] = useState({ couple: "", wedding_date: "", venue: "" });
  const [open, setOpen] = useState(false);

  async function createWedding(event) {
    event.preventDefault();
    await mutate("/api/weddings", { method: "POST", body: JSON.stringify(form) });
    setForm({ couple: "", wedding_date: "", venue: "" });
    setOpen(false);
  }

  if (data.wedding.role !== "super_admin") return null;

  return (
    <section className="switcher">
      <label>Nunta activa
        <select value={data.wedding.id} onChange={(event) => mutate(`/api/weddings/${event.target.value}/select`, { method: "POST" })}>
          {data.weddings.map((wedding) => <option value={wedding.id} key={wedding.id}>{wedding.couple}</option>)}
        </select>
      </label>
      <button className="ghost-button" onClick={() => setOpen(!open)} type="button"><Plus size={16} />Nunta noua</button>
      {open ? (
        <form className="mini-form" onSubmit={createWedding}>
          <input required placeholder="Mireasa & Mire" value={form.couple} onChange={(event) => setForm({ ...form, couple: event.target.value })} />
          <input type="date" value={form.wedding_date} onChange={(event) => setForm({ ...form, wedding_date: event.target.value })} />
          <input placeholder="Locatie" value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} />
          <button type="submit">Creeaza</button>
        </form>
      ) : null}
    </section>
  );
}

function SuperAdmin({ mutate }) {
  const [admin, setAdmin] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [client, setClient] = useState({ name: "", email: "", password: "Client123!", couple: "", wedding_date: "", wedding_time: "", venue: "" });

  useEffect(() => {
    api("/api/admin/dashboard").then(setAdmin).catch((err) => setError(err.message));
  }, []);

  if (error) return <section className="module"><p className="form-error">{error}</p></section>;
  if (!admin) return <section className="module"><div className="loader" /></section>;
  const weddings = admin.weddings.filter((wedding) => [wedding.couple, wedding.owner_name, wedding.owner_email, wedding.venue].join(" ").toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="module">
      <div className="module-title">
        <div><p className="eyebrow">Super admin</p><h2>Dashboard platforma si clienti</h2></div>
      </div>
      <section className="metrics-grid">
        <Metric icon={<Users />} label="Clienti" value={admin.totals.clients} detail={`${admin.totals.weddings} nunti`} />
        <Metric icon={<BarChart3 />} label="Invitati" value={admin.totals.guests} detail="in toate nuntile" />
        <Metric icon={<Bell />} label="Uploaduri noi" value={admin.totals.newUploads} detail={`${admin.totals.uploads} total`} />
        <Metric icon={<WalletCards />} label="Platit total" value={money(admin.totals.paid)} detail={`${money(admin.totals.planned)} planificat`} />
      </section>
      <form className="entry-form admin-client-form" onSubmit={async (event) => {
        event.preventDefault();
        const updated = await api("/api/admin/clients", { method: "POST", body: JSON.stringify(client) });
        setAdmin(updated);
        setClient({ name: "", email: "", password: "Client123!", couple: "", wedding_date: "", wedding_time: "", venue: "" });
      }}>
        <input required placeholder="Nume client" value={client.name} onChange={(event) => setClient({ ...client, name: event.target.value })} />
        <input required placeholder="Email" value={client.email} onChange={(event) => setClient({ ...client, email: event.target.value })} />
        <input required placeholder="Parola initiala" value={client.password} onChange={(event) => setClient({ ...client, password: event.target.value })} />
        <input required placeholder="Mireasa & Mire" value={client.couple} onChange={(event) => setClient({ ...client, couple: event.target.value })} />
        <input type="date" value={client.wedding_date} onChange={(event) => setClient({ ...client, wedding_date: event.target.value })} />
        <input type="time" value={client.wedding_time} onChange={(event) => setClient({ ...client, wedding_time: event.target.value })} />
        <input placeholder="Locatie" value={client.venue} onChange={(event) => setClient({ ...client, venue: event.target.value })} />
        <button type="submit"><Plus size={18} />Client nou</button>
      </form>
      <div className="filter-bar"><label><Search size={16} />Cauta<input placeholder="Client, nunta, locatie" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nunta</th><th>Client</th><th>Data</th><th>Invitati</th><th>Uploaduri</th><th>Buget</th><th></th></tr></thead>
          <tbody>
            {weddings.map((wedding) => (
              <tr key={wedding.id}>
                <td><strong>{wedding.couple}</strong><small>{wedding.venue || "-"}</small></td>
                <td><strong>{wedding.owner_name}</strong><small>{wedding.owner_email}</small></td>
                <td>{wedding.wedding_date || "-"}</td>
                <td>{wedding.confirmed}/{wedding.guests}</td>
                <td>{wedding.uploads} {wedding.newUploads ? <span className="pill yes">{wedding.newUploads} noi</span> : null}</td>
                <td>{money(wedding.paid)} / {money(wedding.planned)}</td>
                <td>
                  <div className="row-actions">
                    <button className="tool-button" onClick={() => mutate(`/api/weddings/${wedding.id}/select`, { method: "POST" })} type="button"><Eye size={17} />Intra</button>
                    <button className="tool-button" onClick={async () => setAdmin(await api(`/api/admin/users/${wedding.owner_id}/reset-password`, { method: "POST", body: JSON.stringify({ password: "Client123!" }) }))} type="button">Reset</button>
                    <button className="tool-button" onClick={async () => setAdmin(await api(`/api/admin/users/${wedding.owner_id}/status`, { method: "POST", body: JSON.stringify({ status: wedding.status === "inactive" ? "active" : "inactive" }) }))} type="button">{wedding.status === "inactive" ? "Activeaza" : "Dezactiveaza"}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ icon, label, value, detail }) {
  return <article className="metric"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function ProgressReports({ data }) {
  const confirmed = data.guests.filter((guest) => guest.status === "Confirmat").length;
  const invited = data.guests.length || 1;
  const seated = data.guests.filter((guest) => guest.status === "Confirmat" && guest.table_id).length;
  const tasksDone = data.tasks.filter((task) => task.done).length;
  const budgetPaid = data.suppliers.reduce((sum, item) => sum + Number(item.advance || 0), 0);
  const budgetPlan = data.suppliers.reduce((sum, item) => sum + Number(item.total || 0), 0) || 1;
  const menuCounts = data.guests.reduce((counts, guest) => {
    if (guest.status === "Confirmat") {
      const choices = Array.isArray(guest.meal_choices) && guest.meal_choices.length ? guest.meal_choices : [guest.meal_choice || "Neales"];
      choices.forEach((choice) => {
        const key = choice || "Neales";
        counts[key] = (counts[key] || 0) + 1;
      });
    }
    return counts;
  }, {});
  const score = Math.round(((confirmed / invited) * 0.28 + (seated / Math.max(confirmed, 1)) * 0.24 + (tasksDone / Math.max(data.tasks.length, 1)) * 0.28 + (budgetPaid / budgetPlan) * 0.2) * 100);

  return (
    <section className="module">
      <div className="module-title"><div><p className="eyebrow">Rapoarte</p><h2>Nunta este {score}% pregatita</h2></div></div>
      <div className="report-grid">
        <ReportBar label="Confirmari" value={confirmed} total={invited} />
        <ReportBar label="Asezare la mese" value={seated} total={Math.max(confirmed, 1)} />
        <ReportBar label="Sarcini" value={tasksDone} total={Math.max(data.tasks.length, 1)} />
        <ReportBar label="Buget platit" value={budgetPaid} total={budgetPlan} moneyMode />
      </div>
      <div className="report-grid">
        <article className="report-card"><h3>Meniuri</h3>{Object.entries(menuCounts).map(([key, value]) => <p key={key}><strong>{key}</strong><span>{value}</span></p>)}</article>
        <article className="report-card"><h3>Atentionari</h3><p>Invitati confirmati fara masa <span>{data.guests.filter((guest) => guest.status === "Confirmat" && !guest.table_id).length}</span></p><p>Task-uri apropiate <span>{data.notifications.openTasks}</span></p><p>Plati apropiate <span>{data.notifications.duePayments}</span></p></article>
      </div>
    </section>
  );
}

function ReportBar({ label, value, total, moneyMode = false }) {
  const percent = Math.min(100, Math.round((Number(value || 0) / Math.max(Number(total || 1), 1)) * 100));
  return <article className="report-card"><h3>{label}</h3><div className="bar-track"><span style={{ width: `${percent}%` }} /></div><p><strong>{percent}%</strong><span>{moneyMode ? `${money(value)} / ${money(total)}` : `${value} / ${total}`}</span></p></article>;
}

function Guests({ data, mutate }) {
  const [form, setForm] = useState(emptyGuest);
  const [editGuest, setEditGuest] = useState(null);
  const [copied, setCopied] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "all", table: "all" });
  const [page, setPage] = useState(1);
  const { askDelete, dialog } = useConfirmDelete(mutate);
  const canEdit = canRole(data.wedding.role, "planner");
  const filteredGuests = data.guests.filter((guest) => {
    const term = filters.search.toLowerCase();
    const matchesText = [guest.name, guest.phone, guest.side].join(" ").toLowerCase().includes(term);
    const matchesStatus = filters.status === "all" || guest.status === filters.status;
    const matchesTable = filters.table === "all" || (filters.table === "none" ? !guest.table_id : guest.table_id === filters.table);
    return matchesText && matchesStatus && matchesTable;
  });
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredGuests.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageGuests = filteredGuests.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const recentAcceptances = data.recentAcceptances || [];

  async function copyLink(guest) {
    await navigator.clipboard.writeText(guest.inviteUrl);
    setCopied(guest.id);
    window.setTimeout(() => setCopied(""), 1500);
  }

  async function addGuest(event) {
    event.preventDefault();
    const name = `${form.first_name} ${form.last_name}`.trim();
    await mutate("/api/guests", { method: "POST", body: JSON.stringify({ ...form, name }) });
    setForm(emptyGuest);
    setPage(1);
  }

  function startEditGuest(guest) {
    const parts = splitGuestName(guest.name);
    setEditGuest({
      id: guest.id,
      first_name: parts.first_name,
      last_name: parts.last_name,
      phone: guest.phone || "",
      side: guest.side || "Comun",
      status: guest.status || "In asteptare",
      seats: guest.seats || 1,
      meal_choice: guest.meal_choice || "",
      allergies: guest.allergies || "",
      table_id: guest.table_id || ""
    });
  }

  async function saveGuestEdit(event) {
    event.preventDefault();
    const name = `${editGuest.first_name} ${editGuest.last_name}`.trim();
    const ok = await mutate(`/api/guests/${editGuest.id}`, { method: "PATCH", body: JSON.stringify({ ...editGuest, name }) });
    if (ok) setEditGuest(null);
  }

  function exportGuests() {
    const headers = ["Nume", "Prenume", "Telefon", "Status", "Locuri", "Meniu", "Masa", "Link invitatie"];
    const lines = filteredGuests.map((guest) => {
      const [firstName, ...rest] = String(guest.name || "").split(" ");
      const row = [firstName || "", rest.join(" "), guest.phone || "", guest.status || "", guest.seats || "", mealSummary(guest), guest.table_label || guest.table_name || "", guest.inviteUrl || ""];
      return row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",");
    });
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "invitati.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="module">
      <div className="module-title">
        <div><p className="eyebrow">Invitati</p><h2>Confirmari detaliate si WhatsApp</h2></div>
      </div>
      {recentAcceptances.length ? (
        <section className="acceptance-strip">
          <div>
            <p className="eyebrow">{data.notifications?.newAcceptances ? "Confirmari noi" : "Ultimele confirmari"}</p>
            <h3>{recentAcceptances[0].title}</h3>
            <small>{recentAcceptances[0].detail}</small>
          </div>
          <div className="acceptance-list">
            {recentAcceptances.slice(0, 3).map((item) => (
              <article className={!item.seen_at ? "new" : ""} key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {canEdit ? <form className="entry-form guests-form" onSubmit={addGuest}>
        <input required placeholder="Nume" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
        <input required placeholder="Prenume" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
        <input placeholder="Telefon 40740..." value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <select value={form.side} onChange={(event) => setForm({ ...form, side: event.target.value })}><option>Comun</option><option>Mireasa</option><option>Mire</option></select>
        <input type="number" min="1" max="10" value={form.seats} onChange={(event) => setForm({ ...form, seats: event.target.value })} />
        <select value={form.table_id} onChange={(event) => setForm({ ...form, table_id: event.target.value })}>
          <option value="">Fara masa</option>
          {data.tables.map((table) => <option value={table.id} key={table.id}>{table.name}</option>)}
        </select>
        <button type="submit"><Plus size={18} />Adauga</button>
      </form> : null}
      <div className="filter-bar">
        <label><Search size={16} />Cauta<input placeholder="Nume sau telefon" value={filters.search} onChange={(event) => { setFilters({ ...filters, search: event.target.value }); setPage(1); }} /></label>
        <label>Status<select value={filters.status} onChange={(event) => { setFilters({ ...filters, status: event.target.value }); setPage(1); }}><option value="all">Toate</option><option>In asteptare</option><option>Confirmat</option><option>Refuzat</option></select></label>
        <label>Masa<select value={filters.table} onChange={(event) => { setFilters({ ...filters, table: event.target.value }); setPage(1); }}><option value="all">Toate</option><option value="none">Fara masa</option>{data.tables.map((table) => <option value={table.id} key={table.id}>{table.name}</option>)}</select></label>
        <button className="tool-button" onClick={exportGuests} type="button"><Download size={16} />Excel</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Invitat</th><th>Status</th><th>Locuri</th><th>Meniu</th><th>Masa</th><th>Invitatie</th><th></th></tr></thead>
          <tbody>
            {pageGuests.map((guest) => {
              const [firstName, ...restName] = String(guest.name || "").split(" ");
              const isEditing = editGuest?.id === guest.id;
              return (
                <React.Fragment key={guest.id}>
                  <tr>
                    <td><strong>{firstName} {restName.join(" ")}</strong><small>{guest.phone || "fara telefon"} - {guest.side}</small></td>
                    <td><span className={`pill ${guest.status === "Confirmat" ? "yes" : guest.status === "Refuzat" ? "no" : ""}`}>{guest.status}</span></td>
                    <td>{guest.seats} <small>{partyLabel(guest.seats)}</small></td>
                    <td><small>{mealSummary(guest)}</small><small>{guest.allergies || ""}</small></td>
                    <td>{guest.table_label || guest.table_name || "-"}</td>
                    <td>
                      {canEdit ? <div className="row-actions">
                        <a className="tool-button whatsapp" href={guest.whatsappUrl} target="_blank" rel="noreferrer" onClick={() => mutate(`/api/guests/${guest.id}`, { method: "PATCH", body: JSON.stringify({ table_id: guest.table_id || "", invitation_sent: 1 }) })}><MessageCircle size={17} />WhatsApp</a>
                        <button className="tool-button" onClick={() => copyLink(guest)} type="button">{copied === guest.id ? <Check size={17} /> : <Copy size={17} />}{copied === guest.id ? "Copiat" : "Link"}</button>
                      </div> : <button className="tool-button" onClick={() => copyLink(guest)} type="button">{copied === guest.id ? <Check size={17} /> : <Copy size={17} />}{copied === guest.id ? "Copiat" : "Link"}</button>}
                    </td>
                    <td>
                      {canEdit ? <div className="row-actions">
                        <button className="icon-button" onClick={() => startEditGuest(guest)} title="Editeaza" type="button"><Pencil size={17} /></button>
                        <button className="icon-button danger" onClick={() => askDelete(`/api/guests/${guest.id}`, `Stergi invitatul ${guest.name}?`)} title="Sterge" type="button"><Trash2 size={17} /></button>
                      </div> : null}
                    </td>
                  </tr>
                  {isEditing ? (
                    <tr className="edit-row">
                      <td colSpan="7">
                        <form className="inline-edit-form" onSubmit={saveGuestEdit}>
                          <input required placeholder="Nume" value={editGuest.first_name} onChange={(event) => setEditGuest({ ...editGuest, first_name: event.target.value })} />
                          <input required placeholder="Prenume" value={editGuest.last_name} onChange={(event) => setEditGuest({ ...editGuest, last_name: event.target.value })} />
                          <input placeholder="Telefon" value={editGuest.phone} onChange={(event) => setEditGuest({ ...editGuest, phone: event.target.value })} />
                          <select value={editGuest.side} onChange={(event) => setEditGuest({ ...editGuest, side: event.target.value })}><option>Comun</option><option>Mireasa</option><option>Mire</option></select>
                          <select value={editGuest.status} onChange={(event) => setEditGuest({ ...editGuest, status: event.target.value })}><option>In asteptare</option><option>Confirmat</option><option>Refuzat</option></select>
                          <input type="number" min="1" max="10" value={editGuest.seats} onChange={(event) => setEditGuest({ ...editGuest, seats: event.target.value })} />
                          <input placeholder="Meniu" value={editGuest.meal_choice} onChange={(event) => setEditGuest({ ...editGuest, meal_choice: event.target.value })} />
                          <input placeholder="Alergii" value={editGuest.allergies} onChange={(event) => setEditGuest({ ...editGuest, allergies: event.target.value })} />
                          <select value={editGuest.table_id} onChange={(event) => setEditGuest({ ...editGuest, table_id: event.target.value })}>
                            <option value="">Fara masa</option>
                            {data.tables.map((table) => <option value={table.id} key={table.id}>{table.name}</option>)}
                          </select>
                          <button type="submit"><Check size={17} />Salveaza</button>
                          <button className="tool-button" onClick={() => setEditGuest(null)} type="button"><X size={17} />Anuleaza</button>
                        </form>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>{filteredGuests.length} invitati - pagina {currentPage} din {totalPages}</span>
        <div className="row-actions">
          <button className="tool-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} type="button">Inapoi</button>
          <button className="tool-button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} type="button">Urmatoarea</button>
        </div>
      </div>
      {dialog}
    </section>
  );
}

function SeatingSection({ data, mutate }) {
  const [tab, setTab] = useState("tables");
  return (
    <section className="module">
      <div className="module-title seating-title">
        <div><p className="eyebrow">Sala</p><h2>Mese si plan sala</h2></div>
        <div className="segmented section-tabs">
          <button className={tab === "tables" ? "active" : ""} onClick={() => setTab("tables")} type="button">Asezare invitati</button>
          <button className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")} type="button">Plan sala</button>
        </div>
      </div>
      {tab === "tables" ? <Tables data={data} embedded mutate={mutate} /> : <RoomPlan data={data} embedded mutate={mutate} />}
    </section>
  );
}

function Tables({ data, mutate, embedded = false }) {
  const [form, setForm] = useState({ name: "", capacity: 8, notes: "" });
  const [search, setSearch] = useState("");
  const { askDelete, dialog } = useConfirmDelete(mutate);
  const canEdit = canRole(data.wedding.role, "planner");
  const unseated = data.guests.filter((guest) => guest.status === "Confirmat" && !guest.table_id);
  const tables = data.tables.filter((table) => table.name.toLowerCase().includes(search.toLowerCase()) || data.guests.some((guest) => guest.table_id === table.id && guest.name.toLowerCase().includes(search.toLowerCase())));

  async function createTable(event) {
    event.preventDefault();
    await mutate("/api/tables", { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", capacity: 8, notes: "" });
  }

  function assignGuest(guestId, tableId) {
    mutate(`/api/guests/${guestId}`, { method: "PATCH", body: JSON.stringify({ table_id: tableId }) });
  }

  const content = (
    <>
      {canEdit ? <form className="entry-form table-form" onSubmit={createTable}>
        <input required placeholder="Nume masa" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input type="number" min="1" max="30" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
        <input placeholder="Observatii" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        <button type="submit"><Plus size={18} />Adauga masa</button>
      </form> : null}
      <div className="filter-bar"><label><Search size={16} />Cauta<input placeholder="Masa sau invitat" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      <div className="seating-layout">
        <aside className="panel">
          <h3>Invitati confirmati neasezati</h3>
          <div className="chip-list">
            {unseated.length ? unseated.map((guest) => (
              <div className="guest-chip" draggable={canEdit} onDragStart={canEdit ? (event) => event.dataTransfer.setData("guestId", guest.id) : undefined} key={guest.id}>
                <strong>{guest.name}</strong><small>{guest.seats} locuri</small>
                {Number(guest.seats || 1) > 1 ? <span className="plus-badge">{partyLabel(guest.seats)}</span> : null}
              </div>
            )) : <p className="empty-state">Toti invitatii confirmati sunt asezati.</p>}
          </div>
        </aside>
        <section className="table-grid">
          {tables.map((table) => {
            const seated = data.guests.filter((guest) => guest.table_id === table.id);
            const seats = seated.reduce((sum, guest) => sum + Number(guest.seats || 0), 0);
            const over = seats > table.capacity;
            return (
              <article className={`table-card ${over ? "over" : ""}`} key={table.id} onDragOver={canEdit ? (event) => event.preventDefault() : undefined} onDrop={canEdit ? (event) => assignGuest(event.dataTransfer.getData("guestId"), table.id) : undefined}>
                <header>
                  <div className="table-title"><span className="table-icon" /><strong>{table.name}</strong><small>{seats}/{table.capacity} locuri</small></div>
                  {canEdit ? <button className="icon-button danger" onClick={() => askDelete(`/api/tables/${table.id}`, `Stergi masa ${table.name}? Invitatii de la aceasta masa vor ramane neasezati.`)} type="button"><Trash2 size={17} /></button> : null}
                </header>
                {over ? <p className="capacity-warning">Capacitate depasita</p> : null}
                <div className="chip-list">
                  {seated.map((guest) => (
                    <div className="guest-chip" key={guest.id}>
                      <span className="guest-name">{guest.name}</span>
                      {Number(guest.seats || 1) > 1 ? <strong className="plus-badge">{partyLabel(guest.seats)}</strong> : <span />}
                      {canEdit ? <button onClick={() => assignGuest(guest.id, "")} type="button">Scoate</button> : <span />}
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      </div>
      {dialog}
    </>
  );

  if (embedded) return content;

  return (
    <section className="module">
      <div className="module-title"><div><p className="eyebrow">Sala</p><h2>Aranjare mese cu capacitate</h2></div></div>
      {content}
    </section>
  );
}

function RoomPlan({ data, mutate, embedded = false }) {
  const roomMap = Object.fromEntries((data.roomTables || []).map((item) => [item.table_id, item]));
  const canEdit = canRole(data.wedding.role, "planner");
  async function move(tableId, event) {
    const table = data.tables.find((item) => item.id === tableId);
    if (!table) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(6, Math.min(94, Math.round(((event.clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(8, Math.min(92, Math.round(((event.clientY - rect.top) / rect.height) * 100)));
    await mutate(`/api/room-tables/${table.id}`, { method: "PATCH", body: JSON.stringify({ x, y, shape: roomMap[table.id]?.shape || "round" }) });
  }
  async function toggleShape(table) {
    const current = roomMap[table.id] || { x: 20, y: 20, shape: "round" };
    await mutate(`/api/room-tables/${table.id}`, { method: "PATCH", body: JSON.stringify({ ...current, shape: current.shape === "round" ? "rect" : "round" }) });
  }
  const content = (
    <>
      <div className="room-plan-header">
        <p className="hint">Trage mesele pentru pozitie. Dublu click pe masa schimba forma.</p>
      </div>
      <div
        className="room-plan"
        onDragOver={canEdit ? (event) => event.preventDefault() : undefined}
        onDrop={canEdit ? (event) => move(event.dataTransfer.getData("tableId"), event) : undefined}
      >
        {data.tables.map((table) => {
          const pos = roomMap[table.id] || { x: 20, y: 20, shape: "round" };
          const seated = data.guests.filter((guest) => guest.table_id === table.id).reduce((sum, guest) => sum + Number(guest.seats || 0), 0);
          return (
            <button
              className={`room-table ${pos.shape === "rect" ? "rect" : ""}`}
              draggable={canEdit}
              key={table.id}
              onDoubleClick={canEdit ? () => toggleShape(table) : undefined}
              onDragStart={canEdit ? (event) => event.dataTransfer.setData("tableId", table.id) : undefined}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              title="Trage pentru pozitie. Dublu click schimba forma."
              type="button"
            >
              <strong>{table.name}</strong><small>{seated}/{table.capacity}</small>
            </button>
          );
        })}
      </div>
    </>
  );

  if (embedded) return content;

  return (
    <section className="module">
      <div className="module-title"><div><p className="eyebrow">Plan sala</p><h2>Trage vizual mesele in sala</h2></div></div>
      {content}
    </section>
  );
}

function Budget({ data, mutate }) {
  const [form, setForm] = useState({ item: "", supplier: "", planned: "", paid: "", status: "De platit", due: "" });
  const [filters, setFilters] = useState({ search: "", status: "all" });
  const { askDelete, dialog } = useConfirmDelete(mutate);
  const rows = data.budget.filter((item) => {
    const matchesText = [item.item, item.supplier].join(" ").toLowerCase().includes(filters.search.toLowerCase());
    const matchesStatus = filters.status === "all" || item.status === filters.status;
    return matchesText && matchesStatus;
  });
  async function submit(event) {
    event.preventDefault();
    await mutate("/api/budget", { method: "POST", body: JSON.stringify(form) });
    setForm({ item: "", supplier: "", planned: "", paid: "", status: "De platit", due: "" });
  }
  return (
    <section className="module">
      <div className="module-title"><div><p className="eyebrow">Financiar</p><h2>Buget, furnizori si scadente</h2></div></div>
      <form className="entry-form budget-form" onSubmit={submit}>
        <input required placeholder="Element" value={form.item} onChange={(event) => setForm({ ...form, item: event.target.value })} />
        <input placeholder="Furnizor" value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} />
        <input type="number" min="0" placeholder="Planificat" value={form.planned} onChange={(event) => setForm({ ...form, planned: event.target.value })} />
        <input type="number" min="0" placeholder="Platit" value={form.paid} onChange={(event) => setForm({ ...form, paid: event.target.value })} />
        <input type="date" value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })} />
        <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>De platit</option><option>Avans</option><option>Achitat</option></select>
        <button type="submit"><Plus size={18} />Adauga</button>
      </form>
      <div className="filter-bar">
        <label><Search size={16} />Cauta<input placeholder="Element sau furnizor" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        <label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="all">Toate</option><option>De platit</option><option>Avans</option><option>Achitat</option></select></label>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Element</th><th>Furnizor</th><th>Planificat</th><th>Platit</th><th>Scadenta</th><th>Status</th><th></th></tr></thead><tbody>
        {rows.map((item) => <tr key={item.id}><td><strong>{item.item}</strong></td><td>{item.supplier || "-"}</td><td>{money(item.planned)}</td><td>{money(item.paid)}</td><td>{item.due || "-"}</td><td><span className="pill">{item.status}</span></td><td><button className="icon-button danger" onClick={() => askDelete(`/api/budget/${item.id}`, `Stergi elementul de buget ${item.item}?`)} type="button"><Trash2 size={17} /></button></td></tr>)}
      </tbody></table></div>
      {dialog}
    </section>
  );
}

function Suppliers({ data, mutate }) {
  const [form, setForm] = useState({ name: "", category: "", phone: "", email: "", advance: "", total: "", due: "", notes: "", contract: null });
  const [editSupplier, setEditSupplier] = useState(null);
  const [search, setSearch] = useState("");
  const { askDelete, dialog } = useConfirmDelete(mutate);
  const canEdit = canRole(data.wedding.role, "planner");
  const rows = data.suppliers.filter((supplier) => [supplier.name, supplier.phone, supplier.email].join(" ").toLowerCase().includes(search.toLowerCase()));
  const planned = rows.reduce((sum, supplier) => sum + Number(supplier.total || 0), 0);
  const paid = rows.reduce((sum, supplier) => sum + Number(supplier.advance || 0), 0);
  const remaining = Math.max(0, planned - paid);
  async function submit(event) {
    event.preventDefault();
    const payload = { ...form };
    if (form.contract) {
      payload.contract_name = form.contract.name;
      payload.contract_data_url = await fileToDataUrl(form.contract);
    }
    delete payload.contract;
    await mutate("/api/suppliers", { method: "POST", body: JSON.stringify(payload) });
    setForm({ name: "", category: "", phone: "", email: "", advance: "", total: "", due: "", notes: "", contract: null });
  }
  function startEditSupplier(supplier) {
    setEditSupplier({
      id: supplier.id,
      name: supplier.name || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      advance: supplier.advance || "",
      total: supplier.total || "",
      notes: supplier.notes || "",
      contract_name: supplier.contract_name || "",
      contract: null
    });
  }
  async function saveSupplier(event) {
    event.preventDefault();
    const payload = { ...editSupplier };
    if (editSupplier.contract) {
      payload.contract_name = editSupplier.contract.name;
      payload.contract_data_url = await fileToDataUrl(editSupplier.contract);
    }
    delete payload.contract;
    const ok = await mutate(`/api/suppliers/${editSupplier.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    if (ok) setEditSupplier(null);
  }
  return (
    <section className="module">
      <div className="module-title"><div><p className="eyebrow">Financiar</p><h2>Costuri</h2></div></div>
      <div className="finance-summary">
        <article><span>Total contracte</span><strong>{money(planned)}</strong></article>
        <article><span>Platit / avansuri</span><strong>{money(paid)}</strong></article>
        <article><span>De plata</span><strong>{money(remaining)}</strong></article>
      </div>
      {canEdit ? <form className="entry-form suppliers-form" onSubmit={submit}>
        <input required placeholder="Furnizor" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="Telefon" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <input placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <input type="number" min="0" placeholder="Avans platit" value={form.advance} onChange={(event) => setForm({ ...form, advance: event.target.value })} />
        <input type="number" min="0" placeholder="Total contract" value={form.total} onChange={(event) => setForm({ ...form, total: event.target.value })} />
        <label className="file-picker">
          <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(event) => setForm({ ...form, contract: event.target.files?.[0] || null })} />
          <span><FileText size={17} />{form.contract ? form.contract.name : "Alege contract"}</span>
        </label>
        <button type="submit"><Plus size={18} />Adauga</button>
      </form> : null}
      <div className="filter-bar"><label><Search size={16} />Cauta<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Furnizor sau contact" /></label></div>
      <div className="table-wrap"><table><thead><tr><th>Furnizor</th><th>Contact</th><th>Avans platit</th><th>Total</th><th>De plata</th><th>Contract</th><th></th></tr></thead><tbody>{rows.map((supplier) => {
        const isEditing = editSupplier?.id === supplier.id;
        return (
          <React.Fragment key={supplier.id}>
            <tr>
              <td><strong>{supplier.name}</strong></td>
              <td>{supplier.phone || "-"}<small>{supplier.email || ""}</small></td>
              <td>{money(supplier.advance)}</td>
              <td>{money(supplier.total)}</td>
              <td>{money(Math.max(0, Number(supplier.total || 0) - Number(supplier.advance || 0)))}</td>
              <td>{supplier.contract_name || "-"}</td>
              <td>
                {canEdit ? (
                <div className="row-actions">
                  <button className="icon-button" onClick={() => startEditSupplier(supplier)} title="Editeaza" type="button"><Pencil size={17} /></button>
                  <button className="icon-button danger" onClick={() => askDelete(`/api/suppliers/${supplier.id}`, `Stergi furnizorul ${supplier.name}?`)} type="button"><Trash2 size={17} /></button>
                </div>
                ) : null}
              </td>
            </tr>
            {isEditing ? (
              <tr className="edit-row">
                <td colSpan="7">
                  <form className="inline-edit-form supplier-edit-form" onSubmit={saveSupplier}>
                    <input required placeholder="Furnizor" value={editSupplier.name} onChange={(event) => setEditSupplier({ ...editSupplier, name: event.target.value })} />
                    <input placeholder="Telefon" value={editSupplier.phone} onChange={(event) => setEditSupplier({ ...editSupplier, phone: event.target.value })} />
                    <input placeholder="Email" value={editSupplier.email} onChange={(event) => setEditSupplier({ ...editSupplier, email: event.target.value })} />
                    <input type="number" min="0" placeholder="Avans platit" value={editSupplier.advance} onChange={(event) => setEditSupplier({ ...editSupplier, advance: event.target.value })} />
                    <input type="number" min="0" placeholder="Total contract" value={editSupplier.total} onChange={(event) => setEditSupplier({ ...editSupplier, total: event.target.value })} />
                    <input placeholder="Observatii" value={editSupplier.notes} onChange={(event) => setEditSupplier({ ...editSupplier, notes: event.target.value })} />
                    <label className="file-picker">
                      <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(event) => setEditSupplier({ ...editSupplier, contract: event.target.files?.[0] || null })} />
                      <span><FileText size={17} />{editSupplier.contract ? editSupplier.contract.name : editSupplier.contract_name || "Schimba contract"}</span>
                    </label>
                    <button type="submit"><Check size={17} />Salveaza</button>
                    <button className="tool-button" onClick={() => setEditSupplier(null)} type="button"><X size={17} />Anuleaza</button>
                  </form>
                </td>
              </tr>
            ) : null}
          </React.Fragment>
        );
      })}</tbody></table></div>
      {dialog}
    </section>
  );
}

function Tasks({ data, mutate }) {
  const [form, setForm] = useState({ title: "", due: "", owner: "Amandoi", stage: "General", priority: "Medie" });
  const [filters, setFilters] = useState({ search: "", done: "all" });
  const { askDelete, dialog } = useConfirmDelete(mutate);
  async function submit(event) {
    event.preventDefault();
    await mutate("/api/tasks", { method: "POST", body: JSON.stringify(form) });
    setForm({ title: "", due: "", owner: "Amandoi", stage: "General", priority: "Medie" });
  }
  const groups = ["Invitatii", "Restaurant", "Furnizori", "Acte", "Saptamana nuntii", "General"];
  const tasks = data.tasks.filter((task) => {
    const matchesText = [task.title, task.owner, task.stage, task.priority].join(" ").toLowerCase().includes(filters.search.toLowerCase());
    const matchesDone = filters.done === "all" || (filters.done === "done" ? task.done : !task.done);
    return matchesText && matchesDone;
  });
  return (
    <section className="module">
      <div className="module-title"><div><p className="eyebrow">Checklist</p><h2>Sarcini pe etape si deadline-uri</h2></div></div>
      <form className="entry-form task-form" onSubmit={submit}>
        <input required placeholder="Sarcina" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <input type="date" value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })} />
        <select value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })}><option>Amandoi</option><option>Mireasa</option><option>Mire</option><option>Familie</option><option>Planner</option></select>
        <select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>{groups.map((group) => <option key={group}>{group}</option>)}</select>
        <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Mica</option><option>Medie</option><option>Mare</option></select>
        <button type="submit"><Plus size={18} />Adauga</button>
      </form>
      <div className="filter-bar">
        <label><Search size={16} />Cauta<input placeholder="Sarcina, responsabil, etapa" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        <label>Status<select value={filters.done} onChange={(event) => setFilters({ ...filters, done: event.target.value })}><option value="all">Toate</option><option value="open">Deschise</option><option value="done">Finalizate</option></select></label>
      </div>
      <div className="kanban">
        {groups.map((group) => (
          <section className="kanban-column" key={group}>
            <h3>{group}</h3>
            {tasks.filter((task) => task.stage === group).map((task) => (
              <article className={`task-card ${task.done ? "done" : ""}`} key={task.id}>
                <input checked={task.done} onChange={(event) => mutate(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ done: event.target.checked }) })} type="checkbox" />
                <div><strong>{task.title}</strong><small>{task.due || "fara termen"} - {task.owner} - {task.priority}</small></div>
                <button className="icon-button danger" onClick={() => askDelete(`/api/tasks/${task.id}`, `Stergi sarcina ${task.title}?`)} type="button"><Trash2 size={17} /></button>
              </article>
            ))}
          </section>
        ))}
      </div>
      {dialog}
    </section>
  );
}

function CalendarView({ data, mutate }) {
  const [form, setForm] = useState({ title: "", due: "", owner: "Amandoi", stage: "General", priority: "Medie" });
  const [filters, setFilters] = useState({ search: "", done: "all" });
  const [month, setMonth] = useState((data.wedding.wedding_date || new Date().toISOString().slice(0, 10)).slice(0, 7));
  const { askDelete, dialog } = useConfirmDelete(mutate);
  const canEdit = canRole(data.wedding.role, "planner");
  const groups = ["Invitatii", "Restaurant", "Furnizori", "Acte", "Saptamana nuntii", "General"];
  const events = [
    ...(data.wedding.wedding_date ? [{ date: data.wedding.wedding_date, title: `Nunta ${data.wedding.couple}`, type: "Eveniment" }] : []),
    ...data.tasks.filter((task) => task.due).map((task) => ({ date: task.due, title: task.title, type: task.done ? "Finalizat" : "Task", meta: `${task.owner} - ${task.stage}` })),
    ...data.budget.filter((item) => item.due).map((item) => ({ date: item.due, title: `Plata: ${item.item}`, type: item.status, meta: money(item.planned - item.paid) }))
  ].sort((a, b) => a.date.localeCompare(b.date));
  const tasks = data.tasks.filter((task) => {
    const matchesText = [task.title, task.owner, task.stage, task.priority].join(" ").toLowerCase().includes(filters.search.toLowerCase());
    const matchesDone = filters.done === "all" || (filters.done === "done" ? task.done : !task.done);
    return matchesText && matchesDone;
  });
  const monthDate = new Date(`${month}-01T12:00:00`);
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const calendarDays = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: monthEnd.getDate() }, (_, index) => {
      const day = index + 1;
      const date = `${month}-${String(day).padStart(2, "0")}`;
      return { day, date, events: events.filter((event) => event.date === date) };
    })
  ];

  async function submit(event) {
    event.preventDefault();
    await mutate("/api/tasks", { method: "POST", body: JSON.stringify(form) });
    setForm({ title: "", due: "", owner: "Amandoi", stage: "General", priority: "Medie" });
  }

  function shiftMonth(direction) {
    const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + direction, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <section className="module">
      <div className="module-title"><div><p className="eyebrow">Calendar</p><h2>Calendar si checklist</h2></div></div>
      {canEdit ? <form className="entry-form task-form" onSubmit={submit}>
        <input required placeholder="Sarcina" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <input type="date" value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })} />
        <select value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })}><option>Amandoi</option><option>Mireasa</option><option>Mire</option><option>Familie</option><option>Planner</option></select>
        <select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>{groups.map((group) => <option key={group}>{group}</option>)}</select>
        <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Mica</option><option>Medie</option><option>Mare</option></select>
        <button type="submit"><Plus size={18} />Adauga</button>
      </form> : null}
      <div className="calendar-toolbar">
        <button className="tool-button" onClick={() => shiftMonth(-1)} type="button">Luna trecuta</button>
        <strong>{monthDate.toLocaleDateString("ro-RO", { month: "long", year: "numeric" })}</strong>
        <button className="tool-button" onClick={() => shiftMonth(1)} type="button">Luna urmatoare</button>
      </div>
      <div className="calendar-board">
        {["Lun", "Mar", "Mie", "Joi", "Vin", "Sam", "Dum"].map((day) => <strong className="calendar-weekday" key={day}>{day}</strong>)}
        {calendarDays.map((day, index) => day ? (
          <article className="calendar-day" key={day.date}>
            <time>{day.day}</time>
            {day.events.slice(0, 3).map((event, eventIndex) => <span className={`calendar-dot ${event.type === "Eveniment" ? "event" : ""}`} key={`${event.date}-${eventIndex}`}>{event.title}</span>)}
          </article>
        ) : <span className="calendar-day muted" key={`empty-${index}`} />)}
      </div>
      <div className="filter-bar">
        <label><Search size={16} />Cauta<input placeholder="Sarcina, responsabil, etapa" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        <label>Status<select value={filters.done} onChange={(event) => setFilters({ ...filters, done: event.target.value })}><option value="all">Toate</option><option value="open">Deschise</option><option value="done">Finalizate</option></select></label>
      </div>
      <div className="task-list">
        {tasks.map((task) => (
          <article className={`task-card ${task.done ? "done" : ""}`} key={task.id}>
            <input checked={task.done} disabled={!canEdit} onChange={(event) => mutate(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ done: event.target.checked }) })} type="checkbox" />
            <div><strong>{task.title}</strong><small>{task.due || "fara termen"} - {task.owner} - {task.stage} - {task.priority}</small></div>
            {canEdit ? <button className="icon-button danger" onClick={() => askDelete(`/api/tasks/${task.id}`, `Stergi sarcina ${task.title}?`)} type="button"><Trash2 size={17} /></button> : null}
          </article>
        ))}
      </div>
      {dialog}
    </section>
  );
}

function Exports() {
  const exports = [
    ["guests", "Invitati complet"],
    ["menu", "Meniuri si alergii"],
    ["tables", "Asezare mese"],
    ["tables-pdf", "Asezare mese PDF"],
    ["budget", "Buget"]
  ];
  return (
    <section className="module">
      <div className="module-title"><div><p className="eyebrow">Export</p><h2>Fisiere CSV pentru Excel</h2></div></div>
      <div className="export-grid">
        {exports.map(([key, label]) => <a className="export-card" href={`/api/export/${key}`} key={key}><Download size={22} /><strong>{label}</strong><small>{key.endsWith("pdf") ? "Descarca PDF" : "Descarca CSV"}</small></a>)}
      </div>
    </section>
  );
}

function MediaQr({ data }) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(data.mediaUrl, { width: 900, margin: 2 }).then(setQr);
  }, [data.mediaUrl]);
  return (
    <section className="module media-layout qr-media-section">
      <div className="qr-media-intro">
        <p className="eyebrow">Poze si video</p>
        <h2>Cod QR pentru upload de la invitati</h2>
        <p className="hint">Linkul public duce la pagina unde invitatii pot incarca poze si video-uri dupa eveniment.</p>
        <div className="row-actions qr-actions">
          <a className="tool-button" href={data.mediaUrl} target="_blank" rel="noreferrer"><ImageUp size={17} />Deschide pagina</a>
          <button className="tool-button" onClick={() => navigator.clipboard.writeText(data.mediaUrl)} type="button"><Copy size={17} />Copiaza link</button>
          {qr ? <a className="tool-button whatsapp" href={qr} download="qr-upload-poze.png"><Download size={17} />Descarca QR</a> : null}
        </div>
      </div>
      <div className="qr-box">{qr ? <img src={qr} alt="QR upload poze si video" /> : <div className="loader" />}</div>
      <div className="panel">
        <h3>Pagina publica</h3>
        <p className="hint">{data.mediaUrl}</p>
      </div>
    </section>
  );
}

function Photos({ data }) {
  const [filters, setFilters] = useState({ search: "", type: "all" });
  const [activeIndex, setActiveIndex] = useState(null);
  const uploads = data.mediaUploads.filter((upload) => {
    const matchesText = [upload.file_name, upload.guest_name].join(" ").toLowerCase().includes(filters.search.toLowerCase());
    const matchesType = filters.type === "all" || (filters.type === "image" ? upload.mime_type.startsWith("image/") : upload.mime_type.startsWith("video/"));
    return matchesText && matchesType;
  });
  const activeUpload = activeIndex === null ? null : uploads[activeIndex];
  function moveLightbox(delta) {
    setActiveIndex((index) => {
      if (index === null || !uploads.length) return null;
      return (index + delta + uploads.length) % uploads.length;
    });
  }

  return (
    <section className="module">
      <div className="module-title">
        <div><p className="eyebrow">Galerie</p><h2>Poze si video-uri primite</h2></div>
        <a className="tool-button" href="/api/media-uploads/zip"><FileArchive size={17} />Descarca ZIP</a>
      </div>
      <div className="filter-bar">
        <label><Search size={16} />Cauta<input placeholder="Fisier sau invitat" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        <label>Tip<select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="all">Toate</option><option value="image">Poze</option><option value="video">Video</option></select></label>
      </div>
      <div className="photo-grid">
        {data.notifications?.newUploads ? <p className="notification-box"><Bell size={18} />Ai {data.notifications.newUploads} uploaduri noi.</p> : null}
        {uploads.length ? uploads.map((upload, index) => (
          <article className={`photo-tile ${upload.is_new ? "new" : ""}`} key={upload.id}>
            <button className="media-preview" onClick={() => setActiveIndex(index)} type="button">
              {upload.mime_type.startsWith("image/") ? <img src={upload.url} alt={upload.file_name} /> : <video src={upload.url} />}
            </button>
            <div className="photo-caption">
              <strong>{upload.file_name}</strong>
              <small>{upload.guest_name || "invitat"} - {Math.round(upload.size / 1024)} KB</small>
              <button className="tool-button" onClick={() => setActiveIndex(index)} type="button"><Eye size={16} />Vizualizeaza</button>
            </div>
          </article>
        )) : <p className="empty-state">Nu exista uploaduri inca.</p>}
      </div>
      {activeUpload ? (
        <div className="lightbox" role="dialog" aria-modal="true">
          <button className="lightbox-close" onClick={() => setActiveIndex(null)} type="button">Inchide</button>
          <button className="lightbox-nav left" onClick={() => moveLightbox(-1)} type="button">‹</button>
          <div className="lightbox-media">
            {activeUpload.mime_type.startsWith("image/") ? <img src={activeUpload.url} alt={activeUpload.file_name} /> : <video src={activeUpload.url} controls autoPlay />}
            <p>{activeUpload.file_name} - {activeUpload.guest_name || "invitat"}</p>
          </div>
          <button className="lightbox-nav right" onClick={() => moveLightbox(1)} type="button">›</button>
        </div>
      ) : null}
    </section>
  );
}

function Team({ data, mutate }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "", password: "", role: "planner" });
  const [editMember, setEditMember] = useState(null);
  async function submit(event) {
    event.preventDefault();
    await mutate("/api/team", { method: "POST", body: JSON.stringify(form) });
    setForm({ first_name: "", last_name: "", phone: "", email: "", password: "", role: "planner" });
  }
  function startEditMember(member) {
    const parts = splitGuestName(member.name);
    setEditMember({
      id: member.id,
      first_name: member.first_name || parts.first_name,
      last_name: member.last_name || parts.last_name,
      phone: member.phone || "",
      email: member.email || "",
      role: member.role || "viewer",
      password: ""
    });
  }
  async function saveMember(event) {
    event.preventDefault();
    const ok = await mutate(`/api/team/${editMember.id}`, { method: "PATCH", body: JSON.stringify(editMember) });
    if (ok) setEditMember(null);
  }
  return (
    <section className="module team-page">
      <div className="settings-header">
        <p className="eyebrow">Roluri</p>
        <h2>Acces pentru colaboratori</h2>
        <p className="hint">Creezi conturi de planner sau vizualizare. Emailul trebuie sa fie unic in platforma.</p>
      </div>
      <div className="team-grid">
        <form className="settings-form team-form-card" onSubmit={submit}>
          <label>Nume<input value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label>
          <label>Prenume<input value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></label>
          <label>Telefon<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Parola<input required minLength="6" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          <label>Rol<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="planner">Planner</option><option value="viewer">Vizualizare</option></select></label>
          <button className="settings-save" type="submit"><UserPlus size={18} />Creeaza cont</button>
        </form>
        <div className="team-list">
          {data.team.map((member) => (
            <article key={member.id}>
              <div>
                <strong>{member.name}</strong>
                <small>{member.email}{member.phone ? ` - ${member.phone}` : ""}</small>
              </div>
              <div className="row-actions">
                <span className="pill">{member.role === "owner" ? "Miri" : member.role === "planner" ? "Planner" : "Vizualizare"}</span>
                {member.role !== "owner" ? <button className="icon-button" onClick={() => startEditMember(member)} title="Editeaza cont" type="button"><Pencil size={17} /></button> : null}
              </div>
            </article>
          ))}
        </div>
      </div>
      {editMember ? (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <section className="confirm-dialog edit-dialog">
            <button className="modal-close" onClick={() => setEditMember(null)} type="button"><X size={18} /></button>
            <h2>Editeaza cont</h2>
            <form className="inline-edit-form team-edit-form" onSubmit={saveMember}>
              <label>Nume<input value={editMember.first_name} onChange={(event) => setEditMember({ ...editMember, first_name: event.target.value })} /></label>
              <label>Prenume<input value={editMember.last_name} onChange={(event) => setEditMember({ ...editMember, last_name: event.target.value })} /></label>
              <label>Telefon<input value={editMember.phone} onChange={(event) => setEditMember({ ...editMember, phone: event.target.value })} /></label>
              <label>Email<input required type="email" value={editMember.email} onChange={(event) => setEditMember({ ...editMember, email: event.target.value })} /></label>
              <label>Rol<select value={editMember.role} onChange={(event) => setEditMember({ ...editMember, role: event.target.value })}><option value="planner">Planner</option><option value="viewer">Vizualizare</option></select></label>
              <label>Parola noua<input minLength="6" placeholder="Lasa gol daca nu schimbi" type="password" value={editMember.password} onChange={(event) => setEditMember({ ...editMember, password: event.target.value })} /></label>
              <button type="submit"><Check size={17} />Salveaza</button>
              <button className="tool-button" onClick={() => setEditMember(null)} type="button"><X size={17} />Anuleaza</button>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function InvitationSettings({ data, mutate }) {
  const [form, setForm] = useState(data.wedding);
  const [uploadingHero, setUploadingHero] = useState("");
  const [saved, setSaved] = useState(false);
  const [menuDraft, setMenuDraft] = useState("");
  useEffect(() => setForm(data.wedding), [data.wedding]);
  const program = Array.isArray(form.program) ? form.program : [];
  const menuOptions = Array.isArray(form.menu_options) ? form.menu_options : [];
  const currentTemplate = invitationTemplates.find((template) => template.key === (form.invitation_template || "custom")) || invitationTemplates[0];
  const previewUrl = data.guests[0]?.inviteUrl || data.wedding.publicInviteUrl || "";
  function setProgram(index, key, value) {
    setSaved(false);
    setForm({ ...form, program: program.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) });
  }
  async function submit(event) {
    event.preventDefault();
    const ok = await mutate("/api/settings", { method: "PUT", body: JSON.stringify(form) });
    if (ok) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    }
  }
  function updateForm(next) {
    setSaved(false);
    setForm(next);
  }
  function addMenuOption() {
    const value = menuDraft.trim();
    if (!value || menuOptions.includes(value)) return;
    updateForm({ ...form, menu_options: [...menuOptions, value] });
    setMenuDraft("");
  }
  function removeMenuOption(option) {
    updateForm({ ...form, menu_options: menuOptions.filter((item) => item !== option) });
  }
  async function uploadHero(event, slot = "hero") {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingHero(slot);
    const dataUrl = await fileToDataUrl(file);
    await mutate("/api/hero-upload", { method: "POST", body: JSON.stringify({ dataUrl, name: file.name, slot: slot === "secondary" ? "secondary" : "hero" }) });
    setUploadingHero("");
  }
  return (
    <section className="module settings-page">
      <div className="settings-header"><p className="eyebrow">Invitatie</p><h2>Pagina publica si RSVP</h2></div>
      <form className="settings-form settings-card" onSubmit={submit}>
        <fieldset>
          <legend>Invitatie - Template pagina</legend>
          <div className="template-picker">
            {invitationTemplates.map((template) => (
              <button className={form.invitation_template === template.key || (!form.invitation_template && template.key === "custom") ? "selected" : ""} key={template.key} onClick={() => updateForm({ ...form, invitation_template: template.key })} type="button">
                <img src={template.icon} alt="" />
                <span><strong>{template.title}</strong><small>{template.description}</small></span>
              </button>
            ))}
          </div>
          {previewUrl ? (
            <div className="invite-preview-box">
              <div>
                <strong>Previzualizare invitatie</strong>
                <small>Se deschide cu datele si imaginile salvate pentru primul invitat din lista.</small>
              </div>
              <a className="tool-button" href={previewUrl} target="_blank" rel="noreferrer"><Eye size={17} />Previzualizeaza</a>
            </div>
          ) : <p className="hint">Adauga cel putin un invitat ca sa poti previzualiza pagina publica.</p>}
        </fieldset>
        <fieldset>
          <legend>Invitatie - Detalii eveniment</legend>
          <div className="settings-grid two">
            <label>Mireasa & Mire<input value={form.couple || ""} onChange={(event) => updateForm({ ...form, couple: event.target.value })} /></label>
            <label>Locatie<input value={form.venue || ""} onChange={(event) => updateForm({ ...form, venue: event.target.value })} /></label>
            <label>Data nuntii<input type="date" value={form.wedding_date || ""} onChange={(event) => updateForm({ ...form, wedding_date: event.target.value })} /></label>
            <label>Ora nuntii<input type="time" value={form.wedding_time || ""} onChange={(event) => updateForm({ ...form, wedding_time: event.target.value })} /></label>
            <label>Adresa<input value={form.venue_address || ""} onChange={(event) => updateForm({ ...form, venue_address: event.target.value })} /></label>
            <label>Link Google Maps<input value={form.map_url || ""} onChange={(event) => updateForm({ ...form, map_url: event.target.value })} /></label>
            <label>Dress code<input value={form.dress_code || ""} onChange={(event) => updateForm({ ...form, dress_code: event.target.value })} /></label>
            <label>Media sus in pagina URL ({currentTemplate.resolution})<input value={form.hero_image_url || ""} onChange={(event) => updateForm({ ...form, hero_image_url: event.target.value })} /></label>
            <label>Media jos in pagina URL ({currentTemplate.secondaryResolution})<input value={form.invite_secondary_image_url || ""} onChange={(event) => updateForm({ ...form, invite_secondary_image_url: event.target.value })} /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Invitatie - Imagini</legend>
          <div className="settings-grid">
            <label className="file-field">Media sus in pagina ({currentTemplate.resolution})
              <span className="file-picker">
                <input type="file" accept="image/*,video/*" onChange={(event) => uploadHero(event, "hero")} />
                <span><ImageUp size={17} />Incarca poza sau video sus</span>
              </span>
            </label>
            <label className="file-field">Media jos in pagina ({currentTemplate.secondaryResolution})
              <span className="file-picker">
                <input type="file" accept="image/*,video/*" onChange={(event) => uploadHero(event, "secondary")} />
                <span><ImageUp size={17} />Incarca poza sau video jos</span>
              </span>
            </label>
          </div>
          {uploadingHero ? <p className="hint">Se incarca {uploadingHero === "secondary" ? "media de jos" : "media de sus"}...</p> : null}
        </fieldset>

        <fieldset>
          <legend>Invitatie - Texte si meniu</legend>
          <label>Text invitatie<textarea value={form.invite_intro || ""} onChange={(event) => updateForm({ ...form, invite_intro: event.target.value })} /></label>
          <label>Mesaj WhatsApp<textarea value={form.whatsapp_message || ""} onChange={(event) => updateForm({ ...form, whatsapp_message: event.target.value })} /></label>
          <div className="menu-builder">
            <span>Optiuni meniu pentru invitati</span>
            <div className="menu-builder-row">
              <input placeholder="Ex: Vita, Peste, Vegetarian" value={menuDraft} onChange={(event) => setMenuDraft(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addMenuOption();
                }
              }} />
              <button type="button" onClick={addMenuOption}><Plus size={17} />Adauga meniu</button>
            </div>
            <div className="menu-option-list">
              {menuOptions.length ? menuOptions.map((option) => <button key={option} onClick={() => removeMenuOption(option)} type="button">{option}<Trash2 size={14} /></button>) : <small>Adauga cel putin un meniu ca invitatii sa poata alege.</small>}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Invitatie - Programul zilei</legend>
          <div className="program-editor">
            {program.map((item, index) => (
              <div className="program-row" key={index}>
                <input value={item.time || ""} placeholder="Ora" onChange={(event) => setProgram(index, "time", event.target.value)} />
                <input value={item.title || ""} placeholder="Moment" onChange={(event) => setProgram(index, "title", event.target.value)} />
                <button type="button" onClick={() => updateForm({ ...form, program: program.filter((_, itemIndex) => itemIndex !== index) })}>Sterge</button>
              </div>
            ))}
            <button type="button" onClick={() => updateForm({ ...form, program: [...program, { time: "", title: "" }] })}>Adauga moment</button>
          </div>
        </fieldset>
        {saved ? <p className="save-notice"><Check size={18} />Setarile au fost salvate.</p> : null}
        <button className="settings-save" type="submit">Salveaza setarile</button>
      </form>
    </section>
  );
}

function SettingsPanel({ data, mutate }) {
  const [form, setForm] = useState(data.wedding);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setForm(data.wedding), [data.wedding]);
  const platformThemes = [
    { key: "sage", label: "Salvie", colors: ["#668a70", "#b98b42", "#ffffff"] },
    { key: "rose", label: "Rose", colors: ["#b76e79", "#7d3042", "#fff7f7"] },
    { key: "navy", label: "Navy", colors: ["#17324d", "#c6a15b", "#ffffff"] },
    { key: "dark", label: "Dark", colors: ["#13201c", "#d1b76f", "#f5f2ea"] }
  ];
  useEffect(() => {
    const shell = document.querySelector(".app-shell");
    if (!shell) return undefined;
    const original = data.wedding.theme_color || "sage";
    shell.classList.remove("theme-sage", "theme-rose", "theme-navy", "theme-dark");
    shell.classList.add(`theme-${form.theme_color || "sage"}`);
    return () => {
      shell.classList.remove("theme-sage", "theme-rose", "theme-navy", "theme-dark");
      shell.classList.add(`theme-${original}`);
    };
  }, [form.theme_color, data.wedding.theme_color]);
  function updateForm(next) {
    setSaved(false);
    setForm(next);
  }
  async function submit(event) {
    event.preventDefault();
    const ok = await mutate("/api/settings", { method: "PUT", body: JSON.stringify(form) });
    if (ok) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    }
  }
  async function uploadProfile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingProfile(true);
    const dataUrl = await fileToDataUrl(file);
    await mutate("/api/profile-upload", { method: "POST", body: JSON.stringify({ dataUrl, name: file.name }) });
    setUploadingProfile(false);
  }
  return (
    <section className="module settings-page">
      <div className="settings-header"><p className="eyebrow">Setari</p><h2>Design platforma si profil</h2></div>
      <form className="settings-form settings-card" onSubmit={submit}>
        <fieldset>
          <legend>Platforma - Design intern</legend>
          <div className="settings-choice-block">
            <span>Tema platforma</span>
            <div className="theme-dots">
              {platformThemes.map((theme) => (
                <button className={form.theme_color === theme.key ? "selected" : ""} key={theme.key} onClick={() => updateForm({ ...form, theme_color: theme.key })} type="button">
                  <span className="dot-stack">{theme.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>
                  <strong>{theme.label}</strong>
                </button>
              ))}
            </div>
          </div>
          <div className={`platform-preview theme-${form.theme_color || "sage"}`}>
            <aside><span /> <strong>{form.couple || "Mireasa & Mire"}</strong></aside>
            <main><b>Preview platforma</b><small>Carduri, meniuri si formulare</small></main>
          </div>
        </fieldset>
        <fieldset>
          <legend>Profil</legend>
          <div className="settings-grid two">
            <label>Mireasa & Mire<input value={form.couple || ""} onChange={(event) => updateForm({ ...form, couple: event.target.value })} /></label>
            <label>Locatie<input value={form.venue || ""} onChange={(event) => updateForm({ ...form, venue: event.target.value })} /></label>
            <label className="file-field">Poza de profil cu mirii
              <span className="file-picker">
                <input type="file" accept="image/*" onChange={uploadProfile} />
                <span><ImageUp size={17} />Incarca poza de profil</span>
              </span>
            </label>
          </div>
          {uploadingProfile ? <p className="hint">Se incarca poza de profil...</p> : null}
        </fieldset>
        {saved ? <p className="save-notice"><Check size={18} />Setarile au fost salvate.</p> : null}
        <button className="settings-save" type="submit">Salveaza setarile</button>
      </form>
    </section>
  );
}

function InvitationPage({ token }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ status: "Confirmat", seats: 1, meal_choice: "", meal_choices: [""], allergies: "", guest_message: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/invite/${token}`).then((payload) => {
      setData(payload);
      setForm({
        status: payload.guest.status === "In asteptare" ? "Confirmat" : payload.guest.status || "Confirmat",
        seats: payload.guest.seats || 1,
        meal_choice: payload.guest.meal_choice || "",
        meal_choices: mealChoicesForSeats(payload.guest.meal_choices, payload.guest.seats || 1, payload.guest.meal_choice || ""),
        allergies: payload.guest.allergies || "",
        guest_message: payload.guest.guest_message || ""
      });
    }).catch((err) => setError(err.message));
  }, [token]);

  if (error && !data) return <main className="invite-screen"><section className="invite-card"><h1>{error}</h1></section></main>;
  if (!data) return <ScreenLoader />;

  const wedding = data.wedding;
  const locked = saved || data.guest.status !== "In asteptare";
  const menuOptions = Array.isArray(wedding.menu_options) && wedding.menu_options.length ? wedding.menu_options : ["Carne", "Peste", "Vegetarian", "Copil"];
  const seatCount = normalizeSeatCount(form.seats);
  function updateSeats(value) {
    const seats = normalizeSeatCount(value);
    setForm({ ...form, seats, meal_choices: mealChoicesForSeats(form.meal_choices, seats, form.meal_choice) });
  }
  function updateMealChoice(index, value) {
    const mealChoices = mealChoicesForSeats(form.meal_choices, seatCount, form.meal_choice);
    mealChoices[index] = value;
    setForm({ ...form, meal_choice: mealChoices.find(Boolean) || "", meal_choices: mealChoices });
  }
  const mealChoiceFields = (
    <div className="meal-choice-group">
      <span>Meniu pentru fiecare persoana</span>
      {mealChoicesForSeats(form.meal_choices, seatCount, form.meal_choice).map((choice, index) => (
        <label key={index}>Persoana {index + 1}
          <select value={choice} onChange={(event) => updateMealChoice(index, event.target.value)}>
            <option value="">Alege meniu</option>
            {menuOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      ))}
    </div>
  );
  const primaryMediaUrl = wedding.hero_image_url || "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=80";
  const heroStyle = isVideoUrl(primaryMediaUrl) ? {} : { backgroundImage: `linear-gradient(rgba(36,45,48,.38), rgba(36,45,48,.12)), url(${primaryMediaUrl})` };
  const details = (
    <div className="invite-facts">
      <span><CalendarDays size={18} />{dateLabel(wedding.wedding_date)}{wedding.wedding_time ? `, ora ${wedding.wedding_time}` : ""}</span>
      <span><MapPin size={18} />Ceremonie: {wedding.venue || "Locatie necompletata"}</span>
      <span><MapPin size={18} />Petrecere: {wedding.venue || "Locatie necompletata"}</span>
      <span><Shirt size={18} />{wedding.dress_code || "Dress code liber"}</span>
    </div>
  );
  const programBlock = <div className="timeline">{wedding.program.map((item, index) => <p key={index}><strong>{item.time}</strong><span>{item.title}</span></p>)}</div>;
  const rsvpBlock = locked ? <div className="success-box"><Check size={22} />Raspunsul tau a fost salvat. Multumim! Nu mai poate fi modificat din acest link.</div> : (
    <form className="rsvp-form" onSubmit={async (event) => { event.preventDefault(); await api(`/api/invite/${token}`, { method: "POST", body: JSON.stringify(form) }); setSaved(true); }}>
      <label>Raspuns<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Confirmat</option><option>Refuzat</option><option>In asteptare</option></select></label>
      <label>Numar persoane<input type="number" min="1" max="10" value={form.seats} onChange={(event) => updateSeats(event.target.value)} /></label>
      {mealChoiceFields}
      <label>Alergii / restrictii<textarea value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} /></label>
      <label>Mesaj pentru miri<textarea value={form.guest_message} onChange={(event) => setForm({ ...form, guest_message: event.target.value })} /></label>
      <button type="submit">Trimite raspunsul</button>
    </form>
  );

  return <TemplateOneInvitation data={data} details={details} form={form} heroStyle={heroStyle} locked={locked} mealChoiceFields={mealChoiceFields} menuOptions={menuOptions} primaryMediaUrl={primaryMediaUrl} programBlock={programBlock} rsvpBlock={rsvpBlock} setForm={setForm} token={token} updateSeats={updateSeats} />;
}

function TemplateOneInvitation({ data, details, form, heroStyle, locked, mealChoiceFields, primaryMediaUrl, programBlock, rsvpBlock, setForm, token, updateSeats }) {
  const wedding = data.wedding;
  const primaryIsVideo = isVideoUrl(primaryMediaUrl);
  const secondaryMediaUrl = wedding.invite_secondary_image_url || wedding.hero_image_url || "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1400&q=80";
  const secondaryIsVideo = isVideoUrl(secondaryMediaUrl);
  const bottomStyle = secondaryIsVideo ? { background: "#1f2524" } : { backgroundImage: `linear-gradient(rgba(36,45,48,.58), rgba(36,45,48,.44)), url(${secondaryMediaUrl})` };
  const eventDate = weddingDateTime(wedding);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const diff = eventDate ? Math.max(0, eventDate.getTime() - now) : 0;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const mapUrl = wedding.map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wedding.venue || "")}`;
  return (
    <main className="tpl1-page">
      <section className="tpl1-hero" style={heroStyle}>
        {primaryIsVideo ? <video className="tpl1-hero-media" src={primaryMediaUrl} autoPlay muted loop playsInline /> : null}
        <div className="tpl1-hero-content">
          <p className="tpl1-topline">Save the date</p>
          <h1>{wedding.couple}</h1>
          <p className="tpl1-meta">{dateLabel(wedding.wedding_date)}{wedding.wedding_time ? ` - ${wedding.wedding_time}` : ""}</p>
          <div className="tpl1-countdown">
            <div><span>{String(days).padStart(2, "0")}</span><small>Zile</small></div>
            <div><span>{String(hours).padStart(2, "0")}</span><small>Ore</small></div>
            <div><span>{String(minutes).padStart(2, "0")}</span><small>Min</small></div>
            <div><span>{String(seconds).padStart(2, "0")}</span><small>Sec</small></div>
          </div>
        </div>
        <a className="tpl1-scroll" href="#details"><span />Scroll</a>
      </section>

      <section className="tpl1-section" id="details">
        <div className="tpl1-title"><span>Invitatie</span><h2>{wedding.venue || "Ziua noastra speciala"}</h2></div>
        <article className="tpl1-card tpl1-invite-card">
          <p className="eyebrow">Pentru {data.guest.name}</p>
          <p>{wedding.invite_intro}</p>
          {details}
          <a className="tpl1-map" href={mapUrl} target="_blank" rel="noreferrer">Vezi locatia pe Google Maps</a>
        </article>
      </section>

      <div className="tpl1-divider"><img src={templateOneIcon} alt="" /></div>

      <section className="tpl1-section tpl1-section-alt">
        <div className="tpl1-title"><span>Dress code & tematica</span><h2>{wedding.dress_code || "Elegant"}</h2></div>
        <div className="tpl1-dress-grid">
          <article className="tpl1-card">
            <h3>Dress code</h3>
            <p>{wedding.dress_code || "Tinuta eleganta, potrivita pentru seara."}</p>
          </article>
          <article className="tpl1-card">
            <h3>Programul zilei</h3>
            {programBlock}
          </article>
        </div>
      </section>

      <section className="tpl1-rsvp" id="rsvp" style={bottomStyle}>
        {secondaryIsVideo ? <video className="tpl1-rsvp-media" src={secondaryMediaUrl} autoPlay muted loop playsInline /> : null}
        <div className="tpl1-rsvp-overlay" />
        <div className="tpl1-rsvp-inner">
          <div className="tpl1-title light"><span>Your response</span><h2>Confirma prezenta</h2></div>
          <article className="tpl1-rsvp-box">
            {locked ? rsvpBlock : (
              <form className="rsvp-form" onSubmit={async (event) => { event.preventDefault(); await api(`/api/invite/${token}`, { method: "POST", body: JSON.stringify(form) }); window.location.reload(); }}>
                <label>Raspuns<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Confirmat</option><option>Refuzat</option></select></label>
                <label>Numar persoane<input type="number" min="1" max="10" value={form.seats} onChange={(event) => updateSeats(event.target.value)} /></label>
                {mealChoiceFields}
                <label>Alergii / restrictii<textarea value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} /></label>
                <label>Mesaj pentru miri<textarea value={form.guest_message} onChange={(event) => setForm({ ...form, guest_message: event.target.value })} /></label>
                <button type="submit">Trimite raspunsul</button>
              </form>
            )}
          </article>
        </div>
      </section>

      <footer className="tpl1-footer">Cu drag, {wedding.couple} {wedding.wedding_date ? `- ${dateLabel(wedding.wedding_date)}` : ""}</footer>
    </main>
  );
}

function MediaUploadPage({ token }) {
  const [data, setData] = useState(null);
  const [guestName, setGuestName] = useState("");
  const [files, setFiles] = useState([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api(`/api/media/${token}`).then(setData).catch((err) => setError(err.message)); }, [token]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    const encoded = await Promise.all(Array.from(files).map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, dataUrl: reader.result });
      reader.readAsDataURL(file);
    })));
    try {
      await api(`/api/media/${token}`, { method: "POST", body: JSON.stringify({ guest_name: guestName, files: encoded }) });
      setSaved(true);
      setFiles([]);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !data) return <main className="invite-screen"><section className="invite-card"><h1>{error}</h1></section></main>;
  if (!data) return <ScreenLoader />;

  return (
    <main className={`media-public theme-${data.wedding.theme_color || "sage"}`}>
      <section className="media-upload-card">
        <div className="media-upload-icon"><Camera size={28} /></div>
        <p className="eyebrow">Albumul nuntii</p>
        <h1>{data.wedding.couple}</h1>
        <p className="invite-copy">Incarca aici pozele si video-urile tale de la eveniment.</p>
        {saved ? <div className="success-box"><Check size={22} />Fisierele au fost incarcate. Multumim!</div> : (
          <form className="rsvp-form" onSubmit={submit}>
            <label>Numele tau<input value={guestName} onChange={(event) => setGuestName(event.target.value)} /></label>
            <label className="file-field">Poze / video
              <span className="file-picker upload-picker">
                <input multiple accept="image/*,video/*" type="file" onChange={(event) => setFiles(event.target.files)} />
                <span><ImageUp size={18} />{prettyFileLabel(files, "Alege poze sau video-uri")}</span>
              </span>
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button type="submit"><ImageUp size={18} />Incarca fisiere</button>
          </form>
        )}
      </section>
    </main>
  );
}

const rootElement = document.getElementById("root");
const root = window.__gestionareNuntaRoot || createRoot(rootElement);
window.__gestionareNuntaRoot = root;
root.render(<App />);
