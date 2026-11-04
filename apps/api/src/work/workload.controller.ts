import {Body,Controller,Get,Param,Patch,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {organizationIdSchema,workQuerySchema,workloadQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {WorkGuard,type WorkRequest} from './work.guard';
import {WorkloadService} from './workload.service';
const uuid=(value:string)=>validate(organizationIdSchema,value),trace=(response:Response)=>String(response.getHeader('x-request-id'));
@Controller('work/organizations/:organizationId/workload')
@UseGuards(WorkGuard)
export class WorkloadController{
 constructor(private readonly workload:WorkloadService){}
 @Get() list(@Param('organizationId') org:string,@Query() query:unknown,@Req() r:WorkRequest){return this.workload.list(r.workIdentity,uuid(org),validate(workloadQuerySchema,query));}
 @Get('capacities/:membershipId') capacities(@Param('organizationId') org:string,@Param('membershipId') membershipId:string,@Query() query:unknown,@Req() r:WorkRequest){return this.workload.capacities(r.workIdentity,uuid(org),uuid(membershipId),validate(workQuerySchema,query));}
 @Post('capacities') create(@Param('organizationId') org:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.workload.saveCapacity(r.workIdentity,uuid(org),undefined,body,trace(response));}
 @Patch('capacities/:id') edit(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.workload.saveCapacity(r.workIdentity,uuid(org),uuid(id),body,trace(response));}
 @Post('capacities/:id/archive') archive(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.workload.archiveCapacity(r.workIdentity,uuid(org),uuid(id),body,trace(response));}
}
