import { useEffect, useState } from 'react';
import type { Locale } from '@work/shared-types';
import { MarketingShell } from '../components/marketing/shell';
import { MarketingPage } from '../components/marketing/page';
import { marketingDictionary } from '../i18n/marketing';

export default function AiPage() {
  const [locale, setLocale] = useState<Locale>('ar');
  const t = marketingDictionary(locale);

  useEffect(() => {
    const saved = localStorage.getItem('work.locale');
    if (saved === 'ar' || saved === 'en') setLocale(saved);
  }, []);

  const sections = [
    { title: t.aiPlan, description: t.aiPlanDesc },
    { title: t.aiSummary, description: t.aiSummaryDesc },
    { title: t.aiForecast, description: t.aiForecastDesc },
    { title: t.aiCommands, description: t.aiCommandsDesc },
    { title: t.aiCredits, description: t.aiCreditsDesc },
    { title: t.aiGuard, description: t.aiGuardDesc },
  ];

  return (
    <MarketingShell>
      <MarketingPage title={t.aiTitle} lead={t.aiLead} sections={sections} notice={t.aiNotice} cta={{ text: t.workspace, href: '/app/ai' }} />
    </MarketingShell>
  );
}
