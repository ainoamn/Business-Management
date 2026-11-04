import {Body,Controller,Get,Param,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {organizationIdSchema,reportQuerySchema,reportExportSchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {WorkGuard,type WorkRequest} from './work.guard';
import {ReportService} from './report.service';
import {ReportExportService} from './report-export.service';
import {IdentityService} from './identity.service';
@UseGuards(WorkGuard)
@Controller('work/organizations/:organizationId/reports')
export class ReportController{
 constructor(private readonly reports:ReportService,private readonly exports:ReportExportService,private readonly identity:IdentityService){}
 @Post('export') async export(@Param('organizationId') org:string,@Body() body:unknown,@Req() r:WorkRequest,@Res() response:Response){const data=validate(reportExportSchema,body);await this.identity.limit('REPORT_EXPORT',r.workIdentity.id,r,{identity:20,ip:100});const file=await this.exports.create(r.workIdentity,validate(organizationIdSchema,org),data.query,data.format,data.locale,String(response.getHeader('x-request-id')));response.setHeader('Content-Type',file.contentType);response.setHeader('Content-Disposition',`attachment; filename="${file.filename}"`);response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');response.send(file.buffer);}
 @Get() list(@Param('organizationId') org:string,@Query() q:unknown,@Req() r:WorkRequest){return this.reports.report(r.workIdentity,validate(organizationIdSchema,org),validate(reportQuerySchema,q));}
}
