# Plan de remediere — audit NuntaNoastră

Document de lucru pentru agentul executant. Fiecare lot (L1–L6) este un PR separat.
Nu trece la lotul următor până nu trec verificările din lotul curent.

**Verificare standard după fiecare lot** (serverul local pornit cu `pnpm dev`):

```
pnpm exec tsc --noEmit
pnpm lint
node tests/e2e.mjs
node tests/approval.mjs
node tests/family-rsvp.mjs
node tests/invitation-templates.mjs
node tests/integrations.mjs
node tests/floor-geometry.mjs
python tests/database.py
pnpm build
```

**Reguli generale**

- Nu modifica modelul de permisiuni (`lib/domain.ts` `permission()`), `authorize()` din
  `server/store.ts`, triggerul `event_revision_guard`, verificările CSRF din `server/api.ts:140`
  sau validarea semnăturilor webhook. Sunt corecte.
- Migrațiile SQL se adaugă ca fișiere noi în `drizzle/` (`0003_…`, `0004_…`), numerotate
  crescător, și se înregistrează în `drizzle/meta/_journal.json`. **Nu edita migrații existente.**
- Actualizează `docs/LIMITATIONS.md` și `docs/TEST-RESULTS.md` la finalul fiecărui lot.

---

## L1 — Curățenie (S3, S4, S6, S1, S2)

Risc: mic. Fără schimbări de comportament. Scopul e reducerea suprafeței înainte de restul.

### S3 — șterge cod mort

- Șterge `app/chatgpt-auth.ts` (90 linii, zero importuri în tot proiectul).

### S4 — elimină fantoma Drizzle

Tot accesul la date trece prin `stmt()` din `server/store.ts`. `db/schema.ts` este literalmente
`export {}`, iar `getDb()` nu este apelat nicăieri.

- Șterge `db/index.ts`, `db/schema.ts`, `drizzle.config.ts`.
- Scoate `drizzle-orm` și `drizzle-kit` din `package.json`; scoate scriptul `db:generate`.
- **PĂSTREAZĂ** `db/env.d.ts` — conține `declare namespace Cloudflare { interface Env { DB: D1Database } }`.
  Mută-l în rădăcină ca `env.d.ts` și verifică cu `tsc --noEmit` că tipurile încă se rezolvă.
- Adaugă `FILES: R2Bucket` în aceeași declarație (azi funcționează doar prin castul `any` din
  `bindings()`, ceea ce ascunde erori).
- `drizzle/*.sql` și `drizzle/meta/_journal.json` **rămân** — sunt migrațiile reale, scrise de mână.

### S6 — curăță arborele de lucru

- Șterge local `dist/`, `.wrangler/`, `tsconfig.tsbuildinfo`, `work/`, `outputs/`.
  Sunt deja în `.gitignore`. `dist/.openai/drizzle/` conține o copie veche a migrațiilor
  care poate deruta.
- Atenție: ștergerea `.wrangler/` distruge baza D1 locală. Fă întâi backup dacă ai date
  de păstrat: `python scripts/backup.py <cale>.sqlite outputs/backup-pre-L1.sqlite`.

### S1 — șterge componentele UI nefolosite

Închidere tranzitivă verificată. **Păstrează exact aceste 15 fișiere** din `components/ui/`:

```
button  input  textarea  checkbox  dialog  alert-dialog  sidebar  table
progress  select  tabs  separator  sheet  skeleton  tooltip
```

(`sidebar` importă `separator`, `sheet`, `skeleton`, `tooltip`; `dialog`, `alert-dialog`
și `sheet` importă `button`.)

**Șterge celelalte 45 de fișiere `.tsx` din `components/ui/`.** Verifică după ștergere că
`grep -rn "components/ui/" app components lib server hooks` nu mai referă niciun fișier absent.

### S2 — scoate dependențele orfane

După S1, aceste pachete nu mai au niciun consumator (verificat):

| pachet | era folosit doar de |
|---|---|
| `recharts` | `components/ui/chart.tsx` |
| `embla-carousel-react` | `components/ui/carousel.tsx` |
| `cmdk` | `components/ui/command.tsx` |
| `input-otp` | `components/ui/input-otp.tsx` |
| `react-resizable-panels` | `components/ui/resizable.tsx` |
| `react-day-picker` | `components/ui/calendar.tsx` |
| `date-fns` | **nimic — zero referințe în tot proiectul** |

Scoate-le din `package.json`, rulează `pnpm install`, apoi verificarea standard.

**NU scoate** `@base-ui/react` — cele 15 primitive păstrate depind de el pentru
comportamentul headless (Select, Dialog, Tabs, Checkbox, Tooltip).

---

## L2 — Retenție și oprirea creșterii necontrolate (A1, A11, A4)

Risc: mediu. Rezolvă B1 și M2 din audit.

### A1 — job de curățare

Adaugă în `server/integrations.ts`, în `tick()`, o etapă de curățare care rulează
**cel mult o dată pe oră** (nu la fiecare tick — folosește un marcaj persistent, de exemplu
un rând în `integration_settings` sau un tabel `maintenance` nou).

Șterge:

- `rate_limits` cu `expires_at < unixepoch()` — coloana există în
  `drizzle/0000_initial.sql:53` dar **nu este citită niciodată**; tabelul crește cu un rând
  per IP × scope × minut, la nesfârșit.
- `sessions` cu `expires_at < now()`.
- `account_tokens` cu `used_at IS NOT NULL` sau `expires_at < now()`.
- `webhook_events` mai vechi de 30 de zile.
- `message_attempts` mai vechi de 90 de zile.
- **Conturi demo inactive**: utilizatori cu `demo=1` fără sesiune activă și cu
  `created_at` mai vechi de 7 zile → șterge utilizatorul, workspace-ul, evenimentul,
  entitățile, joburile, `access_tokens` și auditul aferent.
  Atenție la ordinea ștergerilor din cauza cheilor străine; unele au `ON DELETE CASCADE`,
  altele nu (`workspace_members`, `workspaces`, `access_tokens`, `jobs` prin `event_id`).
  Testează pe o bază locală cu un demo creat intenționat.

`audit` **nu** se curăță automat — poate fi necesar juridic. Adaugă în
`docs/OPERATIONS.md` o procedură manuală de arhivare.

### A11 — limitează crearea de conturi demo

`POST /api/auth/demo` (`server/auth.ts:99`) e neautentificat și declanșează
`createEvent(..., populateDemo=true)` (`server/api.ts:185`) care scrie ~120 de persoane
plus mese, joburi și RSVP-uri. Rata curentă e 15/minut/IP.

- Coboară limita dedicată pentru scope-ul `demo` la 3/oră/IP (scope separat de `auth`).
- Adaugă un plafon global: dacă există deja peste N conturi demo active (propunere: 200),
  răspunde 503 cu mesaj explicit în română, în loc să mai creezi unul.
- Ambele valori configurabile prin `integration_settings`, nu hardcodate.

### A4 — expirarea linkurilor RSVP

Migrație nouă `drizzle/0003_token_expiry.sql`:

- `ALTER TABLE access_tokens ADD COLUMN expires_at TEXT;`
- Backfill: rândurilor existente le pui `created_at + 400 zile` (nu le invalida brusc —
  sunt linkuri deja trimise invitaților).

În cod:

- La emitere (`op === 'invite-link'` și `campaignStatements()` din `server/api.ts`),
  setează `expires_at` = data evenimentului + 30 de zile, sau `now() + 400 zile` dacă
  evenimentul nu are dată.
- În `publicRoute()` (`server/api.ts:1288`) și în verificarea QR de la check-in
  (`server/api.ts:~855`), adaugă `AND (expires_at IS NULL OR expires_at > ?)` la
  interogările pe `access_tokens`.
- În `campaignStatements()`, revocă tokenurile anterioare ale familiei înainte de a emite
  unul nou (`UPDATE access_tokens SET revoked_at=? WHERE event_id=? AND household_id=?
  AND revoked_at IS NULL`). Azi se acumulează linkuri valide la infinit.

Adaugă scenarii în `tests/e2e.mjs`: token expirat → 404; token vechi revocat după campanie
nouă → 404; token valid → 200.

---

## L3 — Scalabilitate și hardening (A2, A8, A9, A6)

Risc: mediu. A2 este cea mai importantă intervenție de performanță din tot planul.

### A2 — elimină scanul complet al bazei din `tick()`

`server/integrations.ts:254` execută `SELECT id,data FROM events` **fără `WHERE`**, apoi
`rows(event.id)` pentru fiecare eveniment din întreaga bază, o dată pe minut, doar ca să
genereze notificări de scadență. Complexitate O(toate evenimentele × toate entitățile).

Rescrie bucla de scadențe ca **o singură interogare SQL** care aduce doar `schedule`-urile
relevante, fără să încarce entități în JS:

```sql
SELECT s.id, s.event_id, json_extract(s.data,'$.name') AS name,
       json_extract(s.data,'$.due')  AS due,
       json_extract(s.data,'$.expense_id') AS expense_id,
       json_extract(s.data,'$.amount') AS amount
FROM entities s
WHERE s.kind='schedule' AND s.deleted_at IS NULL
  AND json_extract(s.data,'$.due') <= ?        -- now + 7 zile
  AND NOT EXISTS (SELECT 1 FROM entities n
                  WHERE n.id = 'due-' || s.id AND n.event_id = s.event_id)
```

Ultima condiție elimină recalcularea pentru scadențele care au deja notificare
(azi se bazează pe `INSERT OR IGNORE`, dar abia după ce a încărcat tot).

Calculul `paid < due` rămâne per cheltuială, dar îl faci doar pentru rândurile rămase
după filtrul de mai sus — de regulă câteva, nu toate.

Adaugă indexul aferent în migrație nouă:
`CREATE INDEX entities_schedule_due ON entities(kind, json_extract(data,'$.due')) WHERE kind='schedule' AND deleted_at IS NULL;`

Adaugă și un index pe `entities(event_id, kind)` dacă profilarea arată că `rows()` e lent.

Măsoară înainte/după: numărul de rânduri citite per tick, cu 3 evenimente și 300 de entități
fiecare. Notează cifrele în `docs/TEST-RESULTS.md`.

### A8 — imaginile invitațiilor

`public/invitation-art/` conține 7,6 MB în 3 PNG-uri (1,9 / 2,7 / 2,9 MB). Sunt conținutul
principal al paginii pe care o deschid invitații, de regulă pe date mobile.
`loading="lazy"` din `components/planner/invitation-card.tsx:59` nu ajută — imaginea e
above the fold.

- Convertește fiecare imagine în AVIF + WebP, la lățimi 640 / 1280 / 1920.
- Păstrează PNG-ul original doar ca fallback, recomprimat.
- Înlocuiește `<img>` din `invitation-card.tsx` cu `<picture>` + `srcset` + `sizes`.
- Actualizează `lib/invitation-templates.ts` (`invitationArt`) ca să expună setul de variante,
  nu o singură cale.
- Țintă: sub 200 KB pentru varianta servită pe telefon.
- Actualizează `tests/invitation-templates.mjs` — verifică azi existența și servirea celor
  3 fișiere PNG.

### A9 — headere de securitate

Nu există CSP / X-Frame-Options / HSTS nicăieri în proiect (verificat prin grep).
React escapează implicit, deci riscul XSS e mic, dar hardeningul lipsește integral.

Adaugă într-un `public/_headers` (Cloudflare Pages/Workers îl respectă) sau centralizat
în handler:

- `Content-Security-Policy`: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
  Verifică în browser că nu rupe nimic — `'unsafe-inline'` pe style e necesar pentru
  culorile dinamice ale invitațiilor; dacă vrei să-l elimini, trece pe custom properties
  setate prin atribut.
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- Păstrează `X-Content-Type-Options: nosniff` și `Referrer-Policy: no-referrer` care
  există deja pe răspunsurile JSON (`server/api.ts:37`), dar extinde-le la toate răspunsurile.

Portalul RSVP mai face o cerere către Google Maps (`components/planner/rsvp.tsx:165`) —
CSP-ul nu o blochează (e navigare, nu subresursă), dar menționează în nota de
confidențialitate de la L4 că adresa se deschide la un terț.

### A6 — provisioning super-admin în producție

`scripts/provision-admin.mjs` folosește `localDatabase()`, care citește fișierul SQLite
Miniflare din `.wrangler/`. **Pe D1 real nu există cale suportată** — și fără super admin
nu se pot configura integrările, deci aplicația nu funcționează după deploy.

Adaugă `POST /api/admin/bootstrap`:

- Autorizat printr-un secret de mediu `BOOTSTRAP_SECRET` comparat cu `secureEqual()`
  (există deja în `server/auth.ts:44`).
- Refuză dacă există deja vreun utilizator cu `platform_role='super_admin'`.
- Creează contul cu `approval_status='approved'`, fără parolă, și emite un token
  `account_tokens` cu `purpose='setup'`, valabil 1 oră.
- Returnează linkul de activare **o singură dată**, în răspuns. Nu îl loga.
- Adaugă rate limit strict (3/oră) și intrare în `audit`.

Documentează pasul în `docs/OPERATIONS.md`, secțiunea de deploy.
`scripts/provision-admin.mjs` rămâne pentru dezvoltare locală.

---

## L4 — Confidențialitate (A3)

Risc: mediu tehnic, **ridicat juridic**.

Portalul RSVP colectează de la persoane care nu sunt utilizatori ai aplicației: nume,
email, telefon, **alergii alimentare** (`components/planner/family-rsvp.tsx:191`,
`components/planner/rsvp.tsx:237`) și **nevoi de accesibilitate**. Alergiile sunt date
privind sănătatea — categorie specială, GDPR art. 9. Un grep după
„confidențial / prelucrare / consimțământ / GDPR / privacy” în tot UI-ul returnează **zero**
rezultate.

### Partea tehnică (agentul o face)

- Pagină `/confidentialitate` (rută publică, fără autentificare), în română și engleză,
  cu același comutator de limbă ca portalul RSVP.
- În formularul RSVP, înainte de câmpurile de alergii/nevoi: un bloc explicativ scurt plus
  **checkbox de consimțământ explicit**, neprebifat, obligatoriu doar dacă utilizatorul
  completează efectiv alergii sau nevoi. Textul trebuie să spună cine e operatorul,
  în ce scop, cât timp se păstrează și cum se retrage consimțământul.
- Persistă consimțământul: câmp `consent` pe entitatea `guest` (data + versiunea textului),
  ca să fie demonstrabil ulterior.
- Operatorul de date configurabil per eveniment: câmpuri noi în `eventInput()`
  (`server/api.ts:66`) pentru numele și contactul organizatorului, afișate în notă.
- Link către notă în subsolul portalului RSVP și în emailurile de campanie (variabilă
  `{privacy}` în `campaignStatements()`).

### Partea juridică (NU e treabă de agent)

Textul efectiv al notei trebuie redactat sau validat de un avocat. Agentul pune un
**placeholder marcat vizibil** (`<!-- TEXT NEVALIDAT JURIDIC — A SE ÎNLOCUI -->`) și
adaugă în `docs/LIMITATIONS.md` §15 mențiunea explicită că nota există dar nu a fost
validată juridic, și că datele de sănătate intră sub art. 9.

---

## L5 — CI (A7)

Risc: mic.

Nu există niciun fel de CI (fără `.github/`). Cele 7 suite de teste se rulează manual, iar
`.oxlintrc.json` are `typescript/no-explicit-any: "error"` în timp ce codul propriu conține
17 apariții de `any` explicit plus `Data = Record<string, any>` ca fundament al tipurilor —
deci `pnpm lint` fie eșuează, fie nu a fost rulat niciodată. `pnpm lint` **nu apare** în
lista de verificări din `README.md`.

Creează `.github/workflows/ci.yml`:

1. Node 22.13+, pnpm, `pnpm install --frozen-lockfile`.
2. `pnpm exec tsc --noEmit`.
3. `pnpm lint` — **rulează-l întâi local și raportează câte erori sunt**. Nu dezactiva
   regula `no-explicit-any` ca să treacă. Dacă sunt puține, repară-le
   (majoritatea sunt semnături `Promise<any>` care pot deveni `Promise<unknown>` sau tipuri
   concrete). Dacă `Data = Record<string, any>` e imposibil de eliminat rezonabil, coboară
   regula la `"warn"` cu un comentariu care explică de ce, și deschide o notă în
   `docs/LIMITATIONS.md`. Fii explicit în PR despre ce ai ales.
4. Pornește `pnpm dev` în fundal, așteaptă `/api/health`, aplică cele 4 migrații,
   rulează `node scripts/init-integration-key.mjs`, apoi toate suitele `tests/*.mjs`.
5. Python 3.13 pentru `python tests/database.py`.
6. `pnpm build`.

Adaugă `pnpm lint` în lista de verificări din `README.md` — lipsește azi.

Notă: `tests/*.mjs` importă `scripts/local-db.mjs`, care citește fișierul SQLite Miniflare.
Deci testele funcționează doar contra unui `pnpm dev` local, nu contra unui deployment.
Nu schimba asta în acest lot; notează limitarea în `docs/TEST-RESULTS.md`.

---

## L6 — Refactorizări mari (A5, A12, A10, S5)

Risc: mare. **Fiecare punct = PR separat.** Dacă unul merge prost, abandonează-l și
treci mai departe; niciunul nu blochează celelalte.

### A5 — paginare reală (PR propriu)

`server/api.ts:313` execută `const es = await rows(eventId)` înainte de dispatch, deci
**fiecare** cerere pe `/events/:id/*` încarcă toate entitățile evenimentului — inclusiv
`/team`, `/audit`, `/documents` și uploadul de fișiere. Iar `/records` filtrează în JS
**după** ce a încărcat tot (`server/api.ts:~455`): `page` și `size` sunt cosmetice.

- Mută `rows(eventId)` din dispatch în fiecare ramură care chiar are nevoie de el.
  Rutele `/team`, `/audit`, `/trash`, `/documents`, `/job-action` nu au.
- Rescrie `GET /records/:kind` cu `LIMIT`/`OFFSET` în SQL, filtrare pe `kind` în `WHERE`,
  iar căutarea `q` prin `json_extract` sau `data LIKE ?` (azi e
  `JSON.stringify(x.data).toLowerCase().includes(q)` în JS).
- Atenție: filtrul `status` pentru `kind='guest'` derivă din entități `rsvp` corelate,
  nu din câmpul propriu. Are nevoie de un JOIN, nu de o condiție simplă. Păstrează
  comportamentul exact — există teste pe el în `tests/e2e.mjs`.
- `enforce()` și `summary()` continuă să primească setul complet acolo unde e necesar
  pentru validare. Nu sacrifica corectitudinea validării pentru performanță.

### A12 — dimensiunea batch-urilor D1 (PR propriu)

`mutate()` (`server/store.ts:127`) trimite toate statement-urile într-un singur
`db().batch()`. Importul acceptă 500 de rânduri (`server/api.ts:1175`) → cu 3 subevenimente
înseamnă ~2500 de statement-uri. O campanie către 500 de familii → ~1000.
`server/seed.ts:415` știa de problemă și împarte în bucăți de 80; `mutate()` nu.

**Decizie asumată (poate fi schimbată de proprietar):** se păstrează atomicitatea.
Chunking-ul în `mutate()` ar rupe garanția pe care se bazează tot designul cu
`event_revision_guard`, iar compensarea parțială e mai riscantă decât limitele mai mici.

- Coboară plafonul de import de la 500 la **150** de rânduri (`server/api.ts:1175`)
  și actualizează mesajul în română, UI-ul de import și `docs/LIMITATIONS.md` §7.
- Pentru campanii: dacă numărul de familii eligibile depășește ~150, respinge cu un mesaj
  clar care sugerează împărțirea pe segmente, **sau** creează campania în stări succesive
  (`campaign.status='building'` → mai multe `mutate()` → `'queued'`), cu curățare dacă
  procesul se întrerupe. Alege varianta simplă întâi.
- Măsoară întâi limita reală: scrie un test care trimite batch-uri crescătoare până
  eșuează, ca să știi pragul concret al D1 în loc să ghicești. Notează cifra în
  `docs/TEST-RESULTS.md`.

### A10 — spargerea `app.tsx` (PR propriu)

`components/planner/app.tsx` are 4061 de linii, din care ~1293 (liniile 818–2110) sunt
funcții de randare imbricate în `Planner()`: `Dashboard`, `Generic`, `Budget`, `Tasks`,
`Invitations`, `Checkin`, `Reports`, `SettingsPage`, `Team`, `Documents`.

Sunt apelate ca funcții (`Dashboard()`), **nu** ca JSX (`<Dashboard/>`) — deci nu e o
încălcare a regulilor hooks și nu se remontează. Dar nu pot folosi hooks deloc, tot arborele
se re-randează la fiecare tastă, iar cele 45 de apeluri `list(es, …)` din render se
recalculează integral de fiecare dată.

- Extrage fiecare într-un fișier propriu sub `components/planner/pages/`, ca **componentă
  reală**, cu props explicite.
- Convertește apelurile `Dashboard()` în `<Dashboard … />`.
- `React.memo` pe fiecare pagină; `useMemo` pentru derivările `list(es, …)`.
- Fă-le pe rând, verificând vizual după fiecare. Nu toate zece deodată.

### S5 — eliminarea Tailwind (PR propriu, ultimul, opțional)

Codul aplicației folosește ~14 utilitare Tailwind față de 201 clase CSS scrise de mână în
`app/design.css` (3257 linii) + `app/invitations.css` (651). Tailwind există practic doar
pentru cele 15 primitive shadcn rămase după S1.

**Acesta e singurul punct din plan pe care îl poți abandona fără consecințe.** Câștigul e
bundle mai mic și un singur sistem de stilizare în loc de două. Costul e rescrierea celor
15 primitive.

Ordine obligatorie:

1. Rescrie clasele Tailwind din cele 15 primitive păstrate în CSS propriu, mutat în
   `app/design.css`. **Păstrează `@base-ui/react`** — el furnizează comportamentul
   (focus trap, tastatură, ARIA), nu stilul.
2. Verifică vizual fiecare primitivă în browser: dialog, alert-dialog, select, tabs,
   checkbox, sidebar (inclusiv colapsat și pe mobil), sheet, tooltip, table, progress.
3. Abia apoi scoate din `app/globals.css` importurile `tailwindcss`, `tw-animate-css`,
   `shadcn/tailwind.css`, blocul `@theme inline` și `@custom-variant dark`.
4. Scoate din `package.json`: `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css`,
   `shadcn`, `@shadcn/react`, și `class-variance-authority` / `tailwind-merge` dacă
   `lib/utils.ts` (`cn()`) nu mai e folosit. Verifică `clsx` separat — are un consumator
   în afara `components/ui/`.
5. Scoate configurarea PostCSS din `vite.config.ts`.

Dacă la pasul 2 ceva arată rupt și nu se repară în timp rezonabil, **fă revert la tot PR-ul**.
Nu livra o interfață degradată ca să scapi de o dependență.

---

## Ce NU e în plan

- **D10 / rolul `vendor`** rămâne nefuncțional: `shared_ids` nu poate fi setat prin niciun
  endpoint, deci un vendor autentificat nu vede nimic. Recunoscut deja în
  `docs/LIMITATIONS.md` §4. De decis separat dacă se finalizează sau se scoate din UI.
- **D2 (PBKDF2 100k → 600k)**, **D3 (comparații de semnătură non-constant-time)**,
  **D6 (enumerare conturi la register)**, **D7 (verificarea emailului deloghează peste tot)**,
  **D8 (polling la 5s fără backoff)**, **D9 (`grants` nevalidate)**: hardening real, dar
  sub pragul de prioritate al acestui plan. Bune candidate pentru un lot L7.
- **M4** — `runtimeSettings()` (`server/integration-settings.ts:109`) returnează
  `{ ...bindings(), ...stored }`, adică **întreg `env`**. Azi nu se scurge nimic, fiindcă
  toți consumatorii citesc chei individuale. Dar un singur `return await runtimeSettings()`
  viitor într-un handler ar returna fiecare secret al Worker-ului.
  **Merită făcut în L1** dacă ai timp: returnează doar cheile din `integrationFields`.
  E o schimbare de 5 linii cu impact disproporționat.
