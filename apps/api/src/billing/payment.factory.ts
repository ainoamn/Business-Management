import type {Environment} from '@work/shared-schemas';
import {HostedApiPaymentProvider,UnconfiguredPaymentProvider,type PaymentProvider} from './payment-provider';

export const PAYMENT_PROVIDER='PAYMENT_PROVIDER';

export function isHostedPaymentConfigured(env:Environment):boolean{
  return !!(env.PAYMENT_ENDPOINT&&env.PAYMENT_API_KEY&&env.PAYMENT_WEBHOOK_SECRET&&env.PAYMENT_MODE&&env.PAYMENT_CHECKOUT_HOSTS);
}

export function createPaymentProvider(env:Environment):PaymentProvider{
  if(!isHostedPaymentConfigured(env))return new UnconfiguredPaymentProvider();
  const allowedCheckoutHosts=env.PAYMENT_CHECKOUT_HOSTS!.split(',').map(host=>host.trim()).filter(Boolean);
  try{
    return new HostedApiPaymentProvider({endpoint:env.PAYMENT_ENDPOINT!,apiKey:env.PAYMENT_API_KEY!,webhookSecret:env.PAYMENT_WEBHOOK_SECRET!,allowedCheckoutHosts,mode:env.PAYMENT_MODE!});
  }catch{
    return new UnconfiguredPaymentProvider();
  }
}
