import {Body,Controller,Delete,Get,Param,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {z} from 'zod';
import {organizationIdSchema,workQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {WorkGuard,type WorkRequest} from '../work/work.guard';
import {IdentityService} from '../work/identity.service';
import {PushService} from './push.service';
const uuid=(value:string)=>validate(organizationIdSchema,value),requestId=(response:Response)=>String(response.getHeader('x-request-id'));
@Controller('work/organizations/:organizationId/push')
@UseGuards(WorkGuard)
export class PushController{
 constructor(private readonly push:PushService,private readonly identity:IdentityService){}
 @Get('config') config(@Param('organizationId') org:string,@Req() request:WorkRequest){return this.push.config(request.workIdentity,uuid(org));}
 @Get('devices') devices(@Param('organizationId') org:string,@Query() query:unknown,@Req() request:WorkRequest){return this.push.devices(request.workIdentity,uuid(org),validate(workQuerySchema,query));}
 @Post('devices') async register(@Param('organizationId') org:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){await this.identity.limit('push-register',request.workIdentity.id,request,{identity:15,ip:60});return this.push.register(request.workIdentity,uuid(org),body,String(request.headers['user-agent']??''),requestId(response));}
 @Delete('devices/:id') revoke(@Param('organizationId') org:string,@Param('id') id:string,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.push.revoke(request.workIdentity,uuid(org),uuid(id),requestId(response));}
 @Post('deliveries/:id/display') display(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest){validate(z.object({}).strict(),body);return this.push.claimDisplay(request.workIdentity,uuid(org),uuid(id));}
}
