# Publicare pe Render

Serviciul existent `Wedding-Platform` construiește ramura `main` cu `npm install && npm run build` și pornește aplicația prin `npm start`.

La pornire, `scripts/render-start.mjs` aplică migrațiile D1 locale din `drizzle/`, apoi pornește Worker-ul Vinext pe `0.0.0.0:$PORT`. Baza D1 și obiectele R2 locale folosesc directorul din `DATA_DIR`.

## Variabile obligatorii

- `APP_ORIGIN`: URL-ul public al serviciului.
- `CONFIG_ENCRYPTION_KEY`: valoare aleatoare de cel puțin 32 de octeți, păstrată stabil pentru a putea decripta setările integrărilor.
- `BOOTSTRAP_SECRET`: secret folosit numai de inițializarea serverului. Pe Render Free rămâne configurat pentru a putea recrea administratorul după pierderea discului efemer; cu un Persistent Disk se poate elimina după activare împreună cu variabilele `SUPER_ADMIN_*`.
- `SUPER_ADMIN_EMAIL` și `SUPER_ADMIN_PASSWORD`: pe Render Free, recreează automat și idempotent administratorul când baza efemeră pornește goală. Dacă administratorul există deja, parola nu este modificată.

## Persistență

Pe instanța Render Free, sistemul de fișiere este efemer. Aplicația funcționează, însă conturile, evenimentele, RSVP-urile și fișierele se pot pierde când serviciul repornește, este suspendat sau este redeployat. Pentru date reale, atașează un Persistent Disk și setează `DATA_DIR=/var/data`, apoi verifică backupul și restaurarea înainte de lansare.
