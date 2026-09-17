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
