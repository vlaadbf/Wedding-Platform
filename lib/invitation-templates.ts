const responsiveArt = (name: string) => ({
  fallback: `/invitation-art/${name}.png`,
  avif: [640, 1280, 1920]
    .map((width) => `/invitation-art/responsive/${name}-${width}.avif ${width}w`)
    .join(', '),
  webp: [640, 1280, 1920]
    .map((width) => `/invitation-art/responsive/${name}-${width}.webp ${width}w`)
    .join(', '),
});
export const invitationArt = {
  botanical: responsiveArt('botanical-poetry'),
  riviera: responsiveArt('mediterranean-light'),
  afterglow: responsiveArt('afterglow'),
};
export const invitationFonts: Record<string, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  modern: '"Segoe UI", Arial, sans-serif',
  editorial: '"Times New Roman", Georgia, serif',
  romantic: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
};
export const invitationTemplates = [
  {
    id: 'essence',
    name: 'Esență',
    category: 'Minimaliste',
    layout: 'minimal',
    description: 'Spațiu alb, linii fine și un anunț simplu.',
    color: '#343d38',
    background: '#fcfcf8',
    text_color: '#292e2c',
    font: 'modern',
    artwork: 'none',
    headline: 'Împreună, de acum înainte.',
  },
  {
    id: 'two-of-us',
    name: 'Noi doi',
    category: 'Minimaliste',
    layout: 'split',
    description: 'Nume supradimensionate și compoziție asimetrică.',
    color: '#ad482e',
    background: '#f4e9dd',
    text_color: '#352c29',
    font: 'serif',
    artwork: 'none',
    headline: 'Un da. O viață. Noi doi.',
  },
  {
    id: 'nocturne',
    name: 'Nocturn',
    category: 'Elegante',
    layout: 'nocturne',
    description: 'Albastru de noapte și accente aurii discrete.',
    color: '#d7b77c',
    background: '#142331',
    text_color: '#fff5df',
    font: 'serif',
    artwork: 'none',
    headline: 'O seară de neuitat',
  },
  {
    id: 'monogram',
    name: 'Monogramă',
    category: 'Elegante',
    layout: 'monogram',
    description: 'Inițialele voastre, într-o compoziție clasică.',
    color: '#705438',
    background: '#f9f4eb',
    text_color: '#3a302a',
    font: 'romantic',
    artwork: 'none',
    headline: 'Cu drag, vă invităm',
  },
  {
    id: 'poetic-garden',
    name: 'Grădină poetică',
    category: 'Florale',
    layout: 'botanical',
    description: 'Flori pictate și delicatețe pe hârtie ivoire.',
    color: '#763e46',
    background: '#faf6e9',
    text_color: '#403c32',
    font: 'romantic',
    artwork: 'botanical',
    headline: 'Iubirea noastră înflorește',
  },
  {
    id: 'afterglow',
    name: 'După apus',
    category: 'Florale',
    layout: 'afterglow',
    description: 'Fotografie florală, vișiniu și atmosferă intimă.',
    color: '#e8bb9a',
    background: '#2b1720',
    text_color: '#fff2e6',
    font: 'editorial',
    artwork: 'afterglow',
    headline: 'Până dincolo de apus',
  },
  {
    id: 'riviera',
    name: 'Riviera',
    category: 'Destinație',
    layout: 'riviera',
    description: 'O fotografie mediteraneană și un aer de vacanță.',
    color: '#194d77',
    background: '#fffaf0',
    text_color: '#253d4b',
    font: 'serif',
    artwork: 'riviera',
    headline: 'Ne întâlnim sub același soare',
  },
  {
    id: 'boarding',
    name: 'Bilet spre noi',
    category: 'Destinație',
    layout: 'ticket',
    description: 'Invitația devine biletul unei călătorii împreună.',
    color: '#245d54',
    background: '#f5f2e5',
    text_color: '#203f38',
    font: 'modern',
    artwork: 'none',
    headline: 'Destinația: împreună',
  },
  {
    id: 'love-issue',
    name: 'Ediția iubirii',
    category: 'Creative',
    layout: 'editorial',
    description: 'Titlu de revistă și fotografie ca într-un editorial.',
    color: '#8b3d42',
    background: '#f6ede8',
    text_color: '#302728',
    font: 'editorial',
    artwork: 'afterglow',
    headline: 'Povestea anului. A noastră.',
  },
  {
    id: 'love-fest',
    name: 'Love Fest',
    category: 'Creative',
    layout: 'festival',
    description: 'Un afiș vesel, cu litere mari și energie de festival.',
    color: '#d63323',
    background: '#f8cf49',
    text_color: '#5c2421',
    font: 'modern',
    artwork: 'none',
    headline: 'Iubire. Muzică. Dans.',
  },
];
export const templateCategories = [
  ...new Set(invitationTemplates.map((t) => t.category)),
];
export function templateFor(design: Record<string, unknown>) {
  const legacy: Record<string, string> = {
    Elegant: 'monogram',
    Minimalist: 'essence',
    Floral: 'poetic-garden',
    Modern: 'two-of-us',
    Rustic: 'boarding',
    Clasic: 'nocturne',
  };
  return (
    invitationTemplates.find(
    (t) => t.id === (design.template_id || legacy[String(design.style)]),
    ) || invitationTemplates[0]
  );
}
export function applyTemplate(design: Record<string, unknown>, id: string) {
  const t = invitationTemplates.find((t) => t.id === id);
  if (!t) throw new Error('Șablon necunoscut.');
  return {
    ...design,
    template_id: t.id,
    color: t.color,
    background: t.background,
    text_color: t.text_color,
    font: t.font,
    artwork: t.artwork,
    headline: t.headline,
  };
}
