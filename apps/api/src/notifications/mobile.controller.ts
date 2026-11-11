import {Body,Controller,Delete,Get,Param,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {organizationIdSchema,workQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {WorkGuard,type WorkRequest} from '../work/work.guard';
import {MobileNotificationService} from './mobile.service';
const uuid=(id:string)=>validate(organizationIdSchema,id),requestId=(response:Response)=>String(response.getHeader('x-request-id'));
@Controller('work/organizations/:organizationId/notification-phone')
@UseGuards(WorkGuard)
export class MobileNotificationController{
 constructor(private readonly mobile:MobileNotificationService){}
 @Get() status(@Param('organizationId') org:string,@Req() request:WorkRequest){return this.mobile.status(request.workIdentity,uuid(org));}
 @Get('deliveries') history(@Param('organizationId') org:string,@Query() query:unknown,@Req() request:WorkRequest){return this.mobile.history(request.workIdentity,uuid(org),validate(workQuerySchema,query));}
 @Post('start') start(@Param('organizationId') org:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.mobile.start(request.workIdentity,uuid(org),body,request,requestId(response));}
 @Post('check') check(@Param('organizationId') org:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.mobile.check(request.workIdentity,uuid(org),body,request,requestId(response));}
 @Post('consent') consent(@Param('organizationId') org:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.mobile.consent(request.workIdentity,uuid(org),body,requestId(response));}
 @Delete() revoke(@Param('organizationId') org:string,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.mobile.revoke(request.workIdentity,uuid(org),requestId(response));}
}
