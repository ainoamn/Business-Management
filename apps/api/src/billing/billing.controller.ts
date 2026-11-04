import {Body,Controller,Get,Param,Patch,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {organizationIdSchema,workQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {PlatformGuard,type PlatformRequest} from '../platform/platform.auth';
import {BillingConfigurationService} from './billing-configuration.service';
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
