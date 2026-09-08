# NuntaNoastră

Aplicație web în română cu backend, bază SQL persistentă, autentificare și control de acces pe eveniment. Include o demonstrație izolată cu 120 de persoane fictive. Numele aplicației se schimbă în Setări.

**Starea livrării:** versiune funcțională de validare a produsului, cu fluxul principal implementat și testat. Nu reprezintă implementarea integrală a tuturor celor 27 de secțiuni din specificație și nu este declarată pregătită pentru lansare comercială. Diferențele sunt inventariate în [LIMITATIONS.md](docs/LIMITATIONS.md).

## Rulare locală

Necesită Node.js 22.13+ (testat cu 24.19), pnpm și, pentru testul SQLite / backup, Python 3.13.

```powershell
pnpm install
pnpm exec wrangler d1 execute DB --local --config "$PWD/wrangler.local.jsonc" --file "$PWD/drizzle/0000_initial.sql"
pnpm dev
```

Deschide adresa indicată de server (implicit http://localhost:3000). Pe Windows folosește căi absolute la `--config` și `--file`. Acestea evită o problemă de rezoluție din Wrangler.

Butonul **Explorează nunta Sofiei & a lui Andrei** creează un cont demo cu cookie HttpOnly și un spațiu propriu. Datele demo se află în baza de date, nu în localStorage. Copiile demo sunt independente; nicio operațiune din ele nu trimite mesaje sau bani reali. La pierderea sesiunii demo se pierde accesul prin interfață, fără a deveni accesibil altui vizitator. Pentru utilizare continuă creează un cont propriu.

## Verificări

Cu serverul local pornit:

```powershell
pnpm exec tsc --noEmit
node tests/e2e.mjs
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

Copiază `.env.example` în `.dev.vars` pentru dezvoltare locală. Nu include credențiale în Git. Pentru găzduire setează valorile în configurația secretă a mediului.

- [Arhitectură și plan](docs/IMPLEMENTATION.md)
- [API](docs/API.md)
- [Integrări și surse oficiale](docs/INTEGRATIONS.md)
- [Deploy, procese de fundal, backup și restaurare](docs/OPERATIONS.md)
- [Ghid pentru organizatori](docs/ORGANIZER-GUIDE.md)
- [Limitări și lucru rămas](docs/LIMITATIONS.md)
