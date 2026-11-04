import { useEffect, useState } from 'react';
import type { Locale } from '@work/shared-types';
import { MarketingShell } from '../components/marketing/shell';
import { MarketingPage } from '../components/marketing/page';
import { marketingDictionary } from '../i18n/marketing';

export default function TermsPage() {
  const [locale, setLocale] = useState<Locale>('ar');
  const t = marketingDictionary(locale);

  useEffect(() => {
    const saved = localStorage.getItem('work.locale');
    if (saved === 'ar' || saved === 'en') setLocale(saved);
  }, []);

  const sections = [
    { title: t.termsAcceptance, description: t.termsAcceptanceDesc },
    { title: t.termsService, description: t.termsServiceDesc },
    { title: t.termsLimitations, description: t.termsLimitationsDesc },
    { title: t.termsTermination, description: t.termsTerminationDesc },
  ];

  return (
    <MarketingShell>
      <MarketingPage title={t.termsTitle} lead={t.termsLead} sections={sections} notice={t.termsDraft} />
    </MarketingShell>
  );
}
