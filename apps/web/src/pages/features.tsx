import { useEffect, useState } from 'react';
import type { Locale } from '@work/shared-types';
import { MarketingShell } from '../components/marketing/shell';
import { MarketingPage } from '../components/marketing/page';
import { marketingDictionary } from '../i18n/marketing';

export default function FeaturesPage() {
  const [locale, setLocale] = useState<Locale>('ar');
  const t = marketingDictionary(locale);

  useEffect(() => {
    const saved = localStorage.getItem('work.locale');
    if (saved === 'ar' || saved === 'en') setLocale(saved);
  }, []);

  const sections = [
    { title: t.featuresWorkflows, description: t.featuresWorkflowsDesc },
    { title: t.featuresAi, description: t.featuresAiDesc },
    { title: t.featuresReports, description: t.featuresReportsDesc },
    { title: t.featuresDocuments, description: t.featuresDocumentsDesc },
    { title: t.featuresFinance, description: t.featuresFinanceDesc },
    { title: t.featuresMeetings, description: t.featuresMeetingsDesc },
  ];

  return (
    <MarketingShell>
      <MarketingPage title={t.featuresTitle} lead={t.featuresLead} sections={sections} cta={{ text: t.getStarted, href: '/register' }} />
    </MarketingShell>
  );
}
