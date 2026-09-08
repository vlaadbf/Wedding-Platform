# NuntaNoastră — plan și arhitectură

## Decizii înainte de implementare

Aplicație React 19 / TypeScript, backend Vinext în Cloudflare Workers, D1 (SQLite) pentru date și R2 pentru fișiere private. Versiunile sunt cele fixate de generatorul Sites 0.3.0; Vinext este beta în acest mediu, deci nu pretindem că întregul stack este stabil. Numele, limba, moneda și fusul orar sunt configurabile. UI ivory, titluri serif, verde salvie, navigație persistentă; dashboardul este suprafața de lucru principală.

## Model și izolare

User → WorkspaceMembership → Workspace → Event → EventMembership. Resursele fiecărui eveniment sunt entități tipizate și validate pe server: Household, Guest, SubEvent, RSVPResponse, InvitationTemplate, Table, SeatAssignment, MenuOption, Expense, PaymentSchedule, Payment, Refund, Contribution, Vendor, Task, TimelineItem, TransportRoute, Accommodation, CheckIn, Notification, Comment. Fiecare are ID, event_id, version, timestamps, autor și ștergere logică. Legăturile între resurse au chei străine compuse (event_id, id); validarea domeniului verifică tipul țintei. Payloadurile JSON au un registru de scheme explicit în cod; aceasta este o alegere de stocare pentru un monolit modular, nu câte un tabel separat pentru fiecare tip.

Tabele separate: utilizatori, sesiuni, tokenuri de cont, spații de lucru, membri, evenimente, membri de eveniment, entități, relații, tokenuri RSVP, joburi, mesaje, încercări, webhookuri, audit și documente. O revizie a evenimentului protejează tranzacțiile concurente: clientul trimite versiunea văzută; o tranzacție cu versiune depășită primește 409. Operațiunile multiple folosesc D1 batch atomic.

## Acces

Proprietar: toate operațiunile propriului spațiu; coorganizator / planner: evenimentele atribuite; financiar: buget, plăți, furnizori; recepție: nume, RSVP, loc și check-in; colaborator: module și acțiuni explicite; furnizor: exclusiv resurse partajate. Invitatul este autorizat prin token aleatoriu revocabil, păstrat numai ca hash. Conturile demo au date proprii și transport extern interzis. Administratorul platformei nu are acces implicit la evenimente.

## Etape și fluxuri verificabile

1. Autentificare, spații de lucru, evenimente, membri, familii, invitați, import cu previzualizare și export.
2. Editor / publicare versiuni invitații, tokenuri, RSVP individual pe subeveniment, campanii, coadă persistentă, adaptori.
3. Mese / atribuiri cu limite și concurență, meniuri și export pentru locație.
4. Furnizori, estimări, contractat, scadențe, plăți manuale și rambursări exacte.
5. Sarcini, Kanban, calendar, program, notificări, audit.
6. Integrări condiționate de configurare, transport, cazare, check-in idempotent.
7. Rapoarte, teste de izolare / concurență / finanțe / RSVP / coadă, documentație și publicare privată.

## Reguli

- Persoana și familia sunt distincte. RSVP și livrarea sunt distincte. Importul nu unește automat persoane.
- Banii sunt numere întregi în unități minore. Monedele nu se însumează între ele.
- Nicio livrare sau plată externă nu este declarată reușită fără dovadă. Stările demo sunt etichetate simulări.
- Joburile sunt persistente; expedierea cere activare explicită și reevaluează eligibilitatea. Rezultatul incert nu se reîncearcă orbește.
- Etichetele și documentația de lansare vor descrie exact limitele implementării și dependențele de configurare.

## Demonstrație finală

Test API: creare eveniment → import familie → publicare invitație → programare → RSVP → indicatori → repartizare → avans → scadență / notificare → export → check-in; teste separate pentru acces neautorizat, token revocat, versiune veche, capacitate, sume, dubluri și restart / persistență.
