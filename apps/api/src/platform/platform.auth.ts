import {CanActivate,ExecutionContext,ForbiddenException,HttpException,Injectable,UnauthorizedException} from '@nestjs/common';
import type {Request,Response} from 'express';
import {randomBytes,randomUUID} from 'node:crypto';
import type {PlatformActor} from '@work/shared-types';
import {PrismaService} from '../database/prisma.service';
import {environment} from '../config/environment';
import {csrfFor,digest,dummyPasswordHash,matchesCsrf,originAllowed,permissionsFor,verifyPassword} from './security';
import {MfaService} from '../security/mfa.service';

export type PlatformRequest=Request & {platformActor:PlatformActor;platformToken:string};
const cookieName='work_platform_session';
export function sessionToken(request:Request):string|undefined {
  const value=request.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${cookieName}=`))?.slice(cookieName.length+1);
  return value && /^[a-f0-9]{64}$/.test(value)?value:undefined;
}
export function checkOrigin(request:Request) {
  if(!originAllowed(request.get('origin'),environment.WEB_ORIGIN,environment.DEPLOYMENT_ENV==='development')) throw new ForbiddenException('Untrusted origin');
}

@Injectable()
export class PlatformAuth {
  constructor(private readonly db:PrismaService,private readonly mfa:MfaService) {}
  async login(email:string,password:string,request:Request,response:Response) {
    checkOrigin(request);
    const keys=[digest(`email:${email}`),digest(`ip:${request.ip||request.socket.remoteAddress||'unknown'}`)].sort();
    const attempts=keys.map(key=>({id:randomUUID(),key,succeeded:false}));
    await this.db.$transaction(async tx=>{
      for(const key of keys) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      for(const key of keys) {
        const count=await tx.platformLoginAttempt.count({where:{key,createdAt:{gte:new Date(Date.now()-15*60000)}}});
        if(count>=(key===digest(`email:${email}`)?5:25)) throw new HttpException('Too many sign-in attempts',429);
      }
      await tx.platformLoginAttempt.createMany({data:attempts});
    });
    const account=await this.db.platformAccount.findUnique({where:{email},include:{role:true}});
    const valid=await verifyPassword(password,account?.passwordHash??dummyPasswordHash);
    if(!account||account.disabledAt||!valid) {
      await this.db.platformAudit.create({data:{action:'LOGIN_FAILED',resource:'security',requestId:String(response.getHeader('x-request-id'))}});
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.db.platformLoginAttempt.updateMany({where:{id:{in:attempts.map(item=>item.id)}},data:{succeeded:true}});
    if(account.mfaEnabled)return this.mfa.createChallenge('PLATFORM',account.id);
    return this.completeMfaLogin(account.id,request,response);
  }
  async completeMfaLogin(accountId:string,request:Request,response:Response){
    checkOrigin(request);
    const account=await this.db.platformAccount.findUnique({where:{id:accountId},include:{role:true}});
    if(!account||account.disabledAt)throw new UnauthorizedException('Invalid credentials');
    const settings=await this.db.platformSettings.findUnique({where:{id:'main'}});
    const token=randomBytes(32).toString('hex');
    const expiresAt=new Date(Date.now()+(settings?.sessionMinutes??60)*60000);
    const session=await this.db.$transaction(async tx=>{
      const created=await tx.platformSession.create({data:{accountId:account.id,tokenHash:digest(token),expiresAt}});
      await tx.platformAudit.create({data:{actorId:account.id,action:'LOGIN',resource:'security',requestId:String(response.getHeader('x-request-id'))}});
      return created;
    });
    this.cookie(response,token,expiresAt);
    return {actor:{id:account.id,email:account.email,displayName:account.displayName,isOwner:account.isOwner,permissions:permissionsFor(account.isOwner,account.role?.permissions??[]),sessionId:session.id},csrf:csrfFor(token)};
  }
  async authenticate(request:Request):Promise<{actor:PlatformActor;token:string}> {
    const token=sessionToken(request);
    if(!token) throw new UnauthorizedException('Sign in required');
    const session=await this.db.platformSession.findUnique({where:{tokenHash:digest(token)},include:{account:{include:{role:true}}}});
    const settings=await this.db.platformSettings.findUnique({where:{id:'main'}});
    const now=Date.now();
    if(!session||session.revokedAt||session.expiresAt.getTime()<=now||session.account.disabledAt||session.createdAt.getTime()+(settings?.sessionMinutes??60)*60000<=now) throw new UnauthorizedException('Session expired');
    const account=session.account;
    return {token,actor:{id:account.id,email:account.email,displayName:account.displayName,isOwner:account.isOwner,permissions:permissionsFor(account.isOwner,account.role?.permissions??[]),sessionId:session.id}};
  }
  cookie(response:Response,token:string,expires:Date) {
    response.cookie(cookieName,token,{httpOnly:true,secure:environment.DEPLOYMENT_ENV!=='development',sameSite:'strict',path:'/api/v1/platform',expires});
  }
  clear(response:Response) {this.cookie(response,'',new Date(0));}
}

@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(private readonly auth:PlatformAuth) {}
  async canActivate(context:ExecutionContext) {
    const request=context.switchToHttp().getRequest<PlatformRequest>();
    const authenticated=await this.auth.authenticate(request);
    request.platformActor=authenticated.actor;request.platformToken=authenticated.token;
    if(!['GET','HEAD','OPTIONS'].includes(request.method)) {
      checkOrigin(request);
      if(!matchesCsrf(authenticated.token,request.get('x-csrf-token'))) throw new ForbiddenException('CSRF validation failed');
    }
    return true;
  }
}
