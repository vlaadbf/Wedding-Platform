# API

Toate endpointurile sunt sub `/api`. JSON UTF-8. Autentificare prin cookie `nn_session`, HttpOnly, SameSite=Lax, Secure pe HTTPS, expirare la 7 zile. Datele de eveniment sunt autorizate pe server. Nicio cheie de integrare nu ajunge în browser.

Erori: `{ "error": { "code": "version_conflict", "message": "…", "correlation": "uuid" } }`. Coduri: 400 validare, 401 neautentificat, 403 fără permisiune, 404 indisponibil, 409 conflict / duplicat, 413 prea mare, 429 limitat, 503 integrare neconfigurată. Erorile interne nu expun excepții brute.

## Cont și sesiuni

| Metodă / rută | Conținut / rezultat |
|---|---|
| GET `me` | Utilizatorul curent sau null |
| POST `auth/register` | name, email, password (12–256 caractere) |
| POST `auth/login` | email, password |
| POST `auth/demo` | Spațiu privat cu persoane fictive; cookie nou |
| POST `auth/logout` | Închide sesiunea curentă |
| POST `auth/recover` | email; necesită email configurat |
| POST `auth/verify` | Trimite verificare contului curent |
| POST `auth/consume` | token și parola nouă pentru recuperare |
| GET / DELETE `sessions` | Listează / închide toate sesiunile proprii |

## Evenimente și resurse

`GET events`: evenimentele autorizate, cu metadate minime. `POST events`: name, partner1, partner2, date opțională, timezone, city, venue, expected, budget (bani întregi), currency, language și opțional workspace_id. Fără workspace_id se creează un spațiu nou. Cu workspace_id trebuie să fii proprietarul acelui spațiu.

`GET events/:event`: date, entități autorizate, rol, permisiuni, indicatori calculați și mesaje. Recepția primește numai nume, familie, categorie, RSVP, mese și sosiri. Nu primește emailuri, alergii sau bani.

`PATCH events/:event`: setări + version. Schimbarea datei nu mută automat termenele sarcinilor existente.

`GET events/:event/records/:kind?q=&status=&page=1&size=25`: paginare (maxim 100 / pagină), căutare și filtru de stare. `POST` pentru creare și `PATCH .../:id` pentru editare: `{version, data}`. `DELETE .../:id`: `{version}` pentru ștergere logică. Schema fiecărui `kind` este în `lib/domain.ts`.

Mutațiile primesc revizia evenimentului din ultimul GET. Succesul întoarce `{ok,id,version}`. Revizia este verificată de trigger SQL în aceeași tranzacție D1 batch cu scrierile și auditul. La 409 reîncarcă și cere reaplicarea intenției. Nu reîncerca orbește.

`POST events/:event/import`: rows, preview, duplicate_policy (`skip`, `create`, `update`), matches (identificator ales explicit pentru fiecare rând de actualizat), key și version. Preview întoarce erori și posibile duplicate pe rând. Maximum 150 persoane; întregul import valid se aplică atomic. Cheia trebuie refolosită pentru aceeași încercare; repetarea unei mutații deja înregistrate produce 409 fără duplicate.

`GET events/:event/export?kind=guest&q=&status=&format=csv|xlsx`: filtre și permisiuni de export. CSV neutralizează formulele. XLSX stochează valori ca text, nu formule. Fișierul invitaților include numele mesei, locul și RSVP pentru recepție.

## Invitații, RSVP și mesaje

- `POST .../publish`: id invitație, version. Copiază draftul în versiunea publicată a evenimentului; păstrează tokenurile.
- `POST .../invite-link`: household_id, version, revoke opțional. Creează token aleatoriu pe 256 biți și întoarce URL-ul; se stochează numai hashul tokenului de acces.
- `POST .../revoke-links`: household_id, version. Revocă toate linkurile familiei.
- `GET public/:token`: doar familia autorizată, membrii ei, subevenimentele permise, meniurile și designul publicat; fără note interne.
- `POST public/:token`: version, responses (`guest_id`, `subevent_id`, `status`), guests (preferințe), companions (nume). Respectă termenul local, lista de persoane, momentele permise și limita însoțitorilor. Repetările nu dublează răspunsurile.
- `POST .../campaigns`: preview pentru verificarea eligibilității; la lansare name, channel, type, message, date, time, activate:true, version. Tipuri: invitation, rsvp_reminder, logistics, thanks.
- `POST .../job-action`: campaign_id, action (`pause`, `resume`, `cancel`), version. Afectează doar mesaje neexpediate.
- `POST .../process-demo`: procesează numai simulările scadente și notificările interne de scadență. Fără expediere externă.
- `POST jobs`: Authorization: Bearer JOB_SECRET; pentru scheduler, nu browser. Procesează maximum 20 joburi per apel.
- `POST webhooks/resend`, `POST webhooks/twilio`: semnături validate, procesare idempotentă, stări terminale protejate.

## Plan, check-in, documente și colaborare

- `GET .../floor`: versiuni salvate și propuneri. `POST` action save / restore / suggest, cu version. Suggest cere preview, apoi confirm:true. Restaurarea păstrează automat o versiune înainte de schimbare.
- `POST .../checkin`: guest_id sau household_id sau qr, subevent_id, undo opțional, version. QR rezolvă un token valid al aceluiași eveniment. Unicitate pe persoană și subeveniment.
- `GET .../documents`: metadate. `GET .../documents/:id`: descărcare autorizată. `POST` multipart: file și version, maximum 5 MB, PDF / JPG / PNG / TXT, semnătură de fișier verificată.
- `GET/POST/DELETE .../team`: proprietar. POST email, role, grants, version creează link pentru destinatar. Niciun email nu este trimis automat.
- `POST team-accept`: token; contul autentificat trebuie să aibă adresa destinatarului.
- `GET .../audit`, `GET .../trash`, `POST .../restore` (id, version).

API-ul agregat este destinat evenimentelor de dimensiuni moderate. Exporturile, importurile și seed-ul demo nu sunt joburi de mare volum; limita și costul lor trebuie măsurate înainte de utilizare la nivel de agenție.
