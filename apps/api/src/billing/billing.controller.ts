import {Body,Controller,Get,Param,Patch,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {organizationIdSchema,workQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {PlatformGuard,type PlatformRequest} from '../platform/platform.auth';
import {BillingConfigurationService} from './billing-configuration.service';
import {BillingService} from './billing.service';
import {WorkGuard,type WorkRequest} from '../work/work.guard';
import {IdentityService} from '../work/identity.service';
const uuid=(value:string)=>validate(organizationIdSchema,value),trace=(response:Response)=>String(response.getHeader('x-request-id'));
@UseGuards(PlatformGuard)
@Controller('platform/billing')
export class BillingPlatformController{
 constructor(private readonly configuration:BillingConfigurationService){}
 @Get('plans') plans(@Query() query:unknown,@Req() r:PlatformRequest){return this.configuration.plans(r.platformActor,validate(workQuerySchema,query));}
 @Patch('plans/:id') plan(@Param('id') id:string,@Body() body:unknown,@Req() r:PlatformRequest,@Res({passthrough:true}) response:Response){return this.configuration.savePlan(r.platformActor,uuid(id),body,trace(response));}
 @Get('settings') settings(@Req() r:PlatformRequest){return this.configuration.settings(r.platformActor);}
 @Patch('settings') saveSettings(@Body() body:unknown,@Req() r:PlatformRequest,@Res({passthrough:true}) response:Response){return this.configuration.saveSettings(r.platformActor,body,trace(response));}
 @Get('coupons') coupons(@Query() query:unknown,@Req() r:PlatformRequest){return this.configuration.coupons(r.platformActor,validate(workQuerySchema,query));}
 @Post('coupons') createCoupon(@Body() body:unknown,@Req() r:PlatformRequest,@Res({passthrough:true}) response:Response){return this.configuration.saveCoupon(r.platformActor,undefined,body,trace(response));}
 @Patch('coupons/:id') coupon(@Param('id') id:string,@Body() body:unknown,@Req() r:PlatformRequest,@Res({passthrough:true}) response:Response){return this.configuration.saveCoupon(r.platformActor,uuid(id),body,trace(response));}
}
@Controller('public/billing')
export class BillingPublicController{
 constructor(private readonly configuration:BillingConfigurationService){}
 @Get('plans') plans(){return this.configuration.catalog();}
}
@UseGuards(WorkGuard)
@Controller('work/organizations/:organizationId/billing')
export class BillingWorkController{
 constructor(private readonly billing:BillingService,private readonly identity:IdentityService){}
 @Get('status') status(@Param('organizationId') org:string,@Req() r:WorkRequest){return this.billing.status(r.workIdentity,uuid(org));}
 @Get('invoices') invoices(@Param('organizationId') org:string,@Query() query:unknown,@Req() r:WorkRequest){return this.billing.invoices(r.workIdentity,uuid(org),validate(workQuerySchema,query));}
 @Get('orders') orders(@Param('organizationId') org:string,@Query() query:unknown,@Req() r:WorkRequest){return this.billing.orders(r.workIdentity,uuid(org),validate(workQuerySchema,query));}
 @Get('orders/:id') order(@Param('organizationId') org:string,@Param('id') id:string,@Req() r:WorkRequest){return this.billing.detail(r.workIdentity,uuid(org),uuid(id));}
 @Post('orders/:id/payment') payment(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.billing.resumePayment(r.workIdentity,uuid(org),uuid(id),body,trace(response));}
 @Get('history') history(@Param('organizationId') org:string,@Query() query:unknown,@Req() r:WorkRequest){return this.billing.history(r.workIdentity,uuid(org),validate(workQuerySchema,query));}
 @Post('quotes') async quote(@Param('organizationId') org:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){await this.identity.limit('BILLING_QUOTE',r.workIdentity.id,r,{identity:30,ip:100});return this.billing.quote(r.workIdentity,uuid(org),body,trace(response));}
 @Post('checkout') async checkout(@Param('organizationId') org:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){await this.identity.limit('BILLING_CHECKOUT',r.workIdentity.id,r,{identity:30,ip:100});return this.billing.checkout(r.workIdentity,uuid(org),body,trace(response));}
 @Post('trial') async trial(@Param('organizationId') org:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){await this.identity.limit('BILLING_TRIAL',r.workIdentity.id,r,{identity:10,ip:50});return this.billing.trial(r.workIdentity,uuid(org),body,trace(response));}
 @Post('orders/:id/cancel') cancelOrder(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.billing.cancelOrder(r.workIdentity,uuid(org),uuid(id),body,trace(response));}
 @Post('subscription/cancellation') cancellation(@Param('organizationId') org:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.billing.cancellation(r.workIdentity,uuid(org),body,false,trace(response));}
 @Post('subscription/cancellation/revoke') revoke(@Param('organizationId') org:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.billing.cancellation(r.workIdentity,uuid(org),body,true,trace(response));}
 @Patch('subscription/renewal') renewal(@Param('organizationId') org:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.billing.renewal(r.workIdentity,uuid(org),body,trace(response));}
}
