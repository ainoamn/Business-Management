/* global self */
// Display only a server-authorized delivery for the currently signed-in session.
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const identityKeys=['deliveryId','organizationId','recipientUserId','recipientSessionId'];
function identity(value){return value&&typeof value==='object'&&identityKeys.every(key=>typeof value[key]==='string'&&uuid.test(value[key]));}
async function api(path,options={}){
 const controller=new globalThis.AbortController(),timer=globalThis.setTimeout(()=>controller.abort(),4000);
 try{const response=await globalThis.fetch(path,{...options,credentials:'include',cache:'no-store',redirect:'error',signal:controller.signal});if(!response.ok){await response.body?.cancel();return null;}return await response.json();}catch{return null;}finally{globalThis.clearTimeout(timer);}
}
function matchingSession(session,data){return session?.user?.id===data.recipientUserId&&session.user.sessionId===data.recipientSessionId&&typeof session.csrf==='string'&&Array.isArray(session.organizations)&&session.organizations.some(org=>org.id===data.organizationId);}
function destination(href,org){
 try{const url=new globalThis.URL(href,self.location.origin);if(url.origin!==self.location.origin||url.hash||url.username||url.password||url.searchParams.get('organizationId')!==org)return null;const parts=url.pathname.split('/');if(parts.length!==4||parts[1]!=='app'||!['tasks','projects','meetings','requests','expenses','budgets','support'].includes(parts[2])||!uuid.test(parts[3]))return null;return url.href;}catch{return null;}
}
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
async function show(payload){
 const data=payload?.data;if(!identity(data)||!await self.registration.pushManager.getSubscription())return;
 const session=await api('/api/v1/work/auth/me');if(!matchingSession(session,data))return;
 const claimed=await api('/api/v1/work/organizations/'+data.organizationId+'/push/deliveries/'+data.deliveryId+'/display',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:'{}'});
 if(!claimed?.show||typeof claimed.title!=='string'||typeof claimed.body!=='string'||typeof claimed.tag!=='string'||!destination(claimed.href,data.organizationId)||!identity(claimed)||identityKeys.some(key=>claimed[key]!==data[key]))return;
 await self.registration.showNotification(claimed.title.slice(0,120),{body:claimed.body.slice(0,300),tag:claimed.tag.slice(0,120),renotify:false,requireInteraction:false,data:{deliveryId:data.deliveryId,organizationId:data.organizationId,recipientUserId:data.recipientUserId,recipientSessionId:data.recipientSessionId,href:claimed.href}});
}
self.addEventListener('push',event=>{if(!event.data)return;let payload;try{payload=event.data.json();}catch{return;}event.waitUntil(show(payload).catch(()=>undefined));});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const data=event.notification.data;if(!identity(data))return;const href=destination(data.href,data.organizationId);if(!href)return;
 event.waitUntil((async()=>{const session=await api('/api/v1/work/auth/me');if(!matchingSession(session,data))return;const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true}),existing=windows.find(client=>new globalThis.URL(client.url).origin===self.location.origin);if(existing){const navigated=await existing.navigate(href);if(navigated){await navigated.focus();return;}}await self.clients.openWindow(href);})().catch(()=>undefined));
});
