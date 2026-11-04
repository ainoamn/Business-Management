import {Injectable,ServiceUnavailableException} from '@nestjs/common';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {environment} from '../config/environment';
import {aiPrivateHash,openAiCredential,parseAiKey,sealAiCredential} from './ai-crypto';
@Injectable()
export class AiCredentialsService{
 private pending?:Promise<Buffer>;
 private async key(){if(!this.pending)this.pending=this.load().catch(()=>{this.pending=undefined;throw new ServiceUnavailableException({code:'AI_CREDENTIAL_KEY_INVALID',message:'AI credential encryption is not configured'});});return this.pending;}
 private async load(){if(process.env.AI_CREDENTIAL_KEY)return parseAiKey(process.env.AI_CREDENTIAL_KEY);const configured=process.env.AI_CREDENTIAL_KEY_FILE;if(!configured&&environment.DEPLOYMENT_ENV!=='development')throw new Error('AI credential key required');const path=resolve(configured??resolve(__dirname,'../../../../.local/secrets/ai.key'));if(!configured){await mkdir(dirname(path),{recursive:true});try{await writeFile(path,randomBytes(32).toString('base64')+'\n',{flag:'wx',mode:0o600});}catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='EEXIST'))throw error;}}return parseAiKey((await readFile(path,'utf8')).trim());}
 async seal(secret:string,id:string,version:number){return sealAiCredential(await this.key(),secret,id,version);}
 async open(sealed:string,id:string,version:number){try{return openAiCredential(await this.key(),sealed,id,version);}catch{throw new ServiceUnavailableException({code:'AI_CREDENTIAL_INVALID',message:'AI credential cannot be decrypted'});}}
 async hash(value:string){return aiPrivateHash(await this.key(),value);}
}
