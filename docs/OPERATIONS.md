# Operare, deploy și recuperare

## Build și hosting

`pnpm build` generează Worker-ul în `dist/server`, activele client și metadata `.openai`. Proiectul are D1 `DB` și R2 `FILES`. Manifestul păstrează numai identificatorul Sites și bindingurile logice. Migrațiile din `drizzle` sunt incluse în arhiva de deployment. Nu publica `.dev.vars`, baze locale, backupuri sau sesiuni.

Publicarea inițială este privată. Aceasta este utilă pentru validarea de către proprietar, dar **portalul RSVP nu este accesibil invitaților externi cât timp bariera de acces Sites rămâne privată**. Pentru o lansare externă este necesară o decizie explicită privind audiența, verificarea autorizării aplicației, configurarea emailului / schedulerului și validarea politicilor de date. Nu schimba accesul public doar pentru a permite joburilor să funcționeze.

Pentru găzduire proprie Cloudflare: creează D1 și R2, înlocuiește bindingurile în configurația de deployment, aplică migrarea SQL pe baza nouă, configurează secretele serverului, publică artefactul Worker generat și setează schedulerul. Vinext din scaffold este beta; testează compatibilitatea runtime-ului înainte de promovarea unei versiuni.

## Backup local

Fișierul SQLite local se află sub `.wrangler/state/v3/d1`. Folosește o copie consistentă, nu copia arbitrar fișierul când baza WAL este deschisă:

```powershell
python scripts/backup.py PATH_TO_DB.sqlite outputs/backup-2026-09-08.sqlite
```

Scriptul folosește API-ul online backup SQLite, refuză suprascrierea și verifică `PRAGMA integrity_check`. Pentru restaurare: oprește serverul, restaurează într-un mediu nou, rulează integrity_check și verifică utilizatorii, evenimentele, relațiile și soldurile; schimbă sursa activă numai după verificare. Testul `tests/database.py` execută efectiv backup și redeschiderea copiei cu verificarea datelor și a reviziei.

## Backup de producție

Configurează exporturi D1 și recuperare prin mecanismele furnizorului. R2 trebuie salvat separat împreună cu cheia obiectelor și metadatele documentelor. Protejează backupurile ca date private, cu acces limitat și retenție definită. Testează restaurarea într-o bază nouă și într-un bucket separat; testează autorizarea înainte de redeschiderea accesului. Backupurile automate de producție nu au fost configurate în această livrare.

## Monitorizare

- `/api/health`: disponibilitatea procesului (nu certifică toate integrările).
- `jobs`: status unknown / failed / unconfigured și due_at mult depășit.
- `message_attempts`: numărul încercărilor și coduri fără secrete.
- `webhook_events`: identificatori deduplicați; corelează `provider_id` din joburi.
- `audit`: operațiuni, actor, resursă, revizii și istoric de schimbare. Auditul poate conține date personale; accesul este restricționat.
- `scripts/jobs.mjs`: loghează timestamp și status HTTP, nu cheia.

Alertele către un operator, reconcilierea automată la furnizor și monitorizarea externă nu sunt configurate. Un job `unknown` necesită verificare la furnizor înaintea unei retrimiteri.

## Date și retenție

Ștergerea operațională este logică și recuperabilă. Aceasta **nu este** ștergere definitivă a datelor personale. Exporturile autorizate sunt disponibile pe module. O procedură completă de export/ștergere de cont și retenție automată după eveniment rămâne de implementat. Până atunci, administratorul bazei trebuie să gestioneze cererile într-o procedură documentată și verificată, inclusiv backupurile și fișierele R2.
