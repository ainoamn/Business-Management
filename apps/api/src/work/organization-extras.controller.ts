import {Body,Controller,Get,Param,Patch,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {z} from 'zod';
import {organizationIdSchema,workQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {WorkGuard,type WorkRequest} from './work.guard';
import {IdentityService} from './identity.service';
import {OrganizationExtrasService} from './organization-extras.service';
const uuid=(value:string)=>validate(organizationIdSchema,value),idFor=(response:Response)=>String(response.getHeader('x-request-id'));
const holidayQuery=workQuerySchema.extend({view:z.enum(['active','archived']).default('active')});
@Controller('work/organizations/:organizationId')
@UseGuards(WorkGuard)
export class OrganizationExtrasController{
 constructor(private readonly extras:OrganizationExtrasService,private readonly identity:IdentityService){}
 @Get('settings/holidays') holidays(@Req() request:WorkRequest,@Param('organizationId') org:string,@Query() query:unknown){const {view,...data}=validate(holidayQuery,query);return this.extras.holidays(request.workIdentity,uuid(org),data,view==='archived');}
 @Post('settings/holidays') create(@Req() request:WorkRequest,@Param('organizationId') org:string,@Body() body:unknown,@Res({passthrough:true}) response:Response){return this.extras.saveHoliday(request.workIdentity,uuid(org),undefined,body,idFor(response));}
 @Patch('settings/holidays/:id') update(@Req() request:WorkRequest,@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Res({passthrough:true}) response:Response){return this.extras.saveHoliday(request.workIdentity,uuid(org),uuid(id),body,idFor(response));}
 @Post('settings/holidays/:id/archive') archive(@Req() request:WorkRequest,@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Res({passthrough:true}) response:Response){return this.extras.archiveHoliday(request.workIdentity,uuid(org),uuid(id),body,idFor(response));}
 @Get('branding') branding(@Req() request:WorkRequest,@Param('organizationId') org:string){return this.extras.branding(request.workIdentity,uuid(org));}
 @Patch('branding') saveBranding(@Req() request:WorkRequest,@Param('organizationId') org:string,@Body() body:unknown,@Res({passthrough:true}) response:Response){return this.extras.saveBranding(request.workIdentity,uuid(org),body,idFor(response));}
 @Get('branding/options') options(@Req() request:WorkRequest,@Param('organizationId') org:string,@Query() query:unknown){return this.extras.options(request.workIdentity,uuid(org),validate(workQuerySchema,query));}
 @Get('branding/logo') async logo(@Req() request:WorkRequest,@Param('organizationId') org:string,@Res() response:Response){const id=uuid(org),image=await this.extras.logo(request.workIdentity,id),fresh=await this.identity.authenticate(request);await this.extras.assertLogo(fresh.identity,id,image.versionId);response.setHeader('Content-Type','image/webp');response.setHeader('Content-Length',image.bytes.length);response.setHeader('Content-Disposition','inline; filename="organization-logo.webp"');response.setHeader('Cache-Control','no-store');response.end(image.bytes);}
}
