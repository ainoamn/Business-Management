import {useEffect,useState} from 'react';
import {useWorkspace} from './context';
import {useWorkData,WorkState} from './data';
import {workError} from './form';
interface PushConfig{configured:boolean;publicKey:string|null;applicationKeyHash:string|null}
interface Device{id:string;userAgent:string|null;active:boolean;currentSession:boolean;endpointHash:string|null}
function applicationKey(value:string){const decoded=atob(value.replaceAll('-','+').replaceAll('_','/'));return Uint8Array.from(decoded,char=>char.charCodeAt(0));}
export function PushPanel({onChange}:{onChange:()=>void}){
 const {base,locale,t,mutate}=useWorkspace(),d=(ar:string,en:string)=>locale==='ar'?ar:en;
 const config=useWorkData<PushConfig>(`${base}/push/config`),devices=useWorkData<{items:Device[];total:number}>(`${base}/push/devices?pageSize=100`);
 const [supported,setSupported]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[currentHash,setCurrentHash]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{setSupported(window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window);},[]);
 async function nativeSubscription(){const registration=await navigator.serviceWorker.getRegistration('/');return registration?.pushManager.getSubscription();}
 useEffect(()=>{let live=true;setCurrentHash('');if(supported)void nativeSubscription().then(async subscription=>{if(!subscription)return;const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(new URL(subscription.endpoint).href));if(live)setCurrentHash(Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join(''));}).catch(()=>undefined);return()=>{live=false;};},[supported,base,devices.data]);
 async function enable(){
  if(!config.data?.configured||!config.data.publicKey||!supported)return;
  setBusy(true);setError('');setNotice('');
  try{
   const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
   if(permission!=='granted'){setNotice(d('لم يُمنح إذن الإشعارات. يمكنك تغييره من إعدادات المتصفح.','Notification permission was not granted. You can change it in browser settings.'));return;}
   await navigator.serviceWorker.register('/push-sw.js',{scope:'/'});const registration=await navigator.serviceWorker.ready,key=applicationKey(config.data.publicKey);
   let subscription=await registration.pushManager.getSubscription();const existing=subscription?.options.applicationServerKey;
   if(subscription&&(!existing||!new Uint8Array(existing).every((byte,index)=>byte===key[index])||existing.byteLength!==key.byteLength)){await subscription.unsubscribe();subscription=null;}
   subscription??=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
   const json=subscription.toJSON();if(!json.endpoint||!json.keys?.p256dh||!json.keys.auth)throw new Error('Invalid browser subscription');
   await mutate(`${base}/push/devices`,{endpoint:json.endpoint,keys:{p256dh:json.keys.p256dh,auth:json.keys.auth}});devices.reload();onChange();setNotice(d('تم تفعيل إشعارات هذا المتصفح لهذه الجلسة.','Notifications enabled for this browser session.'));
  }catch(reason){setError(workError(t,reason));}finally{setBusy(false);}
 }
 async function revoke(device:Device){setBusy(true);setError('');setNotice('');try{await mutate(`${base}/push/devices/${device.id}`,undefined,'DELETE');if(supported&&device.currentSession&&device.endpointHash===currentHash){const subscription=await nativeSubscription();await subscription?.unsubscribe();}devices.reload();onChange();}catch(reason){setError(workError(t,reason));}finally{setBusy(false);}}
 return <section className="work-card"><h2>{d('إشعارات المتصفح والأجهزة','Browser notifications and devices')}</h2><WorkState {...config}>{config.data&&<><p>{!config.data.configured?d('خدمة إشعارات المتصفح غير مهيأة على الخادم.','Browser push is not configured on the server.'):!supported?d('يتطلب التفعيل متصفحًا يدعم الإشعارات واتصال HTTPS أو localhost.','Enabling notifications requires a supported browser and HTTPS or localhost.'):d('فعّل الإشعارات لهذا المتصفح. يُلغى وصول الجهاز عند إلغاء جلسته، وتخضع الإشعارات لصلاحياتك الحالية.','Enable notifications for this browser. Revoking its session disables the device, and notifications respect your current permissions.')}</p><button className="work-button" disabled={busy||!supported||!config.data.configured} onClick={()=>void enable()}>{d('تفعيل إشعارات هذا المتصفح','Enable this browser')}</button></>}</WorkState>{error&&<p className="work-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}<WorkState {...devices}><ul>{devices.data?.items.map(device=><li key={device.id}><p style={{overflowWrap:'anywhere'}}>{device.userAgent||d('جهاز متصفح','Browser device')} — {device.active?d('نشط','Active'):d('غير نشط','Inactive')}{device.currentSession?' · '+d('الجلسة الحالية','Current session'):''}</p>{<button className="work-button secondary small" disabled={busy} onClick={()=>void revoke(device)}>{d('إلغاء الجهاز','Revoke device')}</button>}</li>)}</ul>{devices.data?.total===0&&<p>{d('لا توجد أجهزة مسجلة.','No registered devices.')}</p>}</WorkState></section>;
}
