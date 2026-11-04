import {useEffect,useState} from 'react';
import Head from 'next/head';
import Link from 'next/link';
import type {Locale} from '@work/shared-types';
import {MarketingShell} from '../components/marketing/shell';
import {marketingDictionary} from '../i18n/marketing';
import {billingFeatureLabel} from '../i18n/billing';
import {requestApi} from '../services/api';
interface Plan {id:string;name:string;description:string;price:string|null;annualPrice:string|null;currency:string;maxSeats:number;maxProjects:number|null;storageMb:number;aiCredits:number;features:string[];customPricing:boolean}
export default function PricingPage(){
 const [locale,setLocale]=useState<Locale>('ar'),[plans,setPlans]=useState<Plan[]>([]),[annual,setAnnual]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 const t=marketingDictionary(locale),d=(ar:string,en:string)=>locale==='ar'?' '+ar:en;
 useEffect(()=>{const update=()=>{const saved=localStorage.getItem('work.locale');if(saved==='ar'||saved==='en')setLocale(saved);};update();globalThis.addEventListener('work:locale',update);return()=>globalThis.removeEventListener('work:locale',update);},[]);
 useEffect(()=>{let active=true;setLoading(true);setError(false);void requestApi<{items:Plan[]}>('public/billing/plans').then(response=>{if(active)setPlans(response.items);}).catch(()=>{if(active){setError(true);setPlans([]);}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[attempt]);
 return <MarketingShell><Head><title>{t.pricingTitle}</title><meta name="description" content={t.pricingLead}/></Head><div className="marketing-page"><div className="marketing-hero"><h1>{t.pricingTitle}</h1><p className="marketing-lead">{t.pricingLead}</p></div>
 <div className="marketing-notice">{d('الأسعار بالريال العُماني لكل مستخدم. راجع إجمالي المقاعد والدورة والخصم قبل تأكيد الاشتراك داخل مساحة العمل.','Prices are in Omani rials per user. Review seats, billing cycle and discounts in your workspace before confirming a subscription.')}</div>
 <label className="marketing-notice"><input type="checkbox" checked={annual} onChange={event=>setAnnual(event.target.checked)}/>{d('عرض السعر السنوي للمستخدم','Show annual price per user')}</label>
 {error&&<div className="marketing-notice" role="alert">{d('تعذر تحميل الباقات الحالية.','Current plans could not be loaded.')} <button className="button" onClick={()=>setAttempt(value=>value+1)}>{d('إعادة المحاولة','Retry')}</button></div>}
 {loading?<p role="status">{d('جارٍ تحميل الباقات…','Loading plans…')}</p>:<div className="pricing-grid">{plans.map(plan=>{const price=annual?plan.annualPrice:plan.price;return <article key={plan.id} className="pricing-card"><h2>{plan.name}</h2><p className="pricing-description">{plan.description}</p><div className="pricing-price"><span className="price-amount" dir="auto">{plan.customPricing?d('سعر مخصص','Custom pricing'):price===null?d('غير متاح','Unavailable'):<bdi>{price} {plan.currency}</bdi>}</span>{!plan.customPricing&&price!==null&&<span className="price-period">/{annual?d('مستخدم / سنة','user / year'):d('مستخدم / شهر','user / month')}</span>}</div><ul className="pricing-features"><li>{d('حتى','Up to')} {plan.maxSeats} {d('مستخدم','users')}</li><li>{plan.maxProjects===null?d('دون حد للمشاريع النشطة','No active project cap'):`${plan.maxProjects} ${d('مشروع نشط','active projects')}`}</li><li><bdi>{plan.storageMb} MB</bdi> {d('تخزين للمؤسسة','organization storage')}</li><li>{plan.aiCredits} {d('نقطة ذكاء اصطناعي شهريًا','AI credits per month')}</li>{plan.features.map(feature=><li key={feature}>{billingFeatureLabel(locale,feature)}</li>)}</ul><Link className="button" href={plan.customPricing?'/contact':`/app/settings/billing?plan=${encodeURIComponent(plan.id)}`}>{plan.customPricing?d('تواصل معنا','Contact us'):d('مراجعة الباقة في مساحة العمل','Review plan in workspace')}</Link></article>;})}</div>}
 {!loading&&!error&&plans.length===0&&<p role="status">{d('لم تُنشر باقات بعد.','No plans have been published yet.')}</p>}
 </div></MarketingShell>;
}
