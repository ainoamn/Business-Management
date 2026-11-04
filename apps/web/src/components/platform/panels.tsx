import {MfaSettings} from '../mfa-settings';
import {useCallback,useEffect,useState} from 'react';
import type {PlatformSessionView,PlatformRow,Readiness} from '@work/shared-types';
import type {PlatformText} from '../../i18n/platform';
import {platformLabel} from '../../i18n/platform';
import {platformRequest} from '../../services/platform';
import {AdminForm,errorLabel} from './forms';
import {settingsFields} from './fields';
import {permitted} from './resources';

function useRemote<T>(path:string,t:PlatformText) {
  const [data,setData]=useState<T>();const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [revision,setRevision]=useState(0);
  const reload=useCallback(()=>setRevision(v=>v+1),[]);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');void platformRequest<T>(path,{signal:controller.signal}).then(setData,reason=>{if(!controller.signal.aborted)setError(errorLabel(t,reason));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return ()=>controller.abort();},[path,t,revision]);
  return {data,error,loading,reload};
}
export function OverviewPanel({t}:{t:PlatformText}) {
  const {data,error,loading,reload}=useRemote<Record<string,string|number>>('platform/overview',t);
  const metrics=[['organizations','organizations'],['users','users'],['accounts','activeAdmins'],['plans','activePlans'],['subscriptions','activeSubscriptions'],['invoices','openInvoices'],['pages','publishedPages'],['manualNet','manualNet']];
  return <section><p className="admin-notice">{t.overviewNote}</p><button className="admin-button secondary" onClick={reload}>{t.refresh}</button>{error?<p className="admin-error" role="alert">{error}</p>:loading?<p role="status">{t.loading}</p>:<div className="admin-metrics">{metrics.map(([key,label],i)=><article key={key} className="admin-metric"><span className="admin-metric-index">{String(i+1).padStart(2,'0')}</span><h2>{platformLabel(t,label!)}</h2><strong>{data?.[key!]??'—'}</strong></article>)}</div>}</section>;
}
export function SettingsPanel({t,session}:{t:PlatformText;session:PlatformSessionView}) {
  const {data,error,loading,reload}=useRemote<PlatformRow>('platform/settings',t);
  return <section className="admin-panel admin-settings">{error?<><p className="admin-error" role="alert">{error}</p><button className="admin-button" onClick={reload}>{t.retry}</button></>:loading?<p role="status">{t.loading}</p>:data&&<AdminForm key={JSON.stringify(data)} fields={settingsFields} initial={data} t={t} disabled={!permitted(session,'settings.manage')} onSave={async body=>{await platformRequest('platform/settings',{method:'PATCH',body,csrf:session.csrf});}}/>}</section>;
}
interface Monitoring {readiness:Readiness;process:{uptimeSeconds:number;memoryMb:number};integrations:Record<string,string>}
export function MonitoringPanel({t}:{t:PlatformText}) {
  const {data,error,loading,reload}=useRemote<Monitoring>('platform/monitoring',t);
  return <section><p className="admin-notice">{t.monitorHint}</p><button className="admin-button secondary" onClick={reload}>{t.refresh}</button>{error?<p className="admin-error" role="alert">{error}</p>:loading?<p role="status">{t.loading}</p>:data&&<><div className="admin-metrics">{Object.entries(data.readiness.checks).map(([key,state])=><article className="admin-metric" key={key}><h2>{platformLabel(t,key)}</h2><span className={`admin-tag ${state==='up'?'positive':'warning'}`}>{state==='up'?t.up:t.down}</span></article>)}<article className="admin-metric"><h2>{t.uptime}</h2><strong>{data.process.uptimeSeconds}</strong></article><article className="admin-metric"><h2>{t.memory}</h2><strong>{data.process.memoryMb}</strong></article></div><section className="admin-panel admin-integration-list">{['payments','email','ai'].map(key=><div key={key}><span>{key==='email'?t.mail:platformLabel(t,key)}</span><span className="admin-tag muted">{data.integrations[key]==='CONFIGURED'?(t.language==='English'?'مهيأ — لم يُفحص الاتصال':'Configured — connection unverified'):data.integrations[key]==='DEVELOPMENT_OUTBOX'?(t.language==='English'?'صندوق تطوير محلي':'Local development outbox'):t.notConfigured}</span></div>)}</section></>}</section>;
}
export function SecurityPanel({t,session,onSignedOut,onSessionRefresh,locale}:{t:PlatformText;session:PlatformSessionView;onSignedOut:()=>void;onSessionRefresh:()=>Promise<void>;locale:'ar'|'en'}) {
  const [sessions,setSessions]=useState<PlatformRow[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(false);const [version,setVersion]=useState(0);
  useEffect(()=>{if(!permitted(session,'security.read'))return;const controller=new AbortController();setLoading(true);setError('');void platformRequest<{items:PlatformRow[]}>('platform/security/sessions',{signal:controller.signal}).then(result=>setSessions(result.items),reason=>{if(!controller.signal.aborted)setError(errorLabel(t,reason));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return ()=>controller.abort();},[session,t,version]);
  async function revoke(id:string) {
    if(!window.confirm(t.confirmRevoke))return;
    try{await platformRequest(`platform/security/sessions/${id}/revoke`,{method:'POST',csrf:session.csrf});if(id===session.actor.sessionId)onSignedOut();else setVersion(v=>v+1);}catch(reason){setError(errorLabel(t,reason));}
  }
  return <section><p className="admin-notice">{t.securityNote}</p>{permitted(session,'security.read')&&<section className="admin-panel">{error&&<p role="alert" className="admin-error">{error}</p>}{loading?<p role="status">{t.loading}</p>:<div className="admin-table-scroll"><table><caption>{t.security} · {sessions.length}</caption><thead><tr>{['id','accountId','createdAt','expiresAt'].map(key=><th key={key}>{platformLabel(t,key)}</th>)}{permitted(session,'security.manage')&&<th>{t.actions}</th>}</tr></thead><tbody>{sessions.map(row=><tr key={row.id}>{['id','accountId','createdAt','expiresAt'].map(key=><td key={key}><code>{String(row[key])}</code></td>)}{permitted(session,'security.manage')&&<td><button className="admin-button secondary small" onClick={()=>void revoke(row.id)}>{t.revoke}</button></td>}</tr>)}</tbody></table></div>}</section>}
    <MfaSettings namespace="platform" csrf={session.csrf} locale={locale} onSessionRefresh={onSessionRefresh}/><section className="admin-panel admin-settings"><h2>{t.passwordChange}</h2><p className="admin-muted">{t.passwordHint}</p><AdminForm fields={[{key:'currentPassword',type:'password'},{key:'newPassword',type:'password'}]} t={t} onSave={async body=>{await platformRequest('platform/auth/password',{method:'POST',body,csrf:session.csrf});onSignedOut();}}/></section>
  </section>;
}
