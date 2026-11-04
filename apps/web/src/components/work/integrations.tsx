import {useState} from 'react';
import {useWorkspace} from './context';
import {useWorkData,WorkState,WorkTable,type WorkRow} from './data';
import {workError} from './form';
import {HttpError} from '../../services/api';

interface IntegrationRow extends WorkRow{kind:string;status:string}

const kinds=['CALENDAR','DRIVE','TEAMS','SSO_GOOGLE','SSO_MICROSOFT','SSO_OKTA'] as const;

function useText(){const {locale}=useWorkspace();return (ar:string,en:string)=>locale==='ar'?ar:en;}

function integrationError(reason:unknown,t:ReturnType<typeof useWorkspace>['t'],d:ReturnType<typeof useText>){
  if(reason instanceof HttpError&&reason.code?.endsWith('_NOT_CONFIGURED'))return d('غير مُعد على هذا الخادم — تواصل مع مسؤول المنصة.','Not configured on this server — contact your platform operator.');
  return workError(t,reason);
}

export function IntegrationsPanel(){
  const {t,base,mutate,can}=useWorkspace();
  const d=useText();
  const remote=useWorkData<IntegrationRow[]>(can('organization.manage',true)?`${base}/integrations`:undefined);
  const [error,setError]=useState('');
  const labels:Record<string,[string,string]>={CALENDAR:['التقويم','Calendar'],DRIVE:['التخزين السحابي','Cloud drive'],TEAMS:['Teams','Teams'],SSO_GOOGLE:['Google SSO','Google SSO'],SSO_MICROSOFT:['Microsoft SSO','Microsoft SSO'],SSO_OKTA:['Okta SSO','Okta SSO'],DISCONNECTED:['غير متصل','Disconnected'],CONNECTED:['متصل','Connected'],PENDING:['قيد الإعداد','Pending']};
  const label=(key:string)=>labels[key]?d(...labels[key]):key;
  const rows:IntegrationRow[]=(remote.data??kinds.map(kind=>({id:`missing-${kind}`,kind,status:'DISCONNECTED'}))) as IntegrationRow[];

  return <section className="work-card"><h2>{d('التكاملات','Integrations')}</h2><p className="work-notice">{d('الاتصالات الخارجية تتطلب إعدادًا على الخادم. الأخطاء تُعرض بصدق دون ادّعاء اتصال وهمي.','External connections require server-side configuration. Errors are shown honestly without fake connected states.')}</p>{error&&<p className="work-error" role="alert">{error}</p>}<WorkState {...remote}><WorkTable rows={rows} columns={[{key:'kind',render:row=>label(String(row.kind))},{key:'status',render:row=>label(String(row.status))},{key:'updatedAt'}]} actions={row=>can('organization.manage',true)&&<>{row.status==='DISCONNECTED'?<button className="work-button secondary small" onClick={()=>void mutate(`${base}/integrations/${String(row.kind)}/connect`,{}).then(remote.reload,reason=>setError(integrationError(reason,t,d)))}>{d('اتصال','Connect')}</button>:<button className="work-button secondary small" onClick={()=>{if(!window.confirm(t.confirm))return;void mutate(`${base}/integrations/${String(row.kind)}`,undefined,'DELETE').then(remote.reload,reason=>setError(workError(t,reason)));}}>{d('قطع الاتصال','Disconnect')}</button>}</>}/></WorkState></section>;
}
