import {Injectable,Logger,type OnModuleDestroy,type OnModuleInit} from '@nestjs/common';
import {PrismaService} from '../database/prisma.service';
import type {AiResponse} from '@work/shared-schemas';
import type {AiProviderUsage} from './ai-provider';
@Injectable()
export class AiSettlementService implements OnModuleInit,OnModuleDestroy{
 private readonly logger=new Logger(AiSettlementService.name);private timer?:ReturnType<typeof setInterval>;private work?:Promise<void>;
 constructor(private readonly db:PrismaService){}
 onModuleInit(){if(process.env.NODE_ENV==='test')return;this.timer=setInterval(()=>{void this.tick().catch(()=>this.logger.warn('AI accounting maintenance failed; recorded reservations remain held'));},10000);this.timer.unref();}
 async onModuleDestroy(){if(this.timer)clearInterval(this.timer);await this.work?.catch(()=>undefined);}
 async tick(){if(this.work)return this.work;this.work=(async()=>{await this.db.$queryRaw`SELECT ai_retry_receipts()`;await this.db.$queryRaw`SELECT ai_expire_requests()`;})().finally(()=>{this.work=undefined;});return this.work;}
 async beforeDispatchFailure(id:string,capability:string|null,code:string){if(!capability)return;await this.db.$queryRaw`SELECT ai_settle_request(${id}::uuid,${capability}::uuid,'FAILED',0,0,0,NULL,${code},NULL)`;}
 async uncertain(id:string,capability:string,code:string,providerResponseId:string|null=null){await this.db.$queryRaw`SELECT ai_settle_request(${id}::uuid,${capability}::uuid,'UNCERTAIN',NULL,NULL,NULL,NULL,${code},${providerResponseId})`;}
 async record(id:string,capability:string,outcome:'COMPLETED'|'FAILED',usage:AiProviderUsage,response:AiResponse|null,code:string|null,providerResponseId:string|null){const payload=response?JSON.stringify(response):null;await this.db.$queryRaw`SELECT ai_record_receipt(${id}::uuid,${capability}::uuid,${outcome},${usage.input}::integer,${usage.cached}::integer,${usage.output}::integer,${payload}::jsonb,${code},${providerResponseId})`;await this.db.$queryRaw`SELECT ai_settle_request(${id}::uuid,${capability}::uuid,${outcome},${usage.input}::integer,${usage.cached}::integer,${usage.output}::integer,${payload}::jsonb,${code},${providerResponseId})`;}
}
