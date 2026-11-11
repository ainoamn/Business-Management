import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../../apps/web/public/push-sw.js',import.meta.url),'utf8');
const id='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222',user='33333333-3333-4333-8333-333333333333',session='44444444-4444-4444-8444-444444444444';
const data={deliveryId:id,organizationId:org,recipientUserId:user,recipientSessionId:session};
function harness(options:{signedIn?:boolean;sessionId?:string;claim?:boolean;href?:string;subscribed?:boolean}={}){
 const listeners:Record<string,(event:unknown)=>void>={},shown:unknown[]=[],opened:string[]=[],requests:string[]=[];
 const self={location:{origin:'https://workspace.example'},addEventListener:(name:string,fn:(event:unknown)=>void)=>listeners[name]=fn,registration:{pushManager:{getSubscription:async()=>options.subscribed===false?null:{}},showNotification:async(...args:unknown[])=>{shown.push(args);}},clients:{matchAll:async()=>[],openWindow:async(href:string)=>{opened.push(href);}}};
 const fetch=async(path:string)=>{requests.push(path);return {ok:true,json:async()=>path.endsWith('/auth/me')?(options.signedIn===false?null:{user:{id:user,sessionId:options.sessionId??session},csrf:'fixture',organizations:[{id:org}]}):{...data,show:options.claim!==false,title:'Authorized update',body:'Generic content',tag:'fixture',href:options.href??`/app/tasks/${id}?organizationId=${org}`}};};
 runInNewContext(source,{self,fetch,URL,AbortController,setTimeout,clearTimeout});
 async function emit(name:string,event:object){let pending:Promise<unknown>|undefined;listeners[name]!({...event,waitUntil:(value:Promise<unknown>)=>pending=value});await pending;}
 return {shown,opened,requests,emit};
}
describe('push worker current-session privacy',()=>{
 it('uses server content and safe destination instead of vendor-controlled text',async()=>{const h=harness();await h.emit('push',{data:{json:()=>({data,title:'Forged title',body:'Secret vendor content'})}});expect(h.shown).toHaveLength(1);expect(JSON.stringify(h.shown)).toContain('Authorized update');expect(JSON.stringify(h.shown)).not.toContain('Forged title');expect(h.requests).toHaveLength(2);});
 it.each([{signedIn:false},{sessionId:id},{subscribed:false}])('suppresses messages without the correct active browser session %j',async options=>{const h=harness(options);await h.emit('push',{data:{json:()=>({data})}});expect(h.shown).toHaveLength(0);expect(h.requests.some(path=>path.endsWith('/display'))).toBe(false);});
 it.each([{claim:false},{href:`https://evil.example/app/tasks/${id}?organizationId=${org}`},{href:`/app/tasks/${id}?organizationId=${user}`}])('suppresses denied claims and unsafe links %j',async options=>{const h=harness(options);await h.emit('push',{data:{json:()=>({data})}});expect(h.shown).toHaveLength(0);});
 it('checks identity again before opening a notification',async()=>{const h=harness({signedIn:false});await h.emit('notificationclick',{notification:{close:()=>undefined,data:{...data,href:`/app/tasks/${id}?organizationId=${org}`}}});expect(h.opened).toHaveLength(0);});
 it('opens only the authorized workspace record',async()=>{const h=harness();await h.emit('notificationclick',{notification:{close:()=>undefined,data:{...data,href:`/app/tasks/${id}?organizationId=${org}`}}});expect(h.opened).toEqual([`https://workspace.example/app/tasks/${id}?organizationId=${org}`]);});
});
