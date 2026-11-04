import {Body,Controller,Get,Param,Patch,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {organizationIdSchema,workflowPreviewSchema,workflowQuerySchema,workQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {WorkGuard,type WorkRequest} from './work.guard';
import {WorkflowService} from './workflow.service';
import {WorkflowEngineService} from './workflow-engine.service';
const uuid=(value:string)=>validate(organizationIdSchema,value);
const requestId=(response:Response)=>String(response.getHeader('x-request-id'));
@UseGuards(WorkGuard)
@Controller('work/organizations/:organizationId/workflows')
export class WorkflowController{
 constructor(private readonly workflows:WorkflowService,private readonly engine:WorkflowEngineService){}
 @Get('usage') usage(@Param('organizationId') org:string,@Req() r:WorkRequest){return this.workflows.usage(r.workIdentity,uuid(org));}
 @Get() list(@Param('organizationId') org:string,@Query() q:unknown,@Req() r:WorkRequest){return this.workflows.list(r.workIdentity,uuid(org),validate(workflowQuerySchema,q));}
 @Post() create(@Param('organizationId') org:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.workflows.save(r.workIdentity,uuid(org),undefined,body,requestId(response));}
 @Get(':id') detail(@Param('organizationId') org:string,@Param('id') id:string,@Req() r:WorkRequest){return this.workflows.detail(r.workIdentity,uuid(org),uuid(id));}
 @Patch(':id') update(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.workflows.save(r.workIdentity,uuid(org),uuid(id),body,requestId(response));}
 @Post(':id/control') control(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.workflows.control(r.workIdentity,uuid(org),uuid(id),body,requestId(response));}
 @Post(':id/preview') preview(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest){const data=validate(workflowPreviewSchema,body);return this.engine.inspect(r.workIdentity,uuid(org),uuid(id),data.resourceId);}
 @Get(':id/revisions') revisions(@Param('organizationId') org:string,@Param('id') id:string,@Query() q:unknown,@Req() r:WorkRequest){return this.workflows.revisions(r.workIdentity,uuid(org),uuid(id),validate(workQuerySchema,q));}
 @Get(':id/revisions/:revisionId') revision(@Param('organizationId') org:string,@Param('id') id:string,@Param('revisionId') revisionId:string,@Req() r:WorkRequest){return this.workflows.revision(r.workIdentity,uuid(org),uuid(id),uuid(revisionId));}
 @Get(':id/runs') runs(@Param('organizationId') org:string,@Param('id') id:string,@Query() q:unknown,@Req() r:WorkRequest){return this.workflows.runs(r.workIdentity,uuid(org),uuid(id),validate(workQuerySchema,q));}
 @Get(':id/runs/:runId/logs') logs(@Param('organizationId') org:string,@Param('id') id:string,@Param('runId') runId:string,@Query() q:unknown,@Req() r:WorkRequest){return this.workflows.logs(r.workIdentity,uuid(org),uuid(id),uuid(runId),validate(workQuerySchema,q));}
 @Post(':id/runs/:runId/retry') retry(@Param('organizationId') org:string,@Param('id') id:string,@Param('runId') runId:string,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.engine.retry(r.workIdentity,uuid(org),uuid(id),uuid(runId),requestId(response));}
 @Get(':id/history') history(@Param('organizationId') org:string,@Param('id') id:string,@Query() q:unknown,@Req() r:WorkRequest){return this.workflows.history(r.workIdentity,uuid(org),uuid(id),validate(workQuerySchema,q));}
}
