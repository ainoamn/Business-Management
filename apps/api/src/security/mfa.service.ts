import {BadRequestException,ConflictException,HttpException,Injectable,ServiceUnavailableException,UnauthorizedException} from '@nestjs/common';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {PrismaService} from '../database/prisma.service';
import {environment} from '../config/environment';
import {digest,verifyPassword} from '../common/credentials';
import {issueMfaProof,type MfaAccountType} from './mfa-proof';
import {parseMfaKey,sealMfaSecret,openMfaSecret,generateTotpSecret,generateTotpUri,matchingTotpCounter,generateRecoveryCodes,hashRecoveryCode} from './mfa';

type Tx=Prisma.TransactionClient;
@Injectable()
export class MfaService {
  private pending?:Promise<Buffer>;
  constructor(private readonly db:PrismaService){}
  private async key(){if(!this.pending)this.pending=this.load().catch(error=>{this.pending=undefined;throw error;});return this.pending;}
  private async load(){
    if(process.env.MFA_CREDENTIAL_KEY)return parseMfaKey(process.env.MFA_CREDENTIAL_KEY);
    if(process.env.AI_CREDENTIAL_KEY)return parseMfaKey(process.env.AI_CREDENTIAL_KEY);
    if(environment.DEPLOYMENT_ENV!=='development')throw new ServiceUnavailableException({code:'MFA_CREDENTIAL_KEY_REQUIRED',message:'MFA encryption key is required outside development'});
    const path=resolve(__dirname,'../../../../.local/secrets/mfa.key');await mkdir(dirname(path),{recursive:true});
    try{await writeFile(path,randomBytes(32).toString('base64')+'\n',{flag:'wx',mode:0o600});}catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='EEXIST'))throw error;}
    return parseMfaKey((await readFile(path,'utf8')).trim());
  }
  private async limit(keys:string[],purpose:string,max:number){
    await this.db.$transaction(async tx=>{
      for(const key of [...keys].sort())await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      for(const key of keys){if(await tx.mfaAttempt.count({where:{key,purpose,createdAt:{gte:new Date(Date.now()-15*60000)}}})>=max)throw new HttpException({code:'MFA_RATE_LIMITED',message:'Too many verification attempts. Try again later.'},429);}
      await tx.mfaAttempt.createMany({data:keys.map(key=>({key,purpose}))});
    });
  }
  private async account(tx:Tx,type:MfaAccountType,id:string){
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mfa:${type}:${id}`}))`;
    // Account row lock also serializes password changes and account disabling.
    if(type==='USER')await tx.$queryRaw`SELECT id FROM users WHERE id=${id}::uuid FOR UPDATE`;
    else await tx.$queryRaw`SELECT id FROM platform_accounts WHERE id=${id}::uuid FOR UPDATE`;
    const row=type==='USER'?await tx.user.findUnique({where:{id}}):await tx.platformAccount.findUnique({where:{id}});
    if(!row||row.disabledAt||('deletedAt' in row&&row.deletedAt))throw new UnauthorizedException('Account unavailable');return row;
  }
  private async session(tx:Tx,type:MfaAccountType,id:string,sessionId:string){
    const row=type==='USER'?await tx.userSession.findFirst({where:{id:sessionId,userId:id}}):await tx.platformSession.findFirst({where:{id:sessionId,accountId:id}});
    if(!row||row.revokedAt||row.expiresAt<=new Date())throw new UnauthorizedException('Session expired');
  }
  private async password(type:MfaAccountType,id:string,password:string){
    await this.limit([digest(`mfa:primary:${type}:${id}`)],'PRIMARY',5);
    const account=await this.db.$transaction(tx=>this.account(tx,type,id));
    if(!await verifyPassword(password,account.passwordHash))throw new UnauthorizedException({code:'MFA_PASSWORD_INVALID',message:'Current password is incorrect'});
    return account.passwordHash;
  }
  private async event(tx:Tx,accountType:MfaAccountType,accountId:string,action:string){await tx.mfaSecurityEvent.create({data:{accountType,accountId,action}});}
  private async revoke(tx:Tx,type:MfaAccountType,id:string){
    if(type==='USER')await tx.userSession.updateMany({where:{userId:id,revokedAt:null},data:{revokedAt:new Date()}});
    else await tx.platformSession.updateMany({where:{accountId:id,revokedAt:null},data:{revokedAt:new Date()}});
    await tx.pendingMfaChallenge.updateMany({where:{accountType:type,accountId:id,consumedAt:null},data:{consumedAt:new Date(),secretEnc:null}});
  }
  async startEnrollment(type:MfaAccountType,id:string,label:string,password:string,sessionId:string){
    const hash=await this.password(type,id,password),secret=generateTotpSecret(),token=randomBytes(32).toString('hex'),key=await this.key();
    await this.db.$transaction(async tx=>{
      const account=await this.account(tx,type,id);await this.session(tx,type,id,sessionId);
      if(account.passwordHash!==hash)throw new UnauthorizedException('Credentials changed');
      if(account.mfaEnabled)throw new ConflictException({code:'MFA_ALREADY_ENABLED',message:'Disable the existing factor before replacing it'});
      await tx.pendingMfaChallenge.updateMany({where:{accountType:type,accountId:id,purpose:'ENROLL',consumedAt:null},data:{consumedAt:new Date(),secretEnc:null}});
      await tx.pendingMfaChallenge.create({data:{accountType:type,accountId:id,purpose:'ENROLL',tokenHash:digest(token),expiresAt:new Date(Date.now()+10*60000),secretEnc:sealMfaSecret(key,secret,`${id}:${digest(token)}`,type),credentialVersion:account.mfaVersion,primaryCredentialHash:digest(hash),sessionId}});
      await this.event(tx,type,id,'ENROLLMENT_STARTED');
    });return {setupToken:token,secret,uri:generateTotpUri(secret,label)};
  }
  async completeEnrollment(type:MfaAccountType,id:string,token:string,code:string,sessionId:string){
    await this.limit([digest(`mfa:code:${type}:${id}`)],'CODE',20);const key=await this.key(),recoveryCodes=generateRecoveryCodes();
    const result=await this.db.$transaction(async tx=>{
      const account=await this.account(tx,type,id);await this.session(tx,type,id,sessionId);
      const row=await tx.pendingMfaChallenge.findUnique({where:{tokenHash:digest(token)}});
      if(account.mfaEnabled||!row||row.accountType!==type||row.accountId!==id||row.purpose!=='ENROLL'||row.sessionId!==sessionId||row.consumedAt||row.expiresAt<=new Date()||row.attempts>=5||!row.secretEnc||row.credentialVersion!==account.mfaVersion||row.primaryCredentialHash!==digest(account.passwordHash))return null;
      await tx.pendingMfaChallenge.update({where:{id:row.id},data:{attempts:{increment:1}}});
      const secret=openMfaSecret(key,row.secretEnc,`${id}:${digest(token)}`,type),counter=matchingTotpCounter(secret,code);
      if(counter===null){await this.event(tx,type,id,'ENROLLMENT_CODE_FAILED');return null;}
      const data={mfaEnabled:true,mfaSecretEnc:sealMfaSecret(key,secret,id,type),mfaVerifiedAt:new Date(),mfaLastCounter:counter,mfaVersion:{increment:1}};
      if(type==='USER')await tx.user.update({where:{id},data});else await tx.platformAccount.update({where:{id},data});
      await tx.mfaRecoveryCode.deleteMany({where:{accountType:type,accountId:id}});
      await tx.mfaRecoveryCode.createMany({data:recoveryCodes.map(value=>({accountType:type,accountId:id,codeHash:hashRecoveryCode(value)}))});
      await this.revoke(tx,type,id);await this.event(tx,type,id,'MFA_ENABLED');
      return issueMfaProof({accountType:type,accountId:id,version:account.mfaVersion+1,primaryHash:digest(account.passwordHash)});
    });if(!result)throw new BadRequestException({code:'MFA_CODE_INVALID',message:'Invalid code or expired setup. Restart setup if necessary.'});
    return {ok:true as const,recoveryCodes,proof:result};
  }
  private async assertCode(tx:Tx,type:MfaAccountType,id:string,code:string,account:Awaited<ReturnType<MfaService['account']>>,key:Buffer){
    if(!account.mfaEnabled||!account.mfaSecretEnc)return false;
    const counter=matchingTotpCounter(openMfaSecret(key,account.mfaSecretEnc,id,type),code);
    if(counter!==null&&(account.mfaLastCounter===null||counter>account.mfaLastCounter)){
      if(type==='USER')await tx.user.update({where:{id},data:{mfaLastCounter:counter}});else await tx.platformAccount.update({where:{id},data:{mfaLastCounter:counter}});return true;
    }
    return (await tx.mfaRecoveryCode.updateMany({where:{accountType:type,accountId:id,codeHash:hashRecoveryCode(code),usedAt:null},data:{usedAt:new Date()}})).count===1;
  }
  async disable(type:MfaAccountType,id:string,code:string,password:string,sessionId:string){
    const hash=await this.password(type,id,password);await this.limit([digest(`mfa:code:${type}:${id}`)],'CODE',20);const key=await this.key();
    const proof=await this.db.$transaction(async tx=>{
      const account=await this.account(tx,type,id);await this.session(tx,type,id,sessionId);
      if(account.passwordHash!==hash||!await this.assertCode(tx,type,id,code,account,key)){await this.event(tx,type,id,'DISABLE_FAILED');return null;}
      const data={mfaEnabled:false,mfaSecretEnc:null,mfaVerifiedAt:null,mfaLastCounter:null,mfaVersion:{increment:1}};
      if(type==='USER')await tx.user.update({where:{id},data});else await tx.platformAccount.update({where:{id},data});
      await tx.mfaRecoveryCode.deleteMany({where:{accountType:type,accountId:id}});await this.revoke(tx,type,id);await this.event(tx,type,id,'MFA_DISABLED');
      return issueMfaProof({accountType:type,accountId:id,version:account.mfaVersion+1,primaryHash:digest(hash)});
    });if(!proof)throw new UnauthorizedException({code:'MFA_CODE_INVALID',message:'Invalid verification code'});return {ok:true as const,proof};
  }
  async createChallenge(type:MfaAccountType,id:string,passwordHash:string){
    const token=randomBytes(32).toString('hex');await this.db.$transaction(async tx=>{
      const account=await this.account(tx,type,id);if(!account.mfaEnabled||account.passwordHash!==passwordHash)throw new UnauthorizedException('Credentials changed');
      await tx.pendingMfaChallenge.create({data:{accountType:type,accountId:id,tokenHash:digest(token),credentialVersion:account.mfaVersion,primaryCredentialHash:digest(passwordHash),expiresAt:new Date(Date.now()+10*60000)}});
    });return {mfaRequired:true as const,challengeToken:token};
  }
  async verifyChallenge(type:MfaAccountType,token:string,code:string,ip:string){
    await this.limit([digest(`mfa:ip:${ip}`)],'IP',60);
    const row=await this.db.pendingMfaChallenge.findUnique({where:{tokenHash:digest(token)}});
    if(!row||row.accountType!==type||row.purpose!=='LOGIN')throw new UnauthorizedException({code:'MFA_CHALLENGE_INVALID',message:'Invalid verification challenge'});
    await this.limit([digest(`mfa:code:${type}:${row.accountId}`)],'CODE',20);const key=await this.key();
    const proof=await this.db.$transaction(async tx=>{
      const account=await this.account(tx,type,row.accountId),fresh=await tx.pendingMfaChallenge.findUnique({where:{id:row.id}});
      if(!fresh||fresh.consumedAt||fresh.expiresAt<=new Date()||fresh.attempts>=5||fresh.credentialVersion!==account.mfaVersion||fresh.primaryCredentialHash!==digest(account.passwordHash))return null;
      await tx.pendingMfaChallenge.update({where:{id:row.id},data:{attempts:{increment:1}}});
      if(!await this.assertCode(tx,type,row.accountId,code,account,key)){await this.event(tx,type,row.accountId,'LOGIN_CODE_FAILED');return null;}
      await tx.pendingMfaChallenge.update({where:{id:row.id},data:{consumedAt:new Date()}});await this.event(tx,type,row.accountId,'LOGIN_VERIFIED');
      return issueMfaProof({accountType:type,accountId:row.accountId,version:account.mfaVersion,primaryHash:digest(account.passwordHash)});
    });if(!proof)throw new UnauthorizedException({code:'MFA_CODE_INVALID',message:'Invalid code or expired challenge'});return {accountId:row.accountId,proof};
  }
  async isEnabled(type:MfaAccountType,id:string){return !!(await (type==='USER'?this.db.user.findUnique({where:{id},select:{mfaEnabled:true}}):this.db.platformAccount.findUnique({where:{id},select:{mfaEnabled:true}})))?.mfaEnabled;}
}
