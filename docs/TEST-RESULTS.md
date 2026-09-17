# Rezultatele verificării — 8 septembrie 2026

## Remediere audit L6 — 17 septembrie 2026

Paginarea pentru `GET /records/:kind` rulează acum în SQL cu `COUNT`, `LIMIT` și `OFFSET`; căutarea și filtrarea de stare sunt aplicate înainte de decodare. Pentru invitați, starea RSVP rămâne derivată prin subinterogări corelate, inclusiv cazul `pending`. Rutele pentru echipă, audit, coș, documente, acțiuni de campanie și listarea paginată nu mai încarcă toate entitățile evenimentului înainte de dispatch. Cele 31 de scenarii API generale au rămas verzi după schimbare.

Proba locală D1 a acceptat succesiv importuri de 100, 150, 200, 225, 240, 250, 300, 400 și 500 de rânduri; batch-ul de 500 a terminat în aproximativ 1,95 s în Miniflare. Acest rezultat local nu stabilește limita infrastructurii D1 din producție. Plafonul aplicației rămâne deliberat la 150 de rânduri/import și 150 de familii/campanie, pentru a păstra mutația atomică și marjă pentru statement-urile suplimentare. `tests/batch-limit.mjs` verifică acceptarea a 150 și respingerea a 151.

Cele zece funcții de pagină imbricate în `Planner` au fost mutate în `components/planner/pages/` ca componente React reale, cu props explicite și `memo`. Listele și grupările costisitoare din dashboard, invitații, check-in, sarcini, rapoarte și tabelele generice folosesc `useMemo`. `app.tsx` a scăzut de la aproximativ 4.061 la 3.026 de linii. Eliminarea Tailwind a rămas neaplicată: este pasul opțional al auditului și ar cere rescrierea simultană a celor 15 primitive interactive; raportul risc/câștig nu justifică o posibilă regresie de focus, tastatură sau layout în această remediere.

Verificarea finală în browser a acoperit dashboardul, galeria/editorul cu zece invitații, bugetul, Kanbanul și calendarul sarcinilor, setările cu operatorul/contactul de confidențialitate și ruta publică `/confidentialitate`. Structura, navigarea și conținutul au fost afișate corect, iar consola aplicației nu a raportat erori JavaScript pe aceste trasee.

## Remediere audit L3–L5 — 16 septembrie 2026

L3 a înlocuit scanarea tuturor evenimentelor din procesul automat cu o interogare indexată pentru scadențe. Pe fixture-ul cerut, varianta veche citea 900 de entități, iar selecția nouă a returnat 3 candidate; planul SQLite folosește `entities_schedule_due`. Cele trei ilustrații au primit câte șase variante AVIF/WebP, iar fișierele de 640 px au 22–102 KB. CSP folosește nonce unic și toate scripturile HTML verificate au același nonce; pagina și API-ul au trecut verificarea antetelor. Bootstrap-ul este închis fără secret, limitat și protejat de o revendicare persistentă unică.

L4 a adăugat pagina bilingvă `/confidentialitate`, operator/contact per eveniment, consimțământ condiționat și dovada cu dată + versiune pe entitatea persoanei. Testul RSVP verifică respingerea alergiilor fără consimțământ și persistența dovezii. Textul juridic este marcat explicit ca nevalidat.

L5 a adăugat workflow-ul GitHub Actions cu instalare înghețată, TypeScript, lint, D1 local, toate testele JavaScript, testul Python și buildul complet. Local, lintul are zero erori și avertismentul documentat pentru `Data`; testele rulează secvențial pentru a evita interferența fixture-urilor. CI nu a fost executat încă pe infrastructura GitHub în această copie locală.

## Remediere audit L1–L2 — 16 septembrie 2026

L1 a eliminat 45 de primitive UI nefolosite, scaffoldul Drizzle neutilizat, nouă dependențe orfane și modulul de autentificare mort. Baza locală a fost salvată consistent înainte de curățenie. Lintul a scăzut de la 119 erori la zero erori și un avertisment documentat; TypeScript și buildul complet trec.

L2 adaugă curățarea orară persistentă, retenția pentru date operaționale, ștergerea demo-urilor inactive, limita de 3 demo-uri/oră/IP, plafonul global configurabil și expirarea linkurilor RSVP. Au trecut trei scenarii noi de mentenanță și 31 de scenarii API generale, inclusiv link expirat, QR expirat, link valid și revocarea linkului vechi la o campanie nouă. Valorile de control demo sunt validate și persistate criptat în configurația super adminului.

Testele API trebuie rulate contra serverului local și bazei Miniflare locale; nu sunt teste pentru un deployment extern. Prima rulare API paralelă a produs o interferență între fixture-uri, după care suitele au fost rulate secvențial și au trecut.

---

## Actualizare — 10 septembrie 2026

Au trecut toate verificările curente: 30 scenarii API generale, 10 pentru administrare / aprobare, 7 pentru RSVP pe familie, 4 pentru integrări și 12 pentru colecția de invitații. Au trecut și testul geometriei planului, cele 5 verificări SQL / backup, TypeScript și compilarea client / server / Worker. Comanda standard a proiectului `vinext build` a finalizat compilarea; helperul Sites `build-site.mjs` a întâmpinat o eroare de lansare a managerului de pachete pe Windows.

Testele colecției verifică zece layouturi distincte în cinci categorii, cele trei fișiere PNG și servirea lor, salvarea și publicarea fiecărui model, păstrarea personalizării și a linkurilor existente, izolarea draftului față de invitația publicată și respingerea unui model / culori invalide. Testul familiei verifică suplimentar trei persoane într-o familie cu două locuri rezervate și notificarea organizatorului. Testele integrărilor verifică autorizarea serverului, persistența criptată, absența secretelor în răspuns, preluarea setărilor de către runtime, concurența și eliminarea explicită. Geometria planului acoperă zoomul, grila, dimensiunile elementelor, limitele și pașii de tastatură.

Nu au fost folosite credențiale reale ale furnizorilor și nu au fost trimise mesaje externe. Imaginile generate au fost inspectate individual. Acest set de modificări nu a inclus testare vizuală sau interacțiuni în browser. Modificările sunt locale.

---

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
# Actualizare: aprobarea conturilor — 9 septembrie 2026

Verificat local: 9 scenarii noi în `tests/approval.mjs`, toate cele 30 de scenarii API existente, cele 5 verificări SQL/backup, TypeScript și compilarea completă au trecut. Scenariile noi acoperă starea inițială pending, ignorarea rolurilor falsificate la înregistrare, blocarea API-urilor private înainte de aprobare, interzicerea administrării pentru demo și utilizatori obișnuiți, filtrarea datelor sensibile, aprobarea și respingerea, auditul, deciziile concurente, recuperarea parolei fără aprobare implicită și activarea administratorului cu token de unică folosință. Nu a fost efectuată o verificare vizuală în browser pentru această modificare. Modificările și configurarea administratorului sunt locale; nu a fost efectuată publicarea.

## Actualizare: navigare în conturi și RSVP pe familie

Au trecut 46 de scenarii API: 30 existente, 10 pentru aprobare/administrare și 6 pentru RSVP pe familie. Testul suplimentar de administrare verifică vizualizarea evenimentelor clientului ales, respingerea accesului la alte conturi sau a mutațiilor și păstrarea identității administratorului. Testele familiei verifică invitația fără persoane predefinite, capacitatea, apartenența persoanelor și momentelor, numele duplicate, crearea adulților/copilor și RSVP, actualizarea fără dubluri, refuzul inclusiv fără persoane și eligibilitatea reminderelor. TypeScript, compilarea completă și verificarea diferențelor au trecut. Pagina de așteptare folosește verificare automată la 5 secunde. Nu s-a efectuat testare vizuală în browser pentru acest set de modificări. Livrarea rămâne locală.
