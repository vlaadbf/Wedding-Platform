export const userThemes = [
  {
    id: 'sand',
    name: 'Nisipiu',
    description: 'Cald, luminos și natural',
    colors: ['#f4eadc', '#c98468', '#5a3428'],
  },
  {
    id: 'sage',
    name: 'Salvie',
    description: 'Calm, vegetal și aerisit',
    colors: ['#edf1e8', '#7d9270', '#344735'],
  },
  {
    id: 'rose',
    name: 'Trandafiriu',
    description: 'Delicat, cald și romantic',
    colors: ['#f7e9e8', '#b96f78', '#603943'],
  },
  {
    id: 'ocean',
    name: 'Albastru marin',
    description: 'Proaspăt, sobru și elegant',
    colors: ['#e8f0f2', '#547f8a', '#29464e'],
  },
] as const;

export type UserTheme = (typeof userThemes)[number]['id'];

export const isUserTheme = (value: unknown): value is UserTheme =>
  userThemes.some((theme) => theme.id === value);
