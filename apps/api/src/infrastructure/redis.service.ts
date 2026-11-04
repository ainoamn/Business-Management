import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { environment } from '../config/environment';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client = new Redis(environment.REDIS_URL, {enableOfflineQueue:false,connectTimeout:2000,commandTimeout:2000,maxRetriesPerRequest:1,retryStrategy:times=>Math.min(times*200,2000)});
  constructor() { this.client.on('error', () => { /* Readiness reports outages without logging credentials. */ }); }
  async ping() { return this.client.ping(); }
  async onModuleDestroy() { this.client.disconnect(); }
}
