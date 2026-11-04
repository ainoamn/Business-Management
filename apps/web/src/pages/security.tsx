import { useEffect, useState } from 'react';
import type { Locale } from '@work/shared-types';
import { MarketingShell } from '../components/marketing/shell';
import { MarketingPage } from '../components/marketing/page';
import { marketingDictionary } from '../i18n/marketing';

export default function SecurityPage() {
  const [locale, setLocale] = useState<Locale>('ar');
  const t = marketingDictionary(locale);

  useEffect(() => {
    const saved = localStorage.getItem('work.locale');
    if (saved === 'ar' || saved === 'en') setLocale(saved);
  }, []);

  const sections = [
    { title: t.securityEncryption, description: t.securityEncryptionDesc },
    { title: t.securityAccess, description: t.securityAccessDesc },
    { title: t.securityAudit, description: t.securityAuditDesc },
    { title: t.securityCompliance, description: t.securityComplianceDesc },
  ];

  return (
    <MarketingShell>
      <MarketingPage title={t.securityTitle} lead={t.securityLead} sections={sections} notice={t.securityDraft} />
    </MarketingShell>
  );
}
