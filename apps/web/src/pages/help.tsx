import { useEffect, useState } from 'react';
import type { Locale } from '@work/shared-types';
import { MarketingShell } from '../components/marketing/shell';
import { MarketingPage } from '../components/marketing/page';
import { marketingDictionary } from '../i18n/marketing';

export default function HelpPage() {
  const [locale, setLocale] = useState<Locale>('ar');
  const t = marketingDictionary(locale);

  useEffect(() => {
    const saved = localStorage.getItem('work.locale');
    if (saved === 'ar' || saved === 'en') setLocale(saved);
  }, []);

  const sections = [
    { title: t.helpGettingStarted, description: t.helpGettingStartedDesc },
    { title: t.helpWorkflows, description: t.helpWorkflowsDesc },
    { title: t.helpIntegrations, description: t.helpIntegrationsDesc },
    { title: t.helpSupport, description: t.helpSupportDesc },
  ];

  return (
    <MarketingShell>
      <MarketingPage title={t.helpTitle} lead={t.helpLead} sections={sections} cta={{ text: t.contact, href: '/contact' }} />
    </MarketingShell>
  );
}
