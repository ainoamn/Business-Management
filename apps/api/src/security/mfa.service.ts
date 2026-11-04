import {BadRequestException,Injectable,ServiceUnavailableException,UnauthorizedException} from '@nestjs/common';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {PrismaService} from '../database/prisma.service';
import {environment} from '../config/environment';
import {digest} from '../common/credentials';
import {
  parseMfaKey,
  sealMfaSecret,
  openMfaSecret,
  generateTotpSecret,
  generateTotpUri,
  verifyTotpCode,
  generateRecoveryCodes,
  hashRecoveryCode,
} from './mfa';

@Injectable()
export class MfaService {
  private pending?:Promise<Buffer>;
  constructor(private readonly db:PrismaService){}

  private async key(){
    if(!this.pending){
      this.pending=this.load().catch(error=>{this.pending=undefined;throw error;});
    }
    return this.pending;
  }

  private async load(){
    if(process.env.MFA_CREDENTIAL_KEY)return parseMfaKey(process.env.MFA_CREDENTIAL_KEY);
    if(process.env.AI_CREDENTIAL_KEY)return parseMfaKey(process.env.AI_CREDENTIAL_KEY);
    if(environment.DEPLOYMENT_ENV!=='development'){
      throw new ServiceUnavailableException({code:'MFA_CREDENTIAL_KEY_REQUIRED',message:'MFA encryption key is required outside development'});
    }
    const path=resolve(__dirname,'../../../../.local/secrets/mfa.key');
    await mkdir(dirname(path),{recursive:true});
    try{await writeFile(path,randomBytes(32).toString('base64')+'\n',{flag:'wx',mode:0o600});}catch(error){
      if(!(error instanceof Error&&'code' in error&&error.code==='EEXIST'))throw error;
    }
    return parseMfaKey((await readFile(path,'utf8')).trim());
  }

  async startEnrollment(accountType:'USER'|'PLATFORM',accountId:string,label:string){
    const secret=generateTotpSecret();
    return {secret,uri:generateTotpUri(secret,label)};
  }

  async completeEnrollment(accountType:'USER'|'PLATFORM',accountId:string,secret:string,code:string){
    if(!verifyTotpCode(secret,code))throw new BadRequestException({code:'MFA_CODE_INVALID',message:'Invalid verification code'});
    const sealed=sealMfaSecret(await this.key(),secret,accountId,accountType);
    const recoveryCodes=generateRecoveryCodes();
    await this.db.$transaction(async tx=>{
      if(accountType==='USER'){
        await tx.user.update({where:{id:accountId},data:{mfaEnabled:true,mfaSecretEnc:sealed,mfaVerifiedAt:new Date()}});
      }else{
        await tx.platformAccount.update({where:{id:accountId},data:{mfaEnabled:true,mfaSecretEnc:sealed,mfaVerifiedAt:new Date()}});
      }
      await tx.mfaRecoveryCode.deleteMany({where:{accountType,accountId}});
      await tx.mfaRecoveryCode.createMany({data:recoveryCodes.map(value=>({accountType,accountId,codeHash:hashRecoveryCode(value)}))});
    });
    return {ok:true,recoveryCodes};
  }

  async disable(accountType:'USER'|'PLATFORM',accountId:string,code:string){
    await this.assertCode(accountType,accountId,code);
    await this.db.$transaction(async tx=>{
      if(accountType==='USER')await tx.user.update({where:{id:accountId},data:{mfaEnabled:false,mfaSecretEnc:null,mfaVerifiedAt:null}});
      else await tx.platformAccount.update({where:{id:accountId},data:{mfaEnabled:false,mfaSecretEnc:null,mfaVerifiedAt:null}});
      await tx.mfaRecoveryCode.deleteMany({where:{accountType,accountId}});
      await tx.pendingMfaChallenge.deleteMany({where:{accountType,accountId}});
    });
    return {ok:true};
  }

  async createChallenge(accountType:'USER'|'PLATFORM',accountId:string){
    const token=randomBytes(32).toString('hex');
    await this.db.pendingMfaChallenge.create({data:{accountType,accountId,tokenHash:digest(token),expiresAt:new Date(Date.now()+10*60000)}});
    return {mfaRequired:true as const,challengeToken:token};
  }

  async verifyChallenge(challengeToken:string,code:string){
    const challenge=await this.db.pendingMfaChallenge.findUnique({where:{tokenHash:digest(challengeToken)}});
    if(!challenge||challenge.expiresAt<=new Date())throw new UnauthorizedException({code:'MFA_CHALLENGE_INVALID',message:'Challenge expired or invalid'});
    await this.assertCode(challenge.accountType as 'USER'|'PLATFORM',challenge.accountId,code);
    await this.db.pendingMfaChallenge.delete({where:{id:challenge.id}});
    return {accountType:challenge.accountType as 'USER'|'PLATFORM',accountId:challenge.accountId};
  }

  async isEnabled(accountType:'USER'|'PLATFORM',accountId:string){
    if(accountType==='USER')return !!(await this.db.user.findUnique({where:{id:accountId},select:{mfaEnabled:true}}))?.mfaEnabled;
    return !!(await this.db.platformAccount.findUnique({where:{id:accountId},select:{mfaEnabled:true}}))?.mfaEnabled;
  }

  private async assertCode(accountType:'USER'|'PLATFORM',accountId:string,code:string){
    const account=accountType==='USER'
      ?await this.db.user.findUnique({where:{id:accountId},select:{mfaEnabled:true,mfaSecretEnc:true}})
      :await this.db.platformAccount.findUnique({where:{id:accountId},select:{mfaEnabled:true,mfaSecretEnc:true}});
    if(!account?.mfaEnabled||!account.mfaSecretEnc)throw new UnauthorizedException({code:'MFA_NOT_ENABLED',message:'MFA is not enabled'});
    const secret=openMfaSecret(await this.key(),account.mfaSecretEnc,accountId,accountType);
    if(verifyTotpCode(secret,code))return;
    if(!/^[A-Z0-9-]{8,20}$/i.test(code))throw new UnauthorizedException({code:'MFA_CODE_INVALID',message:'Invalid MFA code'});
    const recovery=await this.db.mfaRecoveryCode.findFirst({where:{accountType,accountId,codeHash:hashRecoveryCode(code.toUpperCase()),usedAt:null}});
    if(!recovery)throw new UnauthorizedException({code:'MFA_CODE_INVALID',message:'Invalid MFA code'});
    await this.db.mfaRecoveryCode.update({where:{id:recovery.id},data:{usedAt:new Date()}});
  }
}
