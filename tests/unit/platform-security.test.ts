import {describe,expect,it} from 'vitest';
import {csrfFor,hashPassword,matchesCsrf,originAllowed,permissionsFor,verifyPassword,allowed} from '../../apps/api/src/platform/security';
import {platformAccountSchema,platformLedgerSchema,platformPlanSchema,platformRoleSchema,platformSettingsSchema} from '../../packages/shared-schemas/src';
import type {PlatformActor} from '../../packages/shared-types/src';
const actor:PlatformActor={id:'00000000-0000-4000-8000-000000000001',email:'test@example.invalid',displayName:'Test',isOwner:false,permissions:['plans.read'],sessionId:'test'};
describe('platform security boundaries',()=>{
  it('hashes and verifies passwords with independent salts',async()=>{
    const hash=await hashPassword('Local-test-password-34');
    expect(hash).not.toContain('Local-test-password');
    expect(await verifyPassword('Local-test-password-34',hash)).toBe(true);
    expect(await verifyPassword('wrong-password',hash)).toBe(false);
    expect(await verifyPassword('anything','invalid hash')).toBe(false);
  },10000);
  it('binds CSRF to the opaque session and rejects malformed values',()=>{
    const token='a'.repeat(64);expect(matchesCsrf(token,csrfFor(token))).toBe(true);
    expect(matchesCsrf('b'.repeat(64),csrfFor(token))).toBe(false);expect(matchesCsrf(token,undefined)).toBe(false);expect(matchesCsrf(token,'arbitrary')).toBe(false);
  });
  it('allows only the configured origin and development loopback alias',()=>{
    expect(originAllowed('http://127.0.0.1:3000','http://localhost:3000',true)).toBe(true);
    expect(originAllowed('http://127.0.0.1:3000','http://localhost:3000',false)).toBe(false);
    expect(originAllowed('https://evil.example','https://work.example',false)).toBe(false);
    expect(originAllowed(undefined,'http://localhost:3000',true)).toBe(false);
    expect(originAllowed('http://localhost:3001','http://localhost:3000',true)).toBe(false);
  });
  it('does not infer manage permissions from read permissions',()=>{expect(allowed(actor,'plans.read')).toBe(true);expect(allowed(actor,'plans.manage')).toBe(false);expect(permissionsFor(false,['plans.read','invented.permission'])).toEqual(['plans.read']);});
});
describe('platform input boundaries',()=>{
  it('rejects privilege escalation fields and unknown permissions',()=>{
    expect(platformAccountSchema.safeParse({email:'a@example.com',displayName:'Admin',password:'Long-password-2',roleId:actor.id,isOwner:true}).success).toBe(false);
    expect(platformRoleSchema.safeParse({name:'Role',permissions:['tenant.content.read']}).success).toBe(false);
  });
  it('preserves decimal strings and refuses negative or overprecise money',()=>{
    const plan={name:'Plan',description:'A plan',price:'2.500',maxSeats:3,storageMb:100,aiCredits:0,active:true};
    expect(platformPlanSchema.parse(plan).price).toBe('2.500');
    expect(platformPlanSchema.safeParse({...plan,price:'-1'}).success).toBe(false);
    expect(platformPlanSchema.safeParse({...plan,price:'1.0001'}).success).toBe(false);
    expect(platformPlanSchema.safeParse({...plan,maxSeats:0}).success).toBe(false);
  });
  it('requires a positive manual amount and bounded session policy',()=>{
    expect(platformLedgerSchema.safeParse({organizationId:actor.id,reference:'ref',direction:'IN',amount:'0',note:'Documented'}).success).toBe(false);
    expect(platformSettingsSchema.safeParse({platformName:'Work',supportEmail:'a@example.com',footerText:'',maintenanceMode:false,publicPagesEnabled:true,sessionMinutes:9999}).success).toBe(false);
  });
});
