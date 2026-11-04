import { useEffect, useState } from 'react';
import type { Locale } from '@work/shared-types';
import { MarketingShell } from '../components/marketing/shell';
import { MarketingPage } from '../components/marketing/page';
import { marketingDictionary } from '../i18n/marketing';

export default function AboutPage() {
  const [locale, setLocale] = useState<Locale>('ar');
  const t = marketingDictionary(locale);

  useEffect(() => {
    const saved = localStorage.getItem('work.locale');
    if (saved === 'ar' || saved === 'en') setLocale(saved);
  }, []);

  const sections = [
    { title: t.aboutMission, description: t.aboutMissionDesc },
    { title: t.aboutVision, description: t.aboutVisionDesc },
    { title: t.aboutValues, description: t.aboutValuesDesc },
  ];

  return (
    <MarketingShell>
      <MarketingPage title={t.aboutTitle} lead={t.aboutLead} sections={sections} cta={{ text: t.contact, href: '/contact' }} />
    </MarketingShell>
  );
}
