import {Injectable,Logger,OnApplicationBootstrap,OnModuleDestroy} from '@nestjs/common';
import {PrismaService} from '../database/prisma.service';
import {environment} from '../config/environment';
@Injectable()
export class BillingWorkerService implements OnApplicationBootstrap,OnModuleDestroy{
 private readonly logger=new Logger(BillingWorkerService.name);private timer:ReturnType<typeof setInterval>|undefined;private running=false;
 constructor(private readonly db:PrismaService){}
 onApplicationBootstrap(){if(environment.NODE_ENV==='test')return;this.timer=setInterval(()=>{void this.tick().catch(()=>this.logger.error('Subscription renewal processing deferred'));},15000);this.timer.unref();}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async tick(){if(this.running)return 0;this.running=true;let processed=0;try{for(let index=0;index<20;index++){const result=await this.db.$queryRaw<Array<{processed:boolean}>>`SELECT billing_dispatch_due() AS processed`;if(!result[0]?.processed)break;processed++;}return processed;}finally{this.running=false;}}
}
