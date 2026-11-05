import {useCallback,useEffect,useState} from 'react';
import type {PlatformResource} from '@work/shared-schemas';
import type {PlatformList,PlatformRow,PlatformSessionView} from '@work/shared-types';
import {platformLabel,type PlatformText} from '../../i18n/platform';
import {platformRequest} from '../../services/platform';
import {columns,fieldsFor} from './fields';
import {AdminDialog,AdminForm,errorLabel} from './forms';

export function permitted(session:PlatformSessionView,permission:string) {return session.actor.isOwner||session.actor.permissions.includes(permission);}
function Cell({value,t}:{value:unknown;t:PlatformText}) {
  if(value===null||value===undefined)return <span>—</span>;
  if(typeof value==='boolean') return <span className={`admin-tag ${value?'positive':'muted'}`}>{value?t.yes:t.no}</span>;
  if(Array.isArray(value))return <div className="admin-permission-tags">{value.map(String).map(v=><span className="admin-tag" key={v}>{v}</span>)}</div>;
  if(typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value))return <code className="admin-record-id" dir="ltr">{value}</code>;
  return <span>{platformLabel(t,String(value))}</span>;
}

export function ResourcePanel({resource,t,session}:{resource:PlatformResource;t:PlatformText;session:PlatformSessionView}) {
  const [data,setData]=useState<PlatformList>();const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [search,setSearch]=useState('');const [query,setQuery]=useState('');const [page,setPage]=useState(1);const [revision,setRevision]=useState(0);const [editor,setEditor]=useState<{row?:PlatformRow}|null>(null);
  const canManage=permitted(session,`${resource}.manage`)&&(!['accounts','roles'].includes(resource)||session.actor.isOwner);
  const canCreate=canManage&&!['users','audit'].includes(resource);
  const reload=useCallback(()=>setRevision(v=>v+1),[]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    void platformRequest<PlatformList>(`platform/resources/${resource}?page=${page}&pageSize=20&search=${encodeURIComponent(query)}`,{signal:controller.signal}).then(result=>setData(result),reason=>{if(!controller.signal.aborted)setError(errorLabel(t,reason));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[resource,page,query,revision,t]);
  async function save(body:Record<string,unknown>) {
    await platformRequest(`platform/resources/${resource}${editor?.row?`/${editor.row.id}`:''}`,{method:editor?.row?'PATCH':'POST',body,csrf:session.csrf});setEditor(null);reload();
  }
  async function voidInvoice(id:string) {
    if(!window.confirm(t.confirmVoid))return;
    try{await platformRequest(`platform/resources/invoices/${id}`,{method:'PATCH',body:{disabled:true},csrf:session.csrf});reload();}catch(reason){setError(errorLabel(t,reason));}
  }
  const hint=resource==='organizations'?t.organizationCreateHint:resource==='ledger'?t.manualNote:resource==='plans'?t.limitsNote:resource==='accounts'||resource==='roles'?t.ownerNote:resource==='audit'?t.auditHint:resource==='pages'?t.pageHint:null;
  return <section className="admin-panel">
    {hint&&<p className="admin-notice">{hint}</p>}
    <div className="admin-toolbar"><form onSubmit={event=>{event.preventDefault();setPage(1);setQuery(search);}}><input aria-label={t.search} placeholder={t.searchHint} value={search} onChange={event=>setSearch(event.target.value)} maxLength={100}/><button className="admin-button secondary">{t.search}</button></form><div><button className="admin-button secondary" onClick={reload}>{t.refresh}</button>{canCreate&&<button className="admin-button" onClick={()=>setEditor({})}>+ {t.create}</button>}</div></div>
    {error?<div className="admin-empty"><p role="alert" className="admin-error">{error}</p><button className="admin-button secondary" onClick={reload}>{t.retry}</button></div>:loading?<p className="admin-empty" role="status">{t.loading}</p>:data?.items.length?<>
      <div className="admin-table-scroll"><table><caption className="admin-sr-only">{platformLabel(t,resource)}</caption><thead><tr>{columns[resource].map(key=><th key={key} scope="col">{platformLabel(t,key)}</th>)}{(canManage||resource==='pages')&&<th scope="col">{t.actions}</th>}</tr></thead><tbody>{data.items.map(row=><tr key={row.id}>{columns[resource].map(key=><td key={key}><Cell value={row[key]} t={t}/></td>)}{(canManage||resource==='pages')&&<td><div className="admin-row-actions">{canManage&&!['ledger','audit','invoices'].includes(resource)&&<button className="admin-button secondary small" disabled={resource==='accounts'&&row.isOwner===true} title={row.isOwner?t.ownerProtected:undefined} onClick={()=>setEditor({row})}>{t.edit}</button>}{canManage&&resource==='invoices'&&row.status==='ISSUED'&&<button className="admin-button secondary small" onClick={()=>void voidInvoice(row.id)}>{t.voidInvoice}</button>}{resource==='pages'&&row.status==='PUBLISHED'&&<a className="admin-button secondary small" href={`/content/${row.slug}`} target="_blank" rel="noreferrer">{t.viewPage} ↗</a>}</div></td>}</tr>)}</tbody></table></div>
      <div className="admin-pagination"><span>{t.total}: {data.total} · {t.page} {page}</span><div><button className="admin-button secondary small" disabled={page<=1} onClick={()=>setPage(v=>v-1)}>{t.previous}</button><button className="admin-button secondary small" disabled={page*20>=data.total} onClick={()=>setPage(v=>v+1)}>{t.next}</button></div></div>
    </>:<div className="admin-empty"><span aria-hidden="true">▤</span><h2>{t.empty}</h2><p>{t.emptyHint}</p></div>}
    {editor&&<AdminDialog title={`${editor.row?t.edit:t.create} · ${platformLabel(t,resource)}`} t={t} onClose={()=>setEditor(null)}><AdminForm fields={fieldsFor(resource,!!editor.row)} initial={editor.row} t={t} onSave={save} onCancel={()=>setEditor(null)} manual={resource==='ledger'}/></AdminDialog>}
  </section>;
}
