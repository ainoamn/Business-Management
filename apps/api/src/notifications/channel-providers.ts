import {Injectable,Logger} from '@nestjs/common';
import {environment} from '../config/environment';

export interface SmsProvider {
  send(recipient:string,message:string):Promise<void>;
}

export interface WhatsAppProvider {
  send(recipient:string,message:string):Promise<void>;
}

export interface PushProvider {
  send(subscription:PushSubscription,payload:PushPayload):Promise<void>;
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

  async send(recipient:string,message:string):Promise<void>{
    this.logger.warn(`SMS not configured: would send to ${recipient}`);
    throw new Error('SMS_PROVIDER_NOT_CONFIGURED');
  }
}

@Injectable()
export class UnconfiguredWhatsAppProvider implements WhatsAppProvider {
  private readonly logger=new Logger(UnconfiguredWhatsAppProvider.name);

  async send(recipient:string,message:string):Promise<void>{
    this.logger.warn(`WhatsApp not configured: would send to ${recipient}`);
    throw new Error('WHATSAPP_PROVIDER_NOT_CONFIGURED');
  }
}

@Injectable()
export class UnconfiguredPushProvider implements PushProvider {
  private readonly logger=new Logger(UnconfiguredPushProvider.name);

  async send(subscription:PushSubscription,payload:PushPayload):Promise<void>{
    this.logger.warn(`Push not configured: would send to ${subscription.endpoint}`);
    throw new Error('PUSH_PROVIDER_NOT_CONFIGURED');
  }
}

/**
 * Real push provider using Web Push with VAPID.
 * Requires VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in environment.
 */
@Injectable()
export class WebPushProvider implements PushProvider {
  private readonly logger=new Logger(WebPushProvider.name);
  private readonly enabled:boolean;
  private readonly publicKey:string|undefined;
  private readonly privateKey:string|undefined;

  constructor(){
    this.publicKey=environment.VAPID_PUBLIC_KEY;
    this.privateKey=environment.VAPID_PRIVATE_KEY;
    this.enabled=!!(this.publicKey&&this.privateKey);
    if(!this.enabled){
      this.logger.warn('VAPID keys not configured, push notifications disabled');
    }
  }

  isEnabled():boolean{
    return this.enabled;
  }

  getPublicKey():string|undefined{
    return this.publicKey;
  }

  async send(subscription:PushSubscription,payload:PushPayload):Promise<void>{
    if(!this.enabled){
      throw new Error('PUSH_PROVIDER_NOT_CONFIGURED');
    }
    
    // In a real implementation, use web-push library here:
    // import webpush from 'web-push';
    // webpush.setVapidDetails('mailto:support@example.com', this.publicKey!, this.privateKey!);
    // await webpush.sendNotification(subscription, JSON.stringify(payload));
    
    this.logger.log(`Would send push to ${subscription.endpoint}: ${payload.title}`);
    throw new Error('WEB_PUSH_NOT_IMPLEMENTED_YET');
  }
}

/**
 * Provider factory based on environment configuration.
 */
@Injectable()
export class NotificationChannelProviders {
  sms:SmsProvider;
  whatsapp:WhatsAppProvider;
  push:PushProvider;

  constructor(){
    this.sms=environment.SMS_PROVIDER_URL
      ?new UnconfiguredSmsProvider() // Replace with real implementation when ready
      :new UnconfiguredSmsProvider();
    
    this.whatsapp=environment.WHATSAPP_PROVIDER_URL
      ?new UnconfiguredWhatsAppProvider() // Replace with real implementation when ready
      :new UnconfiguredWhatsAppProvider();
    
    this.push=environment.VAPID_PUBLIC_KEY&&environment.VAPID_PRIVATE_KEY
      ?new WebPushProvider()
      :new UnconfiguredPushProvider();
  }
}
