import {useCallback,useEffect,useId,useState,type FormEvent} from 'react';
import {HttpError,requestApi} from '../services/api';

export function MfaSettings({namespace,csrf,locale,onSessionRefresh}:{namespace:'work'|'platform';csrf:string;locale:'ar'|'en';onSessionRefresh:()=>Promise<void>}){
 const d=(ar:string,en:string)=>locale==='ar'?ar:en,id=useId();
 const [enabled,setEnabled]=useState<boolean>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[password,setPassword]=useState(''),[code,setCode]=useState('');
 const [setup,setSetup]=useState<{setupToken:string;secret:string;uri:string}>(),[recovery,setRecovery]=useState<string[]>();
 const refresh=useCallback(async()=>{const value=await requestApi<{mfaEnabled:boolean}>(`${namespace}/mfa/status`);setEnabled(value.mfaEnabled);},[namespace]);
 useEffect(()=>{void refresh().catch(()=>setError(locale==='ar'?'تعذر تحميل حالة المصادقة.':'Could not load authentication status.'));},[refresh,locale]);
 async function submit(event:FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   if(setup){const result=await requestApi<{recoveryCodes:string[]}>(`${namespace}/mfa/enroll/complete`,{method:'POST',csrf,body:{setupToken:setup.setupToken,code}});setRecovery(result.recoveryCodes);setSetup(undefined);setEnabled(true);setCode('');await onSessionRefresh();}
   else if(enabled){await requestApi(`${namespace}/mfa`,{method:'DELETE',csrf,body:{currentPassword:password,code}});setEnabled(false);setRecovery(undefined);setPassword('');setCode('');await onSessionRefresh();}
   else{setSetup(await requestApi(`${namespace}/mfa/enroll/start`,{method:'POST',csrf,body:{currentPassword:password,label:namespace==='platform'?'Platform administration':'Work account'}}));setPassword('');setCode('');setRecovery(undefined);}
  }catch(reason){
   const status=reason instanceof HttpError?reason.status:0;
   setError(status===429?d('محاولات كثيرة. حاول بعد 15 دقيقة.','Too many attempts. Try again after 15 minutes.'):status===409?d('العامل مفعّل بالفعل. حدّث الصفحة.','The factor is already enabled. Refresh the page.'):d('لم تكتمل العملية. تحقق من كلمة المرور والرمز، أو ابدأ الإعداد مجددًا عند انتهاء صلاحيته.','Could not complete this action. Check your password and code, or restart an expired setup.'));
  }finally{setBusy(false);}
 }
 return <section className={namespace==='work'?'work-card':'admin-panel'}>
  <h2>{d('المصادقة الثنائية','Two-factor authentication')}</h2>
  <p>{enabled===undefined?d('جارٍ التحميل…','Loading…'):enabled?d('المصادقة الثنائية مفعّلة.','Two-factor authentication is enabled.'):d('أضف تطبيق مصادقة لحماية تسجيل الدخول.','Add an authenticator app to protect sign-in.')}</p>
  {error&&<p role="alert" className={namespace==='work'?'work-error':'admin-error'}>{error}</p>}
  {recovery&&<div role="status"><p>{d('احفظ رموز الاسترداد الآن في مكان آمن. كل رمز يُستخدم مرة واحدة، ولن تُعرض مجددًا.','Save these recovery codes securely now. Each works once and will not be displayed again.')}</p><ul>{recovery.map(value=><li key={value}><code dir="ltr">{value}</code></li>)}</ul><button type="button" onClick={()=>setRecovery(undefined)}>{d('حفظت الرموز — إخفاء','I saved the codes — hide')}</button></div>}
  {enabled!==undefined&&<form onSubmit={event=>void submit(event)} className={namespace==='work'?'work-form':'admin-form'}><fieldset disabled={busy}>
   {setup?<><p>{d('أدخل المفتاح التالي في تطبيق المصادقة، ثم اكتب الرمز المؤلف من 6 أرقام. تنتهي صلاحية الإعداد بعد 10 دقائق.','Enter this secret in your authenticator app, then enter its 6-digit code. Setup expires after 10 minutes.')}</p><p><code dir="ltr" style={{overflowWrap:'anywhere'}}>{setup.secret}</code></p><a href={setup.uri}>{d('فتح تطبيق المصادقة','Open authenticator app')}</a></>:<><label htmlFor={`${id}-password`}>{d('كلمة المرور الحالية','Current password')}</label><input id={`${id}-password`} type="password" autoComplete="current-password" maxLength={128} required value={password} onChange={event=>setPassword(event.target.value)}/></>}
   {(setup||enabled)&&<><label htmlFor={`${id}-code`}>{setup?d('رمز تطبيق المصادقة','Authenticator code'):d('رمز تطبيق المصادقة أو الاسترداد','Authenticator or recovery code')}</label><input id={`${id}-code`} autoComplete="one-time-code" dir="ltr" required maxLength={64} value={code} onChange={event=>setCode(event.target.value)}/></>}
   <p>{d('تفعيل العامل أو تعطيله يُنهي الجلسات السابقة ويُجدّد الجلسة الحالية.','Enabling or disabling this factor ends previous sessions and refreshes this session.')}</p>
   <button className={namespace==='work'?'work-button':'admin-button'} disabled={busy}>{busy?d('جارٍ الحفظ…','Saving…'):setup?d('إكمال التفعيل','Complete setup'):enabled?d('تعطيل المصادقة الثنائية','Disable two-factor authentication'):d('بدء التفعيل','Start setup')}</button>
   {setup&&<button type="button" disabled={busy} onClick={()=>{setSetup(undefined);setCode('');}}>{d('إلغاء الإعداد','Cancel setup')}</button>}
  </fieldset></form>}
 </section>;
}
