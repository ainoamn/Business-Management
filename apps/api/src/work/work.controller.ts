import {Body,Controller,Delete,Get,Param,Patch,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import {ApiTags} from '@nestjs/swagger';
import type {Request,Response} from 'express';
import {organizationIdSchema,tokenSchema,workForgotSchema,workLoginSchema,workProfileSchema,workQuerySchema,workResetSchema,workTokenSchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {PrismaService} from '../database/prisma.service';
import {IdentityService} from './identity.service';
import {OrganizationService,type StructureResource} from './organization.service';
import {WorkGuard,assertWorkOrigin,type WorkRequest} from './work.guard';
import {BadRequestException} from '@nestjs/common';
const uuid=(value:string)=>validate(organizationIdSchema,value);
function resource(value:string):StructureResource {if(!['branches','departments','sections','teams'].includes(value))throw new BadRequestException('Unknown resource');return value as StructureResource;}
@ApiTags('Workspace identity')
@Controller('work/auth')
export class WorkPublicController {
  constructor(private readonly identity:IdentityService){}
  @Post('register')
  register(@Body() body:unknown,@Req() request:Request,@Res({passthrough:true}) response:Response){assertWorkOrigin(request);return this.identity.register(body,request,response);}
  @Post('login')
  login(@Body() body:unknown,@Req() request:Request,@Res({passthrough:true}) response:Response){assertWorkOrigin(request);const data=validate(workLoginSchema,body);return this.identity.login(data.identifier,data.password,request,response);}
  @Post('verify')
  async verify(@Body() body:unknown,@Req() request:Request){assertWorkOrigin(request);const data=validate(workTokenSchema,body);await this.identity.limit('TOKEN_VERIFY',data.token,request);return this.identity.verify(data.token);}
  @Post('forgot-password')
  forgot(@Body() body:unknown,@Req() request:Request){assertWorkOrigin(request);const data=validate(workForgotSchema,body);return this.identity.forgot(data.email,request);}
  @Post('reset-password')
  async reset(@Body() body:unknown,@Req() request:Request){assertWorkOrigin(request);const data=validate(workResetSchema,body);await this.identity.limit('TOKEN_RESET',data.token,request);return this.identity.reset(data.token,data.password);}
  @Get('invitation')
  invitation(@Query('token') token:unknown){return this.identity.invitationInfo(validate(tokenSchema,token));}
}

@ApiTags('Workspace organizations')
@UseGuards(WorkGuard)
@Controller('work')
export class WorkController {
  constructor(private readonly identity:IdentityService,private readonly organization:OrganizationService,private readonly db:PrismaService){}
  @Get('auth/me') me(@Req() request:WorkRequest){return this.identity.me(request.workIdentity,request.workToken);}
  @Post('auth/logout') logout(@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.identity.logout(request.workIdentity,response);}
  @Post('auth/resend-verification') resend(@Req() request:WorkRequest){return this.identity.resend(request.workIdentity,request);}
  @Get('auth/sessions') sessions(@Req() request:WorkRequest){return this.identity.sessions(request.workIdentity);}
  @Post('auth/sessions/:id/revoke') revoke(@Param('id') id:string,@Req() request:WorkRequest){return this.identity.revoke(request.workIdentity,uuid(id));}
  @Get('auth/development-mail') mail(@Req() request:WorkRequest){return this.identity.developmentMail(request.workIdentity);}
  @Patch('auth/profile') profile(@Body() body:unknown,@Req() request:WorkRequest){const data=validate(workProfileSchema,body);return this.db.user.update({where:{id:request.workIdentity.id},data,select:{id:true,displayName:true,email:true,username:true}});}
  @Get('organizations') organizations(@Req() request:WorkRequest){return this.identity.organizations(request.workIdentity);}
  @Post('organizations') createOrganization(@Body() body:unknown,@Req() request:WorkRequest){this.identity.requireVerified(request.workIdentity);return this.identity.createOrganization(body,request.workIdentity);}
  @Post('invitations/accept') accept(@Body() body:unknown,@Req() request:WorkRequest){return this.organization.accept(request.workIdentity,validate(workTokenSchema,body).token);}
  @Get('organizations/:organizationId/context') context(@Param('organizationId') id:string,@Req() request:WorkRequest){return this.organization.context(request.workIdentity,uuid(id));}
  @Get('organizations/:organizationId/dashboard') dashboard(@Param('organizationId') id:string,@Req() request:WorkRequest){return this.organization.dashboard(request.workIdentity,uuid(id));}
  @Get('organizations/:organizationId/members') members(@Param('organizationId') id:string,@Query() query:unknown,@Req() request:WorkRequest){return this.organization.members(request.workIdentity,uuid(id),validate(workQuerySchema,query));}
  @Patch('organizations/:organizationId/members/:id') updateMember(@Param('organizationId') organizationId:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.organization.updateMember(request.workIdentity,uuid(organizationId),uuid(id),body,String(response.getHeader('x-request-id')));}
  @Get('organizations/:organizationId/invitations') invitations(@Param('organizationId') id:string,@Query() query:unknown,@Req() request:WorkRequest){return this.organization.invitations(request.workIdentity,uuid(id),validate(workQuerySchema,query));}
  @Post('organizations/:organizationId/invitations') invite(@Param('organizationId') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.organization.invite(request.workIdentity,uuid(id),body,String(response.getHeader('x-request-id')));}
  @Post('organizations/:organizationId/invitations/:id/revoke') revokeInvitation(@Param('organizationId') organizationId:string,@Param('id') id:string,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.organization.revokeInvitation(request.workIdentity,uuid(organizationId),uuid(id),String(response.getHeader('x-request-id')));}
  @Get('organizations/:organizationId/structure/:resource') structure(@Param('organizationId') id:string,@Param('resource') kind:string,@Query() query:unknown,@Req() request:WorkRequest){return this.organization.structure(request.workIdentity,uuid(id),resource(kind),validate(workQuerySchema,query));}
  @Post('organizations/:organizationId/structure/:resource') createStructure(@Param('organizationId') id:string,@Param('resource') kind:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.organization.saveStructure(request.workIdentity,uuid(id),resource(kind),undefined,body,String(response.getHeader('x-request-id')));}
  @Patch('organizations/:organizationId/structure/:resource/:id') updateStructure(@Param('organizationId') organizationId:string,@Param('resource') kind:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.organization.saveStructure(request.workIdentity,uuid(organizationId),resource(kind),uuid(id),body,String(response.getHeader('x-request-id')));}
  @Post('organizations/:organizationId/teams/:id/members') teamMember(@Param('organizationId') organizationId:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.organization.addTeamMember(request.workIdentity,uuid(organizationId),uuid(id),body,String(response.getHeader('x-request-id')));}
  @Get('organizations/:organizationId/roles') roles(@Param('organizationId') id:string,@Query() query:unknown,@Req() request:WorkRequest){return this.organization.roles(request.workIdentity,uuid(id),validate(workQuerySchema,query));}
  @Get('organizations/:organizationId/teams/:id/members') teamMembers(@Param('organizationId') organizationId:string,@Param('id') id:string,@Query() query:unknown,@Req() request:WorkRequest){return this.organization.teamMembers(request.workIdentity,uuid(organizationId),uuid(id),validate(workQuerySchema,query));}
  @Get('organizations/:organizationId/role-assignments') roleAssignments(@Param('organizationId') id:string,@Query() query:unknown,@Req() request:WorkRequest){return this.organization.roleAssignments(request.workIdentity,uuid(id),validate(workQuerySchema,query));}
  @Post('organizations/:organizationId/roles') createRole(@Param('organizationId') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.organization.saveRole(request.workIdentity,uuid(id),undefined,body,String(response.getHeader('x-request-id')));}
  @Patch('organizations/:organizationId/roles/:id') updateRole(@Param('organizationId') organizationId:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.organization.saveRole(request.workIdentity,uuid(organizationId),uuid(id),body,String(response.getHeader('x-request-id')));}
  @Post('organizations/:organizationId/role-assignments') assignRole(@Param('organizationId') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.organization.assignRole(request.workIdentity,uuid(id),body,String(response.getHeader('x-request-id')));}
  @Patch('organizations/:organizationId/settings') settings(@Param('organizationId') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.organization.settings(request.workIdentity,uuid(id),body,String(response.getHeader('x-request-id')));}
  @Delete('organizations/:organizationId/structure/:resource/:id') archive(@Param('organizationId') organizationId:string,@Param('resource') kind:string,@Param('id') id:string,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.organization.archiveStructure(request.workIdentity,uuid(organizationId),resource(kind),uuid(id),String(response.getHeader('x-request-id')));}
  @Delete('organizations/:organizationId/teams/:teamId/members/:id') removeTeamMember(@Param('organizationId') organizationId:string,@Param('teamId') teamId:string,@Param('id') id:string,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.organization.removeTeamMember(request.workIdentity,uuid(organizationId),uuid(teamId),uuid(id),String(response.getHeader('x-request-id')));}
  @Delete('organizations/:organizationId/roles/:id') removeRole(@Param('organizationId') organizationId:string,@Param('id') id:string,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.organization.removeRole(request.workIdentity,uuid(organizationId),uuid(id),String(response.getHeader('x-request-id')));}
  @Delete('organizations/:organizationId/role-assignments/:id') revokeRole(@Param('organizationId') organizationId:string,@Param('id') id:string,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.organization.revokeRole(request.workIdentity,uuid(organizationId),uuid(id),String(response.getHeader('x-request-id')));}
}
