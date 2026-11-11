import {TwilioMobileProvider,type MobileNotificationProvider} from './mobile-provider';
import {createHash} from 'node:crypto';
import {deliverWebPush,vapidConfiguration,type VapidConfiguration} from './web-push-adapter';
import {pushCredentialKey} from './push-crypto';
import {Injectable,Logger} from '@nestjs/common';
import {environment} from '../config/environment';

export interface SmsProvider {
  send(recipient:string,_message:string):Promise<void>;
}

export interface WhatsAppProvider {
  send(recipient:string,_message:string):Promise<void>;
}

export interface PushProvider {
  send(subscription:PushSubscription,_payload:PushPayload):Promise<{statusCode:number}>;
  isEnabled():boolean;
  getPublicKey():string|undefined;
  getCredentialKey():Buffer|null;
  getApplicationKeyHash():string|undefined;
}

export interface PushSubscription {
  endpoint:string;
  keys:{p256dh:string;auth:string};
}

export interface PushPayload {
  title:string;
  body:string;
  data?:Record<string,unknown>;
}

@Injectable()
export class UnconfiguredSmsProvider implements SmsProvider {
  private readonly logger=new Logger(UnconfiguredSmsProvider.name);

  async send(_recipient:string,_message:string):Promise<void>{
    this.logger.warn('SMS provider not configured');
    throw new Error('SMS_PROVIDER_NOT_CONFIGURED');
  }
}

@Injectable()
export class UnconfiguredWhatsAppProvider implements WhatsAppProvider {
  private readonly logger=new Logger(UnconfiguredWhatsAppProvider.name);

  async send(_recipient:string,_message:string):Promise<void>{
    this.logger.warn('WhatsApp provider not configured');
    throw new Error('WHATSAPP_PROVIDER_NOT_CONFIGURED');
  }
}

@Injectable()
export class UnconfiguredPushProvider implements PushProvider {
  private readonly logger=new Logger(UnconfiguredPushProvider.name);

  isEnabled(){return false;}
  getPublicKey(){return undefined;}
  getCredentialKey(){return null;}
  getApplicationKeyHash(){return undefined;}
  async send(_subscription:PushSubscription,_payload:PushPayload):Promise<{statusCode:number}>{
    this.logger.warn('Push provider not configured');
    throw new Error('PUSH_PROVIDER_NOT_CONFIGURED');
  }
}

/** Standard encrypted Web Push. Readiness requires valid signing and at-rest keys. */
export class WebPushProvider implements PushProvider{
 private readonly config:VapidConfiguration|null;
 private readonly credentialKey:Buffer|null;
 constructor(){this.config=vapidConfiguration(environment.VAPID_SUBJECT,environment.VAPID_PUBLIC_KEY,environment.VAPID_PRIVATE_KEY);this.credentialKey=pushCredentialKey(environment.PUSH_CREDENTIAL_KEY);}
 isEnabled(){return !!(this.config&&this.credentialKey);}
 getPublicKey(){return this.isEnabled()?this.config!.publicKey:undefined;}
 getCredentialKey(){return this.isEnabled()?Buffer.from(this.credentialKey!):null;}
 getApplicationKeyHash(){const key=this.getPublicKey();return key?createHash('sha256').update(key).digest('hex'):undefined;}
 async send(subscription:PushSubscription,payload:PushPayload){if(!this.isEnabled())throw Error('PUSH_PROVIDER_NOT_CONFIGURED');return deliverWebPush(this.config!,subscription,payload);}
}

/**
 * Provider factory based on environment configuration.
 */
@Injectable()
export class NotificationChannelProviders {
  mobile:MobileNotificationProvider;
  sms:SmsProvider;
  whatsapp:WhatsAppProvider;
  push:PushProvider;

  constructor(){
    this.mobile=new TwilioMobileProvider();
    this.sms={send:async(recipient,message)=>{await this.mobile.sendSms(recipient,message);}};
    this.whatsapp={send:async(recipient,portalUrl)=>{await this.mobile.sendWhatsApp(recipient,portalUrl);}};
    const push=new WebPushProvider();this.push=push.isEnabled()?push:new UnconfiguredPushProvider();
  }
}
