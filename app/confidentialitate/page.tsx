import type { Metadata } from 'next';
import { PrivacyNotice } from '@/components/planner/privacy-notice';

export const metadata: Metadata = {
  title: 'Confidențialitate · Planora',
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  return <PrivacyNotice initialLanguage={lang === 'en' ? 'en' : 'ro'} />;
}
