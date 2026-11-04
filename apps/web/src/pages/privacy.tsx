import { useEffect, useState } from 'react';
import type { Locale } from '@work/shared-types';
import { MarketingShell } from '../components/marketing/shell';
import { MarketingPage } from '../components/marketing/page';
import { marketingDictionary } from '../i18n/marketing';

export default function PrivacyPage() {
  const [locale, setLocale] = useState<Locale>('ar');
  const t = marketingDictionary(locale);

  useEffect(() => {
    const saved = localStorage.getItem('work.locale');
    if (saved === 'ar' || saved === 'en') setLocale(saved);
  }, []);

  const sections = [
    { title: t.privacyCollection, description: t.privacyCollectionDesc },
    { title: t.privacyUsage, description: t.privacyUsageDesc },
    { title: t.privacyRetention, description: t.privacyRetentionDesc },
    { title: t.privacyRights, description: t.privacyRightsDesc },
  ];

  return (
    <MarketingShell>
      <MarketingPage title={t.privacyTitle} lead={t.privacyLead} sections={sections} notice={t.privacyDraft} />
    </MarketingShell>
  );
}
