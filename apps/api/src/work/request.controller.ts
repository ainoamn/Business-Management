import {Body,Controller,Get,Param,Patch,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {organizationIdSchema,requestQuerySchema,workQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {RequestService} from './request.service';
import {WorkGuard,type WorkRequest} from './work.guard';
const uuid=(value:string)=>validate(organizationIdSchema,value);
const requestId=(response:Response)=>String(response.getHeader('x-request-id'));
@UseGuards(WorkGuard)
@Controller('work/organizations/:organizationId')
export class RequestController{
  constructor(private readonly requests:RequestService){}
  @Post('requests/:id/assign') assign(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.requests.assign(request.workIdentity,uuid(org),uuid(id),body,requestId(response));}
  @Get('request-types') types(@Param('organizationId') org:string,@Query() query:unknown,@Req() request:WorkRequest){return this.requests.types(request.workIdentity,uuid(org),validate(workQuerySchema,query));}
  @Get('request-types/:id') type(@Param('organizationId') org:string,@Param('id') id:string,@Req() request:WorkRequest){return this.requests.type(request.workIdentity,uuid(org),uuid(id));}
  @Post('request-types') createType(@Param('organizationId') org:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.requests.saveType(request.workIdentity,uuid(org),undefined,body,requestId(response));}
  @Patch('request-types/:id') updateType(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.requests.saveType(request.workIdentity,uuid(org),uuid(id),body,requestId(response));}
  @Get('requests') list(@Param('organizationId') org:string,@Query() query:unknown,@Req() request:WorkRequest){return this.requests.list(request.workIdentity,uuid(org),validate(requestQuerySchema,query));}
  @Post('requests') create(@Param('organizationId') org:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.requests.save(request.workIdentity,uuid(org),undefined,body,requestId(response));}
  @Get('requests/:id') detail(@Param('organizationId') org:string,@Param('id') id:string,@Req() request:WorkRequest){return this.requests.detail(request.workIdentity,uuid(org),uuid(id));}
  @Patch('requests/:id') update(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.requests.save(request.workIdentity,uuid(org),uuid(id),body,requestId(response));}
  @Post('requests/:id/action') action(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.requests.action(request.workIdentity,uuid(org),uuid(id),body,requestId(response));}
  @Get('requests/:id/records/:resource') records(@Param('organizationId') org:string,@Param('id') id:string,@Param('resource') resource:string,@Query() query:unknown,@Req() request:WorkRequest){return this.requests.records(request.workIdentity,uuid(org),uuid(id),resource,validate(workQuerySchema,query));}
}
