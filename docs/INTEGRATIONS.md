# Integrări

Nicio credențială nu este livrată. Aplicația afișează starea reală a configurării; un cont demo nu apelează transporturile externe, chiar dacă serverul are chei.

## Email — Resend

Configurează `RESEND_API_KEY`, `EMAIL_FROM` pe un domeniu verificat și `RESEND_WEBHOOK_SECRET`. Webhook: `/api/webhooks/resend`. Sunt validate semnătura Svix și abaterea temporală de maximum 5 minute. Tokenurile de verificare / recuperare sunt valabile o oră.

Fiecare expediere are `Idempotency-Key` egal cu ID-ul jobului. Resend păstrează cheile de idempotență 24 de ore; workerul nu reia automat expedierea după un rezultat incert. HTTP acceptat produce starea `accepted`, nu `delivered`. Numai webhookul de livrare confirmă livrarea. Documentație oficială verificată la implementare: [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys), [API](https://resend.com/docs/api-reference/introduction).

## SMS și WhatsApp — Twilio

Configurează `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`. Contactele destinate SMS/WhatsApp trebuie să aibă prefix internațional. Pentru WhatsApp: `WHATSAPP_FROM` și `WHATSAPP_CONTENT_SID`; folosește un expeditor oficial și un șablon aprobat compatibil cu variabila `1`. StatusCallback este `/api/webhooks/twilio`; validarea folosește URL-ul extern exact și câmpurile formularului.

Costurile nu sunt estimate fără contractul și destinațiile furnizorului. Organizatorul trebuie să gestioneze acordurile și dezabonările prin `opt_out` la familie. Implementarea nu presupune că există o sesiune WhatsApp deschisă. Documentație: [Messages resource](https://www.twilio.com/docs/messaging/api/message-resource), [status callbacks](https://www.twilio.com/docs/messaging/guides/outbound-message-status-in-status-callbacks).

## Plăți online

**Nu sunt implementate tranzacții online.** Registrul de plăți, contribuții și rambursări este manual și nu transferă bani. Integrarea Stripe este afișată ca indisponibilă și nu poate fi activată prin simpla introducere a unei chei.

Pentru dezvoltare ulterioară este necesară definirea comerciantului, a conturilor Stripe Connect și a fluxului juridic/comercial. Confirmarea va trebui să folosească webhookuri verificate, nu redirectul de succes: [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment), [webhook signatures](https://docs.stripe.com/webhooks). Aceasta rămâne o diferență explicită față de specificație.

## Procesare programată

Configurează `JOB_SECRET` pe server și în procesul scheduler. `APP_ORIGIN` trebuie să fie adresa externă a aplicației. Rulează `node scripts/jobs.mjs` sub un supervisor sau apelează endpointul printr-un cron HTTPS la fiecare minut. Găzduirea privată Sites poate bloca accesul unui scheduler extern; verifică ruta și politica de acces înainte de activare.

Orele sunt interpretate în fusul evenimentului, stocate UTC; orele inexistente/ambigue la trecerea DST sunt respinse. Fereastra de expediere reală: 09:00–19:59. Maximum 20 de mesaje procesate per execuție. La HTTP 429 există până la 3 reîncercări cu backoff. Erorile permanente se opresc; timeouturile / întreruperile devin `unknown` pentru reconciliere manuală. Joburile și încercările sunt persistente și independente de durata procesului Node.

Scrierile critice folosesc tranzacții D1 batch: [documentația oficială D1](https://developers.cloudflare.com/d1/worker-api/d1-database/).
