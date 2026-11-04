import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue, QueueEvents, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { environment } from '../config/environment';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly redisUrl = new URL(environment.REDIS_URL);
  private readonly connection = {
    host:this.redisUrl.hostname,port:Number(this.redisUrl.port || 6379),
    username:this.redisUrl.username ? decodeURIComponent(this.redisUrl.username) : undefined,
    password:this.redisUrl.password ? decodeURIComponent(this.redisUrl.password) : undefined,
    db:Number(this.redisUrl.pathname.slice(1) || 0),
    ...(this.redisUrl.protocol==='rediss:'?{tls:{}}:{}),
    connectTimeout:2000,maxRetriesPerRequest:null,
  };
  private bundle?:{queue:Queue;events:QueueEvents;worker:Worker};
  private initialize() {
    if(this.bundle)return this.bundle;
    const queue=new Queue('infrastructure-probe',{connection:this.connection,prefix:'work-management'});
    const events=new QueueEvents('infrastructure-probe',{connection:this.connection,prefix:'work-management'});
    const worker=new Worker('infrastructure-probe',async(job:Job<{nonce:string}>)=>{
      if(job.name!=='probe')throw new Error('Unsupported infrastructure job');return job.data.nonce;
    },{connection:this.connection,concurrency:1,prefix:'work-management'});
    queue.on('error',()=>{ /* surfaced by readiness */ });events.on('error',()=>{ /* surfaced by readiness */ });worker.on('error',()=>{ /* surfaced by readiness */ });
    this.bundle={queue,events,worker};return this.bundle;
  }
  async probe(): Promise<boolean> {
    // Start workers only when a caller has verified Redis is reachable. The
    // administrative database remains usable while optional workers are down.
    const {queue,events}=this.initialize();
    const nonce = randomUUID();
    await events.waitUntilReady();
    // Keep the result briefly: a fast worker may finish before waitUntilFinished
    // attaches its listener. Immediate deletion would lose that completed result.
    const job = await queue.add('probe',{nonce},{removeOnComplete:{age:60,count:20},removeOnFail:10});
    return await job.waitUntilFinished(events,2500) === nonce;
  }
  async onModuleDestroy() {if(this.bundle){await this.bundle.worker.close(true);await this.bundle.events.close();await this.bundle.queue.close();}}
}
