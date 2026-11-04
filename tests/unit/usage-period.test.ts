import {describe,expect,it} from 'vitest';
import {usagePeriod} from '../../apps/api/src/work/usage-period';
describe('subscription monthly quota periods',()=>{
 it('uses UTC calendar months for an organization without a subscription',()=>{const period=usagePeriod(undefined,new Date('2026-11-03T20:30:00Z'));expect(period.start.toISOString()).toBe('2026-11-01T00:00:00.000Z');expect(period.end.toISOString()).toBe('2026-12-01T00:00:00.000Z');});
 it('keeps the subscription anniversary and its exact boundary',()=>{const anchor=new Date('2026-08-15T10:30:45.123Z');expect(usagePeriod(anchor,new Date('2026-11-15T10:30:45.122Z')).start.toISOString()).toBe('2026-10-15T10:30:45.123Z');expect(usagePeriod(anchor,new Date('2026-11-15T10:30:45.123Z')).start.toISOString()).toBe('2026-11-15T10:30:45.123Z');});
 it('clamps short months without losing the original day and handles year boundaries',()=>{const anchor=new Date('2026-01-31T08:00:00Z');const february=usagePeriod(anchor,new Date('2027-03-01T00:00:00Z'));expect(february.start.toISOString()).toBe('2027-02-28T08:00:00.000Z');expect(february.end.toISOString()).toBe('2027-03-31T08:00:00.000Z');expect(usagePeriod(anchor,new Date('2028-03-01T00:00:00Z')).start.toISOString()).toBe('2028-02-29T08:00:00.000Z');expect(usagePeriod(anchor,new Date('2027-01-01T00:00:00Z')).start.toISOString()).toBe('2026-12-31T08:00:00.000Z');});
});
