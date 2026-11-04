import {Body,Controller,Get,Param,Patch,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {organizationIdSchema,portfolioQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {WorkGuard,type WorkRequest} from './work.guard';
import {PortfolioService} from './portfolio.service';
const uuid=(value:string)=>validate(organizationIdSchema,value),trace=(response:Response)=>String(response.getHeader('x-request-id'));
@Controller('work/organizations/:organizationId/portfolios')
@UseGuards(WorkGuard)
export class PortfolioController{
 constructor(private readonly portfolios:PortfolioService){}
 @Get() list(@Param('organizationId') org:string,@Query() q:unknown,@Req() r:WorkRequest){return this.portfolios.list(r.workIdentity,uuid(org),validate(portfolioQuerySchema,q));}
 @Get(':id') detail(@Param('organizationId') org:string,@Param('id') id:string,@Req() r:WorkRequest){return this.portfolios.detail(r.workIdentity,uuid(org),uuid(id));}
 @Post() create(@Param('organizationId') org:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.portfolios.save(r.workIdentity,uuid(org),undefined,body,trace(response));}
 @Patch(':id') edit(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.portfolios.save(r.workIdentity,uuid(org),uuid(id),body,trace(response));}
 @Post(':id/projects') link(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.portfolios.link(r.workIdentity,uuid(org),uuid(id),body,false,trace(response));}
 @Post(':id/projects/remove') unlink(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.portfolios.link(r.workIdentity,uuid(org),uuid(id),body,true,trace(response));}
 @Post(':id/archive') archive(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.portfolios.archive(r.workIdentity,uuid(org),uuid(id),body,false,trace(response));}
 @Post(':id/restore') restore(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.portfolios.archive(r.workIdentity,uuid(org),uuid(id),body,true,trace(response));}
}
