import {BadRequestException,ConflictException,ForbiddenException,HttpException,Injectable,NotFoundException,UnauthorizedException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import type {Request,Response} from 'express';
import {randomBytes,randomUUID} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {MailService} from '../mail/mail.service';
import {environment} from '../config/environment';
import {csrfFor,digest,dummyPasswordHash,hashPassword,verifyPassword} from '../common/credentials';
import {validate} from '../common/validation';
import {createOrganizationSchema,workRegisterSchema} from '@work/shared-schemas';

export interface WorkIdentity {id:string;email:string;username:string|null;displayName:string;emailVerified:boolean;sessionId:string}
export interface OrganizationSummary {id:string;name:string;slug:string;locale:string;timezone:string;role:string;membership_id:string}
export const workCookie='work_user_session';

@Injectable()
export class IdentityService {
  constructor(private readonly db:PrismaService,private readonly mail:MailService){}
  async limit(action:string,identifier:string,request:Request,limits={identity:5,ip:30}){
    const keys=[digest(`${action}:identity:${identifier}`),digest(`${action}:ip:${request.ip||request.socket.remoteAddress||'unknown'}`)].sort();
    const attempts=keys.map(key=>({id:randomUUID(),key,action,succeeded:false}));
    await this.db.$transaction(async tx=>{for(const key of keys)await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;for(const key of keys){const count=await tx.userLoginAttempt.count({where:{key,action,createdAt:{gte:new Date(Date.now()-15*60000)}}});if(count>=(key===digest(`${action}:identity:${identifier}`)?limits.identity:limits.ip))throw new HttpException('Too many requests',429);}await tx.userLoginAttempt.createMany({data:attempts});});
    return attempts.map(value=>value.id);
  }
  async token(tx:Prisma.TransactionClient,userId:string,email:string,purpose:'VERIFY_EMAIL'|'RESET_PASSWORD',inviteToken?:string){
    const plain=randomBytes(32).toString('hex');
    await tx.userActionToken.updateMany({where:{userId,purpose,usedAt:null},data:{usedAt:new Date()}});
    await tx.userActionToken.create({data:{userId,purpose,tokenHash:digest(plain),expiresAt:new Date(Date.now()+(purpose==='VERIFY_EMAIL'?86400000:1800000))}});
    const link=new URL(purpose==='VERIFY_EMAIL'?'/verify-email':'/reset-password',environment.WEB_ORIGIN);link.searchParams.set('token',plain);
    if(inviteToken)link.searchParams.set('invite',inviteToken);
    await this.mail.enqueue(tx,{recipient:email,subject:purpose==='VERIFY_EMAIL'?'تأكيد البريد الإلكتروني | Verify your email':'إعادة تعيين كلمة المرور | Reset your password',textBody:`${purpose==='VERIFY_EMAIL'?'أكد بريدك الإلكتروني / Verify your email':'غيّر كلمة المرور / Reset your password'}\n${link.toString()}\n${purpose==='VERIFY_EMAIL'?'ينتهي الرابط خلال 24 ساعة / Expires in 24 hours':'ينتهي الرابط خلال 30 دقيقة / Expires in 30 minutes'}`});
  }
  private async issue(tx:Prisma.TransactionClient,userId:string,request:Request){const token=randomBytes(32).toString('hex');const session=await tx.userSession.create({data:{userId,tokenHash:digest(token),expiresAt:new Date(Date.now()+8*3600000),deviceName:(request.get('user-agent')??'').slice(0,160)}});return {token,expiresAt:session.expiresAt};}
  cookie(response:Response,token:string,expires:Date){response.cookie(workCookie,token,{httpOnly:true,secure:environment.DEPLOYMENT_ENV!=='development',sameSite:'strict',path:'/api/v1/work',expires});}
  async register(body:unknown,request:Request,response:Response){
    const data=validate(workRegisterSchema,body);this.mail.assertAvailable();await this.limit('REGISTER',data.email,request);const passwordHash=await hashPassword(data.password);
    try{const result=await this.db.$transaction(async tx=>{
      if(data.inviteToken){const invitation=await tx.$queryRaw<Array<{email:string}>>`SELECT email FROM work_invitation_info(${digest(data.inviteToken)})`;if(invitation[0]?.email!==data.email)throw new BadRequestException('Invitation unavailable for this email');}
      const user=await tx.user.create({data:{email:data.email,username:data.username,displayName:data.displayName,passwordHash}});
      await tx.$executeRaw`SELECT set_config('app.user_id',${user.id},true)`;
      if(data.organizationName&&data.organizationSlug){const organizationId=randomUUID();await tx.$queryRaw`SELECT work_create_organization(${organizationId}::uuid,${data.organizationName},${data.organizationSlug})`;await tx.$executeRaw`SELECT set_config('app.organization_id',${organizationId},true)`;await tx.organization.update({where:{id:organizationId},data:{locale:data.locale}});}
      await this.token(tx,user.id,user.email,'VERIFY_EMAIL',data.inviteToken);
      const session=await this.issue(tx,user.id,request);return {...session};
    },{timeout:15000});this.cookie(response,result.token,result.expiresAt);return {ok:true,requiresVerification:true};}
    catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')throw new ConflictException('Account or organization identifier already exists');throw error;}
  }
  async login(identifier:string,password:string,request:Request,response:Response){
    const attempts=await this.limit('LOGIN',identifier,request);
    const user=await this.db.user.findFirst({where:{OR:[{email:identifier},{username:identifier}],deletedAt:null}});
    const valid=await verifyPassword(password,user?.passwordHash??dummyPasswordHash);
    if(!user||user.disabledAt||!valid)throw new UnauthorizedException('Invalid credentials');
    const session=await this.db.$transaction(async tx=>{
      const fresh=await tx.user.findUnique({where:{id:user.id}});if(!fresh||fresh.disabledAt||fresh.deletedAt||fresh.passwordHash!==user.passwordHash)throw new UnauthorizedException('Invalid credentials');
      await tx.userLoginAttempt.updateMany({where:{id:{in:attempts}},data:{succeeded:true}});return this.issue(tx,user.id,request);
    });this.cookie(response,session.token,session.expiresAt);return {ok:true};
  }
  async authenticate(request:Request){
    const raw=request.headers.cookie?.split(';').map(value=>value.trim()).find(value=>value.startsWith(`${workCookie}=`))?.slice(workCookie.length+1);
    if(!raw||!/^[a-f0-9]{64}$/.test(raw))throw new UnauthorizedException('Sign in required');
    const session=await this.db.userSession.findUnique({where:{tokenHash:digest(raw)},include:{user:true}});
    if(!session||session.revokedAt||session.expiresAt<=new Date()||session.user.deletedAt||session.user.disabledAt)throw new UnauthorizedException('Session expired');
    if(session.lastSeenAt.getTime()<Date.now()-60000)await this.db.userSession.update({where:{id:session.id},data:{lastSeenAt:new Date()}});
    const user=session.user;
    return {identity:{id:user.id,email:user.email,username:user.username,displayName:user.displayName,emailVerified:!!user.emailVerifiedAt,sessionId:session.id} satisfies WorkIdentity,token:raw};
  }
  async organizations(identity:WorkIdentity){return this.db.$transaction(async tx=>{await tx.$executeRaw`SELECT set_config('app.user_id',${identity.id},true)`;return tx.$queryRaw<OrganizationSummary[]>`SELECT * FROM work_my_organizations()`;});}
  async me(identity:WorkIdentity,token:string){return {user:identity,organizations:await this.organizations(identity),csrf:csrfFor(token),developmentMail:environment.DEPLOYMENT_ENV==='development'&&environment.MAIL_DELIVERY_MODE==='outbox'};}
  async createOrganization(body:unknown,identity:WorkIdentity){const data=validate(createOrganizationSchema,body);try{return await this.db.$transaction(async tx=>{await tx.$executeRaw`SELECT set_config('app.user_id',${identity.id},true)`;const id=randomUUID();await tx.$queryRaw`SELECT work_create_organization(${id}::uuid,${data.name},${data.slug})`;return {id};});}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2010')throw new BadRequestException('Organization could not be created');throw error;}}
  async verify(token:string){
    return this.db.$transaction(async tx=>{const row=await tx.userActionToken.findUnique({where:{tokenHash:digest(token)}});if(!row||row.purpose!=='VERIFY_EMAIL'||row.usedAt||row.expiresAt<=new Date())throw new BadRequestException('Invalid or expired verification link');const changed=await tx.userActionToken.updateMany({where:{id:row.id,usedAt:null,expiresAt:{gt:new Date()}},data:{usedAt:new Date()}});if(changed.count!==1)throw new BadRequestException('Token already used');await tx.user.update({where:{id:row.userId},data:{emailVerifiedAt:new Date()}});return {ok:true};});
  }
  async resend(identity:WorkIdentity,request:Request){this.mail.assertAvailable();await this.limit('VERIFY',identity.email,request);if(!identity.emailVerified)await this.db.$transaction(tx=>this.token(tx,identity.id,identity.email,'VERIFY_EMAIL'));return {ok:true};}
  async forgot(email:string,request:Request){this.mail.assertAvailable();await this.limit('RESET',email,request);const user=await this.db.user.findUnique({where:{email}});if(user&&!user.disabledAt&&!user.deletedAt)await this.db.$transaction(tx=>this.token(tx,user.id,user.email,'RESET_PASSWORD'));return {ok:true};}
  async reset(token:string,password:string){const passwordHash=await hashPassword(password);return this.db.$transaction(async tx=>{const row=await tx.userActionToken.findUnique({where:{tokenHash:digest(token)}});if(!row||row.purpose!=='RESET_PASSWORD'||row.usedAt||row.expiresAt<=new Date())throw new BadRequestException('Invalid or expired reset link');const changed=await tx.userActionToken.updateMany({where:{id:row.id,usedAt:null,expiresAt:{gt:new Date()}},data:{usedAt:new Date()}});if(changed.count!==1)throw new BadRequestException('Token already used');const user=await tx.user.findUnique({where:{id:row.userId}});if(!user||user.disabledAt||user.deletedAt)throw new BadRequestException('Account unavailable');await tx.user.update({where:{id:user.id},data:{passwordHash}});await tx.userSession.updateMany({where:{userId:user.id,revokedAt:null},data:{revokedAt:new Date()}});return {ok:true};});}
  async sessions(identity:WorkIdentity){return this.db.userSession.findMany({where:{userId:identity.id},orderBy:{createdAt:'desc'},take:50,select:{id:true,deviceName:true,createdAt:true,lastSeenAt:true,expiresAt:true,revokedAt:true}});}
  async revoke(identity:WorkIdentity,id:string){const result=await this.db.userSession.updateMany({where:{id,userId:identity.id,revokedAt:null},data:{revokedAt:new Date()}});if(!result.count)throw new NotFoundException('Session not found');return {ok:true};}
  async logout(identity:WorkIdentity,response:Response){await this.revoke(identity,identity.sessionId);this.cookie(response,'',new Date(0));return {ok:true};}
  async developmentMail(identity:WorkIdentity){if(environment.DEPLOYMENT_ENV!=='development'||environment.MAIL_DELIVERY_MODE!=='outbox')throw new NotFoundException('Route unavailable');return this.db.emailOutbox.findMany({where:{recipient:identity.email},orderBy:{createdAt:'desc'},take:20,select:{id:true,subject:true,textBody:true,status:true,createdAt:true}});}
  async invitationInfo(token:string){const rows=await this.db.$queryRaw<Array<{email:string;organization_name:string}>>`SELECT * FROM work_invitation_info(${digest(token)})`;if(!rows[0])throw new NotFoundException('Invitation unavailable');return rows[0];}
  requireVerified(identity:WorkIdentity){if(!identity.emailVerified)throw new ForbiddenException('Verify your email before using the workspace');}
}
