import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {platformPermissions} from '@work/shared-schemas';
import type {PlatformList,PlatformRow} from '@work/shared-types';
import {platformRequest,PlatformHttpError} from '../../services/platform';
import {platformLabel,type PlatformText} from '../../i18n/platform';
import type {AdminField} from './fields';

export type FormValues=Record<string,string|boolean|string[]>;
export function errorLabel(t:PlatformText,error:unknown) {
  if(error instanceof PlatformHttpError) return error.status===401?t.unauthorized:error.status===403?t.forbidden:error.status===400?t.invalid:error.status===409?t.conflict:error.status===429?t.rateLimited:t.unavailable;
  return t.unavailable;
}
function ReferenceField({field,value,onChange,t}:{field:AdminField;value:string;onChange:(value:string)=>void;t:PlatformText}) {
  const [search,setSearch]=useState('');const [items,setItems]=useState<PlatformRow[]>([]);const [error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>{void platformRequest<PlatformList>(`platform/resources/${field.resource}?search=${encodeURIComponent(search)}&page=1&pageSize=20`,{signal:controller.signal}).then(result=>{setItems(result.items);setError('');},reason=>{if(!controller.signal.aborted)setError(errorLabel(t,reason));});},250);
    return ()=>{clearTimeout(timeout);controller.abort();};
  },[search,field.resource,t]);
  return <div className="admin-reference"><input aria-label={`${platformLabel(t,field.key)} — ${t.referenceSearch}`} placeholder={t.referenceSearch} value={search} onChange={event=>setSearch(event.target.value)}/><select aria-label={platformLabel(t,field.key)} required={!field.optional} value={value} onChange={event=>onChange(event.target.value)}><option value="">{t.noSelection}</option>{value&&!items.some(item=>item.id===value)&&<option value={value}>{value}</option>}{items.map(item=><option key={item.id} value={item.id}>{String(item.name??item.displayName??item.number??item.title??item.id)}</option>)}</select>{error&&<span className="admin-error" role="alert">{error}</span>}{value&&<small dir="ltr">{value}</small>}</div>;
}

export function AdminForm({fields,initial,t,onSave,onCancel,disabled=false,manual=false}:{fields:AdminField[];initial?:PlatformRow;t:PlatformText;onSave:(body:Record<string,unknown>)=>Promise<void>;onCancel?:()=>void;disabled?:boolean;manual?:boolean}) {
  const [values,setValues]=useState<FormValues>(()=>Object.fromEntries(fields.map(field=>{
    const value=initial?.[field.key];
    return [field.key,field.type==='checkbox'?Boolean(value??field.key==='active'):field.type==='permissions'?Array.isArray(value)?value:[]:field.type==='date'&&typeof value==='string'?new Date(value).toISOString().slice(0,16):value!==null&&value!==undefined?String(value):field.options?.[0]??field.default??''];
  })));
  const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [confirmed,setConfirmed]=useState(false);const [saved,setSaved]=useState(false);const id=useId();
  function set(key:string,value:string|boolean|string[]) {setValues(current=>({...current,[key]:value}));setSaved(false);}
  async function submit(event:FormEvent) {
    event.preventDefault();if(saving||disabled||(manual&&!confirmed))return;
    setError('');setSaving(true);setSaved(false);
    try {
      const body:Record<string,unknown>={};
      for(const field of fields) {
        const value=values[field.key];
        if(field.optional&&!value) continue;
        body[field.key]=field.type==='number'?Number(value):field.type==='date'?new Date(String(value)).toISOString():value;
      }
      await onSave(body);setSaved(true);
    }catch(reason){setError(errorLabel(t,reason));}finally{setSaving(false);}
  }
  return <form className="admin-form" onSubmit={event=>void submit(event)}>
    <fieldset disabled={saving||disabled}><div className="admin-form-grid">{fields.map(field=>{
      const label=platformLabel(t,field.key);const value=values[field.key];
      if(field.type==='permissions') return <fieldset className="admin-permissions admin-full" key={field.key}><legend>{label}</legend>{platformPermissions.map(permission=>{
        const [resource,action]=permission.split('.');
        return <label key={permission}><input type="checkbox" checked={Array.isArray(value)&&value.includes(permission)} onChange={event=>set(field.key,event.target.checked?[...(Array.isArray(value)?value:[]),permission]:(Array.isArray(value)?value:[]).filter(p=>p!==permission))}/>{platformLabel(t,resource!)} · {platformLabel(t,action!)}</label>;
      })}</fieldset>;
      if(field.type==='checkbox') return <label className="admin-check" key={field.key}><input type="checkbox" checked={value===true} onChange={event=>set(field.key,event.target.checked)}/>{label}</label>;
      return <div className={`admin-field ${field.type==='textarea'?'admin-full':''}`} key={field.key}><label htmlFor={`${id}-${field.key}`}>{label}</label>{field.type==='reference'?<ReferenceField field={field} value={String(value??'')} onChange={next=>set(field.key,next)} t={t}/>:field.type==='select'?<select id={`${id}-${field.key}`} value={String(value??'')} onChange={event=>set(field.key,event.target.value)}>{field.options?.map(option=><option key={option} value={option}>{platformLabel(t,option)}</option>)}</select>:field.type==='textarea'?<textarea id={`${id}-${field.key}`} rows={field.key==='body'?10:3} required={!field.optional} value={String(value??'')} onChange={event=>set(field.key,event.target.value)}/>:<input id={`${id}-${field.key}`} type={field.type==='date'?'datetime-local':field.type==='money'?'text':field.type??'text'} inputMode={field.type==='money'?'decimal':undefined} pattern={field.type==='money'?'(0|[1-9][0-9]{0,8})([.][0-9]{1,3})?':undefined} min={field.type==='number'?field.key==='sessionMinutes'?15:field.key==='seats'||field.key==='maxSeats'?1:0:undefined} max={field.key==='sessionMinutes'?480:undefined} minLength={field.type==='password'?12:undefined} maxLength={field.type==='password'?128:field.type==='money'?13:254} autoComplete={field.type==='password'?'new-password':'off'} required={!field.optional} value={String(value??'')} onChange={event=>set(field.key,event.target.value)}/>}</div>;
    })}</div>{manual&&<label className="admin-check admin-full"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} required/>{t.manualConfirm}</label>}</fieldset>
    {error&&<p className="admin-error" role="alert">{error}</p>}{saved&&<p className="admin-success" role="status">{t.success}</p>}
    <div className="admin-form-actions">{!disabled&&<button className="admin-button" disabled={saving||(manual&&!confirmed)}>{saving?t.loading:t.save}</button>}{onCancel&&<button className="admin-button secondary" type="button" onClick={onCancel} disabled={saving}>{t.cancel}</button>}</div>
  </form>;
}

export function AdminDialog({title,children,onClose,t,wide=false}:{title:string;children:React.ReactNode;onClose:()=>void;t:Pick<PlatformText,'close'>;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);const id=useId();
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();return ()=>dialog?.close();},[]);
  return <dialog className={`admin-dialog${wide?' wide':''}`} ref={ref} aria-labelledby={id} onCancel={event=>{event.preventDefault();onClose();}}><div className="admin-dialog-heading"><h2 id={id}>{title}</h2><button aria-label={t.close} className="admin-icon-button" onClick={onClose}>×</button></div>{children}</dialog>;
}
