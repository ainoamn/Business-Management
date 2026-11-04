import {Body,Controller,Get,Param,Patch,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import {ApiTags} from '@nestjs/swagger';
import type {Request,Response} from 'express';
import {organizationIdSchema,platformLoginSchema,platformPasswordChangeSchema,platformQuerySchema,platformResourceSchema,contactSchema} from '@work/shared-schemas';
import {PlatformAuth,PlatformGuard,type PlatformRequest} from './platform.auth';
import {PlatformService} from './platform.service';
import {csrfFor} from './security';
import {authorize,validate} from './validation';
import {HealthService} from '../health/health.service';

@ApiTags('Platform authentication')
@Controller('platform/auth')
export class PlatformLoginController {
  constructor(private readonly auth:PlatformAuth) {}
  @Post('login')
  async login(@Body() body:unknown,@Req() request:Request,@Res({passthrough:true}) response:Response) {
    const data=validate(platformLoginSchema,body);
    return this.auth.login(data.email,data.password,request,response);
  }
}

@ApiTags('Platform administration')
@UseGuards(PlatformGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly service:PlatformService,private readonly auth:PlatformAuth,private readonly health:HealthService) {}
  @Get('auth/me')
  me(@Req() request:PlatformRequest) {return {actor:request.platformActor,csrf:csrfFor(request.platformToken)};}
  @Post('auth/logout')
  async logout(@Req() request:PlatformRequest,@Res({passthrough:true}) response:Response) {
    const result=await this.service.logout(request.platformActor,String(response.getHeader('x-request-id')));this.auth.clear(response);return result;
  }
  @Post('auth/password')
  async password(@Body() body:unknown,@Req() request:PlatformRequest,@Res({passthrough:true}) response:Response) {
    const data=validate(platformPasswordChangeSchema,body);
    const result=await this.service.changePassword(request.platformActor,data.currentPassword,data.newPassword,String(response.getHeader('x-request-id')));this.auth.clear(response);return result;
  }
  @Get('overview')
  overview(@Req() request:PlatformRequest) {return this.service.overview(request.platformActor);}
  @Get('monitoring')
  async monitoring(@Req() request:PlatformRequest) {
    authorize(request.platformActor,'monitoring.read');
    return {readiness:await this.health.check(),process:{uptimeSeconds:Math.floor(process.uptime()),memoryMb:Math.round(process.memoryUsage().rss/1048576)},integrations:await this.service.integrationStatus(request.platformActor)};
  }
  @Get('settings')
  settings(@Req() request:PlatformRequest) {return this.service.settings(request.platformActor);}
  @Patch('settings')
  saveSettings(@Body() body:unknown,@Req() request:PlatformRequest,@Res({passthrough:true}) response:Response) {return this.service.saveSettings(body,request.platformActor,String(response.getHeader('x-request-id')));}
  @Get('security/sessions')
  sessions(@Req() request:PlatformRequest) {return this.service.sessions(request.platformActor);}
  @Post('security/sessions/:id/revoke')
  revoke(@Param('id') id:string,@Req() request:PlatformRequest,@Res({passthrough:true}) response:Response) {return this.service.revoke(validate(organizationIdSchema,id),request.platformActor,String(response.getHeader('x-request-id')));}
  @Get('resources/:resource')
  list(@Param('resource') resource:string,@Query() query:unknown,@Req() request:PlatformRequest) {return this.service.list(validate(platformResourceSchema,resource),validate(platformQuerySchema,query),request.platformActor);}
  @Post('resources/:resource')
  create(@Param('resource') resource:string,@Body() body:unknown,@Req() request:PlatformRequest,@Res({passthrough:true}) response:Response) {return this.service.create(validate(platformResourceSchema,resource),body,request.platformActor,String(response.getHeader('x-request-id')));}
  @Patch('resources/:resource/:id')
  update(@Param('resource') resource:string,@Param('id') id:string,@Body() body:unknown,@Req() request:PlatformRequest,@Res({passthrough:true}) response:Response) {return this.service.update(validate(platformResourceSchema,resource),validate(organizationIdSchema,id),body,request.platformActor,String(response.getHeader('x-request-id')));}
}

@ApiTags('Published site content')
@Controller('public')
export class PublicSiteController {
  constructor(private readonly service:PlatformService) {}
  @Get('site')
  site() {return this.service.site();}
  @Get('pages/:slug')
  page(@Param('slug') slug:string) {return this.service.publicPage(slug);}
  @Post('contact')
  contact(@Body() body:unknown) {return this.service.contact(validate(contactSchema,body));}
  @Get('billing/plans')
  plans() {return this.service.plans();}
}
