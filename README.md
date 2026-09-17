# Planora

Aplicație web în română cu backend, bază SQL persistentă, autentificare și control de acces pe eveniment. Include o demonstrație izolată cu 120 de persoane fictive. Numele aplicației se schimbă în Setări.

**Starea livrării:** versiune funcțională de validare a produsului, cu fluxul principal implementat și testat. Nu reprezintă implementarea integrală a tuturor celor 27 de secțiuni din specificație și nu este declarată pregătită pentru lansare comercială. Diferențele sunt inventariate în [LIMITATIONS.md](docs/LIMITATIONS.md).

## Rulare locală

Necesită Node.js 22.13+ (testat cu 24.19), pnpm și, pentru testul SQLite / backup, Python 3.13.

```powershell
pnpm install
pnpm exec wrangler d1 execute DB --local --config "$PWD/wrangler.local.jsonc" --file "$PWD/drizzle/0000_initial.sql"
pnpm exec wrangler d1 execute DB --local --config "$PWD/wrangler.local.jsonc" --file "$PWD/drizzle/0001_account_approval.sql"
pnpm exec wrangler d1 execute DB --local --config "$PWD/wrangler.local.jsonc" --file "$PWD/drizzle/0002_integration_settings.sql"
pnpm exec wrangler d1 execute DB --local --config "$PWD/wrangler.local.jsonc" --file "$PWD/drizzle/0003_token_expiry.sql"
pnpm exec wrangler d1 execute DB --local --config "$PWD/wrangler.local.jsonc" --file "$PWD/drizzle/0004_hardening.sql"
node scripts/init-integration-key.mjs
pnpm dev
```

Deschide adresa indicată de server (implicit http://localhost:3000). Pe Windows folosește căi absolute la `--config` și `--file`. Acestea evită o problemă de rezoluție din Wrangler.

Butonul **Explorează nunta Sofiei & a lui Andrei** creează un cont demo cu cookie HttpOnly și un spațiu propriu. Datele demo se află în baza de date, nu în localStorage. Copiile demo sunt independente; nicio operațiune din ele nu trimite mesaje sau bani reali. La pierderea sesiunii demo se pierde accesul prin interfață, fără a deveni accesibil altui vizitator. Pentru utilizare continuă creează un cont propriu.

## Verificări

Conturile reale noi necesită aprobarea super adminului. Demo-ul este separat și nu afișează administrarea conturilor. Pentru configurarea inițială locală: `node scripts/provision-admin.mjs adresa-administratorului`. Un cont nou primește un link privat de setare a parolei în `outputs/super-admin-activation.txt`, valabil 24 de ore; un cont existent folosește parola existentă. Nu există parolă implicită și primul utilizator înregistrat nu primește automat drepturi administrative. Migrația `0001` se aplică o singură dată inclusiv pe baza existentă; conturile reale existente vor necesita aprobare. Vezi [fluxul de aprobare](docs/ACCOUNT-APPROVAL.md).

Cu serverul local pornit:

```powershell
pnpm exec tsc --noEmit
pnpm lint
node tests/e2e.mjs
node tests/approval.mjs
node tests/family-rsvp.mjs
node tests/invitation-templates.mjs
node tests/integrations.mjs
node tests/maintenance.mjs
node tests/bootstrap.mjs
node tests/security-headers.mjs
node tests/tick-performance.mjs
node tests/floor-geometry.mjs
python tests/database.py
pnpm build
```

Testele API creează doar date fictive în instanța locală. Nu le executa împotriva unui eveniment real. Vezi [rezultatele verificării](docs/TEST-RESULTS.md).

## Structură

- `app/`: intrarea React, API catch-all și portalul RSVP.
- `components/planner/`: dashboard și module, formulare accesibile, import XLSX, QR.
- `lib/domain.ts`: entități, schemele câmpurilor, validare, roluri, calcule și CSV.
- `server/`: autorizare, autentificare, operațiuni SQL, RSVP, coadă, adaptori, plan de sală, date demo.
- `drizzle/0000_initial.sql`: schema SQL canonică, indexuri și triggerul de concurență.
- `scripts/`: proces de fundal și backup local.
- `docs/`: arhitectură, API, integrări, operare, ghid și limitări.

Registrul entităților folosește payloaduri JSON tipizate și validate, cu relații normalizate în `entity_links` și chei străine compuse. Nu există câte un tabel pentru fiecare concept al specificației. Migrațiile SQL se editează explicit; fișierul Drizzle inițial generat nu reprezintă schema aplicației.

## Configurare și livrare

Copiază `.env.example` în `.dev.vars` doar dacă fișierul local nu există deja. Nu suprascrie cheia generată de `scripts/init-integration-key.mjs`. Nu include credențiale în Git. Pentru găzduire păstrează cheia de criptare în configurația secretă a mediului; cheile furnizorilor se gestionează din **Administrare conturi → Integrări**. Migrațiile se aplică o singură dată, în ordine.

`node scripts/optimize-invitation-art.mjs` regenerează variantele AVIF și WebP ale ilustrațiilor la 640, 1280 și 1920 px. Fișierele rezultate sunt versionate; comanda se rulează după înlocuirea imaginilor sursă.

- [Arhitectură și plan](docs/IMPLEMENTATION.md)
- [API](docs/API.md)
- [Integrări și surse oficiale](docs/INTEGRATIONS.md)
- [Colecția de invitații și imaginile generate](docs/INVITATION-COLLECTION.md)
- [Deploy, procese de fundal, backup și restaurare](docs/OPERATIONS.md)
- [Ghid pentru organizatori](docs/ORGANIZER-GUIDE.md)
- [Limitări și lucru rămas](docs/LIMITATIONS.md)
