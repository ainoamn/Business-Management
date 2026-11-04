import { useEffect, useState } from 'react';
import { useBhdCatalog } from '../../lib/identity/use-bhd-catalog';
import { launchUrlForApp } from '../../lib/bhd/apps';
import { BhdAppIcon } from './BhdAppIcon';

export function BhdProgramsFooter({ locale = 'ar' }: { locale?: 'ar' | 'en' }) {
  const apps = useBhdCatalog().filter((app) => app.enabled && app.id !== 'account');
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  if (!apps.length) return null;
  return (
    <div className="bhd-programs-footer">
      <h3>{locale === 'ar' ? 'برامجنا' : 'Our programs'}</h3>
      <div className="bhd-programs-grid">
        {apps.map((app) => {
          const label = locale === 'ar' ? app.nameAr : app.nameEn;
          const href = launchUrlForApp(app, origin || undefined);
          return (
            <a key={app.id} href={href} className="bhd-programs-item">
              <BhdAppIcon id={app.id} title={label} logoUrl={app.logoUrl} soft={app.soft} accent={app.accent} />
              <span>{label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
