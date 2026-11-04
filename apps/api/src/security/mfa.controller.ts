import {Body,Controller,Delete,Get,Post,Req,Res,UseGuards} from '@nestjs/common';
import type {Request,Response} from 'express';
import {z} from 'zod';
import {validate} from '../common/validation';
import {MfaService} from './mfa.service';
import {WorkGuard,assertWorkOrigin,type WorkRequest} from '../work/work.guard';
import {PlatformGuard,PlatformAuth,checkOrigin,type PlatformRequest} from '../platform/platform.auth';
import {IdentityService} from '../work/identity.service';

const password=z.string().min(1).max(128),code=z.string().min(6).max(64),token=z.string().regex(/^[a-f0-9]{64}$/);
const enrollStartSchema=z.object({label:z.string().trim().min(1).max(100),currentPassword:password}).strict();
const enrollCompleteSchema=z.object({setupToken:token,code}).strict();
const disableSchema=z.object({currentPassword:password,code}).strict();
const verifySchema=z.object({challengeToken:token,code}).strict();

@Controller('work/mfa')
@UseGuards(WorkGuard)
export class WorkMfaController {
  constructor(private readonly mfa:MfaService,private readonly identity:IdentityService){}
  @Get('status') status(@Req() request:WorkRequest){return this.mfa.isEnabled('USER',request.workIdentity.id).then(mfaEnabled=>({mfaEnabled}));}
  @Post('enroll/start') start(@Req() request:WorkRequest,@Body() body:unknown){const data=validate(enrollStartSchema,body);return this.mfa.startEnrollment('USER',request.workIdentity.id,data.label,data.currentPassword,request.workIdentity.sessionId);}
  @Post('enroll/complete') async complete(@Req() request:WorkRequest,@Body() body:unknown,@Res({passthrough:true}) response:Response){
    const data=validate(enrollCompleteSchema,body),result=await this.mfa.completeEnrollment('USER',request.workIdentity.id,data.setupToken,data.code,request.workIdentity.sessionId);
    await this.identity.completeMfaLogin(request.workIdentity.id,request,response,result.proof);return {ok:true,recoveryCodes:result.recoveryCodes};
  }
  @Delete() async disable(@Req() request:WorkRequest,@Body() body:unknown,@Res({passthrough:true}) response:Response){
    const data=validate(disableSchema,body),result=await this.mfa.disable('USER',request.workIdentity.id,data.code,data.currentPassword,request.workIdentity.sessionId);
    await this.identity.completeMfaLogin(request.workIdentity.id,request,response,result.proof);return {ok:true};
  }
}
@Controller('platform/mfa')
@UseGuards(PlatformGuard)
export class PlatformMfaController {
  constructor(private readonly mfa:MfaService,private readonly auth:PlatformAuth){}
  @Get('status') status(@Req() request:PlatformRequest){return this.mfa.isEnabled('PLATFORM',request.platformActor.id).then(mfaEnabled=>({mfaEnabled}));}
  @Post('enroll/start') start(@Req() request:PlatformRequest,@Body() body:unknown){const data=validate(enrollStartSchema,body);return this.mfa.startEnrollment('PLATFORM',request.platformActor.id,data.label,data.currentPassword,request.platformActor.sessionId);}
  @Post('enroll/complete') async complete(@Req() request:PlatformRequest,@Body() body:unknown,@Res({passthrough:true}) response:Response){
    const data=validate(enrollCompleteSchema,body),result=await this.mfa.completeEnrollment('PLATFORM',request.platformActor.id,data.setupToken,data.code,request.platformActor.sessionId);
    await this.auth.completeMfaLogin(request.platformActor.id,request,response,result.proof);return {ok:true,recoveryCodes:result.recoveryCodes};
  }
  @Delete() async disable(@Req() request:PlatformRequest,@Body() body:unknown,@Res({passthrough:true}) response:Response){
    const data=validate(disableSchema,body),result=await this.mfa.disable('PLATFORM',request.platformActor.id,data.code,data.currentPassword,request.platformActor.sessionId);
    await this.auth.completeMfaLogin(request.platformActor.id,request,response,result.proof);return {ok:true};
  }
}
@Controller()
export class AuthMfaController {
  constructor(private readonly mfa:MfaService,private readonly identity:IdentityService,private readonly platformAuth:PlatformAuth){}
  @Post('work/auth/mfa/verify') async workVerify(@Body() body:unknown,@Req() request:Request,@Res({passthrough:true}) response:Response){
    assertWorkOrigin(request);const data=validate(verifySchema,body),result=await this.mfa.verifyChallenge('USER',data.challengeToken,data.code,request.ip??request.socket.remoteAddress??'unknown');
    return this.identity.completeMfaLogin(result.accountId,request,response,result.proof);
  }
  @Post('platform/auth/mfa/verify') async platformVerify(@Body() body:unknown,@Req() request:Request,@Res({passthrough:true}) response:Response){
    checkOrigin(request);const data=validate(verifySchema,body),result=await this.mfa.verifyChallenge('PLATFORM',data.challengeToken,data.code,request.ip??request.socket.remoteAddress??'unknown');
    return this.platformAuth.completeMfaLogin(result.accountId,request,response,result.proof);
  }
}
