import { Injectable } from '@nestjs/common';
import type { Readiness, ServiceState } from '@work/shared-types';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../infrastructure/redis.service';
import { QueueService } from '../infrastructure/queue.service';
import { StorageService } from '../infrastructure/storage.service';

export function withinDeadline<T>(operation: Promise<T>, milliseconds = 4000): Promise<T> {
  return new Promise((resolve,reject) => {
    const timeout = setTimeout(()=>reject(new Error('Readiness timeout')),milliseconds);
    operation.then(value=>{clearTimeout(timeout);resolve(value);},error=>{clearTimeout(timeout);reject(error);});
  });
}

@Injectable()
export class HealthService {
  private cached?: {value:Readiness; expires:number};
  private pending?: Promise<Readiness>;
  constructor(private readonly db:PrismaService,private readonly redis:RedisService,private readonly queue:QueueService,private readonly storage:StorageService) {}
  check():Promise<Readiness> {
    if (this.cached && this.cached.expires > Date.now()) return Promise.resolve(this.cached.value);
    if (this.pending) return this.pending;
    this.pending = this.run().then(value=>{this.cached={value,expires:Date.now()+5000};return value;}).finally(()=>{this.pending=undefined;});
    return this.pending;
  }
  private async run():Promise<Readiness> {
    const redisAvailable = await withinDeadline(this.redis.ping()).then(()=>true,()=>false);
    const results = await Promise.allSettled([
      // Verify migrated schema, not just an open TCP port.
      this.db.$queryRaw`SELECT id FROM organizations LIMIT 0`,
      Promise.resolve(redisAvailable),redisAvailable ? this.queue.probe() : Promise.resolve(false),this.storage.available(),
    ].map(value=>withinDeadline(value)));
    const states = results.map((result):ServiceState=>result.status === 'fulfilled' && result.value !== false ? 'up' : 'down');
    return {status:states.every(state=>state==='up')?'ready':'not_ready',checks:{database:states[0]!,redis:states[1]!,queue:states[2]!,storage:states[3]!},timestamp:new Date().toISOString()};
  }
}
