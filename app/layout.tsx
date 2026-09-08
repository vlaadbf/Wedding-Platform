import type { Metadata } from 'next';
import './globals.css';
import './design.css';

export const metadata: Metadata = {
  title: 'NuntaNoastră · Totul, împreună',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
