import {createECDH,createHash,timingSafeEqual} from 'node:crypto';
import {request} from 'node:https';
import type {ClientRequest} from 'node:http';
import * as webpush from 'web-push';
import {pushEndpoint,PushEndpointRejected,resolvePushEndpoint} from './push-endpoint';
import type {PushPayload,PushSubscription} from './channel-providers';
export interface VapidConfiguration{subject:string;publicKey:string;privateKey:string}
export class PushDeliveryFailure extends Error{constructor(readonly code:string,readonly retryable:boolean,readonly statusCode:number|null=null,readonly retryAfterSeconds:number|null=null){super(code);}}
export function vapidConfiguration(subject:string|undefined,publicKey:string|undefined,privateKey:string|undefined):VapidConfiguration|null{
 try{if(!subject||subject.length>200||!publicKey||!privateKey||!/^[a-z0-9_-]{87}$/i.test(publicKey)||!/^[a-z0-9_-]{43}$/i.test(privateKey))return null;const identity=new URL(subject);if(!['https:','mailto:'].includes(identity.protocol)||identity.hash||identity.search||identity.username||identity.password||identity.protocol==='mailto:'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.pathname)||identity.protocol==='https:'&&identity.hostname==='localhost')return null;const privateBytes=Buffer.from(privateKey,'base64url'),publicBytes=Buffer.from(publicKey,'base64url');if(privateBytes.length!==32||publicBytes.length!==65||publicBytes[0]!==4)return null;const pair=createECDH('prime256v1');pair.setPrivateKey(privateBytes);if(!timingSafeEqual(pair.getPublicKey(),publicBytes))return null;webpush.getVapidHeaders('https://example.com',subject,publicKey,privateKey,'aes128gcm');return {subject,publicKey,privateKey};}catch{return null;}
}
export function validPushSubscription(value:PushSubscription){
 pushEndpoint(value.endpoint);if(!/^[a-z0-9_-]{87}$/i.test(value.keys.p256dh)||!/^[a-z0-9_-]{22}$/i.test(value.keys.auth))throw new PushEndpointRejected();
 try{const point=Buffer.from(value.keys.p256dh,'base64url'),auth=Buffer.from(value.keys.auth,'base64url');if(point.length!==65||auth.length!==16)throw Error();const pair=createECDH('prime256v1');pair.generateKeys();pair.computeSecret(point);}catch{throw new PushEndpointRejected();}
 return {endpoint:new URL(value.endpoint).href,keys:{p256dh:value.keys.p256dh,auth:value.keys.auth}};
}
export function encryptedPushRequest(config:VapidConfiguration,subscription:PushSubscription,payload:PushPayload){
 const value=validPushSubscription(subscription),body=JSON.stringify(payload);if(Buffer.byteLength(body)>2048)throw new PushDeliveryFailure('PUSH_PAYLOAD_TOO_LARGE',false);
 const topic=createHash('sha256').update(String(payload.data?.deliveryId??body)).digest('base64url').slice(0,32);
 return webpush.generateRequestDetails(value,body,{vapidDetails:config,contentEncoding:'aes128gcm',TTL:300,urgency:'normal',topic});
}
/** Uses the library for protocol encryption/signing and a bounded, DNS-pinned transport. */
export async function deliverWebPush(config:VapidConfiguration,subscription:PushSubscription,payload:PushPayload){
 const deadline=Date.now()+5000;
 let destination:Awaited<ReturnType<typeof resolvePushEndpoint>>;
 try{destination=await resolvePushEndpoint(subscription.endpoint,deadline);}catch(error){if(error instanceof PushEndpointRejected)throw new PushDeliveryFailure('PUSH_ENDPOINT_REJECTED',false);throw new PushDeliveryFailure('PUSH_NETWORK_TIMEOUT',true);}
 const details=encryptedPushRequest(config,subscription,payload),remaining=deadline-Date.now();if(remaining<=0)throw new PushDeliveryFailure('PUSH_NETWORK_TIMEOUT',true);
 return new Promise<{statusCode:number}>((resolve,reject)=>{
  let settled=false;let outbound:ClientRequest|undefined;const timeout=setTimeout(()=>finish(new PushDeliveryFailure('PUSH_NETWORK_TIMEOUT',true)),remaining);timeout.unref();
  function finish(error:PushDeliveryFailure|null,statusCode=0){if(settled)return;settled=true;clearTimeout(timeout);outbound?.destroy();if(error)reject(error);else resolve({statusCode});}
  try{outbound=request({protocol:'https:',hostname:destination.url.hostname.replace(/^\[|\]$/g,''),port:443,path:destination.url.pathname+destination.url.search,method:details.method,headers:details.headers,agent:false,family:destination.family,lookup:(_host,options,callback)=>{if(options.all)callback(null,[{address:destination.address,family:destination.family}]);else callback(null,destination.address,destination.family);}},response=>{
   const status=response.statusCode??0,retry=response.headers['retry-after'],delay=typeof retry==='string'&&/^\d{1,6}$/.test(retry)?Math.min(3600,Number(retry)):null;response.destroy();
   if(status>=200&&status<300)finish(null,status);else finish(new PushDeliveryFailure(status===404||status===410?'PUSH_SUBSCRIPTION_EXPIRED':status===429?'PUSH_RATE_LIMIT':status===401||status===403?'PUSH_PROVIDER_AUTH':'PUSH_PROVIDER_ERROR',status===429||status>=500||status===401||status===403,status,delay));
  });
  outbound.on('error',()=>finish(new PushDeliveryFailure('PUSH_NETWORK_TIMEOUT',true)));outbound.end(details.body);}catch{finish(new PushDeliveryFailure('PUSH_REQUEST_INVALID',false));}
 });
}

export type PushLibrary=typeof webpush;

