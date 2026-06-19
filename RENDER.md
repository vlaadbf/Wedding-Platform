# Deploy Render

Aplicatia foloseste SQLite. Pentru productie, baza de date trebuie tinuta pe un Render Disk persistent, nu in git.

## Setari Render

`render.yaml` configureaza:

- `buildCommand`: `npm ci && npm run build`
- `startCommand`: `npm start`
- `DATA_DIR`: `/var/data`
- disk persistent montat la `/var/data`

La prima pornire, aplicatia creeaza automat baza de date si ruleaza migrarile.

## Variabile obligatorii

Seteaza in Render:

- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

Parola trebuie sa aiba minimum 10 caractere, litera mare, cifra si simbol.

## Important

Nu urca `data/wedding.sqlite` in git. Daca este urcata in repository, poate suprascrie sau expune date reale. Pe Render, fisierul SQLite va fi creat in `/var/data/wedding.sqlite` si ramane acolo datorita diskului persistent.
