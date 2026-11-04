import {BadRequestException,Controller,Headers,Inject,Post,Req} from '@nestjs/common';
import type {Request} from 'express';
import {Prisma} from '@prisma/client';
import {PrismaService} from '../database/prisma.service';
import {PaymentProviderError,type PaymentProvider} from './payment-provider';
import {PAYMENT_PROVIDER} from './payment.factory';

type WebhookRequest=Request&{body:Buffer|unknown};

@Controller('public/billing/webhooks')
export class BillingWebhookController {
  constructor(
    private readonly db:PrismaService,
    @Inject(PAYMENT_PROVIDER)private readonly payments:PaymentProvider
  ){}

  @Post('hosted')
  async hosted(@Req()request:WebhookRequest,@Headers('payment-signature')signature?:string){
    const rawBody=Buffer.isBuffer(request.body)?request.body:Buffer.alloc(0);
    let event;
    try{
      event=this.payments.verifyEvent(rawBody,signature??'');
    }catch(error){
      if(error instanceof PaymentProviderError)throw new BadRequestException({code:error.code,message:'Payment webhook rejected'});
      throw error;
    }
    if(event.status!=='PAID')return {ok:true,ignored:true};
    try{
      await this.db.$queryRaw<Array<{status:string}>>`SELECT billing_settle_hosted_payment(${event.eventId},${event.checkoutId},${event.reference}::uuid) AS status`;
    }catch(error){
      if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2010'){
        const message=String(error.meta?.message??'');
        const code=message.match(/\b[A-Z][A-Z0-9_]{2,50}\b/)?.[0];
        if(code)throw new BadRequestException({code,message:'Payment settlement rejected'});
      }
      throw error;
    }
    return {ok:true};
  }
}
