export interface ChannelReceipt{providerId:string;status:'ACCEPTED'}
export class ChannelDeliveryFailure extends Error{
 constructor(readonly code:string,readonly outcome:'RETRY'|'FAILED'|'UNCERTAIN',readonly statusCode:number|null=null){super(code);}
}
export interface TwilioOptions{accountSid:string;username:string;password:string;verifyServiceSid?:string;smsFrom?:string;messagingServiceSid?:string;whatsappFrom?:string;whatsappContentSid?:string}
export type TwilioEnvironment=Partial<Record<'TWILIO_ACCOUNT_SID'|'TWILIO_AUTH_TOKEN'|'TWILIO_API_KEY_SID'|'TWILIO_API_KEY_SECRET'|'TWILIO_VERIFY_SERVICE_SID'|'TWILIO_SMS_FROM'|'TWILIO_MESSAGING_SERVICE_SID'|'TWILIO_WHATSAPP_FROM'|'TWILIO_WHATSAPP_CONTENT_SID',string>>;
export const phoneNumberPattern=/^\+[1-9]\d{7,14}$/;
const sid=(prefix:string,value:string|undefined)=>!!value&&new RegExp('^'+prefix+'[a-f0-9]{32}$','i').test(value);
export function twilioConfiguration(env:TwilioEnvironment):TwilioOptions|null{
 if(!sid('AC',env.TWILIO_ACCOUNT_SID))return null;
 const useKey=sid('SK',env.TWILIO_API_KEY_SID)&&!!env.TWILIO_API_KEY_SECRET&&/^\S{32,128}$/.test(env.TWILIO_API_KEY_SECRET);
 if(!useKey&&!/^[a-f0-9]{32}$/i.test(env.TWILIO_AUTH_TOKEN??''))return null;
 if(env.TWILIO_SMS_FROM&&!phoneNumberPattern.test(env.TWILIO_SMS_FROM)||env.TWILIO_WHATSAPP_FROM&&!phoneNumberPattern.test(env.TWILIO_WHATSAPP_FROM)||env.TWILIO_VERIFY_SERVICE_SID&&!sid('VA',env.TWILIO_VERIFY_SERVICE_SID)||env.TWILIO_MESSAGING_SERVICE_SID&&!sid('MG',env.TWILIO_MESSAGING_SERVICE_SID)||env.TWILIO_WHATSAPP_CONTENT_SID&&!sid('HX',env.TWILIO_WHATSAPP_CONTENT_SID))return null;
 return {accountSid:env.TWILIO_ACCOUNT_SID!,username:useKey?env.TWILIO_API_KEY_SID!:env.TWILIO_ACCOUNT_SID!,password:useKey?env.TWILIO_API_KEY_SECRET!:env.TWILIO_AUTH_TOKEN!,verifyServiceSid:env.TWILIO_VERIFY_SERVICE_SID,smsFrom:env.TWILIO_SMS_FROM,messagingServiceSid:env.TWILIO_MESSAGING_SERVICE_SID,whatsappFrom:env.TWILIO_WHATSAPP_FROM,whatsappContentSid:env.TWILIO_WHATSAPP_CONTENT_SID};
}
async function boundedJson(response:Response){
 if(!response.body)throw new ChannelDeliveryFailure('CHANNEL_RESPONSE_INVALID','UNCERTAIN');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
 try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>16384)throw new ChannelDeliveryFailure('CHANNEL_RESPONSE_INVALID','UNCERTAIN');chunks.push(part.value);}const parsed:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();return parsed as Record<string,unknown>;}catch(error){if(error instanceof ChannelDeliveryFailure)throw error;throw new ChannelDeliveryFailure('CHANNEL_RESPONSE_INVALID','UNCERTAIN');}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
}
/** Fixed vendor origins, no redirects, bounded bodies and no automatic transport retries. */
export class TwilioAdapter{
 constructor(private readonly options:TwilioOptions,private readonly transport:typeof fetch=globalThis.fetch){}
 canVerify(){return !!this.options.verifyServiceSid;}
 canSendSms(){return !!(this.options.smsFrom||this.options.messagingServiceSid);}
 canSendWhatsApp(){return !!(this.options.whatsappFrom&&this.options.whatsappContentSid&&this.options.messagingServiceSid);}
 private phone(value:string){if(!phoneNumberPattern.test(value))throw new ChannelDeliveryFailure('CHANNEL_PHONE_INVALID','FAILED');return value;}
 private async post(host:'api.twilio.com'|'verify.twilio.com',path:string,body:URLSearchParams){
  let response:Response;try{response=await this.transport('https://'+host+path,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(this.options.username+':'+this.options.password).toString('base64'),'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:body.toString(),redirect:'error',signal:AbortSignal.timeout(5000)});}catch{throw new ChannelDeliveryFailure('CHANNEL_TRANSPORT_UNCERTAIN','UNCERTAIN');}
  if(!response.ok){await response.body?.cancel().catch(()=>undefined);throw new ChannelDeliveryFailure(response.status===429?'CHANNEL_RATE_LIMIT':response.status===401||response.status===403?'CHANNEL_PROVIDER_AUTH':'CHANNEL_PROVIDER_REJECTED',response.status===429?'RETRY':response.status>=500||response.status>=300&&response.status<400?'UNCERTAIN':'FAILED',response.status);}
  return boundedJson(response);
 }
 async startVerification(phone:string,locale:'ar'|'en'){
  if(!this.canVerify())throw new ChannelDeliveryFailure('PHONE_VERIFICATION_NOT_CONFIGURED','FAILED');
  const result=await this.post('verify.twilio.com','/v2/Services/'+this.options.verifyServiceSid+'/Verifications',new URLSearchParams({To:this.phone(phone),Channel:'sms',Locale:locale,RiskCheck:'enable'}));
  if(typeof result.sid!=='string'||!sid('VE',result.sid)||result.status!=='pending'||result.to!==phone)throw new ChannelDeliveryFailure('PHONE_VERIFICATION_RESPONSE_INVALID','UNCERTAIN');return {verificationId:result.sid};
 }
 async checkVerification(verificationId:string,code:string){
  if(!this.canVerify()||!sid('VE',verificationId)||!/^\d{4,10}$/.test(code))throw new ChannelDeliveryFailure('PHONE_VERIFICATION_INVALID','FAILED');
  try{const result=await this.post('verify.twilio.com','/v2/Services/'+this.options.verifyServiceSid+'/VerificationCheck',new URLSearchParams({VerificationSid:verificationId,Code:code}));if(result.sid!==verificationId||result.service_sid!==this.options.verifyServiceSid)throw new ChannelDeliveryFailure('PHONE_VERIFICATION_RESPONSE_INVALID','UNCERTAIN');return result.status==='approved';}catch(error){if(error instanceof ChannelDeliveryFailure&&error.statusCode===404)return false;throw error;}
 }
 private async message(body:URLSearchParams):Promise<ChannelReceipt>{
  const result=await this.post('api.twilio.com','/2010-04-01/Accounts/'+this.options.accountSid+'/Messages.json',body);
  if(typeof result.sid!=='string'||!/^(?:SM|MM)[a-f0-9]{32}$/i.test(result.sid))throw new ChannelDeliveryFailure('CHANNEL_RESPONSE_INVALID','UNCERTAIN');
  if(['failed','undelivered','canceled'].includes(String(result.status)))throw new ChannelDeliveryFailure('CHANNEL_PROVIDER_REJECTED','FAILED');if(!['accepted','queued','sending','sent','delivered','read'].includes(String(result.status)))throw new ChannelDeliveryFailure('CHANNEL_RESPONSE_INVALID','UNCERTAIN');return {providerId:result.sid,status:'ACCEPTED'};
 }
 async sendSms(recipient:string,message:string){if(!this.canSendSms())throw new ChannelDeliveryFailure('SMS_NOT_CONFIGURED','FAILED');if(!message||message.length>500)throw new ChannelDeliveryFailure('CHANNEL_MESSAGE_INVALID','FAILED');const body=new URLSearchParams({To:this.phone(recipient),Body:message});if(this.options.smsFrom)body.set('From',this.options.smsFrom);if(this.options.messagingServiceSid)body.set('MessagingServiceSid',this.options.messagingServiceSid);return this.message(body);}
 async sendWhatsApp(recipient:string,portalUrl:string){
  if(!this.canSendWhatsApp())throw new ChannelDeliveryFailure('WHATSAPP_NOT_CONFIGURED','FAILED');let url:URL;try{url=new URL(portalUrl);}catch{throw new ChannelDeliveryFailure('CHANNEL_MESSAGE_INVALID','FAILED');}if(url.protocol!=='https:'||url.username||url.password||url.hash||url.href.length>500)throw new ChannelDeliveryFailure('CHANNEL_MESSAGE_INVALID','FAILED');
  return this.message(new URLSearchParams({To:'whatsapp:'+this.phone(recipient),From:'whatsapp:'+this.options.whatsappFrom,MessagingServiceSid:this.options.messagingServiceSid!,ContentSid:this.options.whatsappContentSid!,ContentVariables:JSON.stringify({'1':url.href})}));
 }
}
