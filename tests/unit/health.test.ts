import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthService, withinDeadline } from '../../apps/api/src/health/health.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.service';
import type { RedisService } from '../../apps/api/src/infrastructure/redis.service';
import type { QueueService } from '../../apps/api/src/infrastructure/queue.service';
import type { StorageService } from '../../apps/api/src/infrastructure/storage.service';

function fixture() {
  const db={$queryRaw:vi.fn().mockResolvedValue([])};
  const redis={ping:vi.fn().mockResolvedValue('PONG')};
  const queue={probe:vi.fn().mockResolvedValue(true)};
  const storage={available:vi.fn().mockResolvedValue(true)};
  const service=new HealthService(db as unknown as PrismaService,redis as unknown as RedisService,queue as unknown as QueueService,storage as unknown as StorageService);
  return {service,db,redis,queue,storage};
}
afterEach(()=>vi.useRealTimers());
describe('readiness aggregation',()=>{
  it('reports ready only when every dependency succeeds',async()=>{
    const {service}=fixture();
    expect(await service.check()).toMatchObject({status:'ready',checks:{database:'up',redis:'up',queue:'up',storage:'up'}});
  });
  it('does not claim success when the worker returns false',async()=>{
    const {service,queue}=fixture();queue.probe.mockResolvedValue(false);
    expect(await service.check()).toMatchObject({status:'not_ready',checks:{queue:'down'}});
  });
  it('marks Redis and queue down and avoids enqueueing when Redis fails',async()=>{
    const {service,redis,queue}=fixture();redis.ping.mockRejectedValue(new Error('unavailable'));
    expect(await service.check()).toMatchObject({status:'not_ready',checks:{redis:'down',queue:'down'}});
    expect(queue.probe).not.toHaveBeenCalled();
  });
  it('shares concurrent probes and expires the short cache',async()=>{
    vi.useFakeTimers();const {service,db}=fixture();
    await Promise.all([service.check(),service.check()]);
    await service.check();expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5001);await service.check();expect(db.$queryRaw).toHaveBeenCalledTimes(2);
  });
  it('reports a failed database query without leaking provider errors',async()=>{
    const {service,db}=fixture();db.$queryRaw.mockRejectedValue(new Error('password=do-not-leak'));
    const result=await service.check();expect(result.status).toBe('not_ready');expect(result.checks.database).toBe('down');
    expect(JSON.stringify(result)).not.toContain('password');
  });
  it('bounds a hanging dependency check',async()=>{
    vi.useFakeTimers();
    const pending=withinDeadline(new Promise(()=>{}),100);
    const assertion=expect(pending).rejects.toThrow('Readiness timeout');
    await vi.advanceTimersByTimeAsync(100);await assertion;
  });
});
