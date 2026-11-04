import { useEffect, useState } from 'react';
import type { Locale } from '@work/shared-types';
import { MarketingShell } from '../components/marketing/shell';
import { MarketingPage } from '../components/marketing/page';
import { marketingDictionary } from '../i18n/marketing';

export default function TemplatesPage() {
  const [locale, setLocale] = useState<Locale>('ar');
  const t = marketingDictionary(locale);

  useEffect(() => {
    const saved = localStorage.getItem('work.locale');
    if (saved === 'ar' || saved === 'en') setLocale(saved);
  }, []);

  return (
    <MarketingShell>
      <MarketingPage title={t.templatesTitle} lead={t.templatesLead} cta={{ text: t.getStarted, href: '/register' }}>
        <div className="marketing-notice">
          <span>{t.templatesAvailable}</span>
        </div>
      </MarketingPage>
    </MarketingShell>
  );
}
