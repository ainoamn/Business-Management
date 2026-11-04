import {Body,Controller,Get,Param,Patch,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {z} from 'zod';
import {organizationIdSchema,workQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {WorkGuard,type WorkRequest} from './work.guard';
import {IdentityService} from './identity.service';
import {MemberProfileService} from './member-profile.service';
const uuid=(value:string)=>validate(organizationIdSchema,value);
const workQuery=workQuerySchema.extend({kind:z.enum(['tasks','achievements','projects']).default('tasks')});
@Controller('work/organizations/:organizationId/members')
@UseGuards(WorkGuard)
export class MemberProfileController{
 constructor(private readonly profiles:MemberProfileService,private readonly identity:IdentityService){}
 @Get(':id/profile') detail(@Req() request:WorkRequest,@Param('organizationId') org:string,@Param('id') id:string){return this.profiles.detail(request.workIdentity,uuid(org),uuid(id));}
 @Patch(':id/profile') save(@Req() request:WorkRequest,@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Res({passthrough:true}) response:Response){return this.profiles.save(request.workIdentity,uuid(org),uuid(id),body,String(response.getHeader('x-request-id')));}
 @Get(':id/profile/avatar-options') options(@Req() request:WorkRequest,@Param('organizationId') org:string,@Param('id') id:string,@Query() query:unknown){return this.profiles.options(request.workIdentity,uuid(org),uuid(id),validate(workQuerySchema,query));}
 @Get(':id/profile/work') work(@Req() request:WorkRequest,@Param('organizationId') org:string,@Param('id') id:string,@Query() query:unknown){const {kind,...data}=validate(workQuery,query);return this.profiles.work(request.workIdentity,uuid(org),uuid(id),kind,data);}
 @Get(':id/avatar') async avatar(@Req() request:WorkRequest,@Param('organizationId') org:string,@Param('id') id:string,@Res() response:Response){const organizationId=uuid(org),memberId=uuid(id),result=await this.profiles.avatar(request.workIdentity,organizationId,memberId),fresh=await this.identity.authenticate(request);await this.profiles.assertAvatar(fresh.identity,organizationId,memberId,result.versionId);response.setHeader('Content-Type','image/webp');response.setHeader('Content-Length',result.bytes.length);response.setHeader('Content-Disposition','inline; filename="avatar.webp"');response.setHeader('Cache-Control','no-store');response.end(result.bytes);}
}
