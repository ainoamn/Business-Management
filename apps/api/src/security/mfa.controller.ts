import {Body,Controller,Delete,Get,Post,Req,Res,UnauthorizedException,UseGuards} from '@nestjs/common';
import type {Request,Response} from 'express';
import {z} from 'zod';
import {validate} from '../common/validation';
import {MfaService} from './mfa.service';
import {WorkGuard,type WorkRequest} from '../work/work.guard';
import {PlatformGuard,PlatformAuth,type PlatformRequest} from '../platform/platform.auth';
import {IdentityService} from '../work/identity.service';

const enrollStartSchema=z.object({label:z.string().trim().min(1).max(100)}).strict();
const enrollCompleteSchema=z.object({secret:z.string().min(16).max(64),code:z.string().regex(/^\d{6}$/)}).strict();
const disableSchema=z.object({code:z.string().min(6).max(20)}).strict();
const verifySchema=z.object({challengeToken:z.string().regex(/^[a-f0-9]{64}$/),code:z.string().min(6).max(20)}).strict();

@Controller('work/mfa')
@UseGuards(WorkGuard)
export class WorkMfaController {
  constructor(private readonly mfa:MfaService){}
  @Get('status') status(@Req() request:WorkRequest){return this.mfa.isEnabled('USER',request.workIdentity.id).then(mfaEnabled=>({mfaEnabled}));}
  @Post('enroll/start') start(@Req() request:WorkRequest,@Body() body:unknown){
    return this.mfa.startEnrollment('USER',request.workIdentity.id,validate(enrollStartSchema,body).label);
  }
  @Post('enroll/complete') complete(@Req() request:WorkRequest,@Body() body:unknown){
    const data=validate(enrollCompleteSchema,body);
    return this.mfa.completeEnrollment('USER',request.workIdentity.id,data.secret,data.code);
  }
  @Delete() disable(@Req() request:WorkRequest,@Body() body:unknown){
    return this.mfa.disable('USER',request.workIdentity.id,validate(disableSchema,body).code);
  }
}

@Controller('platform/mfa')
@UseGuards(PlatformGuard)
export class PlatformMfaController {
  constructor(private readonly mfa:MfaService){}
  @Get('status') status(@Req() request:PlatformRequest){return this.mfa.isEnabled('PLATFORM',request.platformActor.id).then(mfaEnabled=>({mfaEnabled}));}
  @Post('enroll/start') start(@Req() request:PlatformRequest,@Body() body:unknown){
    return this.mfa.startEnrollment('PLATFORM',request.platformActor.id,validate(enrollStartSchema,body).label);
  }
  @Post('enroll/complete') complete(@Req() request:PlatformRequest,@Body() body:unknown){
    const data=validate(enrollCompleteSchema,body);
    return this.mfa.completeEnrollment('PLATFORM',request.platformActor.id,data.secret,data.code);
  }
  @Delete() disable(@Req() request:PlatformRequest,@Body() body:unknown){
    return this.mfa.disable('PLATFORM',request.platformActor.id,validate(disableSchema,body).code);
  }
}

@Controller()
export class AuthMfaController {
  constructor(private readonly mfa:MfaService,private readonly identity:IdentityService,private readonly platformAuth:PlatformAuth){}

  @Post('work/auth/mfa/verify')
  async workVerify(@Body() body:unknown,@Req() request:Request,@Res({passthrough:true}) response:Response){
    const data=validate(verifySchema,body);
    const challenge=await this.mfa.verifyChallenge(data.challengeToken,data.code);
    if(challenge.accountType!=='USER')throw new UnauthorizedException('Invalid MFA challenge');
    return this.identity.completeMfaLogin(challenge.accountId,request,response);
  }

  @Post('platform/auth/mfa/verify')
  async platformVerify(@Body() body:unknown,@Req() request:Request,@Res({passthrough:true}) response:Response){
    const data=validate(verifySchema,body);
    const challenge=await this.mfa.verifyChallenge(data.challengeToken,data.code);
    if(challenge.accountType!=='PLATFORM')throw new UnauthorizedException('Invalid MFA challenge');
    return this.platformAuth.completeMfaLogin(challenge.accountId,request,response);
  }
}
