import {Body,Controller,Delete,Get,Param,Patch,Post,Query,Req,Res,Sse,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {from,interval,startWith,exhaustMap} from 'rxjs';
import {organizationIdSchema,timeQuerySchema,notificationQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {IdentityService} from './identity.service';
import {NotificationService} from './notification.service';
import {TimeService} from './time.service';
import {WorkGuard,type WorkRequest} from './work.guard';
const uuid=(value:string)=>validate(organizationIdSchema,value);
const requestId=(response:Response)=>String(response.getHeader('x-request-id'));
@UseGuards(WorkGuard)
@Controller('work/organizations/:organizationId')
export class OperationsController{
  constructor(private readonly notifications:NotificationService,private readonly time:TimeService,private readonly identity:IdentityService){}
  @Get('notifications') notificationsList(@Param('organizationId') org:string,@Query() query:unknown,@Req() request:WorkRequest){const {view,...data}=validate(notificationQuerySchema,query);return this.notifications.list(request.workIdentity,uuid(org),data,view==='archived');}
  @Post('notifications/:id/archive') archiveNotification(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.notifications.archive(request.workIdentity,uuid(org),uuid(id),body,requestId(response));}
  @Post('notifications/read-all') readAll(@Param('organizationId') org:string,@Req() request:WorkRequest){return this.notifications.read(request.workIdentity,uuid(org),undefined);}
  @Post('notifications/:id/read') read(@Param('organizationId') org:string,@Param('id') id:string,@Req() request:WorkRequest){return this.notifications.read(request.workIdentity,uuid(org),uuid(id));}
  @Get('notification-preferences') preferences(@Param('organizationId') org:string,@Req() request:WorkRequest){return this.notifications.preferences(request.workIdentity,uuid(org));}
  @Patch('notification-preferences') savePreferences(@Param('organizationId') org:string,@Body() body:unknown,@Req() request:WorkRequest){return this.notifications.savePreferences(request.workIdentity,uuid(org),body);}
  @Sse('notifications/events') events(@Param('organizationId') org:string,@Req() request:WorkRequest){const id=uuid(org);return interval(10000).pipe(startWith(0),exhaustMap(()=>from((async()=>{const {identity}=await this.identity.authenticate(request);const result=await this.notifications.list(identity,id,{page:1,pageSize:1,search:''});return {data:{unread:result.unread,total:result.total,latest:result.items[0]?.id??null}};})())));}
  @Get('time/entries') entries(@Param('organizationId') org:string,@Query() query:unknown,@Req() request:WorkRequest){return this.time.list(request.workIdentity,uuid(org),validate(timeQuerySchema,query));}
  @Post('time/entries') createEntry(@Param('organizationId') org:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.time.save(request.workIdentity,uuid(org),undefined,body,requestId(response));}
  @Patch('time/entries/:id') updateEntry(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.time.save(request.workIdentity,uuid(org),uuid(id),body,requestId(response));}
  @Delete('time/entries/:id') removeEntry(@Param('organizationId') org:string,@Param('id') id:string,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.time.remove(request.workIdentity,uuid(org),uuid(id),requestId(response));}
  @Get('time/timer') timer(@Param('organizationId') org:string,@Req() request:WorkRequest){return this.time.timer(request.workIdentity,uuid(org));}
  @Post('time/timer/start') startTimer(@Param('organizationId') org:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.time.start(request.workIdentity,uuid(org),body,requestId(response));}
  @Post('time/timer/stop') stopTimer(@Param('organizationId') org:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.time.stop(request.workIdentity,uuid(org),body,requestId(response));}
  @Delete('time/timer') cancelTimer(@Param('organizationId') org:string,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.time.cancel(request.workIdentity,uuid(org),requestId(response));}
  @Get('time/report') timeReport(@Param('organizationId') org:string,@Query() query:unknown,@Req() request:WorkRequest){return this.time.report(request.workIdentity,uuid(org),validate(timeQuerySchema,query));}
}
