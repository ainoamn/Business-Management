import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@work/ui';
import type { Locale } from '@work/shared-types';
import { marketingDictionary } from '../../i18n/marketing';
import { usePlatformBrand } from '../../hooks/use-platform-brand';
import { BhdProductMark } from '../bhd/BhdProductMark';
import { BhdProgramsFooter } from '../bhd/BhdProgramsFooter';

interface MarketingShellProps {
  children: React.ReactNode;
}

export function MarketingShell({ children }: MarketingShellProps) {
  const [locale, setLocale] = useState<Locale>('ar');
  const [dark, setDark] = useState(false);
  const t = marketingDictionary(locale);
  const brand = usePlatformBrand();

  useEffect(() => {
    const saved = localStorage.getItem('work.locale');
    if (saved === 'ar' || saved === 'en') setLocale(saved);
    setDark(localStorage.getItem('work.theme') === 'dark');
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  function toggleLocale() {
    const next = locale === 'ar' ? 'en' : 'ar';
    setLocale(next);
    localStorage.setItem('work.locale', next);
    globalThis.dispatchEvent(new Event('work:locale'));
  }

  function toggleTheme() {
    setDark(!dark);
    localStorage.setItem('work.theme', !dark ? 'dark' : 'light');
  }

  return (
    <div className="marketing-shell">
      <header className="marketing-header">
        <Link href="/" className="brand">
          <BhdProductMark />
          <span>
            <strong>{brand?.platformName ?? 'Work Management Platform'}</strong>
            <small>Oman</small>
          </span>
        </Link>

        <nav className="marketing-nav" aria-label={locale === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>
          <Link href="/features">{t.features}</Link>
          <Link href="/ai">{t.aiNav}</Link>
          <Link href="/solutions">{t.solutions}</Link>
          <Link href="/industries">{t.industries}</Link>
          <Link href="/pricing">{t.pricing}</Link>
          <Link href="/about">{t.about}</Link>
          <Link href="/help">{t.help}</Link>
        </nav>

        <div className="marketing-actions">
          <Link href="/api/auth/bhd/start?returnTo=%2Fapp%2Fdashboard" className="button button-ghost">
            {locale === 'ar' ? 'دخول BHD' : 'BHD sign-in'}
          </Link>
          <Link href="/login" className="button button-ghost">
            {t.login}
          </Link>
          <Link href="/register" className="button button-ghost">
            {t.register}
          </Link>
          <Link href="/app/dashboard" className="button">
            {t.workspace}
          </Link>
          <Button className="button-ghost" onClick={toggleLocale}>
            {locale === 'ar' ? 'English' : 'العربية'}
          </Button>
          <Button className="button-icon button-ghost" aria-label={locale === 'ar' ? 'تبديل المظهر' : 'Toggle theme'} onClick={toggleTheme}>
            {dark ? '☀' : '☾'}
          </Button>
        </div>
      </header>

      <main className="marketing-main">{children}</main>

      <footer className="marketing-footer">
        <div className="marketing-footer-top">
          <div className="footer-group">
            <h3>{t.features}</h3>
            <Link href="/features">{t.features}</Link>
            <Link href="/ai">{t.aiNav}</Link>
            <Link href="/templates">{t.templates}</Link>
            <Link href="/pricing">{t.pricing}</Link>
          </div>
          <div className="footer-group">
            <h3>{locale === 'ar' ? 'الحلول' : 'Solutions'}</h3>
            <Link href="/solutions">{t.solutions}</Link>
            <Link href="/industries">{t.industries}</Link>
          </div>
          <div className="footer-group">
            <h3>{locale === 'ar' ? 'الشركة' : 'Company'}</h3>
            <Link href="/about">{t.about}</Link>
            <Link href="/contact">{t.contact}</Link>
            <Link href="/help">{t.help}</Link>
          </div>
          <div className="footer-group">
            <h3>{locale === 'ar' ? 'قانوني' : 'Legal'}</h3>
            <Link href="/privacy">{t.privacy}</Link>
            <Link href="/terms">{t.terms}</Link>
            <Link href="/security">{t.security}</Link>
          </div>
        </div>
        <BhdProgramsFooter locale={locale} />
        <div className="marketing-footer-bottom">
          <span>{brand?.platformName ?? 'Work Management Platform'} © {new Date().getFullYear()}</span>
          <span dir="ltr">Oman</span>
        </div>
      </footer>
    </div>
  );
}
