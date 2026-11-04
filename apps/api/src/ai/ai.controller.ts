import {AiDraftsService} from './ai-drafts.service';
import {Body,Controller,Get,HttpException,Param,Patch,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {aiHistoryQuerySchema,organizationIdSchema,workQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {PlatformGuard,type PlatformRequest} from '../platform/platform.auth';
import {WorkGuard,type WorkRequest} from '../work/work.guard';
import {IdentityService} from '../work/identity.service';
import {AiConfigurationService} from './ai-configuration.service';
import {AiRequestService} from './ai-request.service';
const uuid=(value:string)=>validate(organizationIdSchema,value),trace=(response:Response)=>String(response.getHeader('x-request-id'));
@UseGuards(PlatformGuard)
@Controller('platform/ai')
export class AiPlatformController{
 constructor(private readonly configuration:AiConfigurationService){}
 @Get('providers') providers(@Query() query:unknown,@Req() r:PlatformRequest){return this.configuration.providers(r.platformActor,validate(workQuerySchema,query));}
 @Post('providers') createProvider(@Body() body:unknown,@Req() r:PlatformRequest,@Res({passthrough:true}) response:Response){return this.configuration.saveProvider(r.platformActor,undefined,body,trace(response));}
 @Patch('providers/:id') updateProvider(@Param('id') id:string,@Body() body:unknown,@Req() r:PlatformRequest,@Res({passthrough:true}) response:Response){return this.configuration.saveProvider(r.platformActor,uuid(id),body,trace(response));}
 @Get('models') models(@Query() query:unknown,@Req() r:PlatformRequest){return this.configuration.models(r.platformActor,validate(workQuerySchema,query));}
 @Post('models') createModel(@Body() body:unknown,@Req() r:PlatformRequest,@Res({passthrough:true}) response:Response){return this.configuration.saveModel(r.platformActor,undefined,body,trace(response));}
 @Patch('models/:id') updateModel(@Param('id') id:string,@Body() body:unknown,@Req() r:PlatformRequest,@Res({passthrough:true}) response:Response){return this.configuration.saveModel(r.platformActor,uuid(id),body,trace(response));}
 @Get('prompts') prompts(@Req() r:PlatformRequest){return this.configuration.prompts(r.platformActor);}
 @Post('prompts') prompt(@Body() body:unknown,@Req() r:PlatformRequest,@Res({passthrough:true}) response:Response){return this.configuration.savePrompt(r.platformActor,body,trace(response));}
 @Get('prompts/:kind/history') promptHistory(@Param('kind') kind:string,@Query() query:unknown,@Req() r:PlatformRequest){return this.configuration.promptHistory(r.platformActor,kind,validate(workQuerySchema,query));}
 @Post('credits') grant(@Body() body:unknown,@Req() r:PlatformRequest,@Res({passthrough:true}) response:Response){return this.configuration.grant(r.platformActor,body,trace(response));}
 @Get('pending') pending(@Query() query:unknown,@Req() r:PlatformRequest){return this.configuration.pending(r.platformActor,validate(workQuerySchema,query));}
 @Post('pending/:id/reconcile') reconcile(@Param('id') id:string,@Body() body:unknown,@Req() r:PlatformRequest,@Res({passthrough:true}) response:Response){return this.configuration.reconcile(r.platformActor,uuid(id),body,trace(response));}
 @Get('usage') usage(@Query() query:unknown,@Req() r:PlatformRequest){return this.configuration.platformUsage(r.platformActor,validate(workQuerySchema,query));}
}
@UseGuards(WorkGuard)
@Controller('work/organizations/:organizationId/ai')
export class AiWorkController{
 private estimates=0;
 constructor(private readonly configuration:AiConfigurationService,private readonly requests:AiRequestService,private readonly identity:IdentityService,private readonly drafts:AiDraftsService){}
 @Get('settings') settings(@Param('organizationId') org:string,@Req() r:WorkRequest){return this.configuration.settings(r.workIdentity,uuid(org));}
 @Patch('settings') saveSettings(@Param('organizationId') org:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.configuration.saveSettings(r.workIdentity,uuid(org),body,trace(response));}
 @Get('usage') usage(@Param('organizationId') org:string,@Req() r:WorkRequest){return this.configuration.usage(r.workIdentity,uuid(org));}
 @Post('estimate') async estimate(@Param('organizationId') org:string,@Body() body:unknown,@Req() r:WorkRequest){await this.identity.limit('AI_ESTIMATE',r.workIdentity.id,r,{identity:40,ip:200});if(this.estimates>=4)throw new HttpException({code:'AI_BUSY',message:'Context preparation busy'},429);this.estimates++;try{return await this.requests.estimate(r.workIdentity,uuid(org),body);}finally{this.estimates--;}}
 @Post('requests') async request(@Param('organizationId') org:string,@Body() body:unknown,@Req() r:WorkRequest){await this.identity.limit('AI_REQUEST',r.workIdentity.id,r,{identity:20,ip:100});return this.requests.request(r.workIdentity,uuid(org),body,r.workToken);}
 @Get('requests/:id') detail(@Param('organizationId') org:string,@Param('id') id:string,@Req() r:WorkRequest){return this.requests.detail(r.workIdentity,uuid(org),uuid(id));}
 @Get('conversations') conversations(@Param('organizationId') org:string,@Query() query:unknown,@Req() r:WorkRequest){return this.requests.conversations(r.workIdentity,uuid(org),validate(aiHistoryQuerySchema,query));}
 @Get('conversations/:id/messages') messages(@Param('organizationId') org:string,@Param('id') id:string,@Query() query:unknown,@Req() r:WorkRequest){return this.requests.messages(r.workIdentity,uuid(org),uuid(id),validate(workQuerySchema,query));}
 @Post('conversations/:id/erase') erase(@Param('organizationId') org:string,@Param('id') id:string,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.requests.erase(r.workIdentity,uuid(org),uuid(id),trace(response));}
 @Post('conversations/:id/restore') restore(@Param('organizationId') org:string,@Param('id') id:string,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.requests.archive(r.workIdentity,uuid(org),uuid(id),trace(response),true);}
 @Post('conversations/:id/archive') archive(@Param('organizationId') org:string,@Param('id') id:string,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.requests.archive(r.workIdentity,uuid(org),uuid(id),trace(response));}
 @Patch('drafts/:id') updateDraft(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.drafts.update(r.workIdentity,uuid(org),uuid(id),body,trace(response));}
 @Post('drafts/:id/confirm') confirmDraft(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.drafts.confirm(r.workIdentity,uuid(org),uuid(id),body,trace(response));}
 @Post('drafts/:id/discard') discardDraft(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.drafts.discard(r.workIdentity,uuid(org),uuid(id),body,trace(response));}
}
