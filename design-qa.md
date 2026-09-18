# Design QA — Planora authentication

Date: 2026-09-17

## Target

- Reference: `design/reference/planora-auth-selected.png`
- Route: `http://localhost:3000/`
- Primary viewport: 390 × 844 px

## Visual comparison

- Brand updated to Planora and kept in the same warm editorial style.
- Warm ivory paper texture and terracotta arches match the selected sandy direction.
- Registration headline, approval note, segmented login/register control, icon inputs, rounded primary action, divider, and account switch are all present.
- Registration content fits the 390 × 844 viewport with `scrollHeight: 844`.
- Login and registration use the same visual system and remain readable over the artwork.
- Inputs, buttons, labels, and password visibility control have accessible names and mobile-sized targets.

## Functional checks

- TypeScript: passed (`tsc --noEmit`).
- Production build: passed (`vinext build`).
- Demo authentication flow: passed.
- Theme selector exposes four radio options: Nisipiu, Salvie, Trandafiriu, Albastru marin.
- Theme change persists after reload and is restored from the authenticated user record.
- Browser console showed no application errors; unrelated browser-extension messages were excluded.

final result: passed

---

# Design QA — Fundal autentificare responsive

Date: 2026-09-18

## Target

- Route: `http://localhost:3000/`
- States: login and registration
- Viewports: 390 × 844, 768 × 1024, 1440 × 1000, 1920 × 1080

## Visual and responsive checks

- Mobile and tablet retain the sand artwork at proportions suited to portrait screens.
- Desktop uses a dedicated two-column composition with CSS-generated sand shapes instead of enlarging the portrait artwork.
- The form stays in a stable, readable panel while the decorative area expands on wide monitors.
- Login and registration have no horizontal overflow at the tested sizes.
- The 390 × 844 registration screen fits without vertical scrolling.
- Browser console showed no warnings or errors.
- TypeScript, lint, and the production build passed.

final result: passed

---

# Design QA — Setări responsive și cod QR public

Date: 2026-09-18

## Target

- Settings route: `http://localhost:3000/#settings`
- Public event route: `http://localhost:3000/eveniment/:eventId`
- Mobile viewport: 390 × 844 px

## Visual and responsive checks

- Theme cards remain readable in a compact 2 × 2 mobile grid.
- Settings rows, buttons, long values, and tables stay inside the viewport.
- Settings page has no horizontal overflow (`clientWidth: 375`, `scrollWidth: 375`).
- The printable QR panel stacks cleanly on mobile and keeps the download action easy to reach.
- The public invitation and event schedule render correctly on mobile with no horizontal overflow (`clientWidth: 375`, `scrollWidth: 375`).

## Functional and privacy checks

- The QR download is a 1024 px PNG data URL with an event-specific filename.
- The public URL remains stable for the event and shows a waiting state until the invitation is published.
- Once published, the public page shows the invitation and event schedule.
- The public API returns only event, invitation, and schedule fields; it does not return guests, families, RSVP answers, or authentication data.
- Personalized RSVP links remain separate for each family.
- TypeScript, lint, and the production build passed.
- Browser console showed no application warnings or errors on Settings and the public event page.

final result: passed
