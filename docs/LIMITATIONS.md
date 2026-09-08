# Limitări cunoscute și diferențe față de specificație

Această listă face parte din livrare. Nu pretindem că toate cerințele inițiale sunt finalizate.

## Implementat și funcțional

- Autentificare cu parolă, sesiuni, verificare / recuperare prin adaptor email, spații și evenimente, membri și roluri, control API și audit.
- Persoane separate de familii, 3 subevenimente inițiale, RSVP separat, date de meniu și nevoi, CRUD, căutare, filtre de răspuns, import CSV/XLSX cu mapare și preview, duplicate explicite, export CSV/XLSX.
- Designuri de invitație, draft / publicare, variante de stil, linkuri opace revocabile, RSVP public în română și parțial engleză, limita însoțitorilor și termen local.
- Campanii și reguli programate persistente, activare explicită, eligibilitate reevaluată, pause/resume/cancel, adaptori Resend și Twilio, webhookuri validate, idempotență și stări corecte, simulări fără transport real.
- Mese cu capacitate, forme, poziții și rotație, mutare pe grilă, persoane prin drag-and-drop sau listă, unicitate pe plan / loc, snapshoturi și restaurare, sugestii cu preview și explicații de conflicte.
- Buget / estimat / contractat / plăți / rambursări / contribuții distincte, sume întregi și validarea monedei, scadențe și notificări interne.
- Furnizori, fișiere private R2, sarcini și Kanban / calendar, program cu suprapuneri, transport / cazare cu capacități, check-in individual / familie / QR idempotent, rapoarte și exporturi.
- Demo SQL cu 120 persoane, teste API și constrângeri SQL, test real de backup / restaurare.

## Depinde de configurare externă

- Email, SMS, WhatsApp: chei, expeditor verificat, șabloane, condiții contractuale, costuri și preferințe de contact.
- Scheduler extern și `JOB_SECRET`: necesare pentru expediere fără browser deschis și notificări automate de scadență.
- R2 și D1 în producție: bindinguri, migrații, backupuri și monitorizare.
- Portalul RSVP pentru invitați externi: necesită o politică de acces a găzduirii care permite intrarea publică la portal. Publicarea privată Sites nu o permite.

## Neimplementat sau parțial

1. **Plăți online:** nici checkout, nici Stripe Connect, nici reconciliere financiară online. Nu există un adaptor de plată utilizabil. Nu se stochează carduri și nu se prezintă tranzacții fictive drept încasări.
2. **MFA:** nu există autentificare suplimentară TOTP / passkeys, coduri de recuperare sau gestiune individuală a dispozitivelor. Verificarea emailului și recuperarea nu au fost testate cu un furnizor real.
3. **Modelul complet de date:** folosește un registru tipizat în `entities`, nu toate cele 50 de tabele distincte solicitate. Serviciile furnizorilor, selecțiile de meniu pe subeveniment, locurile ca entități proprii și unele versiuni de documente nu sunt modelate separat. Meniul persoanei este comun, nu diferit pe fiecare subeveniment.
4. **Roluri avansate:** API-ul acceptă grants pe modul/acțiune și shared_ids pentru furnizori, dar interfața expune doar partener / planner / financiar / recepție. Nu există panou de administrare a platformei sau flux complet pentru partajarea selectivă cu furnizori.
5. **Invitații:** fotografii / galerii, editor tipografic avansat, autosalvare pe server, istoric navigabil al tuturor versiunilor publicate și un calendar public complet nu sunt finalizate. Salvarea progresului la formularele de creare folosește sessionStorage, limitat la sesiunea browserului.
6. **Campanii:** preview-ul include eligibilitatea; testul către organizator, canalele alternative, estimările de cost și o politică completă de contact pe canal nu sunt implementate. Regulile reprezintă programări singulare, nu un motor general de evenimente și repetiții. O regulă dezactivată nu trebuie reactivată cu același ID fără recreare; creează o regulă nouă.
7. **Fiabilitate la volum:** maximum 500 persoane / import, 20 mesaje / rulare; nu există exporturi mari asincrone sau throttling distribuit personalizabil per eveniment. Un apel nou poate începe înaintea finalizării altuia; joburile individuale sunt revendicate atomic. Reconcilierea stărilor `unknown` rămâne manuală. Expedierea are o fereastră fixă 09–20.
8. **Plan sală:** versiuni salvate / restaurare, nu o stivă completă undo/redo; dimensiunile meselor sunt fixe, iar decorul se mută prin formular. Nu există aliniere automată, drag de grup, cartonașe de nume dedicate sau optimizare globală a regulilor. PDF-ul folosește tipărirea browserului, nu un generator PDF de server.
9. **Finanțe:** nu există curs valutar / conversie, plăți online, anulări financiare specializate sau contabilitate de abonamente. Monedele diferite rămân separate; dashboardul însumează numai moneda evenimentului. Scadențele sunt interpretate cumulativ per cheltuială.
10. **Colaborare:** comentariile au date/API, dar nu există un flux complet de mențiuni, atașamente la comentarii, checklist structurat și preferințe individuale pentru notificări. Citit/necitit este deocamdată comun evenimentului. Nu există rezumat periodic.
11. **Calendar:** exportul ICS creează elemente de o zi, cu orele în descriere. Termenele relative nu sunt recalibrate cu preview când se schimbă data. Nu se mută automat termene existente.
12. **Documente:** upload/download și validare conținut, nu versiuni legate ale aceluiași document, preview integrat sau semnătură electronică. Nu există scanare antivirus.
13. **Localizare / accesibilitate:** UI administrativă în română; portal bilingv cu unele etichete/designuri românești. Contrastul și fluxurile principale au fost verificate vizual, fără audit WCAG exhaustiv. Scanarea camerei cere BarcodeDetector; fallback: cititor extern sau căutare.
14. **Offline:** nu este implementat. Interfața semnalează lipsa conexiunii, iar API-ul trebuie să confirme salvarea.
15. **Protecția datelor / operare:** retenție automată, ștergere definitivă / export complet de cont, texte juridice validate, politici și alerte operaționale nu sunt finalizate. Backupul local este testat; backupul/restaurarea din infrastructura de producție nu sunt configurate și testate.
16. **Stack:** scaffoldul oficial folosește Vinext beta; aceasta nu satisface integral cerința unui stack exclusiv stabil. XLSX încarcă dinamic un bundle mai mare; se poate optimiza la nevoie.

## Verificări încă necesare înainte de utilizare reală

Testare într-un cont sandbox real al furnizorilor (inclusiv indisponibilitate, semnături, callbackuri duplicate și în altă ordine), revizuire de securitate independentă, audit complet de accesibilitate și traducere, politici de confidențialitate/consimțământ și un exercițiu de restaurare a producției. Nu s-a afirmat conformitate legală automată.
