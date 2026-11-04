import { useEffect, useState } from 'react';
import type { Locale } from '@work/shared-types';
import { MarketingShell } from '../components/marketing/shell';
import { MarketingPage } from '../components/marketing/page';
import { marketingDictionary } from '../i18n/marketing';

export default function SolutionsPage() {
  const [locale, setLocale] = useState<Locale>('ar');
  const t = marketingDictionary(locale);

  useEffect(() => {
    const saved = localStorage.getItem('work.locale');
    if (saved === 'ar' || saved === 'en') setLocale(saved);
  }, []);

  const sections = [
    { title: t.solutionsOperations, description: t.solutionsOperationsDesc },
    { title: t.solutionsProjects, description: t.solutionsProjectsDesc },
    { title: t.solutionsHr, description: t.solutionsHrDesc },
    { title: t.solutionsCustomer, description: t.solutionsCustomerDesc },
  ];

  return (
    <MarketingShell>
      <MarketingPage title={t.solutionsTitle} lead={t.solutionsLead} sections={sections} cta={{ text: t.getStarted, href: '/register' }} />
    </MarketingShell>
  );
}
