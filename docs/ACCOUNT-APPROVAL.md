# Aprobarea conturilor

Înregistrare → cont `pending` → super adminul aprobă sau respinge → acces la aplicație numai după aprobare. Autentificarea este permisă pentru afișarea stării; fiecare cerere la API-ul privat verifică starea curentă din SQL. Recuperarea parolei și verificarea emailului nu aprobă contul. Invitațiile de echipă nu ocolesc această regulă. Portalul RSVP pentru invitați rămâne public prin linkul personal.

Super adminul intră direct în **Administrare conturi**, fără a crea un eveniment. Poate filtra cererile în așteptare, aprobate și respinse; lista are paginare de 50. Decizia cere confirmarea contului și este salvată împreună cu autorul și data în `account_reviews`, prin trigger SQL. Două decizii concurente asupra aceluiași cont nu se suprascriu. Interfața permite decizii asupra conturilor în așteptare; redeschiderea cererilor respinse și suspendarea conturilor aprobate nu sunt incluse.

Pagina de așteptare verifică automat aprobarea la fiecare 5 secunde, fără buton de verificare. O eroare de conexiune este afișată și verificarea reîncearcă automat. Nu se trimite automat un email de aprobare. Rolul `super_admin` este global și separat de rolul de proprietar al unui eveniment. Rolul nu poate fi cerut prin înregistrare sau editat de un organizator.

Super adminul poate alege **Deschide contul** pentru fiecare client, inclusiv conturi în așteptare sau respinse, apoi naviga prin evenimentele accesibile acelui client. Acest mod este pentru consultare: un indicator permanent arată numele/emailul clientului și butonul de revenire. Sesiunea rămâne a administratorului; nu se creează o sesiune a clientului. API-ul verifică rolul global și limitează consultarea la cereri GET pentru evenimentele clientului ales, respectând permisiunile sale. Modificările sunt respinse. Un client fără evenimente are un ecran gol explicit, fără lansarea formularului de creare. La reîncărcare se revine în administrare.

Demo-ul nu afișează administrarea, nu apare în listele super adminului și primește 403 dacă apelează direct aceste rute. Demo-ul rămâne accesibil cu date fictive; excepția de aprobare se aplică exclusiv acestui spațiu izolat.

## Instalare și configurare inițială

Aplică migrațiile SQL în ordine, o singură dată. `0001_account_approval.sql` este incrementală: toate conturile reale existente devin `pending`, fără ștergerea evenimentelor sau datelor. Administratorul desemnat este configurat separat, prin mentenanță de încredere, niciodată prin „primul cont devine admin”.

Local: `node scripts/provision-admin.mjs adresa-email`. Scriptul accesează exclusiv D1 local din proiect. Pentru un cont existent cu parolă, acordă rolul și aprobarea fără schimbarea parolei. Pentru un cont nou rezervă emailul și rolul, apoi salvează un link cu token aleator de 256 biți în fișierul ignorat `outputs/super-admin-activation.txt`. SQL păstrează doar hashul. Linkul expiră în 24 de ore, poate fi folosit o singură dată și activează accesul după alegerea unei parole de minimum 12 caractere. Nu se expediază email. Nu distribui fișierul de activare.

Configurarea locală nu configurează automat un administrator în găzduire. La publicare, migrațiile și configurarea contului desemnat trebuie aplicate bazei țintă printr-un canal de administrare autorizat. Nu publica un token de activare în cod, migrații sau variabile client.

## API

- `GET /api/me`: include `approval_status` și `platform_role` pentru sesiunea curentă.
- `GET /api/admin/accounts?status=pending&page=1`: exclusiv super admin aprobat, fără conturi demo și fără parole/tokenuri.
- `POST /api/admin/accounts/:id` cu `{ "status": "approved" }` sau `{ "status": "rejected" }`: exclusiv super admin, numai conturi obișnuite în așteptare; conflictele returnează 409.
- Conturile reale neaprobate primesc 403 (`account_pending` / `account_rejected`) pe API-urile private.

Verificări: `node tests/approval.mjs` testează înregistrarea, blocarea accesului, separarea demo/admin, aprobarea/respingerea, concurența, auditul și activarea administratorului. Testele introduc identități fictive exclusiv în baza locală, apoi elimină conturile de test create de această suită.
