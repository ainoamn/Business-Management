import {Body,Controller,Get,Param,Patch,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {organizationIdSchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {SupportService,supportQuery} from './support.service';
import {PlatformGuard,type PlatformRequest} from './platform.auth';
import {WorkGuard,type WorkRequest} from '../work/work.guard';
const uuid=(value:string)=>validate(organizationIdSchema,value),requestId=(response:Response)=>String(response.getHeader('x-request-id'));
@Controller('work/organizations/:organizationId/support')
@UseGuards(WorkGuard)
export class WorkSupportController{
 constructor(private readonly support:SupportService){}
 @Get() list(@Req() request:WorkRequest,@Param('organizationId') org:string,@Query() query:unknown){return this.support.workList(request.workIdentity,uuid(org),validate(supportQuery,query));}
 @Post() create(@Req() request:WorkRequest,@Param('organizationId') org:string,@Body() body:unknown,@Res({passthrough:true}) response:Response){return this.support.workCreate(request.workIdentity,uuid(org),body,requestId(response));}
 @Get(':id') detail(@Req() request:WorkRequest,@Param('organizationId') org:string,@Param('id') id:string,@Query() query:unknown){return this.support.workDetail(request.workIdentity,uuid(org),uuid(id),validate(supportQuery,query));}
 @Post(':id/messages') reply(@Req() request:WorkRequest,@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Res({passthrough:true}) response:Response){return this.support.workReply(request.workIdentity,uuid(org),uuid(id),body,requestId(response));}
 @Patch(':id/status') status(@Req() request:WorkRequest,@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Res({passthrough:true}) response:Response){return this.support.workStatus(request.workIdentity,uuid(org),uuid(id),body,requestId(response));}
}
@Controller('platform/support')
@UseGuards(PlatformGuard)
export class PlatformSupportController{
 constructor(private readonly support:SupportService){}
 @Get() list(@Req() request:PlatformRequest,@Query() query:unknown,@Res({passthrough:true}) response:Response){return this.support.platformList(request.platformActor,validate(supportQuery,query),requestId(response));}
 @Get(':id') detail(@Req() request:PlatformRequest,@Param('id') id:string,@Query() query:unknown,@Res({passthrough:true}) response:Response){return this.support.platformDetail(request.platformActor,uuid(id),validate(supportQuery,query),requestId(response));}
 @Post(':id/messages') reply(@Req() request:PlatformRequest,@Param('id') id:string,@Body() body:unknown,@Res({passthrough:true}) response:Response){return this.support.platformReply(request.platformActor,uuid(id),body,requestId(response));}
 @Patch(':id/status') status(@Req() request:PlatformRequest,@Param('id') id:string,@Body() body:unknown,@Res({passthrough:true}) response:Response){return this.support.platformStatus(request.platformActor,uuid(id),body,requestId(response));}
}
