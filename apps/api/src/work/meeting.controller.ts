import {Body,Controller,Delete,Get,Param,Patch,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {meetingQuerySchema,organizationIdSchema,workQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {MeetingService} from './meeting.service';
import {WorkGuard,type WorkRequest} from './work.guard';
const uuid=(value:string)=>validate(organizationIdSchema,value);
const requestId=(response:Response)=>String(response.getHeader('x-request-id'));
@UseGuards(WorkGuard)
@Controller('work/organizations/:organizationId/meetings')
export class MeetingController{
  constructor(private readonly meetings:MeetingService){}
  @Get() list(@Param('organizationId') org:string,@Query() query:unknown,@Req() request:WorkRequest){return this.meetings.list(request.workIdentity,uuid(org),validate(meetingQuerySchema,query));}
  @Post() create(@Param('organizationId') org:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.meetings.save(request.workIdentity,uuid(org),undefined,body,requestId(response));}
  @Get(':id') detail(@Param('organizationId') org:string,@Param('id') id:string,@Req() request:WorkRequest){return this.meetings.detail(request.workIdentity,uuid(org),uuid(id));}
  @Patch(':id') update(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.meetings.save(request.workIdentity,uuid(org),uuid(id),body,requestId(response));}
  @Delete(':id') archive(@Param('organizationId') org:string,@Param('id') id:string,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.meetings.archive(request.workIdentity,uuid(org),uuid(id),false,requestId(response));}
  @Post(':id/restore') restore(@Param('organizationId') org:string,@Param('id') id:string,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.meetings.archive(request.workIdentity,uuid(org),uuid(id),true,requestId(response));}
  @Post(':id/action') action(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.meetings.action(request.workIdentity,uuid(org),uuid(id),body,requestId(response));}
  @Post(':id/respond') respond(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest){return this.meetings.respond(request.workIdentity,uuid(org),uuid(id),body);}
  @Get(':id/records/:resource') records(@Param('organizationId') org:string,@Param('id') id:string,@Param('resource') resource:string,@Query() query:unknown,@Req() request:WorkRequest){return this.meetings.records(request.workIdentity,uuid(org),uuid(id),resource,validate(workQuerySchema,query));}
  @Post(':id/decisions') createDecision(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.meetings.saveDecision(request.workIdentity,uuid(org),uuid(id),undefined,body,requestId(response));}
  @Patch(':id/decisions/:decisionId') updateDecision(@Param('organizationId') org:string,@Param('id') id:string,@Param('decisionId') decisionId:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.meetings.saveDecision(request.workIdentity,uuid(org),uuid(id),uuid(decisionId),body,requestId(response));}
  @Post(':id/decisions/:decisionId/convert') convertDecision(@Param('organizationId') org:string,@Param('id') id:string,@Param('decisionId') decisionId:string,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.meetings.convertDecision(request.workIdentity,uuid(org),uuid(id),uuid(decisionId),requestId(response));}
}
