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
  EyeOff,
  FileArchive,
  ImageUp,
  LogOut,
  MapPin,
  Menu,
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
  LockKeyhole,
  Mail,
  Search,
  ShieldCheck,
  User,
  X
} from "lucide-react";
import "./styles.css";
import appLogo from "./assets/logo.png";

const emptyGuest = {
  first_name: "",
  last_name: "",
  name: "",
  phone: "",
  side: "Comun",
  group_name: "",
  status: "În așteptare",
  meal_choice: "",
  allergies: "",
  seats: 1,
  table_id: ""
};

function splitGuestName(name = "") {
  const [firstName, ...rest] = String(name || "").trim().split(/\s+/).filter(Boolean);
  return { first_name: firstName || "", last_name: rest.join(" ") };
}

function prettyFileLabel(files, fallback = "Alege fișiere") {
  const list = Array.from(files || []);
  if (!list.length) return fallback;
  if (list.length === 1) return list[0].name;
  return `${list.length} fișiere selectate`;
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
  { key: "custom", title: "Template 1", description: "Layout cu 2 media, RSVP și program", resolution: "1920x1080 px", secondaryResolution: "1200x900 px", icon: appLogo },
  { key: "figma-landing", title: "Template 2", description: "Landing page stil Italia, cu galerie și RSVP", resolution: "1920x1080 px", secondaryResolution: "1400x1000 px", icon: appLogo }
];

const template1Defaults = {
  background: "#fffaf2",
  text: "#1f2524",
  muted: "#756b5d",
  accent: "#c49345",
  card: "#ffffff",
  border: "#eadcc8",
  darkOverlay: "#1f2524",
  heroKicker: "Save the date",
  scrollText: "Scroll",
  detailsKicker: "Invitație",
  detailsTitle: "Ziua noastră specială",
  mapButton: "Vezi locația pe Google Maps",
  dressKicker: "Dress code & tematică",
  dressTitle: "Elegant",
  programTitle: "Program",
  dressText: "Ținută elegantă, potrivită pentru seară.",
  rsvpKicker: "RSVP",
  rsvpTitle: "Confirmă prezența",
  footerText: "Cu drag"
};

const template2Defaults = {
  background: "#f8f8f3",
  text: "#30342d",
  muted: "#697060",
  accent: "#697060",
  darkBand: "#555b51",
  card: "#ffffff",
  border: "#e4e6dc",
  heroKicker: "Romantic wedding venue",
  heroTitle: "Discover your perfect Italian wedding venue",
  photosTitle: "Galerie foto",
  photoOne: "",
  photoTwo: "",
  photoThree: "",
  photoFour: "",
  photoFive: "",
  venueKicker: "Featured venue",
  servicesTitle: "Services",
  serviceOne: "Ceremony",
  serviceTwo: "Dinner",
  serviceThree: "Wedding day",
  galleryTitle: "Our portfolio",
  testimonialKicker: "Testimonials",
  testimonialText: "O zi elegantă, caldă și atent organizată. Abia așteptăm să sărbătorim împreună cu voi.",
  rsvpKicker: "RSVP",
  rsvpTitle: "Confirmă prezența"
};

function template2Design(wedding = {}) {
  return { ...template2Defaults, ...(wedding.invitation_design || {}) };
}

function template1Design(wedding = {}) {
  return { ...template1Defaults, ...(wedding.invitation_design || {}) };
}

async function api(path, options = {}) {
  const csrfToken = document.cookie.split("; ").find((item) => item.startsWith("csrf_token="))?.split("=")[1] || "";
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(csrfToken ? { "X-CSRF-Token": decodeURIComponent(csrfToken) } : {}), ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Cererea a eșuat.");
  return data;
}

function money(value) {
  return new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function dateLabel(value) {
  if (!value) return "Data necompletata";
  return new Date(`${value}T12:00:00`).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
}

function dateTimeLabel(value) {
  if (!value) return "Nu s-a conectat";
  const normalized = String(value).includes("T") ? String(value) : String(value).replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "Nu s-a conectat";
  return date.toLocaleString("ro-RO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function confirmationLabel(guest) {
  if (guest.status !== "Confirmat") return "-";
  return dateTimeLabel(guest.confirmed_at || guest.updated_at);
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
  if (!target) return <Metric icon={<Clock />} label="Până la nuntă" value="-" detail="setează data și ora" />;
  const diff = Math.max(0, target.getTime() - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return <Metric icon={<Clock />} label="Până la nuntă" value={`${days}z ${hours}h`} detail={`${minutes} minute rămase`} />;
}

function SidebarCountdown({ wedding }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const target = weddingDateTime(wedding);
  if (!target) return <p className="sidebar-countdown"><Clock size={16} />Setează data și ora nunții</p>;
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
  return <main className="center-screen"><div className="wedding-loader"><img src={appLogo} alt="" /> <strong>Se încarcă platforma</strong></div></main>;
}

function ConfirmDialog({ title = "Ești sigur?", message, confirmLabel = "Șterge", onCancel, onConfirm }) {
  return (
    <div className="confirm-backdrop" role="dialog" aria-modal="true">
      <section className="confirm-dialog">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="row-actions">
          <button className="tool-button" onClick={onCancel} type="button">Anulează</button>
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
              ? "Validăm datele, creăm nunta și pregătim contul."
              : "Verificăm sesiunea și pregătim panoul tău."}
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
  const [register, setRegister] = useState({ name: "", email: "", password: "" });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
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
      setLoadingMessage("Se încarcă platforma...");
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
      setRegister({ name: "", email: "", password: "" });
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
      <section className={`login-panel auth-card ${mode === "register" ? "register-card" : ""}`}>
        <div className="auth-card-head">
          <div className="auth-card-icon"><img src={appLogo} alt="Gestionare Nunta" /></div>
          <p className="eyebrow">Platforma pentru miri</p>
          <h1>{mode === "login" ? "Autentificare" : "Înregistrare"}</h1>
          {mode === "login" ? <p>Bine ai revenit. Conectează-te ca să continui organizarea.</p> : null}
        </div>
        {loadingMessage ? <AuthMotion type={mode} message={loadingMessage} /> : null}
        {successMessage ? <AuthMotion type="success" message={successMessage} /> : null}
        {mode === "login" ? (
          <form className="login-form auth-form" onSubmit={submitLogin}>
            <label>Email<span className="auth-input"><Mail size={19} /><input placeholder="exemplu@email.com" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} /></span></label>
            <label>Parola<span className="auth-input"><LockKeyhole size={19} /><input placeholder="Parola contului" type={showLoginPassword ? "text" : "password"} value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /><button className="password-toggle" type="button" aria-label={showLoginPassword ? "Ascunde parola" : "Arată parola"} onClick={() => setShowLoginPassword(!showLoginPassword)}>{showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
            <div className="auth-options"><label><input type="checkbox" />Ține-mă minte</label></div>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="auth-submit" disabled={Boolean(loadingMessage)} type="submit">Conectează-te</button>
            <div className="auth-divider"><span />sau<span /></div>
            <p className="auth-switch">Nu ai cont? <button onClick={() => { setMode("register"); setError(""); setSuccessMessage(""); }} type="button">Înregistrează-te</button></p>
          </form>
        ) : (
          <form className="login-form auth-form" onSubmit={submitRegister}>
            <label>Nume cont<span className="auth-input"><User size={19} /><input required placeholder="Numele tău complet" value={register.name} onChange={(event) => setRegister({ ...register, name: event.target.value })} /></span></label>
            <label>Email<span className="auth-input"><Mail size={19} /><input required placeholder="exemplu@email.com" type="email" value={register.email} onChange={(event) => setRegister({ ...register, email: event.target.value })} /></span></label>
            <label>Parola<span className="auth-input"><LockKeyhole size={19} /><input required placeholder="Minim 10 caractere" type={showRegisterPassword ? "text" : "password"} minLength="10" value={register.password} onChange={(event) => setRegister({ ...register, password: event.target.value })} /><button className="password-toggle" type="button" aria-label={showRegisterPassword ? "Ascunde parola" : "Arată parola"} onClick={() => setShowRegisterPassword(!showRegisterPassword)}>{showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span><span className="field-hint">Literă mare, cifră și simbol.</span></label>
            {error ? <p className="form-error span-2">{error}</p> : null}
            <button className="auth-submit" disabled={Boolean(loadingMessage)} type="submit">Creează cont</button>
            <div className="auth-divider"><span />sau<span /></div>
            <p className="auth-switch">Ai deja cont? <button onClick={() => { setMode("login"); setError(""); setSuccessMessage(""); }} type="button">Autentifică-te</button></p>
          </form>
        )}
      </section>
    </main>
  );
}

function Dashboard({ session, onLogout }) {
  const [data, setData] = useState(null);
  const [active, setActive] = useState(session.user.isSuperAdmin ? "admin" : "guests");
  const [error, setError] = useState("");
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [topbarSearch, setTopbarSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (active === "room") setActive("tables");
    if (active === "invitation") setActive("guests");
    if (active === "photos") setActive("media");
  }, [active]);

  async function refresh() {
    setError("");
    try {
      setData(await api("/api/dashboard"));
    } catch (err) {
      if (session.user.isSuperAdmin) {
        setData({
          wedding: {
            id: "super-admin",
            couple: "Super Admin",
            venue: "Platforma",
            role: "super_admin",
            theme_color: "sage",
            onboarding_completed: 1
          },
          weddings: [],
          guests: [],
          tables: [],
          suppliers: [],
          budget: [],
          tasks: [],
          roomTables: [],
          team: [],
          mediaUploads: [],
          notifications: { newAcceptances: 0, newUploads: 0, openTasks: 0, duePayments: 0 },
          mediaUrl: ""
        });
        setActive("admin");
      } else {
        setError(err.message);
      }
    }
  }

  async function mutate(path, options) {
    setError("");
    try {
      const nextData = await api(path, options);
      setData(nextData);
      if (path.includes("/api/weddings/") && path.endsWith("/select")) setActive("progress");
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

  function applyTopbarSearch(value) {
    setTopbarSearch(value);
    if (!value.trim()) return;
    if (active === "progress" || active === "exports" || active === "settings" || active === "team") {
      setActive(session.user.isSuperAdmin ? "admin" : "guests");
    }
  }

  if (!data) return <ScreenLoader />;
  if (canRole(data.wedding.role, "owner") && !session.user.isSuperAdmin && !Number(data.wedding.onboarding_completed || 0)) {
    return <OnboardingWizard data={data} onDone={setData} />;
  }

  const confirmedSeats = data.guests.filter((guest) => guest.status === "Confirmat").reduce((sum, guest) => sum + Number(guest.seats || 0), 0);
  const paid = data.suppliers.reduce((sum, item) => sum + Number(item.advance || 0), 0);
  const planned = data.suppliers.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const done = data.tasks.filter((task) => task.done).length;
  const role = data.wedding.role || "viewer";
  const userInitials = String(session.user.name || session.user.email || "GN")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "GN";
  const normalizedTopbarSearch = topbarSearch.trim().toLowerCase();
  const topbarResults = normalizedTopbarSearch ? [
    ...data.guests
      .filter((guest) => [guest.name, guest.phone, guest.status, guest.table_label || guest.table_name].join(" ").toLowerCase().includes(normalizedTopbarSearch))
      .slice(0, 3)
      .map((guest) => ({ key: `guest-${guest.id}`, section: "guests", title: guest.name, detail: `Invitat - ${guest.status}` })),
    ...data.tables
      .filter((table) => [table.name, table.notes].join(" ").toLowerCase().includes(normalizedTopbarSearch))
      .slice(0, 2)
      .map((table) => ({ key: `table-${table.id}`, section: "tables", title: table.name, detail: "Masa" })),
    ...data.suppliers
      .filter((supplier) => [supplier.name, supplier.phone, supplier.email].join(" ").toLowerCase().includes(normalizedTopbarSearch))
      .slice(0, 2)
      .map((supplier) => ({ key: `supplier-${supplier.id}`, section: "suppliers", title: supplier.name, detail: "Financiar" })),
    ...data.tasks
      .filter((task) => [task.title, task.owner, task.stage].join(" ").toLowerCase().includes(normalizedTopbarSearch))
      .slice(0, 2)
      .map((task) => ({ key: `task-${task.id}`, section: "calendar", title: task.title, detail: "Calendar" })),
    ...data.mediaUploads
      .filter((item) => [item.original_name, item.guest_name].join(" ").toLowerCase().includes(normalizedTopbarSearch))
      .slice(0, 2)
      .map((item) => ({ key: `media-${item.id}`, section: "media", title: item.original_name, detail: "Media" }))
  ].slice(0, 7) : [];
  const tabs = [
    ...(session.user.isSuperAdmin ? [["admin", "Super Admin", ShieldCheck]] : []),
    ["progress", "Progres", BarChart3],
    ["guests", "Invitați", Users],
    ["tables", "Mese", Table2],
    ["suppliers", "Financiar", WalletCards],
    ["calendar", "Calendar", CalendarDays],
    ["exports", "Export", Download],
    ["media", "Media", Camera],
    ...(canRole(role, "owner") ? [["team", "Roluri", UserPlus], ["settings", "Setări", Settings]] : [])
  ];

  return (
    <div className={`app-shell theme-${data.wedding.theme_color || "sage"}`}>
      {mobileMenuOpen ? <button className="mobile-menu-backdrop" aria-label="Închide meniul" onClick={() => setMobileMenuOpen(false)} type="button" /> : null}
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <button className="mobile-menu-close" aria-label="Închide meniul" onClick={() => setMobileMenuOpen(false)} type="button"><X size={18} /></button>
        <div className="brand">
          {data.wedding.profile_image_url ? <img className="profile-photo" src={data.wedding.profile_image_url} alt={data.wedding.couple} /> : <img className="brand-logo" src={appLogo} alt="Gestionare Nunta" />}
          <div>
            <span className="brand-platform">EverAfter</span>
            <strong>{data.wedding.couple}</strong>
            <small>{data.wedding.venue || "Nunta activă"}</small>
          </div>
        </div>
        <div className="sidebar-user">
          <small>Conectat ca</small>
          <strong>{session.user.name}</strong>
        </div>
        <SidebarCountdown wedding={data.wedding} />
        <nav>
          {tabs.map(([key, label, Icon]) => (
            <button className={active === key ? "active" : ""} key={key} onClick={() => {
              setActive(key);
              setMobileMenuOpen(false);
              if (canRole(data.wedding.role, "planner") && key === "guests" && data.notifications?.newAcceptances) mutate("/api/rsvp-acceptances/seen", { method: "POST" });
              if (canRole(data.wedding.role, "planner") && key === "media" && data.notifications?.newUploads) mutate("/api/media-uploads/seen", { method: "POST" });
            }} type="button">
              <Icon size={18} />{label}
              {key === "guests" && data.notifications?.newAcceptances ? <span className="nav-badge">{data.notifications.newAcceptances}</span> : null}
              {key === "media" && data.notifications?.newUploads ? <span className="nav-badge">{data.notifications.newUploads}</span> : null}
            </button>
          ))}
        </nav>
        <button className="sidebar-logout" onClick={() => {
          setMobileMenuOpen(false);
          setLogoutConfirm(true);
        }} type="button"><LogOut size={18} />Deconectare</button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Panou organizatori</p>
            <h1>{data.wedding.couple}</h1>
            <span className="topbar-subtitle">{data.wedding.venue || "Locație necompletată"}{data.wedding.wedding_date ? ` · ${dateLabel(data.wedding.wedding_date)}` : ""}</span>
          </div>
          <div className="user-tools">
            <div className="topbar-search-wrap">
              <label className="topbar-search"><Search size={16} /><input value={topbarSearch} onChange={(event) => applyTopbarSearch(event.target.value)} placeholder="Caută în platformă" /></label>
              {normalizedTopbarSearch ? (
                <div className="topbar-results">
                  {topbarResults.length ? topbarResults.map((result) => (
                    <button key={result.key} onClick={() => { setActive(result.section); setProfileOpen(false); }} type="button">
                      <strong>{result.title}</strong>
                      <span>{result.detail}</span>
                    </button>
                  )) : <p>Nu există rezultate.</p>}
                </div>
              ) : null}
            </div>
            <button className="topbar-account" onClick={() => setProfileOpen(!profileOpen)} title={session.user.name || session.user.email} type="button">
              <span>{userInitials}</span>
            </button>
            {profileOpen ? (
              <div className="profile-menu">
                <small>Conectat ca</small>
                <strong>{session.user.name}</strong>
                <span>{session.user.email}</span>
                <button onClick={() => { setProfileOpen(false); setActive(canRole(role, "owner") ? "settings" : "progress"); }} type="button"><User size={15} />Profil</button>
                <button onClick={() => { setProfileOpen(false); setLogoutConfirm(true); }} type="button"><LogOut size={15} />Deconectare</button>
              </div>
            ) : null}
            <button className="icon-button mobile-menu-toggle" onClick={() => setMobileMenuOpen(true)} title="Meniu" type="button"><Menu size={18} /></button>
          </div>
        </header>

        {error ? <p className="form-error">{error}</p> : null}

        {active === "progress" ? (
          <section className="metrics-grid">
            <Metric icon={<Users />} label="Persoane confirmate" value={confirmedSeats} detail={`${data.guests.length} invitați în listă`} />
            <Metric icon={<Table2 />} label="Mese" value={data.tables.length} detail="cu capacitate și repartizare" />
            <Metric icon={<WalletCards />} label="Buget plătit" value={money(paid)} detail={`${money(planned)} planificat`} />
            <Metric icon={<ClipboardList />} label="Task-uri bifate" value={`${done}/${data.tasks.length}`} detail="organizare curentă" />
          </section>
        ) : null}

        {active === "admin" ? <SuperAdmin mutate={mutate} searchQuery={topbarSearch} /> : null}
        {active === "progress" ? <ProgressReports data={data} /> : null}
        {active === "guests" ? <GuestInvitationHub data={data} mutate={mutate} searchQuery={topbarSearch} /> : null}
        {active === "tables" ? <SeatingSection data={data} mutate={mutate} searchQuery={topbarSearch} /> : null}
        {active === "suppliers" ? <Suppliers data={data} mutate={mutate} searchQuery={topbarSearch} /> : null}
        {active === "calendar" ? <CalendarView data={data} mutate={mutate} searchQuery={topbarSearch} /> : null}
        {active === "exports" ? <Exports /> : null}
        {active === "media" ? <MediaHub data={data} mutate={mutate} /> : null}
        {active === "team" ? <Team data={data} mutate={mutate} /> : null}
        {active === "settings" ? <SettingsPanel data={data} mutate={mutate} /> : null}
        {logoutConfirm ? (
          <ConfirmDialog
            confirmLabel="Deconectare"
            message="Ești sigur că vrei să te deconectezi?"
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
      <label>Nunta activă
        <select value={data.wedding.id} onChange={(event) => mutate(`/api/weddings/${event.target.value}/select`, { method: "POST" })}>
          {data.weddings.map((wedding) => <option value={wedding.id} key={wedding.id}>{wedding.couple}</option>)}
        </select>
      </label>
      <button className="ghost-button" onClick={() => setOpen(!open)} type="button"><Plus size={16} />Nuntă nouă</button>
      {open ? (
        <form className="mini-form" onSubmit={createWedding}>
          <input required placeholder="Mireasă & Mire" value={form.couple} onChange={(event) => setForm({ ...form, couple: event.target.value })} />
          <input type="date" value={form.wedding_date} onChange={(event) => setForm({ ...form, wedding_date: event.target.value })} />
          <input placeholder="Locație" value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} />
          <button type="submit">Creează</button>
        </form>
      ) : null}
    </section>
  );
}

function OnboardingWizard({ data, onDone }) {
  const themes = [
    { key: "sage", label: "Salvie", colors: ["#668a70", "#b98b42", "#ffffff"] },
    { key: "rose", label: "Rose", colors: ["#b77982", "#8e4f5b", "#ffffff"] },
    { key: "navy", label: "Navy", colors: ["#4f6f88", "#c4a15c", "#ffffff"] },
    { key: "dark", label: "Dark", colors: ["#111716", "#d1b76f", "#f5f2ea"] }
  ];
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    phone: "",
    address: "",
    couple: data.wedding.couple || "",
    wedding_date: data.wedding.wedding_date || "",
    wedding_time: data.wedding.wedding_time || "",
    venue: data.wedding.venue || "",
    venue_address: data.wedding.venue_address || "",
    map_url: data.wedding.map_url || "",
    theme_color: data.wedding.theme_color || "sage",
    profile_image_url: data.wedding.profile_image_url || "",
    profile_data_url: ""
  });
  const steps = ["Contact", "Eveniment", "Design", "Final"];

  function update(next) {
    setError("");
    setForm(next);
  }

  async function uploadProfile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    update({ ...form, profile_data_url: dataUrl, profile_image_url: dataUrl });
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const updated = await api("/api/onboarding", { method: "POST", body: JSON.stringify(form) });
      onDone(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={`onboarding-screen theme-${form.theme_color || "sage"}`}>
      <section className="onboarding-phone">
        <div className="onboarding-top">
          <img src={appLogo} alt="Gestionare Nunta" />
          <div>
            <p className="eyebrow">Configurare initiala</p>
            <h1>Hai sa pregatim nuntă</h1>
          </div>
        </div>
        <div className="onboarding-steps">
          {steps.map((item, index) => <span className={index <= step ? "active" : ""} key={item}>{index + 1}</span>)}
        </div>

        {step === 0 ? (
          <div className="onboarding-step">
            <h2>Date de contact</h2>
            <p>Aceste date rămân în cont și ajută la administrare.</p>
            <label>Telefon<span className="auth-input"><PhoneIcon /><input placeholder="07xx xxx xxx" value={form.phone} onChange={(event) => update({ ...form, phone: event.target.value })} /></span></label>
            <label>Adresa ta<span className="auth-input"><MapPin size={19} /><input placeholder="Oras / adresa" value={form.address} onChange={(event) => update({ ...form, address: event.target.value })} /></span></label>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="onboarding-step">
            <h2>Detalii eveniment</h2>
            <p>Le poti modifica oricand mai tarziu din setari.</p>
            <label>Mireasă & Mire<span className="auth-input"><Users size={19} /><input value={form.couple} onChange={(event) => update({ ...form, couple: event.target.value })} /></span></label>
            <div className="auth-inline-fields">
              <label>Data<span className="auth-input"><CalendarDays size={19} /><input type="date" value={form.wedding_date} onChange={(event) => update({ ...form, wedding_date: event.target.value })} /></span></label>
              <label>Ora<span className="auth-input"><Clock size={19} /><input type="time" value={form.wedding_time} onChange={(event) => update({ ...form, wedding_time: event.target.value })} /></span></label>
            </div>
            <label>Restaurant<span className="auth-input"><MapPin size={19} /><input placeholder="Numele restaurantului" value={form.venue} onChange={(event) => update({ ...form, venue: event.target.value })} /></span></label>
            <label>Adresa restaurantului<span className="auth-input"><MapPin size={19} /><input placeholder="Adresa completa" value={form.venue_address} onChange={(event) => update({ ...form, venue_address: event.target.value })} /></span></label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="onboarding-step">
            <h2>Design și profil</h2>
            <p>Alege tema platformei și poza mirilor.</p>
            <div className="onboarding-theme-grid">
              {themes.map((theme) => (
                <button className={form.theme_color === theme.key ? "selected" : ""} key={theme.key} onClick={() => update({ ...form, theme_color: theme.key })} type="button">
                  <span>{theme.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>
                  {theme.label}
                </button>
              ))}
            </div>
            <label className="file-field">Poza de profil miri
              <span className="file-picker">
                <input type="file" accept="image/*" onChange={uploadProfile} />
                <span><ImageUp size={17} />Alege poza</span>
              </span>
            </label>
            {form.profile_image_url ? <img className="onboarding-profile-preview" src={form.profile_image_url} alt="Preview profil" /> : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="onboarding-step done">
            <h2>Totul este pregatit</h2>
            <p>Salvăm configurarea inițială și intri în platformă.</p>
            <div className="onboarding-summary">
              <span>{form.couple || "Nunta"}</span>
              <span>{form.venue || "Restaurant necompletat"}</span>
              <span>{themes.find((theme) => theme.key === form.theme_color)?.label || "Tema"}</span>
            </div>
          </div>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}
        <div className="onboarding-actions">
          <button className="tool-button" disabled={step === 0 || saving} onClick={() => setStep(step - 1)} type="button">Înapoi</button>
          {step < steps.length - 1 ? <button className="settings-save" onClick={() => setStep(step + 1)} type="button">Continuă</button> : <button className="settings-save" disabled={saving} onClick={submit} type="button">{saving ? "Se salvează..." : "Intră în platformă"}</button>}
        </div>
      </section>
    </main>
  );
}

function PhoneIcon() {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.35 1.9.66 2.81a2 2 0 0 1-.45 2.11L8.05 9.91a16 16 0 0 0 6.04 6.04l1.27-1.27a2 2 0 0 1 2.11-.45c.91.31 1.85.53 2.81.66A2 2 0 0 1 22 16.92z" /></svg>;
}

function SuperAdmin({ mutate, searchQuery = "" }) {
  const [admin, setAdmin] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [enteringWedding, setEnteringWedding] = useState(null);
  const [client, setClient] = useState({ name: "", email: "", password: "Client123!", couple: "", wedding_date: "", wedding_time: "", venue: "" });

  useEffect(() => {
    api("/api/admin/dashboard").then(setAdmin).catch((err) => setError(err.message));
  }, []);
  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  if (error) return <section className="module"><p className="form-error">{error}</p></section>;
  if (!admin) return <section className="module"><div className="loader" /></section>;
  const weddings = admin.weddings.filter((wedding) => [wedding.couple, wedding.owner_name, wedding.owner_email, wedding.venue].join(" ").toLowerCase().includes(search.toLowerCase()));
  const activeClients = admin.weddings.filter((wedding) => wedding.status !== "inactive").length;
  const inactiveClients = admin.weddings.length - activeClients;
  const upcomingWeddings = admin.weddings.filter((wedding) => wedding.wedding_date && new Date(`${wedding.wedding_date}T23:59:59`) >= new Date()).length;
  const acceptanceRate = admin.totals.guests ? Math.round((admin.weddings.reduce((sum, wedding) => sum + Number(wedding.confirmed || 0), 0) / admin.totals.guests) * 100) : 0;
  const budgetRate = admin.totals.planned ? Math.round((Number(admin.totals.paid || 0) / Number(admin.totals.planned || 1)) * 100) : 0;
  const recentWeddings = [...admin.weddings].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 5);
  const topByGuests = [...admin.weddings].sort((a, b) => Number(b.guests || 0) - Number(a.guests || 0)).slice(0, 5);

  async function enterWedding(wedding) {
    setEnteringWedding(wedding);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      await mutate(`/api/weddings/${wedding.id}/select`, { method: "POST" });
    } finally {
      setEnteringWedding(null);
    }
  }

  return (
    <section className="module">
      {enteringWedding ? (
        <div className="admin-enter-overlay" role="status" aria-live="polite">
          <section>
            {enteringWedding.profile_image_url ? <img src={enteringWedding.profile_image_url} alt="" /> : <img src={appLogo} alt="" />}
            <div>
              <p className="eyebrow">Se deschide gestiunea</p>
              <h3>{enteringWedding.couple}</h3>
              <span>{enteringWedding.owner_name}</span>
            </div>
            <div className="admin-enter-progress"><span /></div>
          </section>
        </div>
      ) : null}
      <div className="module-title">
        <div><p className="eyebrow">Super admin</p><h2>Dashboard platformă și clienți</h2></div>
      </div>
      <section className="metrics-grid">
        <Metric icon={<Users />} label="Clienti" value={admin.totals.clients} detail={`${admin.totals.weddings} nunti`} />
        <Metric icon={<BarChart3 />} label="Invitați" value={admin.totals.guests} detail="in toate nuntile" />
        <Metric icon={<Bell />} label="Uploaduri noi" value={admin.totals.newUploads} detail={`${admin.totals.uploads} total`} />
        <Metric icon={<WalletCards />} label="Platit total" value={money(admin.totals.paid)} detail={`${money(admin.totals.planned)} planificat`} />
      </section>
      <section className="admin-insights-grid">
        <article className="admin-insight-card">
          <div>
            <p className="eyebrow">Status clienți</p>
            <h3>{activeClients} activi</h3>
            <span>{inactiveClients} dezactivati</span>
          </div>
          <div className="mini-bars">
            <span style={{ width: `${admin.weddings.length ? Math.max(8, (activeClients / admin.weddings.length) * 100) : 0}%` }} />
          </div>
        </article>
        <article className="admin-insight-card">
          <div>
            <p className="eyebrow">Nunți viitoare</p>
            <h3>{upcomingWeddings}</h3>
            <span>din {admin.totals.weddings} gestionari</span>
          </div>
          <CalendarDays size={38} />
        </article>
        <article className="admin-insight-card">
          <div>
            <p className="eyebrow">Rata confirmari</p>
            <h3>{acceptanceRate}%</h3>
            <span>locuri confirmate din invitați</span>
          </div>
          <div className="mini-bars"><span style={{ width: `${acceptanceRate}%` }} /></div>
        </article>
        <article className="admin-insight-card">
          <div>
            <p className="eyebrow">Buget incasat</p>
            <h3>{budgetRate}%</h3>
            <span>{money(admin.totals.paid)} plătit</span>
          </div>
          <div className="mini-bars"><span style={{ width: `${budgetRate}%` }} /></div>
        </article>
      </section>
      <section className="admin-snapshot-grid">
        <article className="dashboard-list-card accent-clients">
          <div className="dashboard-list-head">
            <span><UserPlus size={18} /></span>
            <div><small>Clienți</small><h3>Ultimele conturi create</h3></div>
          </div>
          <div className="dashboard-list">
            {recentWeddings.length ? recentWeddings.map((wedding) => (
              <p key={wedding.id}>
                <i>{String(wedding.couple || "EA").slice(0, 2).toUpperCase()}</i>
                <strong>{wedding.couple}</strong>
                <span>{wedding.owner_email}</span>
              </p>
            )) : <p><i>0</i><strong>Nu există clienți</strong><span>-</span></p>}
          </div>
        </article>
        <article className="dashboard-list-card accent-guests">
          <div className="dashboard-list-head">
            <span><Users size={18} /></span>
            <div><small>Invitați</small><h3>Nunți cu cei mai mulți invitați</h3></div>
          </div>
          <div className="dashboard-list">
            {topByGuests.length ? topByGuests.map((wedding) => (
              <p key={wedding.id}>
                <i>{wedding.guests}</i>
                <strong>{wedding.couple}</strong>
                <span>{wedding.guests} invitați</span>
              </p>
            )) : <p><i>0</i><strong>Nu există invitați</strong><span>-</span></p>}
          </div>
        </article>
        <article className="dashboard-list-card accent-alerts">
          <div className="dashboard-list-head">
            <span><Bell size={18} /></span>
            <div><small>Status</small><h3>Atenționări rapide</h3></div>
          </div>
          <div className="dashboard-list">
            <p><i>{admin.totals.newUploads}</i><strong>Uploaduri nevăzute</strong><span>media nouă</span></p>
            <p><i>{inactiveClients}</i><strong>Clienți dezactivați</strong><span>conturi oprite</span></p>
            <p><i>{admin.weddings.filter((wedding) => !wedding.wedding_date).length}</i><strong>Fără data nunții</strong><span>de completat</span></p>
          </div>
        </article>
      </section>
      <div className="module-title compact-title">
        <div><p className="eyebrow">Nuntă nouă</p><h2>Creează client și nuntă</h2></div>
      </div>
      <form className="entry-form admin-client-form" onSubmit={async (event) => {
        event.preventDefault();
        const updated = await api("/api/admin/clients", { method: "POST", body: JSON.stringify(client) });
        setAdmin(updated);
        setClient({ name: "", email: "", password: "Client123!", couple: "", wedding_date: "", wedding_time: "", venue: "" });
      }}>
        <input required placeholder="Nume client" value={client.name} onChange={(event) => setClient({ ...client, name: event.target.value })} />
        <input required placeholder="Email" value={client.email} onChange={(event) => setClient({ ...client, email: event.target.value })} />
        <input required placeholder="Parola inițială" value={client.password} onChange={(event) => setClient({ ...client, password: event.target.value })} />
        <input required placeholder="Mireasă & Mire" value={client.couple} onChange={(event) => setClient({ ...client, couple: event.target.value })} />
        <input type="date" value={client.wedding_date} onChange={(event) => setClient({ ...client, wedding_date: event.target.value })} />
        <input type="time" value={client.wedding_time} onChange={(event) => setClient({ ...client, wedding_time: event.target.value })} />
        <input placeholder="Locație" value={client.venue} onChange={(event) => setClient({ ...client, venue: event.target.value })} />
        <button type="submit"><Plus size={18} />Creează nuntă</button>
      </form>
      <div className="filter-bar"><label><Search size={16} />Caută<input placeholder="Client, nuntă, locație" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nunta</th><th>Client</th><th>Ultima conectare</th><th>Data</th><th>Invitați</th><th>Uploaduri</th><th>Buget</th><th></th></tr></thead>
          <tbody>
            {weddings.map((wedding) => (
              <tr key={wedding.id}>
                <td>
                  <div className="admin-wedding-cell">
                    {wedding.profile_image_url ? <img src={wedding.profile_image_url} alt={wedding.couple} /> : <img className="admin-logo-fallback" src={appLogo} alt="Gestionare Nunta" />}
                    <div><strong>{wedding.couple}</strong><small>{wedding.venue || "-"}</small></div>
                  </div>
                </td>
                <td><strong>{wedding.owner_name}</strong><small>{wedding.owner_email}</small></td>
                <td>{dateTimeLabel(wedding.owner_last_login_at)}</td>
                <td>{wedding.wedding_date || "-"}</td>
                <td>{wedding.confirmed}/{wedding.guests}</td>
                <td>{wedding.uploads} {wedding.newUploads ? <span className="pill yes">{wedding.newUploads} noi</span> : null}</td>
                <td>{money(wedding.paid)} / {money(wedding.planned)}</td>
                <td>
                  <div className="row-actions">
                    <button className="tool-button" onClick={() => enterWedding(wedding)} type="button"><Eye size={17} />Intra</button>
                    <button className="tool-button" onClick={async () => setAdmin(await api(`/api/admin/users/${wedding.owner_id}/status`, { method: "POST", body: JSON.stringify({ status: wedding.status === "inactive" ? "active" : "inactive" }) }))} type="button">{wedding.status === "inactive" ? "Activează" : "Dezactivează"}</button>
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
      <div className="module-title"><div><p className="eyebrow">Rapoarte</p><h2>Nunta este {score}% pregătită</h2></div></div>
      <div className="report-grid">
        <ReportBar label="Confirmări" value={confirmed} total={invited} />
        <ReportBar label="Așezare la mese" value={seated} total={Math.max(confirmed, 1)} />
        <ReportBar label="Sarcini" value={tasksDone} total={Math.max(data.tasks.length, 1)} />
        <ReportBar label="Buget plătit" value={budgetPaid} total={budgetPlan} moneyMode />
      </div>
      <div className="report-grid">
        <article className="dashboard-list-card compact-report accent-menu">
          <div className="dashboard-list-head">
            <span><ClipboardList size={18} /></span>
            <div><small>Preferințe</small><h3>Meniuri alese</h3></div>
          </div>
          <div className="dashboard-list">
            {Object.entries(menuCounts).length ? Object.entries(menuCounts).map(([key, value]) => (
              <p key={key}><i>{value}</i><strong>{key}</strong><span>{value === 1 ? "invitat" : "invitați"}</span></p>
            )) : <p><i>0</i><strong>Nu există meniuri alese</strong><span>-</span></p>}
          </div>
        </article>
        <article className="dashboard-list-card compact-report accent-alerts">
          <div className="dashboard-list-head">
            <span><Bell size={18} /></span>
            <div><small>De urmărit</small><h3>Atenționări</h3></div>
          </div>
          <div className="dashboard-list">
            <p><i>{data.guests.filter((guest) => guest.status === "Confirmat" && !guest.table_id).length}</i><strong>Invitați confirmați fără masă</strong><span>așezare</span></p>
            <p><i>{data.notifications.openTasks}</i><strong>Task-uri apropiate</strong><span>calendar</span></p>
            <p><i>{data.notifications.duePayments}</i><strong>Plăți apropiate</strong><span>financiar</span></p>
          </div>
        </article>
      </div>
    </section>
  );
}

function ReportBar({ label, value, total, moneyMode = false }) {
  const percent = Math.min(100, Math.round((Number(value || 0) / Math.max(Number(total || 1), 1)) * 100));
  return <article className="report-card"><h3>{label}</h3><div className="bar-track"><span style={{ width: `${percent}%` }} /></div><p><strong>{percent}%</strong><span>{moneyMode ? `${money(value)} / ${money(total)}` : `${value} / ${total}`}</span></p></article>;
}

function GuestInvitationHub({ data, mutate, searchQuery = "" }) {
  const [tab, setTab] = useState("guests");
  const canOpenInvitation = canRole(data.wedding.role, "owner");
  return (
    <section className="hub-stack">
      <div className="segmented section-tabs hub-tabs">
        <button className={tab === "guests" ? "active" : ""} onClick={() => setTab("guests")} type="button"><Users size={16} />Invitați</button>
        {canOpenInvitation ? <button className={tab === "invitation" ? "active" : ""} onClick={() => setTab("invitation")} type="button"><FileText size={16} />Invitație</button> : null}
      </div>
      {tab === "guests" ? <Guests data={data} mutate={mutate} embedded searchQuery={searchQuery} /> : null}
      {tab === "invitation" && canOpenInvitation ? <InvitationSettings data={data} mutate={mutate} embedded /> : null}
    </section>
  );
}

function Guests({ data, mutate, searchQuery = "" }) {
  const [form, setForm] = useState(emptyGuest);
  const [editGuest, setEditGuest] = useState(null);
  const [copied, setCopied] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "all", table: "all" });
  const [page, setPage] = useState(1);
  const { askDelete, dialog } = useConfirmDelete(mutate);
  const canEdit = canRole(data.wedding.role, "planner");
  useEffect(() => {
    setFilters((current) => ({ ...current, search: searchQuery }));
    setPage(1);
  }, [searchQuery]);
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
      status: guest.status || "În așteptare",
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
    const headers = ["Nume", "Prenume", "Telefon", "Status", "Confirmat la", "Locuri", "Meniu", "Masa", "Link invitație"];
    const lines = filteredGuests.map((guest) => {
      const [firstName, ...rest] = String(guest.name || "").split(" ");
      const row = [firstName || "", rest.join(" "), guest.phone || "", guest.status || "", confirmationLabel(guest), guest.seats || "", mealSummary(guest), guest.table_label || guest.table_name || "", guest.inviteUrl || ""];
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
        <div><p className="eyebrow">Invitați</p><h2>Confirmări detaliate și WhatsApp</h2></div>
      </div>
      {canEdit ? <form className="entry-form guests-form" onSubmit={addGuest}>
        <input required placeholder="Nume" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
        <input required placeholder="Prenume" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
        <input placeholder="Telefon 40740..." value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <select value={form.side} onChange={(event) => setForm({ ...form, side: event.target.value })}><option>Comun</option><option>Mireasă</option><option>Mire</option></select>
        <input type="number" min="1" max="10" value={form.seats} onChange={(event) => setForm({ ...form, seats: event.target.value })} />
        <select value={form.table_id} onChange={(event) => setForm({ ...form, table_id: event.target.value })}>
          <option value="">Fara masa</option>
          {data.tables.map((table) => <option value={table.id} key={table.id}>{table.name}</option>)}
        </select>
        <button type="submit"><Plus size={18} />Adaugă</button>
      </form> : null}
      <div className="filter-bar guest-filter-bar">
        <label><Search size={16} />Caută<input placeholder="Nume sau telefon" value={filters.search} onChange={(event) => { setFilters({ ...filters, search: event.target.value }); setPage(1); }} /></label>
        <label>Status<select value={filters.status} onChange={(event) => { setFilters({ ...filters, status: event.target.value }); setPage(1); }}><option value="all">Toate</option><option>În așteptare</option><option>Confirmat</option><option>Refuzat</option></select></label>
        <label>Masa<select value={filters.table} onChange={(event) => { setFilters({ ...filters, table: event.target.value }); setPage(1); }}><option value="all">Toate</option><option value="none">Fara masa</option>{data.tables.map((table) => <option value={table.id} key={table.id}>{table.name}</option>)}</select></label>
        <button className="tool-button" onClick={exportGuests} type="button"><Download size={16} />Excel</button>
      </div>
      <div className="table-wrap guest-table-wrap">
        <table>
          <thead><tr><th>Invitat</th><th>Status</th><th>Confirmat la</th><th>Locuri</th><th>Meniu</th><th>Masa</th><th>Invitație</th><th></th></tr></thead>
          <tbody>
            {pageGuests.map((guest) => {
              const [firstName, ...restName] = String(guest.name || "").split(" ");
              const isEditing = editGuest?.id === guest.id;
              return (
                <React.Fragment key={guest.id}>
                  <tr>
                    <td><strong>{firstName} {restName.join(" ")}</strong><small>{guest.phone || "fără telefon"} - {guest.side}</small></td>
                    <td><span className={`pill ${guest.status === "Confirmat" ? "yes" : guest.status === "Refuzat" ? "no" : ""}`}>{guest.status}</span></td>
                    <td><small>{confirmationLabel(guest)}</small></td>
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
                        <button className="icon-button" onClick={() => startEditGuest(guest)} title="Editează" type="button"><Pencil size={17} /></button>
                        <button className="icon-button danger" onClick={() => askDelete(`/api/guests/${guest.id}`, `Ștergi invitatul ${guest.name}?`)} title="Șterge" type="button"><Trash2 size={17} /></button>
                      </div> : null}
                    </td>
                  </tr>
                  {isEditing ? (
                    <tr className="edit-row">
                      <td colSpan="8">
                        <form className="inline-edit-form" onSubmit={saveGuestEdit}>
                          <input required placeholder="Nume" value={editGuest.first_name} onChange={(event) => setEditGuest({ ...editGuest, first_name: event.target.value })} />
                          <input required placeholder="Prenume" value={editGuest.last_name} onChange={(event) => setEditGuest({ ...editGuest, last_name: event.target.value })} />
                          <input placeholder="Telefon" value={editGuest.phone} onChange={(event) => setEditGuest({ ...editGuest, phone: event.target.value })} />
                          <select value={editGuest.side} onChange={(event) => setEditGuest({ ...editGuest, side: event.target.value })}><option>Comun</option><option>Mireasă</option><option>Mire</option></select>
                          <select value={editGuest.status} onChange={(event) => setEditGuest({ ...editGuest, status: event.target.value })}><option>În așteptare</option><option>Confirmat</option><option>Refuzat</option></select>
                          <input type="number" min="1" max="10" value={editGuest.seats} onChange={(event) => setEditGuest({ ...editGuest, seats: event.target.value })} />
                          <input placeholder="Meniu" value={editGuest.meal_choice} onChange={(event) => setEditGuest({ ...editGuest, meal_choice: event.target.value })} />
                          <input placeholder="Alergii" value={editGuest.allergies} onChange={(event) => setEditGuest({ ...editGuest, allergies: event.target.value })} />
                          <select value={editGuest.table_id} onChange={(event) => setEditGuest({ ...editGuest, table_id: event.target.value })}>
                            <option value="">Fara masa</option>
                            {data.tables.map((table) => <option value={table.id} key={table.id}>{table.name}</option>)}
                          </select>
                          <button type="submit"><Check size={17} />Salvează</button>
                          <button className="tool-button" onClick={() => setEditGuest(null)} type="button"><X size={17} />Anulează</button>
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
        <span>{filteredGuests.length} invitați - pagina {currentPage} din {totalPages}</span>
        <div className="row-actions">
          <button className="tool-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} type="button">Înapoi</button>
          <button className="tool-button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} type="button">Următoarea</button>
        </div>
      </div>
      {dialog}
    </section>
  );
}

function SeatingSection({ data, mutate, searchQuery = "" }) {
  const [tab, setTab] = useState("tables");
  return (
    <section className="module">
      <div className="module-title seating-title">
        <div><p className="eyebrow">Sală</p><h2>Mese și plan sală</h2></div>
        <div className="segmented section-tabs">
          <button className={tab === "tables" ? "active" : ""} onClick={() => setTab("tables")} type="button">Așezare invitați</button>
          <button className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")} type="button">Plan sală</button>
        </div>
      </div>
      {tab === "tables" ? <Tables data={data} embedded mutate={mutate} searchQuery={searchQuery} /> : <RoomPlan data={data} embedded mutate={mutate} />}
    </section>
  );
}

function Tables({ data, mutate, embedded = false, searchQuery = "" }) {
  const [form, setForm] = useState({ name: "", capacity: 8, notes: "" });
  const [search, setSearch] = useState("");
  const { askDelete, dialog } = useConfirmDelete(mutate);
  const canEdit = canRole(data.wedding.role, "planner");
  const unseated = data.guests.filter((guest) => guest.status === "Confirmat" && !guest.table_id);
  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);
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
        <input placeholder="Observații" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        <button type="submit"><Plus size={18} />Adaugă masa</button>
      </form> : null}
      <div className="filter-bar"><label><Search size={16} />Caută<input placeholder="Masa sau invitat" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      <div className="seating-layout">
        <aside className="panel">
          <h3>Invitați confirmați neașezați</h3>
          <div className="chip-list">
            {unseated.length ? unseated.map((guest) => (
              <div className="guest-chip" draggable={canEdit} onDragStart={canEdit ? (event) => event.dataTransfer.setData("guestId", guest.id) : undefined} key={guest.id}>
                <strong>{guest.name}</strong><small>{guest.seats} locuri</small>
                {Number(guest.seats || 1) > 1 ? <span className="plus-badge">{partyLabel(guest.seats)}</span> : null}
              </div>
            )) : <p className="empty-state">Toți invitații confirmați sunt așezați.</p>}
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
                  {canEdit ? <button className="icon-button danger" onClick={() => askDelete(`/api/tables/${table.id}`, `Ștergi masa ${table.name}? Invitații de la această masă vor rămâne neașezați.`)} type="button"><Trash2 size={17} /></button> : null}
                </header>
                {over ? <p className="capacity-warning">Capacitate depășită</p> : null}
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
      <div className="module-title"><div><p className="eyebrow">Plan sală</p><h2>Trage vizual mesele in sala</h2></div></div>
      {content}
    </section>
  );
}

function Budget({ data, mutate }) {
  const [form, setForm] = useState({ item: "", supplier: "", planned: "", paid: "", status: "De plătit", due: "" });
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
    setForm({ item: "", supplier: "", planned: "", paid: "", status: "De plătit", due: "" });
  }
  return (
    <section className="module">
      <div className="module-title"><div><p className="eyebrow">Financiar</p><h2>Buget, furnizori și scadențe</h2></div></div>
      <form className="entry-form budget-form" onSubmit={submit}>
        <input required placeholder="Element" value={form.item} onChange={(event) => setForm({ ...form, item: event.target.value })} />
        <input placeholder="Furnizor" value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} />
        <input type="number" min="0" placeholder="Planificat" value={form.planned} onChange={(event) => setForm({ ...form, planned: event.target.value })} />
        <input type="number" min="0" placeholder="Platit" value={form.paid} onChange={(event) => setForm({ ...form, paid: event.target.value })} />
        <input type="date" value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })} />
        <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>De plătit</option><option>Avans</option><option>Achitat</option></select>
        <button type="submit"><Plus size={18} />Adaugă</button>
      </form>
      <div className="filter-bar">
        <label><Search size={16} />Caută<input placeholder="Element sau furnizor" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        <label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="all">Toate</option><option>De plătit</option><option>Avans</option><option>Achitat</option></select></label>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Element</th><th>Furnizor</th><th>Planificat</th><th>Platit</th><th>Scadenta</th><th>Status</th><th></th></tr></thead><tbody>
        {rows.map((item) => <tr key={item.id}><td><strong>{item.item}</strong></td><td>{item.supplier || "-"}</td><td>{money(item.planned)}</td><td>{money(item.paid)}</td><td>{item.due || "-"}</td><td><span className="pill">{item.status}</span></td><td><button className="icon-button danger" onClick={() => askDelete(`/api/budget/${item.id}`, `Ștergi elementul de buget ${item.item}?`)} type="button"><Trash2 size={17} /></button></td></tr>)}
      </tbody></table></div>
      {dialog}
    </section>
  );
}

function Suppliers({ data, mutate, searchQuery = "" }) {
  const [form, setForm] = useState({ name: "", category: "", phone: "", email: "", advance: "", total: "", due: "", notes: "", contract: null });
  const [editSupplier, setEditSupplier] = useState(null);
  const [search, setSearch] = useState("");
  const { askDelete, dialog } = useConfirmDelete(mutate);
  const canEdit = canRole(data.wedding.role, "planner");
  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);
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
        <article><span>De plată</span><strong>{money(remaining)}</strong></article>
      </div>
      {canEdit ? <form className="entry-form suppliers-form" onSubmit={submit}>
        <input required placeholder="Furnizor" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="Telefon" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <input placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <input type="number" min="0" placeholder="Avans plătit" value={form.advance} onChange={(event) => setForm({ ...form, advance: event.target.value })} />
        <input type="number" min="0" placeholder="Total contract" value={form.total} onChange={(event) => setForm({ ...form, total: event.target.value })} />
        <label className="file-picker">
          <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(event) => setForm({ ...form, contract: event.target.files?.[0] || null })} />
          <span><FileText size={17} />{form.contract ? form.contract.name : "Alege contract"}</span>
        </label>
        <button type="submit"><Plus size={18} />Adaugă</button>
      </form> : null}
      <div className="filter-bar"><label><Search size={16} />Caută<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Furnizor sau contact" /></label></div>
      <div className="table-wrap"><table><thead><tr><th>Furnizor</th><th>Contact</th><th>Avans plătit</th><th>Total</th><th>De plată</th><th>Contract</th><th></th></tr></thead><tbody>{rows.map((supplier) => {
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
                  <button className="icon-button" onClick={() => startEditSupplier(supplier)} title="Editează" type="button"><Pencil size={17} /></button>
                  <button className="icon-button danger" onClick={() => askDelete(`/api/suppliers/${supplier.id}`, `Ștergi furnizorul ${supplier.name}?`)} type="button"><Trash2 size={17} /></button>
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
                    <input type="number" min="0" placeholder="Avans plătit" value={editSupplier.advance} onChange={(event) => setEditSupplier({ ...editSupplier, advance: event.target.value })} />
                    <input type="number" min="0" placeholder="Total contract" value={editSupplier.total} onChange={(event) => setEditSupplier({ ...editSupplier, total: event.target.value })} />
                    <input placeholder="Observații" value={editSupplier.notes} onChange={(event) => setEditSupplier({ ...editSupplier, notes: event.target.value })} />
                    <label className="file-picker">
                      <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(event) => setEditSupplier({ ...editSupplier, contract: event.target.files?.[0] || null })} />
                      <span><FileText size={17} />{editSupplier.contract ? editSupplier.contract.name : editSupplier.contract_name || "Schimbă contract"}</span>
                    </label>
                    <button type="submit"><Check size={17} />Salvează</button>
                    <button className="tool-button" onClick={() => setEditSupplier(null)} type="button"><X size={17} />Anulează</button>
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
  const [form, setForm] = useState({ title: "", due: "", owner: "Amândoi", stage: "General", priority: "Medie" });
  const [filters, setFilters] = useState({ search: "", done: "all" });
  const { askDelete, dialog } = useConfirmDelete(mutate);
  async function submit(event) {
    event.preventDefault();
    await mutate("/api/tasks", { method: "POST", body: JSON.stringify(form) });
    setForm({ title: "", due: "", owner: "Amândoi", stage: "General", priority: "Medie" });
  }
  const groups = ["Invitații", "Restaurant", "Furnizori", "Acte", "Săptămâna nunții", "General"];
  const tasks = data.tasks.filter((task) => {
    const matchesText = [task.title, task.owner, task.stage, task.priority].join(" ").toLowerCase().includes(filters.search.toLowerCase());
    const matchesDone = filters.done === "all" || (filters.done === "done" ? task.done : !task.done);
    return matchesText && matchesDone;
  });
  return (
    <section className="module">
      <div className="module-title"><div><p className="eyebrow">Checklist</p><h2>Sarcini pe etape și deadline-uri</h2></div></div>
      <form className="entry-form task-form" onSubmit={submit}>
        <input required placeholder="Sarcina" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <input type="date" value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })} />
        <select value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })}><option>Amândoi</option><option>Mireasă</option><option>Mire</option><option>Familie</option><option>Planner</option></select>
        <select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>{groups.map((group) => <option key={group}>{group}</option>)}</select>
        <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Mica</option><option>Medie</option><option>Mare</option></select>
        <button type="submit"><Plus size={18} />Adaugă</button>
      </form>
      <div className="filter-bar">
        <label><Search size={16} />Caută<input placeholder="Sarcina, responsabil, etapa" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        <label>Status<select value={filters.done} onChange={(event) => setFilters({ ...filters, done: event.target.value })}><option value="all">Toate</option><option value="open">Deschise</option><option value="done">Finalizate</option></select></label>
      </div>
      <div className="kanban">
        {groups.map((group) => (
          <section className="kanban-column" key={group}>
            <h3>{group}</h3>
            {tasks.filter((task) => task.stage === group).map((task) => (
              <article className={`task-card ${task.done ? "done" : ""}`} key={task.id}>
                <input checked={task.done} onChange={(event) => mutate(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ done: event.target.checked }) })} type="checkbox" />
                <div><strong>{task.title}</strong><small>{task.due || "fără termen"} - {task.owner} - {task.priority}</small></div>
                <button className="icon-button danger" onClick={() => askDelete(`/api/tasks/${task.id}`, `Ștergi sarcina ${task.title}?`)} type="button"><Trash2 size={17} /></button>
              </article>
            ))}
          </section>
        ))}
      </div>
      {dialog}
    </section>
  );
}

function CalendarView({ data, mutate, searchQuery = "" }) {
  const [form, setForm] = useState({ title: "", due: "", owner: "Amândoi", stage: "General", priority: "Medie" });
  const [filters, setFilters] = useState({ search: "", done: "all" });
  const [month, setMonth] = useState((data.wedding.wedding_date || new Date().toISOString().slice(0, 10)).slice(0, 7));
  const { askDelete, dialog } = useConfirmDelete(mutate);
  const canEdit = canRole(data.wedding.role, "planner");
  useEffect(() => {
    setFilters((current) => ({ ...current, search: searchQuery }));
  }, [searchQuery]);
  const groups = ["Invitații", "Restaurant", "Furnizori", "Acte", "Săptămâna nunții", "General"];
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
    setForm({ title: "", due: "", owner: "Amândoi", stage: "General", priority: "Medie" });
  }

  function shiftMonth(direction) {
    const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + direction, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <section className="module">
      <div className="module-title"><div><p className="eyebrow">Calendar</p><h2>Calendar și checklist</h2></div></div>
      {canEdit ? <form className="entry-form task-form" onSubmit={submit}>
        <input required placeholder="Sarcina" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <input type="date" value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })} />
        <select value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })}><option>Amândoi</option><option>Mireasă</option><option>Mire</option><option>Familie</option><option>Planner</option></select>
        <select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>{groups.map((group) => <option key={group}>{group}</option>)}</select>
        <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Mica</option><option>Medie</option><option>Mare</option></select>
        <button type="submit"><Plus size={18} />Adaugă</button>
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
        <label><Search size={16} />Caută<input placeholder="Sarcina, responsabil, etapa" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        <label>Status<select value={filters.done} onChange={(event) => setFilters({ ...filters, done: event.target.value })}><option value="all">Toate</option><option value="open">Deschise</option><option value="done">Finalizate</option></select></label>
      </div>
      <div className="task-list">
        {tasks.map((task) => (
          <article className={`task-card ${task.done ? "done" : ""}`} key={task.id}>
            <input checked={task.done} disabled={!canEdit} onChange={(event) => mutate(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ done: event.target.checked }) })} type="checkbox" />
            <div><strong>{task.title}</strong><small>{task.due || "fără termen"} - {task.owner} - {task.stage} - {task.priority}</small></div>
            {canEdit ? <button className="icon-button danger" onClick={() => askDelete(`/api/tasks/${task.id}`, `Ștergi sarcina ${task.title}?`)} type="button"><Trash2 size={17} /></button> : null}
          </article>
        ))}
      </div>
      {dialog}
    </section>
  );
}

function Exports() {
  const exports = [
    ["guests", "Invitați complet"],
    ["menu", "Meniuri și alergii"],
    ["tables", "Așezare mese"],
    ["tables-pdf", "Așezare mese PDF"],
    ["budget", "Buget"]
  ];
  return (
    <section className="module">
      <div className="module-title"><div><p className="eyebrow">Export</p><h2>Fisiere CSV pentru Excel</h2></div></div>
      <div className="export-grid">
        {exports.map(([key, label]) => <a className="export-card" href={`/api/export/${key}`} key={key}><Download size={22} /><strong>{label}</strong><small>{key.endsWith("pdf") ? "Descarcă PDF" : "Descarcă CSV"}</small></a>)}
      </div>
    </section>
  );
}

function MediaHub({ data, mutate }) {
  const [tab, setTab] = useState("qr");
  async function openPhotos() {
    setTab("photos");
    if (data.notifications?.newUploads) await mutate("/api/media-uploads/seen", { method: "POST" });
  }
  return (
    <section className="hub-stack">
      <div className="segmented section-tabs hub-tabs">
        <button className={tab === "qr" ? "active" : ""} onClick={() => setTab("qr")} type="button"><QrCode size={16} />QR Media</button>
        <button className={tab === "photos" ? "active" : ""} onClick={openPhotos} type="button">
          <Camera size={16} />Poze
          {data.notifications?.newUploads ? <span className="nav-badge inline-badge">{data.notifications.newUploads}</span> : null}
        </button>
      </div>
      {tab === "qr" ? <MediaQr data={data} /> : null}
      {tab === "photos" ? <Photos data={data} /> : null}
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
        <p className="eyebrow">Poze și video</p>
        <h2>Cod QR pentru upload de la invitați</h2>
        <p className="hint">Linkul public duce la pagina unde invitații pot încărca poze și video-uri după eveniment.</p>
        <div className="row-actions qr-actions">
          <a className="tool-button" href={data.mediaUrl} target="_blank" rel="noreferrer"><ImageUp size={17} />Deschide pagina</a>
          <button className="tool-button" onClick={() => navigator.clipboard.writeText(data.mediaUrl)} type="button"><Copy size={17} />Copiaza link</button>
          {qr ? <a className="tool-button whatsapp" href={qr} download="qr-upload-poze.png"><Download size={17} />Descarcă QR</a> : null}
        </div>
      </div>
      <div className="qr-box">{qr ? <img src={qr} alt="QR upload poze și video" /> : <div className="loader" />}</div>
    </section>
  );
}

function Photos({ data }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const uploads = data.mediaUploads;
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
        <div><p className="eyebrow">Galerie</p><h2>Poze și video-uri primite</h2></div>
        <a className="tool-button" href="/api/media-uploads/zip"><FileArchive size={17} />Descarcă ZIP</a>
      </div>
      <div className="photo-grid">
        {data.notifications?.newUploads ? <p className="notification-box"><Bell size={18} />Ai {data.notifications.newUploads} uploaduri noi.</p> : null}
        {uploads.length ? uploads.map((upload, index) => (
          <article className={`photo-tile ${upload.is_new ? "new" : ""}`} key={upload.id}>
            <button className="media-preview" onClick={() => setActiveIndex(index)} type="button">
              {upload.mime_type.startsWith("image/") ? <img src={upload.url} alt={upload.file_name} onError={(event) => event.currentTarget.classList.add("media-broken")} /> : <video src={upload.url} />}
            </button>
            <div className="photo-caption">
              <strong>{upload.file_name}</strong>
              <small>{upload.guest_name || "invitat"} - {Math.round(upload.size / 1024)} KB</small>
              <button className="tool-button" onClick={() => setActiveIndex(index)} type="button"><Eye size={16} />Vizualizeaza</button>
            </div>
          </article>
        )) : <p className="empty-state">Nu există uploaduri încă.</p>}
      </div>
      {activeUpload ? (
        <div className="lightbox" role="dialog" aria-modal="true">
          <button className="lightbox-close" onClick={() => setActiveIndex(null)} type="button">Închide</button>
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
        <p className="hint">Creezi conturi de planner sau vizualizare. Emailul trebuie să fie unic în platformă.</p>
      </div>
      <div className="team-grid">
        <form className="settings-form team-form-card" onSubmit={submit}>
          <label>Nume<input value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label>
          <label>Prenume<input value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></label>
          <label>Telefon<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Parola<input required minLength="6" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          <label>Rol<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="planner">Planner</option><option value="viewer">Vizualizare</option></select></label>
          <button className="settings-save" type="submit"><UserPlus size={18} />Creează cont</button>
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
                {member.role !== "owner" ? <button className="icon-button" onClick={() => startEditMember(member)} title="Editează cont" type="button"><Pencil size={17} /></button> : null}
              </div>
            </article>
          ))}
        </div>
      </div>
      {editMember ? (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <section className="confirm-dialog edit-dialog">
            <button className="modal-close" onClick={() => setEditMember(null)} type="button"><X size={18} /></button>
            <h2>Editează cont</h2>
            <form className="inline-edit-form team-edit-form" onSubmit={saveMember}>
              <label>Nume<input value={editMember.first_name} onChange={(event) => setEditMember({ ...editMember, first_name: event.target.value })} /></label>
              <label>Prenume<input value={editMember.last_name} onChange={(event) => setEditMember({ ...editMember, last_name: event.target.value })} /></label>
              <label>Telefon<input value={editMember.phone} onChange={(event) => setEditMember({ ...editMember, phone: event.target.value })} /></label>
              <label>Email<input required type="email" value={editMember.email} onChange={(event) => setEditMember({ ...editMember, email: event.target.value })} /></label>
              <label>Rol<select value={editMember.role} onChange={(event) => setEditMember({ ...editMember, role: event.target.value })}><option value="planner">Planner</option><option value="viewer">Vizualizare</option></select></label>
              <label>Parola noua<input minLength="6" placeholder="Lasă gol dacă nu schimbi" type="password" value={editMember.password} onChange={(event) => setEditMember({ ...editMember, password: event.target.value })} /></label>
              <button type="submit"><Check size={17} />Salvează</button>
              <button className="tool-button" onClick={() => setEditMember(null)} type="button"><X size={17} />Anulează</button>
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
  useEffect(() => {
    const templateExists = invitationTemplates.some((template) => template.key === data.wedding.invitation_template);
    setForm({ ...data.wedding, invitation_template: templateExists ? data.wedding.invitation_template : "custom" });
  }, [data.wedding]);
  const program = Array.isArray(form.program) ? form.program : [];
  const menuOptions = Array.isArray(form.menu_options) ? form.menu_options : [];
  const currentTemplate = invitationTemplates.find((template) => template.key === (form.invitation_template || "custom")) || invitationTemplates[0];
  const t1 = template1Design(form);
  const t2 = template2Design(form);
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
  function updateTemplate2(key, value) {
    updateForm({ ...form, invitation_design: { ...t2, [key]: value } });
  }
  function updateTemplate1(key, value) {
    updateForm({ ...form, invitation_design: { ...t1, [key]: value } });
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
  async function uploadTemplatePhoto(event, key) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingHero(key);
    const dataUrl = await fileToDataUrl(file);
    const payload = await api("/api/invitation-design-upload", { method: "POST", body: JSON.stringify({ dataUrl, name: file.name, key }) });
    updateForm({ ...form, invitation_design: { ...t2, [key]: payload.url } });
    setUploadingHero("");
  }
  return (
    <section className="module settings-page">
      <div className="settings-header"><p className="eyebrow">Invitație</p><h2>Pagina publică și RSVP</h2></div>
      <form className="settings-form settings-card" onSubmit={submit}>
        <fieldset>
          <legend>Invitație - Template pagina</legend>
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
                <strong>Previzualizare invitație</strong>
                <small>Se deschide cu datele și imaginile salvate pentru primul invitat din listă.</small>
              </div>
              <a className="tool-button" href={previewUrl} target="_blank" rel="noreferrer"><Eye size={17} />Previzualizeaza</a>
            </div>
          ) : <p className="hint">Adaugă cel putin un invitat ca sa poti previzualiza pagina publica.</p>}
        </fieldset>
        {(!form.invitation_template || form.invitation_template === "custom" || !invitationTemplates.some((template) => template.key === form.invitation_template)) ? (
          <fieldset>
            <legend>Template 1 - Culori și texte</legend>
            <div className="template-customizer-preview tpl1-preview" style={{
              "--preview-bg": t1.background,
              "--preview-text": t1.text,
              "--preview-muted": t1.muted,
              "--preview-accent": t1.accent,
              "--preview-card": t1.card,
              "--preview-border": t1.border
            }}>
              <div>
                <span>{t1.heroKicker}</span>
                <strong>{form.couple || "Mireasă & Mire"}</strong>
                <small>{t1.rsvpKicker} · {t1.rsvpTitle}</small>
              </div>
              <i />
            </div>
            <div className="settings-grid four color-grid">
              <label>Fundal<input type="color" value={t1.background} onChange={(event) => updateTemplate1("background", event.target.value)} /></label>
              <label>Text<input type="color" value={t1.text} onChange={(event) => updateTemplate1("text", event.target.value)} /></label>
              <label>Accent<input type="color" value={t1.accent} onChange={(event) => updateTemplate1("accent", event.target.value)} /></label>
              <label>Overlay jos<input type="color" value={t1.darkOverlay} onChange={(event) => updateTemplate1("darkOverlay", event.target.value)} /></label>
              <label>Text secundar<input type="color" value={t1.muted} onChange={(event) => updateTemplate1("muted", event.target.value)} /></label>
              <label>Carduri<input type="color" value={t1.card} onChange={(event) => updateTemplate1("card", event.target.value)} /></label>
              <label>Border<input type="color" value={t1.border} onChange={(event) => updateTemplate1("border", event.target.value)} /></label>
            </div>
            <div className="settings-grid two">
              <label>Text mic hero<input value={t1.heroKicker} onChange={(event) => updateTemplate1("heroKicker", event.target.value)} /></label>
              <label>Text scroll<input value={t1.scrollText} onChange={(event) => updateTemplate1("scrollText", event.target.value)} /></label>
              <label>Text mic detalii<input value={t1.detailsKicker} onChange={(event) => updateTemplate1("detailsKicker", event.target.value)} /></label>
              <label>Titlu detalii<input value={t1.detailsTitle} onChange={(event) => updateTemplate1("detailsTitle", event.target.value)} /></label>
              <label>Buton hartă<input value={t1.mapButton} onChange={(event) => updateTemplate1("mapButton", event.target.value)} /></label>
              <label>Text mic dress code<input value={t1.dressKicker} onChange={(event) => updateTemplate1("dressKicker", event.target.value)} /></label>
              <label>Titlu dress code<input value={t1.dressTitle} onChange={(event) => updateTemplate1("dressTitle", event.target.value)} /></label>
              <label>Titlu program<input value={t1.programTitle} onChange={(event) => updateTemplate1("programTitle", event.target.value)} /></label>
              <label>Text mic RSVP<input value={t1.rsvpKicker} onChange={(event) => updateTemplate1("rsvpKicker", event.target.value)} /></label>
              <label>Titlu RSVP<input value={t1.rsvpTitle} onChange={(event) => updateTemplate1("rsvpTitle", event.target.value)} /></label>
              <label>Text footer<input value={t1.footerText} onChange={(event) => updateTemplate1("footerText", event.target.value)} /></label>
              <label>Text dress code<textarea value={t1.dressText} onChange={(event) => updateTemplate1("dressText", event.target.value)} /></label>
            </div>
          </fieldset>
        ) : null}
        {form.invitation_template === "figma-landing" ? (
          <fieldset>
            <legend>Template 2 - Culori și texte</legend>
            <div className="template-customizer-preview" style={{
              "--preview-bg": t2.background,
              "--preview-text": t2.text,
              "--preview-muted": t2.muted,
              "--preview-accent": t2.accent,
              "--preview-card": t2.card,
              "--preview-border": t2.border
            }}>
              <div>
                <span>{t2.heroKicker}</span>
                <strong>{t2.heroTitle}</strong>
                <small>{t2.rsvpKicker} · {t2.rsvpTitle}</small>
              </div>
              <i />
            </div>
            <div className="settings-grid four color-grid">
              <label>Fundal<input type="color" value={t2.background} onChange={(event) => updateTemplate2("background", event.target.value)} /></label>
              <label>Text<input type="color" value={t2.text} onChange={(event) => updateTemplate2("text", event.target.value)} /></label>
              <label>Accent<input type="color" value={t2.accent} onChange={(event) => updateTemplate2("accent", event.target.value)} /></label>
              <label>Bandă jos<input type="color" value={t2.darkBand} onChange={(event) => updateTemplate2("darkBand", event.target.value)} /></label>
              <label>Text secundar<input type="color" value={t2.muted} onChange={(event) => updateTemplate2("muted", event.target.value)} /></label>
              <label>Carduri<input type="color" value={t2.card} onChange={(event) => updateTemplate2("card", event.target.value)} /></label>
              <label>Border<input type="color" value={t2.border} onChange={(event) => updateTemplate2("border", event.target.value)} /></label>
            </div>
            <div className="settings-grid two">
              <label>Text mic hero<input value={t2.heroKicker} onChange={(event) => updateTemplate2("heroKicker", event.target.value)} /></label>
              <label>Titlu hero<textarea value={t2.heroTitle} onChange={(event) => updateTemplate2("heroTitle", event.target.value)} /></label>
              <label>Titlu galerie foto<input value={t2.photosTitle} onChange={(event) => updateTemplate2("photosTitle", event.target.value)} /></label>
              <label>Text mic locație<input value={t2.venueKicker} onChange={(event) => updateTemplate2("venueKicker", event.target.value)} /></label>
              <label>Titlu servicii<input value={t2.servicesTitle} onChange={(event) => updateTemplate2("servicesTitle", event.target.value)} /></label>
              <label>Titlu galerie<input value={t2.galleryTitle} onChange={(event) => updateTemplate2("galleryTitle", event.target.value)} /></label>
              <label>Text mic RSVP<input value={t2.rsvpKicker} onChange={(event) => updateTemplate2("rsvpKicker", event.target.value)} /></label>
              <label>Titlu RSVP<input value={t2.rsvpTitle} onChange={(event) => updateTemplate2("rsvpTitle", event.target.value)} /></label>
            </div>
            <div className="settings-grid three">
              <label>Serviciu 1<input value={t2.serviceOne} onChange={(event) => updateTemplate2("serviceOne", event.target.value)} /></label>
              <label>Serviciu 2<input value={t2.serviceTwo} onChange={(event) => updateTemplate2("serviceTwo", event.target.value)} /></label>
              <label>Serviciu 3<input value={t2.serviceThree} onChange={(event) => updateTemplate2("serviceThree", event.target.value)} /></label>
            </div>
            <div className="settings-grid two">
              <label>Text mic testimonial<input value={t2.testimonialKicker} onChange={(event) => updateTemplate2("testimonialKicker", event.target.value)} /></label>
              <label>Text testimonial<textarea value={t2.testimonialText} onChange={(event) => updateTemplate2("testimonialText", event.target.value)} /></label>
            </div>
            <div className="settings-grid five compact-inputs template-photo-upload-grid">
              {[
                ["photoOne", "Poza 1"],
                ["photoTwo", "Poza 2"],
                ["photoThree", "Poza 3"],
                ["photoFour", "Poza 4"],
                ["photoFive", "Poza 5"]
              ].map(([key, label]) => (
                <label className="file-field template-photo-field" key={key}>{label}
                  <span className="file-picker">
                    <input type="file" accept="image/*" onChange={(event) => uploadTemplatePhoto(event, key)} />
                    <span><ImageUp size={17} />Încarcă</span>
                  </span>
                  {t2[key] ? <img src={t2[key]} alt="" /> : null}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <fieldset>
          <legend>Invitație - Detalii eveniment</legend>
          <div className="settings-grid two">
            <label>Mireasă & Mire<input value={form.couple || ""} onChange={(event) => updateForm({ ...form, couple: event.target.value })} /></label>
            <label>Locație<input value={form.venue || ""} onChange={(event) => updateForm({ ...form, venue: event.target.value })} /></label>
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
          <legend>Invitație - Imagini</legend>
          <div className="settings-grid">
            <label className="file-field">Media sus in pagina ({currentTemplate.resolution})
              <span className="file-picker">
                <input type="file" accept="image/*,video/*" onChange={(event) => uploadHero(event, "hero")} />
                <span><ImageUp size={17} />Încarcă poza sau video sus</span>
              </span>
            </label>
            <label className="file-field">Media jos in pagina ({currentTemplate.secondaryResolution})
              <span className="file-picker">
                <input type="file" accept="image/*,video/*" onChange={(event) => uploadHero(event, "secondary")} />
                <span><ImageUp size={17} />Încarcă poza sau video jos</span>
              </span>
            </label>
          </div>
          {uploadingHero ? <p className="hint">Se încarcă {uploadingHero === "secondary" ? "media de jos" : "media de sus"}...</p> : null}
        </fieldset>

        <fieldset>
          <legend>Invitație - Texte și meniu</legend>
          <label>Text invitație<textarea value={form.invite_intro || ""} onChange={(event) => updateForm({ ...form, invite_intro: event.target.value })} /></label>
          <label>Mesaj WhatsApp<textarea value={form.whatsapp_message || ""} onChange={(event) => updateForm({ ...form, whatsapp_message: event.target.value })} /></label>
          <div className="menu-builder">
            <span>Opțiuni meniu pentru invitați</span>
            <div className="menu-builder-row">
              <input placeholder="Ex: Vita, Peste, Vegetarian" value={menuDraft} onChange={(event) => setMenuDraft(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addMenuOption();
                }
              }} />
              <button type="button" onClick={addMenuOption}><Plus size={17} />Adaugă meniu</button>
            </div>
            <div className="menu-option-list">
              {menuOptions.length ? menuOptions.map((option) => <button key={option} onClick={() => removeMenuOption(option)} type="button">{option}<Trash2 size={14} /></button>) : <small>Adaugă cel puțin un meniu ca invitații să poată alege.</small>}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Invitație - Programul zilei</legend>
          <div className="program-editor">
            {program.map((item, index) => (
              <div className="program-row" key={index}>
                <input value={item.time || ""} placeholder="Ora" onChange={(event) => setProgram(index, "time", event.target.value)} />
                <input value={item.title || ""} placeholder="Moment" onChange={(event) => setProgram(index, "title", event.target.value)} />
                <button type="button" onClick={() => updateForm({ ...form, program: program.filter((_, itemIndex) => itemIndex !== index) })}>Șterge</button>
              </div>
            ))}
            <button type="button" onClick={() => updateForm({ ...form, program: [...program, { time: "", title: "" }] })}>Adaugă moment</button>
          </div>
        </fieldset>
        {saved ? <p className="save-notice"><Check size={18} />Setările au fost salvate.</p> : null}
        <button className="settings-save" type="submit">Salvează setările</button>
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
      <div className="settings-header"><p className="eyebrow">Setări</p><h2>Design platformă și profil</h2></div>
      <form className="settings-form settings-card" onSubmit={submit}>
        <fieldset>
          <legend>Platforma - Design intern</legend>
          <div className="settings-choice-block">
            <span>Tema platformă</span>
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
            <aside><span /> <strong>{form.couple || "Mireasă & Mire"}</strong></aside>
            <main><b>Preview platformă</b><small>Carduri, meniuri și formulare</small></main>
          </div>
        </fieldset>
        <fieldset>
          <legend>Profil</legend>
          <div className="settings-grid two">
            <label>Mireasă & Mire<input value={form.couple || ""} onChange={(event) => updateForm({ ...form, couple: event.target.value })} /></label>
            <label>Locație<input value={form.venue || ""} onChange={(event) => updateForm({ ...form, venue: event.target.value })} /></label>
            <label className="file-field">Poza de profil cu mirii
              <span className="file-picker">
                <input type="file" accept="image/*" onChange={uploadProfile} />
                <span><ImageUp size={17} />Încarcă poza de profil</span>
              </span>
            </label>
          </div>
          {uploadingProfile ? <p className="hint">Se încarcă poza de profil...</p> : null}
        </fieldset>
        {saved ? <p className="save-notice"><Check size={18} />Setările au fost salvate.</p> : null}
        <button className="settings-save" type="submit">Salvează setările</button>
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
        status: payload.guest.status === "În așteptare" ? "Confirmat" : payload.guest.status || "Confirmat",
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
  const locked = saved || data.guest.status !== "În așteptare";
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
      <span>Meniu pentru fiecare persoană</span>
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
      <span><MapPin size={18} />Ceremonie: {wedding.venue || "Locație necompletată"}</span>
      <span><MapPin size={18} />Petrecere: {wedding.venue || "Locație necompletată"}</span>
      <span><Shirt size={18} />{wedding.dress_code || "Dress code liber"}</span>
    </div>
  );
  const programBlock = <div className="timeline">{wedding.program.map((item, index) => <p key={index}><strong>{item.time}</strong><span>{item.title}</span></p>)}</div>;
  const rsvpBlock = locked ? <div className="success-box"><Check size={22} />Răspunsul tău a fost salvat. Mulțumim! Nu mai poate fi modificat din acest link.</div> : (
    <form className="rsvp-form" onSubmit={async (event) => { event.preventDefault(); await api(`/api/invite/${token}`, { method: "POST", body: JSON.stringify(form) }); setSaved(true); }}>
      <label>Răspuns<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Confirmat</option><option>Refuzat</option><option>În așteptare</option></select></label>
      <label>Număr persoane<input type="number" min="1" max="10" value={form.seats} onChange={(event) => updateSeats(event.target.value)} /></label>
      {mealChoiceFields}
      <label>Alergii / restricții<textarea value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} /></label>
      <label>Mesaj pentru miri<textarea value={form.guest_message} onChange={(event) => setForm({ ...form, guest_message: event.target.value })} /></label>
      <button type="submit">Trimite răspunsul</button>
    </form>
  );

  const templateProps = { data, details, form, heroStyle, locked, mealChoiceFields, menuOptions, primaryMediaUrl, programBlock, rsvpBlock, setForm, token, updateSeats };
  if (wedding.invitation_template === "figma-landing") return <TemplateTwoFigmaLanding {...templateProps} />;
  return <TemplateOneInvitation {...templateProps} />;
}

function TemplateOneInvitation({ data, details, form, heroStyle, locked, mealChoiceFields, primaryMediaUrl, programBlock, rsvpBlock, setForm, token, updateSeats }) {
  const wedding = data.wedding;
  const design = template1Design(wedding);
  const primaryIsVideo = isVideoUrl(primaryMediaUrl);
  const secondaryMediaUrl = wedding.invite_secondary_image_url || wedding.hero_image_url || "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1400&q=80";
  const secondaryIsVideo = isVideoUrl(secondaryMediaUrl);
  const bottomStyle = secondaryIsVideo ? { background: design.darkOverlay } : { backgroundImage: `linear-gradient(color-mix(in srgb, ${design.darkOverlay} 72%, transparent), color-mix(in srgb, ${design.darkOverlay} 58%, transparent)), url(${secondaryMediaUrl})` };
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
    <main className="tpl1-page" style={{
      "--tpl1-bg": design.background,
      "--tpl1-text": design.text,
      "--tpl1-muted": design.muted,
      "--tpl1-accent": design.accent,
      "--tpl1-card": design.card,
      "--tpl1-border": design.border,
      "--tpl1-overlay": design.darkOverlay
    }}>
      <section className="tpl1-hero" style={heroStyle}>
        {primaryIsVideo ? <video className="tpl1-hero-media" src={primaryMediaUrl} autoPlay muted loop playsInline /> : null}
        <div className="tpl1-hero-content">
          <p className="tpl1-topline">{design.heroKicker}</p>
          <h1>{wedding.couple}</h1>
          <p className="tpl1-meta">{dateLabel(wedding.wedding_date)}{wedding.wedding_time ? ` - ${wedding.wedding_time}` : ""}</p>
          <div className="tpl1-countdown">
            <div><span>{String(days).padStart(2, "0")}</span><small>Zile</small></div>
            <div><span>{String(hours).padStart(2, "0")}</span><small>Ore</small></div>
            <div><span>{String(minutes).padStart(2, "0")}</span><small>Min</small></div>
            <div><span>{String(seconds).padStart(2, "0")}</span><small>Sec</small></div>
          </div>
        </div>
        <a className="tpl1-scroll" href="#details"><span />{design.scrollText}</a>
      </section>

      <section className="tpl1-section" id="details">
        <div className="tpl1-title"><span>{design.detailsKicker}</span><h2>{wedding.venue || design.detailsTitle}</h2></div>
        <article className="tpl1-card tpl1-invite-card">
          <p className="eyebrow">Pentru {data.guest.name}</p>
          <p>{wedding.invite_intro}</p>
          {details}
          <a className="tpl1-map" href={mapUrl} target="_blank" rel="noreferrer">{design.mapButton}</a>
        </article>
      </section>

      <div className="tpl1-divider"><img src={appLogo} alt="" /></div>

      <section className="tpl1-section tpl1-section-alt">
        <div className="tpl1-title"><span>{design.dressKicker}</span><h2>{wedding.dress_code || design.dressTitle}</h2></div>
        <div className="tpl1-dress-grid">
          <article className="tpl1-card">
            <h3>Dress code</h3>
            <p>{wedding.dress_code || design.dressText}</p>
          </article>
          <article className="tpl1-card">
            <h3>{design.programTitle}</h3>
            {programBlock}
          </article>
        </div>
      </section>

      <section className="tpl1-rsvp" id="rsvp" style={bottomStyle}>
        {secondaryIsVideo ? <video className="tpl1-rsvp-media" src={secondaryMediaUrl} autoPlay muted loop playsInline /> : null}
        <div className="tpl1-rsvp-overlay" />
        <div className="tpl1-rsvp-inner">
          <div className="tpl1-title light"><span>{design.rsvpKicker}</span><h2>{design.rsvpTitle}</h2></div>
          <article className="tpl1-rsvp-box">
            {locked ? rsvpBlock : (
              <form className="rsvp-form" onSubmit={async (event) => { event.preventDefault(); await api(`/api/invite/${token}`, { method: "POST", body: JSON.stringify(form) }); window.location.reload(); }}>
                <label>Răspuns<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Confirmat</option><option>Refuzat</option></select></label>
                <label>Număr persoane<input type="number" min="1" max="10" value={form.seats} onChange={(event) => updateSeats(event.target.value)} /></label>
                {mealChoiceFields}
                <label>Alergii / restricții<textarea value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} /></label>
                <label>Mesaj pentru miri<textarea value={form.guest_message} onChange={(event) => setForm({ ...form, guest_message: event.target.value })} /></label>
                <button type="submit">Trimite răspunsul</button>
              </form>
            )}
          </article>
        </div>
      </section>

      <footer className="tpl1-footer">{design.footerText}, {wedding.couple} {wedding.wedding_date ? `- ${dateLabel(wedding.wedding_date)}` : ""}</footer>
    </main>
  );
}

function TemplateFigmaLanding({ data, details, form, locked, mealChoiceFields, primaryMediaUrl, programBlock, rsvpBlock, setForm, token, updateSeats }) {
  const wedding = data.wedding;
  const primaryIsVideo = isVideoUrl(primaryMediaUrl);
  const secondaryMediaUrl = wedding.invite_secondary_image_url || wedding.hero_image_url || "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1600&q=80";
  const secondaryIsVideo = isVideoUrl(secondaryMediaUrl);
  const mapUrl = wedding.map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wedding.venue || "")}`;
  const heroStyle = primaryIsVideo ? {} : { backgroundImage: `linear-gradient(rgba(18, 20, 18, .32), rgba(18, 20, 18, .12)), url(${primaryMediaUrl})` };
  return (
    <main className="figma-wedding-page">
      <section className="figma-landing-hero" style={heroStyle}>
        {primaryIsVideo ? <video className="figma-template-media" src={primaryMediaUrl} autoPlay muted loop playsInline /> : null}
        <nav><span>{wedding.couple}</span><a href="#rsvp">RSVP</a></nav>
        <div className="figma-landing-copy">
          <p>We're getting married</p>
          <h1>{wedding.couple}</h1>
          <span>{dateLabel(wedding.wedding_date)}{wedding.wedding_time ? ` · ${wedding.wedding_time}` : ""}</span>
        </div>
      </section>

      <section className="figma-story-section">
        <article>
          <p className="figma-kicker">Invitație</p>
          <h2>{wedding.venue || "Ziua noastră specială"}</h2>
          <p>{wedding.invite_intro}</p>
          {details}
          <a href={mapUrl} target="_blank" rel="noreferrer">Vezi locația</a>
        </article>
        <figure>
          {secondaryIsVideo ? <video src={secondaryMediaUrl} autoPlay muted loop playsInline /> : <img src={secondaryMediaUrl} alt="" />}
        </figure>
      </section>

      <section className="figma-program-section">
        <div>
          <p className="figma-kicker">Program</p>
          <h2>Momentele zilei</h2>
        </div>
        {programBlock}
      </section>

      <section className="figma-rsvp-section" id="rsvp">
        <div>
          <p className="figma-kicker">Confirmare</p>
          <h2>Ne spui dacă ajungi?</h2>
        </div>
        <article>
          {locked ? rsvpBlock : (
            <form className="rsvp-form" onSubmit={async (event) => { event.preventDefault(); await api(`/api/invite/${token}`, { method: "POST", body: JSON.stringify(form) }); window.location.reload(); }}>
              <label>Răspuns<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Confirmat</option><option>Refuzat</option></select></label>
              <label>Număr persoane<input type="number" min="1" max="10" value={form.seats} onChange={(event) => updateSeats(event.target.value)} /></label>
              {mealChoiceFields}
              <label>Alergii / restricții<textarea value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} /></label>
              <label>Mesaj pentru miri<textarea value={form.guest_message} onChange={(event) => setForm({ ...form, guest_message: event.target.value })} /></label>
              <button type="submit">Trimite răspunsul</button>
            </form>
          )}
        </article>
      </section>
    </main>
  );
}

function TemplateTwoFigmaLanding({ data, details, form, locked, mealChoiceFields, primaryMediaUrl, rsvpBlock, setForm, token, updateSeats }) {
  const wedding = data.wedding;
  const design = template2Design(wedding);
  const primaryIsVideo = isVideoUrl(primaryMediaUrl);
  const secondaryMediaUrl = wedding.invite_secondary_image_url || wedding.hero_image_url || "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1600&q=80";
  const secondaryIsVideo = isVideoUrl(secondaryMediaUrl);
  const mapUrl = wedding.map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wedding.venue || "")}`;
  const heroStyle = primaryIsVideo ? {} : { backgroundImage: `linear-gradient(rgba(35, 39, 34, .16), rgba(35, 39, 34, .06)), url(${primaryMediaUrl})` };
  const photoGrid = [
    design.photoOne || "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=800&q=80",
    design.photoTwo || "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=800&q=80",
    design.photoThree || "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80",
    design.photoFour || "https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?auto=format&fit=crop&w=800&q=80",
    design.photoFive || secondaryMediaUrl
  ];
  const gallery = [
    primaryMediaUrl,
    secondaryMediaUrl,
    "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=900&q=80"
  ];
  const rsvpForm = locked ? rsvpBlock : (
    <form className="rsvp-form" onSubmit={async (event) => { event.preventDefault(); await api(`/api/invite/${token}`, { method: "POST", body: JSON.stringify(form) }); window.location.reload(); }}>
      <label>Răspuns<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Confirmat</option><option>Refuzat</option></select></label>
      <label>Număr persoane<input type="number" min="1" max="10" value={form.seats} onChange={(event) => updateSeats(event.target.value)} /></label>
      {mealChoiceFields}
      <label>Alergii / restricții<textarea value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} /></label>
      <label>Mesaj pentru miri<textarea value={form.guest_message} onChange={(event) => setForm({ ...form, guest_message: event.target.value })} /></label>
      <button type="submit">Trimite răspunsul</button>
    </form>
  );

  return (
    <main className="template2-page" style={{
      "--t2-bg": design.background,
      "--t2-text": design.text,
      "--t2-muted": design.muted,
      "--t2-accent": design.accent,
      "--t2-band": design.darkBand,
      "--t2-card": design.card,
      "--t2-border": design.border
    }}>
      <section className="template2-hero" style={heroStyle}>
        {primaryIsVideo ? <video className="template2-media" src={primaryMediaUrl} autoPlay muted loop playsInline /> : null}
        <nav className="template2-nav">
          <span className="template2-mark">{String(wedding.couple || "EA").slice(0, 2)}</span>
          <div><a href="#photos">{design.photosTitle}</a><a href="#venue">{design.venueKicker}</a><a href="#gallery">{design.galleryTitle}</a><a href="#contact">{design.rsvpKicker}</a></div>
          <small>♡ ◎ ↗</small>
        </nav>
        <div className="template2-hero-copy">
          <p>{design.heroKicker}</p>
          <h1>{design.heroTitle}</h1>
          <span>{wedding.couple} · {dateLabel(wedding.wedding_date)}{wedding.wedding_time ? ` · ${wedding.wedding_time}` : ""}</span>
        </div>
        <div className="template2-wave" />
      </section>

      <section className="template2-photo-section" id="photos">
        <p className="template2-kicker">{design.photosTitle}</p>
        <div className="template2-photo-grid">
          {photoGrid.map((image, index) => (
            <figure key={`${image}-${index}`}><img src={image} alt="" /></figure>
          ))}
        </div>
      </section>

      <section className="template2-featured" id="venue">
        <figure>{secondaryIsVideo ? <video src={secondaryMediaUrl} autoPlay muted loop playsInline /> : <img src={secondaryMediaUrl} alt="" />}</figure>
        <article>
          <p className="template2-kicker">{design.venueKicker}</p>
          <h2>{wedding.venue || "Villa Balbiano"}</h2>
          <p>{wedding.invite_intro}</p>
          {details}
          <a href={mapUrl} target="_blank" rel="noreferrer">Open location</a>
        </article>
      </section>

      <section className="template2-services">
        <p className="template2-kicker">{design.servicesTitle}</p>
        <div>
          {[design.serviceOne, design.serviceTwo, design.serviceThree].map((title, index) => (
            <article key={title}><img src={gallery[index + 2]} alt="" /><h3>{title}</h3></article>
          ))}
        </div>
      </section>

      <section className="template2-gallery" id="gallery">
        <p className="template2-kicker">{design.galleryTitle}</p>
        <div>{gallery.map((image, index) => <img src={image} alt="" key={`${image}-${index}`} />)}</div>
      </section>

      <section className="template2-testimonial">
        <p>{design.testimonialKicker}</p>
        <blockquote>„{design.testimonialText}”</blockquote>
        <span>{wedding.couple}</span>
      </section>

      <section className="template2-contact" id="contact">
        <article>
          <p className="template2-kicker">{design.rsvpKicker}</p>
          <h2>{design.rsvpTitle}</h2>
          {rsvpForm}
        </article>
        <aside>
          <div className="template2-map">MAP</div>
          <strong>{wedding.venue || "Wedding venue"}</strong>
          <span>{wedding.venue_address || "Adresa se completează din setări"}</span>
          <a href={mapUrl} target="_blank" rel="noreferrer">Deschide harta</a>
        </aside>
      </section>
    </main>
  );
}

function TemplateSimpleWedding({ data, details, form, locked, mealChoiceFields, primaryMediaUrl, programBlock, rsvpBlock, setForm, token, updateSeats }) {
  const wedding = data.wedding;
  const primaryIsVideo = isVideoUrl(primaryMediaUrl);
  const mapUrl = wedding.map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wedding.venue || "")}`;
  return (
    <main className="simple-wedding-page">
      <section className="simple-wedding-hero">
        <div>
          <p>Wedding invitation</p>
          <h1>{wedding.couple}</h1>
          <span>{dateLabel(wedding.wedding_date)}{wedding.wedding_time ? ` · ora ${wedding.wedding_time}` : ""}</span>
          <a href="#simple-rsvp">Confirmă prezența</a>
        </div>
        <figure>
          {primaryIsVideo ? <video src={primaryMediaUrl} autoPlay muted loop playsInline /> : <img src={primaryMediaUrl} alt="" />}
        </figure>
      </section>

      <section className="simple-wedding-card">
        <p className="figma-kicker">Pentru {data.guest.name}</p>
        <h2>{wedding.venue || "Vă așteptăm cu drag"}</h2>
        <p>{wedding.invite_intro}</p>
        {details}
        <a href={mapUrl} target="_blank" rel="noreferrer">Deschide locația</a>
      </section>

      <section className="simple-wedding-grid">
        <article>
          <h3>Program</h3>
          {programBlock}
        </article>
        <article>
          <h3>Dress code</h3>
          <p>{wedding.dress_code || "Elegant, confortabil, potrivit pentru o seară de poveste."}</p>
        </article>
      </section>

      <section className="simple-rsvp-card" id="simple-rsvp">
        <h2>Confirmare RSVP</h2>
        {locked ? rsvpBlock : (
          <form className="rsvp-form" onSubmit={async (event) => { event.preventDefault(); await api(`/api/invite/${token}`, { method: "POST", body: JSON.stringify(form) }); window.location.reload(); }}>
            <label>Răspuns<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Confirmat</option><option>Refuzat</option></select></label>
            <label>Număr persoane<input type="number" min="1" max="10" value={form.seats} onChange={(event) => updateSeats(event.target.value)} /></label>
            {mealChoiceFields}
            <label>Alergii / restricții<textarea value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} /></label>
            <label>Mesaj pentru miri<textarea value={form.guest_message} onChange={(event) => setForm({ ...form, guest_message: event.target.value })} /></label>
            <button type="submit">Trimite răspunsul</button>
          </form>
        )}
      </section>
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
        <div className="media-upload-icon"><img src={appLogo} alt="" /></div>
        <p className="eyebrow">Albumul nuntii</p>
        <h1>{data.wedding.couple}</h1>
        <p className="invite-copy">Încarcă aici pozele și video-urile tale de la eveniment.</p>
        {saved ? <div className="success-box"><Check size={22} />Fișierele au fost încărcate. Mulțumim!</div> : (
          <form className="rsvp-form" onSubmit={submit}>
            <label>Numele tău<input value={guestName} onChange={(event) => setGuestName(event.target.value)} /></label>
            <label className="file-field">Poze / video
              <span className="file-picker upload-picker">
                <input multiple accept="image/*,video/*" type="file" onChange={(event) => setFiles(event.target.files)} />
                <span><ImageUp size={18} />{prettyFileLabel(files, "Alege poze sau video-uri")}</span>
              </span>
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button type="submit"><ImageUp size={18} />Încarcă fișiere</button>
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

