import {useState} from 'react';
import {useWorkspace} from './context';
import {useWorkData,WorkState} from './data';
import {WorkForm,workError} from './form';

function useText(){const {locale}=useWorkspace();return (ar:string,en:string)=>locale==='ar'?ar:en;}

export function MfaPanel(){
  const {t,mutate}=useWorkspace();
  const d=useText();
  const status=useWorkData<{mfaEnabled:boolean}>('work/mfa/status');
  const [error,setError]=useState('');
  const [enroll,setEnroll]=useState<{secret:string;uri:string}|null>(null);
  const [recovery,setRecovery]=useState<string[]|null>(null);
  const [busy,setBusy]=useState(false);

  async function start(){
    setBusy(true);setError('');
    try{
      const result=await mutate<{secret:string;uri:string}>('work/mfa/enroll/start',{label:t.brand});
      setEnroll(result);setRecovery(null);
    }catch(reason){setError(workError(t,reason));}finally{setBusy(false);}
  }

  return (
    <section className="work-card">
      <h2>{d('المصادقة الثنائية (TOTP)','Two-factor authentication (TOTP)')}</h2>
      <p className="work-notice">{d('فعّل رمزًا لمرة واحدة لتأمين تسجيل الدخول.','Enable an authenticator app to protect sign-in.')}</p>
      {error&&<p className="work-error" role="alert">{error}</p>}
      <WorkState {...status}>
        {status.data&&!status.data.mfaEnabled&&!enroll&&<button className="work-button" disabled={busy} onClick={()=>void start()}>{busy?t.loading:d('بدء التفعيل','Start setup')}</button>}
        {status.data?.mfaEnabled&&<p className="work-success" role="status">{d('المصادقة الثنائية مفعّلة.','Two-factor authentication is enabled.')}</p>}
        {enroll&&<>
          <p>{d('امسح الرمز أو أدخل المفتاح في تطبيق المصادقة.','Scan the QR code or enter the secret in your authenticator app.')}</p>
          <p className="work-muted"><a href={enroll.uri} target="_blank" rel="noreferrer">{d('فتح في تطبيق المصادقة','Open in authenticator app')}</a></p>
          <code dir="ltr">{enroll.secret}</code>
          <WorkForm t={t} fields={[{key:'code',label:d('رمز التحقق (6 أرقام)','Verification code (6 digits)'),min:6,max:6}]} submitLabel={d('إكمال التفعيل','Complete setup')} onSave={async values=>{const result=await mutate<{ok:true;recoveryCodes:string[]}>('work/mfa/enroll/complete',{secret:enroll.secret,code:values.code});setEnroll(null);setRecovery(result.recoveryCodes);status.reload();}}/>
        </>}
        {recovery&&<>
          <p className="work-notice">{d('احفظ رموز الاسترداد في مكان آمن. لن تُعرض مرة أخرى.','Save these recovery codes securely. They will not be shown again.')}</p>
          <ul>{recovery.map(code=><li key={code}><code dir="ltr">{code}</code></li>)}</ul>
        </>}
        {status.data?.mfaEnabled&&<WorkForm t={t} fields={[{key:'code',label:d('رمز التحقق أو رمز استرداد','Authenticator or recovery code'),min:6,max:20}]} submitLabel={d('تعطيل المصادقة الثنائية','Disable two-factor authentication')} onSave={async values=>{await mutate('work/mfa',{code:values.code},'DELETE');setRecovery(null);status.reload();}}/>}
      </WorkState>
    </section>
  );
}
