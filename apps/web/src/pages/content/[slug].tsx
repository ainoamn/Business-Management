import {useEffect,useState} from 'react';
import {useRouter} from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {platformRequest} from '../../services/platform';
import {platformDictionary} from '../../i18n/platform';
interface PageContent {title:string;body:string;platformName:string;footerText:string}
export default function ContentPage() {
  const {query}=useRouter();const [data,setData]=useState<PageContent>();const [error,setError]=useState(false);const [revision,setRevision]=useState(0);const [locale,setLocale]=useState<'ar'|'en'>('ar');const t=platformDictionary(locale);
  useEffect(()=>{const lang=localStorage.getItem('work.locale');if(lang==='en')setLocale('en');},[]);
  useEffect(()=>{if(typeof query.slug!=='string')return;const controller=new AbortController();setError(false);setData(undefined);void platformRequest<PageContent>(`public/pages/${encodeURIComponent(query.slug)}`,{signal:controller.signal}).then(setData,()=>{if(!controller.signal.aborted)setError(true);});return ()=>controller.abort();},[query.slug,revision]);
  return <main className="admin-root admin-public" dir={locale==='ar'?'rtl':'ltr'}><Head><title>{data?`${data.title} · ${data.platformName}`:t.brand}</title></Head><Link href="/">{t.back}</Link>{error?<section role="alert"><h1>{t.publicUnavailable}</h1><button className="admin-button" onClick={()=>setRevision(v=>v+1)}>{t.retry}</button></section>:!data?<p role="status">{t.loading}</p>:<article><span className="admin-eyebrow">{data.platformName}</span><h1>{data.title}</h1><div className="admin-safe-content">{data.body}</div><footer>{data.footerText}</footer></article>}</main>;
}
