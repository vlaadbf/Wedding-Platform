# Rezultatele verificării — 8 septembrie 2026

Mediu: Windows, Node.js 24.19, pnpm 11.19, Python 3.13, Vinext 1.0.0-beta.5, D1 local prin Miniflare. Testele folosesc exclusiv conturi și evenimente fictive create în instanța locală.

| Verificare | Rezultat |
|---|---|
| TypeScript `tsc --noEmit` | Trecut, fără erori |
| Build producție `vinext build` | Trecut (client + server + Worker) |
| `node tests/e2e.mjs` | **30 / 30** verificări API trecute |
| `python tests/database.py` | **5 / 5** verificări SQL și backup/restaurare trecute |
| GET `/` și `/api/me` | HTTP 200 |
| Browser desktop / telefon | Dashboard și module inspectate; fără erori JS în logurile consultate |

## Flux demonstrat efectiv prin API

Creare eveniment fără dată → import 2 persoane în aceeași familie → preview și reimport fără duplicate → personalizare și publicare invitație → programare persistentă cu activare explicită → RSVP pentru persoanele și momentele permise → dashboard actualizat → repartizare la masă → avans de 250,01 RON și rambursare de 5,01 RON → plătit net 245 RON → reminder intern pentru scadență → export CSV și XLSX pentru locație → check-in și QR repetate fără duplicate.

## Riscuri verificate

- Acces neautorizat prin API, referințe între evenimente, export financiar interzis recepției, eliminarea contactelor/alergiilor și din API-ul paginat.
- Familie și persoană separate, avertizare duplicate, contacte invalide cu erori pe rând.
- RSVP în afara familiei/subevenimentului respins, token revocat, anulare eveniment, răspuns repetat fără duplicate.
- Reminder după RSVP exclus chiar înainte de expediere; joburi persistente fără duplicare la procesare repetată.
- Versiune depășită respinsă cu 409 și trigger SQL, fără suprascriere tăcută.
- Loc dublu, persoană în două mese ale aceluiași plan, capacitate depășită; snapshot/restaurare și sugestii.
- Plată parțială, rambursare excesivă respinsă, monede incompatibile și sume fracționare în unități minore respinse.
- Export filtrat; fișier XLSX reîncărcat cu succes și număr de rânduri verificat.
- Check-in individual/familie/QR idempotent, anulare sosire, cod din alt context respins.
- Capacitate transport, CSRF, acces neautorizat la worker și webhookuri neconfigurate.
- Fus orar invalid și ore ambigue/inexistente la schimbarea orei în Europe/Bucharest.
- Copie SQLite consistentă, redeschidere, integrity_check și păstrarea datelor/reviziei.

## Ce nu certifică aceste teste

Nu s-au trimis emailuri/SMS/WhatsApp reale, nu s-au procesat plăți online, nu s-au validat chei reale sau callbackuri semnate de un cont live. Nu există test de plată Stripe reușită/redirecționare, deoarece acea integrare nu este implementată. Nu s-au efectuat audit WCAG complet, testare pe toate dispozitivele, test de încărcare sau restaurare a producției. Scanarea camerei depinde de browser; rezolvarea tokenului QR și idempotența au fost testate prin API. Datele demo nu maschează absența backendului: toate aceste teste au accesat backendul și baza SQL.

Build-ul avertizează despre un chunk client mare (XLSX încărcat dinamic) și clasificarea statică incompletă a rutei `/` în Vinext. Aceste avertizări nu au împiedicat compilarea.
