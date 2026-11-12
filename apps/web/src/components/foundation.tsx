import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Button, Card, StatusBadge } from '@work/ui';
import type { Locale } from '@work/shared-types';
import { dictionary } from '../i18n';
import { useReadiness } from '../hooks/use-readiness';
import Link from 'next/link';
import {usePlatformBrand} from '../hooks/use-platform-brand';
import {BhdProductMark} from './bhd/BhdProductMark';
import { BhdProgramsStrip } from './bhd/BhdProgramsStrip';

const services = ['database','redis','queue','storage'] as const;
const hints = {database:'databaseHint',redis:'redisHint',queue:'queueHint',storage:'storageHint'} as const;

export function Foundation() {
  const [locale,setLocale]=useState<Locale>('ar');
  const [dark,setDark]=useState(false);
  const {data,loading,error,refresh}=useReadiness();
  const t=dictionary(locale);
  const brand=usePlatformBrand();
  useEffect(()=>{
    const saved=localStorage.getItem('work.locale');
    if(saved==='ar'||saved==='en') setLocale(saved);
    setDark(localStorage.getItem('work.theme')==='dark');
  },[]);
  useEffect(()=>{document.documentElement.lang=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr';},[locale]);
  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';},[dark]);
  function toggleLocale(){const next=locale==='ar'?'en':'ar';setLocale(next);localStorage.setItem('work.locale',next);}
  function toggleTheme(){setDark(!dark);localStorage.setItem('work.theme',!dark?'dark':'light');}
  return <>
    <Head><title>{t.title}</title><meta name="description" content={t.description}/><meta name="robots" content="noindex,nofollow"/></Head>
    <div className="shell">
      <header className="header">
        <a className="brand" href="/"><BhdProductMark /><span><strong>{brand?.platformName??t.title}</strong><small>{t.subtitle}</small></span></a>
        <div className="header-actions">
          <BhdProgramsStrip locale={locale} compact />
          <a className="button button-ghost" href="/api/auth/bhd/start?returnTo=%2Fapp%2Fdashboard">{locale==='ar'?'دخول BHD':'BHD sign-in'}</a>
          <Link href="/features" className="button button-ghost">{locale==='ar'?'المميزات':'Features'}</Link><Link href="/pricing" className="button button-ghost">{locale==='ar'?'الأسعار':'Pricing'}</Link><Link href="/about" className="button button-ghost">{locale==='ar'?'من نحن':'About'}</Link><Link href="/help" className="button button-ghost">{locale==='ar'?'المساعدة':'Help'}</Link><Link href="/app/dashboard" className="button button-ghost">{locale==='ar'?'مساحة العمل':'Workspace'}</Link><Link href="/register" className="button button-ghost">{locale==='ar'?'إنشاء حساب':'Create account'}</Link><Link href="/platform" className="button button-ghost">{t.admin}</Link><Button className="button-ghost" onClick={toggleLocale}>{t.language}</Button><Button className="button-icon button-ghost" aria-label={t.theme} onClick={toggleTheme}>{dark?'☀':'☾'}</Button>
        </div>
      </header>
      <main>
        <div className="hero">
          <span className="eyebrow"><span className="line"/>{t.eyebrow}</span>
          <h1>{t.heading}</h1><p>{t.description}</p>
          <div className="phase-tag"><span aria-hidden="true">01</span>{t.phase} / {t.foundation}</div>
          <div className="hero-orbit" aria-hidden="true"><div/><div/><div/><span><BhdProductMark size="hero" /></span></div>
        </div>
        <div className="content-grid">
          <Card className="status-card">
            <div className="section-heading"><div><h2>{t.services}</h2><p>{t.servicesDescription}</p></div><span className="mini-label" aria-hidden="true">●</span></div>
            <div className={`summary ${!data || data.status!=='ready'?'summary-wait':''}`} role="status" aria-live="polite">
              <span className="summary-dot"/>{loading?t.checking:data?.status==='ready'?t.ready:t.notReady}
            </div>
            {error && <p className="error" role="alert">{t.unavailable}</p>}
            <div className="service-list">{services.map((service,index)=><div className="service" key={service}>
              <span className="service-icon" aria-hidden="true">{['▤','◈','↻','▱'][index]}</span><div className="service-text"><h3>{t[service]}</h3><p>{t[hints[service]]}</p></div>
              <StatusBadge up={!loading && data?.checks[service]==='up'}>{loading?t.checking:data?.checks[service]==='up'?t.up:t.down}</StatusBadge>
            </div>)}</div>
            <div className="status-footer"><span>{data?`${t.lastChecked}: ${new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(data.timestamp))}`:t.notChecked}</span><Button disabled={loading} onClick={()=>void refresh()}>{loading?t.checking:t.refresh}<span aria-hidden="true">↻</span></Button></div>
          </Card>
          <aside className="details">
            <Card><span className="card-number">01 /</span><h2>{t.architecture}</h2><p>{t.architectureDescription}</p><div className="technology"><span>Next.js</span><span>NestJS</span><span>TypeScript</span></div></Card>
            <Card><span className="card-number">02 /</span><h2>{t.isolation}</h2><p>{t.isolationDescription}</p><span className="quiet-note">{t.note}</span></Card>
          </aside>
        </div>
        <section className="development-note"><div><h2>{t.honest}</h2><p>{t.honestDescription}</p></div><div className="text-links"><a href="/api/docs/" target="_blank" rel="noreferrer">{t.api} ↗</a><a href="/api/v1/health/live" target="_blank" rel="noreferrer">{t.live} ↗</a></div></section>
      </main>
      <BhdProgramsStrip locale={locale} />
      <footer><span>{t.title}</span><div className="footer-links"><Link href="/privacy">{locale==='ar'?'الخصوصية':'Privacy'}</Link><Link href="/terms">{locale==='ar'?'الشروط':'Terms'}</Link><Link href="/security">{locale==='ar'?'الأمان':'Security'}</Link></div><span>{t.footer}</span><span dir="ltr">v0.1.0</span></footer>
    </div>
  </>;
}
