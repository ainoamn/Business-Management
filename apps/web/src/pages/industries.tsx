import { useEffect, useState } from 'react';
import type { Locale } from '@work/shared-types';
import { MarketingShell } from '../components/marketing/shell';
import { MarketingPage } from '../components/marketing/page';
import { marketingDictionary } from '../i18n/marketing';

export default function IndustriesPage() {
  const [locale, setLocale] = useState<Locale>('ar');
  const t = marketingDictionary(locale);

  useEffect(() => {
    const saved = localStorage.getItem('work.locale');
    if (saved === 'ar' || saved === 'en') setLocale(saved);
  }, []);

  const sections = [
    { title: t.industriesGov, description: t.industriesGovDesc },
    { title: t.industriesFinance, description: t.industriesFinanceDesc },
    { title: t.industriesHealth, description: t.industriesHealthDesc },
    { title: t.industriesEdu, description: t.industriesEduDesc },
  ];

  return (
    <MarketingShell>
      <MarketingPage title={t.industriesTitle} lead={t.industriesLead} sections={sections} cta={{ text: t.learnMore, href: '/about' }} />
    </MarketingShell>
  );
}
