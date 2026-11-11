import {createHash} from 'node:crypto';
import {environment} from '../config/environment';
import {pushCredentialKey} from './push-crypto';
import {pushEndpoint} from './push-endpoint';
import {ChannelDeliveryFailure,TwilioAdapter,twilioConfiguration,type ChannelReceipt} from './twilio-adapter';
export interface MobileNotificationProvider{
 isVerificationEnabled():boolean;isSmsEnabled():boolean;isWhatsAppEnabled():boolean;
 getCredentialKey():Buffer|null;getCredentialKeyHash():string|null;getProviderKeyHash():string|null;
 startVerification(phone:string,locale:'ar'|'en'):Promise<{verificationId:string}>;
 checkVerification(id:string,code:string):Promise<boolean>;
 sendSms(phone:string,message:string):Promise<ChannelReceipt>;
 sendWhatsApp(phone:string,portalUrl:string):Promise<ChannelReceipt>;
}
export class TwilioMobileProvider implements MobileNotificationProvider{
 private readonly adapter:TwilioAdapter|null;private readonly key:Buffer|null;private readonly providerHash:string|null;private readonly publicPortal:boolean;
 constructor(){const config=twilioConfiguration(environment);this.adapter=config?new TwilioAdapter(config):null;this.key=pushCredentialKey(environment.NOTIFICATION_CONTACT_KEY);this.providerHash=config?createHash('sha256').update(config.accountSid+'\0'+config.verifyServiceSid).digest('hex'):null;try{pushEndpoint(environment.WEB_ORIGIN);this.publicPortal=true;}catch{this.publicPortal=false;}}
 isVerificationEnabled(){return !!(this.key&&this.adapter?.canVerify());}
 isSmsEnabled(){return this.isVerificationEnabled()&&this.publicPortal&&!!this.adapter?.canSendSms();}
 isWhatsAppEnabled(){return this.isVerificationEnabled()&&this.publicPortal&&!!this.adapter?.canSendWhatsApp();}
 getCredentialKey(){return this.isVerificationEnabled()?Buffer.from(this.key!):null;}
 getCredentialKeyHash(){const key=this.getCredentialKey();return key?createHash('sha256').update(key).digest('hex'):null;}
 getProviderKeyHash(){return this.isVerificationEnabled()?this.providerHash:null;}
 startVerification(phone:string,locale:'ar'|'en'){if(!this.isVerificationEnabled())throw new ChannelDeliveryFailure('PHONE_VERIFICATION_NOT_CONFIGURED','FAILED');return this.adapter!.startVerification(phone,locale);}
 checkVerification(id:string,code:string){if(!this.isVerificationEnabled())throw new ChannelDeliveryFailure('PHONE_VERIFICATION_NOT_CONFIGURED','FAILED');return this.adapter!.checkVerification(id,code);}
 sendSms(phone:string,message:string){if(!this.isSmsEnabled())throw new ChannelDeliveryFailure('SMS_NOT_CONFIGURED','FAILED');return this.adapter!.sendSms(phone,message);}
 sendWhatsApp(phone:string,portalUrl:string){if(!this.isWhatsAppEnabled())throw new ChannelDeliveryFailure('WHATSAPP_NOT_CONFIGURED','FAILED');return this.adapter!.sendWhatsApp(phone,portalUrl);}
}
