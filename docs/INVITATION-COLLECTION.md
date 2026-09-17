# Colecția de invitații — 10 septembrie 2026

În **Invitație → Designul invitației**, clientul filtrează categoria, alege modelul și îl personalizează cu previzualizare live, inclusiv la lățime de telefon. Sunt editabile numele, titlul, mesajele, locația afișată, dress code, termenul RSVP, textele auxiliare, fontul, trei culori și imaginea. Data vine din setările evenimentului. Modelele tip revistă, bilet și afiș au și titlu principal editabil.

| Categorie | Modele |
|---|---|
| Minimaliste | Esență, Noi doi |
| Elegante | Nocturn, Monogramă |
| Florale | Grădină poetică, După apus |
| Destinație | Riviera, Bilet spre noi |
| Creative | Ediția iubirii, Love Fest |

Modelele au zece compoziții CSS distincte. Schimbarea modelului păstrează mesajele și datele completate, aplicând noua paletă, fontul, imaginea și titlul sugerat. Modificările locale nu au autosalvare. **Salvează designul** păstrează draftul; **Salvează și publică** actualizează invitația vizibilă familiilor prin linkurile existente. Invitațiile vechi păstrează aspectul anterior până la publicarea unui model nou. Administratorul care consultă contul unui client vede editorul fără drept de modificare.

## Imagini generate

Mod: instrumentul integrat `image_gen` (built-in), trei imagini originale PNG 1024 × 1536, câte o generare pentru fiecare. Imaginile sunt decorative, fără text integrat și fără a reprezenta locația reală a evenimentului. Textele invitațiilor sunt HTML editabil. Nu s-a folosit un API cu cheie proprie. Nu există încă încărcare de fotografii personale în acest editor.

Căile finale în proiect:

- `C:/Users/florin.vlad/Documents/ChatGPT/WeddingPlan/public/invitation-art/botanical-poetry.png`
- `C:/Users/florin.vlad/Documents/ChatGPT/WeddingPlan/public/invitation-art/mediterranean-light.png`
- `C:/Users/florin.vlad/Documents/ChatGPT/WeddingPlan/public/invitation-art/afterglow.png`

Pentru fiecare sursă există variante AVIF și WebP la 640, 1280 și 1920 px în `public/invitation-art/responsive/`. Componenta folosește `<picture>`, `srcset` și `sizes`; PNG-ul rămâne fallback. Variantele AVIF de telefon au 22–83 KB, iar WebP 33–102 KB, sub ținta de 200 KB. Se regenerează cu `node scripts/optimize-invitation-art.mjs`.

Prompturile folosite, integral:

### Botanical Poetry

```text
Use case: stylized-concept
Asset type: standalone bitmap artwork for an editable wedding invitation background, portrait 2:3.
Primary request: Botanical Poetry. Fine art gouache and watercolor painting of white cosmos, blush dahlias and burgundy scabiosa with dark expressive green leaves against pale ivory.
Composition: flowers concentrated at lower left and top right, generous completely blank central area for invitation text added separately. Refined non-cutesy stationery art, painterly botanical detail and subtle paper texture.
Constraints: artwork only; no text, no letters, no numbers, no logos, no border, no card mockup, no people, no UI.
```

### Mediterranean light

```text
Use case: photorealistic-natural
Asset type: standalone editorial photograph used as wedding invitation header artwork, portrait 2:3.
Primary request: Mediterranean light. An ivory Mediterranean villa terrace with a pale stone arch, bougainvillea climbing along the edge, and cobalt sea beyond. A plausible invented place with no named real venue.
Style: photoreal editorial architectural detail, warm sunlit texture, cinematic delicate film grain, refined and romantic.
Constraints: image only; no people, no text, no letters, no numbers, no logos, no border, no card mockup, no UI.
```

### Afterglow

```text
Use case: photorealistic-natural
Asset type: standalone editorial still-life photograph for a wedding invitation background, portrait 2:3.
Primary request: Afterglow. Close crop of sculptural burgundy calla lilies and pale pink anthurium in smoked glass on muted deep plum fabric.
Composition: sophisticated editorial wedding still life, floral arrangement in lower portion, generous dark upper space for editable text added separately.
Lighting and mood: directional warm light, romantic rich tones, tactile fabric and glass, refined photographic realism.
Constraints: image only; no text, no letters, no numbers, no logos, no border, no card mockup, no people, no UI.
```
