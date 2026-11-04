import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

const require = createRequire(new URL('../../apps/api/package.json',import.meta.url));
const {PrismaClient:Client} = require('@prisma/client') as {PrismaClient:typeof import('@prisma/client').PrismaClient};
const {PrismaService} = require('../../apps/api/dist/database/prisma.service.js') as typeof import('../../apps/api/src/database/prisma.service');
const {createApp} = require('../../apps/api/dist/bootstrap.js') as typeof import('../../apps/api/src/bootstrap');
const ids={userA:randomUUID(),userB:randomUUID(),orgA:randomUUID(),orgB:randomUUID()};
const suffix=randomUUID();
let admin:PrismaClient;
let appDb:InstanceType<typeof PrismaService>;
let app:INestApplication;
let connected=false;

beforeAll(async()=>{
  if(!process.env.MIGRATION_DATABASE_URL) throw new Error('Integration tests require local infrastructure and MIGRATION_DATABASE_URL');
  admin=new Client({datasourceUrl:process.env.MIGRATION_DATABASE_URL});
  appDb=new PrismaService();
  await admin.$connect();connected=true;await appDb.$connect();
  await admin.user.createMany({data:[{id:ids.userA,email:`a-${suffix}@test.invalid`,passwordHash:'TEST_FIXTURE_NOT_LOGIN_CAPABLE',displayName:'Test A'},{id:ids.userB,email:`b-${suffix}@test.invalid`,passwordHash:'TEST_FIXTURE_NOT_LOGIN_CAPABLE',displayName:'Test B'}]});
  await admin.organization.createMany({data:[{id:ids.orgA,name:'Isolation test A',slug:`a-${suffix}`},{id:ids.orgB,name:'Isolation test B',slug:`b-${suffix}`}]});
  await admin.membership.createMany({data:[{organizationId:ids.orgA,userId:ids.userA,role:'ORGANIZATION_OWNER'},{organizationId:ids.orgB,userId:ids.userB,role:'EMPLOYEE'}]});
  app=await createApp();await app.init();
});
afterAll(async()=>{
  if(app) await app.close();
  if(appDb) await appDb.$disconnect();
  if(admin && connected){
    await admin.auditLog.deleteMany({where:{organizationId:{in:[ids.orgA,ids.orgB]}}});
    await admin.membership.deleteMany({where:{organizationId:{in:[ids.orgA,ids.orgB]}}});
    await admin.organization.deleteMany({where:{id:{in:[ids.orgA,ids.orgB]}}});
    await admin.user.deleteMany({where:{id:{in:[ids.userA,ids.userB]}}});
    await admin.$disconnect();
  }
  else if(admin) await admin.$disconnect();
});

describe('real infrastructure',()=>{
  it('checks liveness and response security headers',async()=>{
    const response=await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    expect(response.body).toEqual({status:'alive'});
    expect(response.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
  it('requires schema, Redis, worker execution and storage to be ready',async()=>{
    const response=await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    expect(response.body.checks).toEqual({database:'up',redis:'up',queue:'up',storage:'up'});
  });
  it('does not allow anonymous access to the private bucket',async()=>{
    const response=await fetch(`${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/`,{method:'HEAD',signal:AbortSignal.timeout(3000)});
    expect([401,403]).toContain(response.status);
  });
  it('returns a consistent 404 envelope',async()=>{
    const response=await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);
    expect(response.body).toMatchObject({statusCode:404});
    expect(response.body.requestId).toBeTruthy();
  });
});
describe('PostgreSQL organization isolation',()=>{
  it('uses a non-superuser role that cannot bypass RLS',async()=>{
    const roles=await appDb.$queryRaw<Array<{rolsuper:boolean;rolbypassrls:boolean}>>`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
    expect(roles).toEqual([{rolsuper:false,rolbypassrls:false}]);
  });
  it('fails closed when tenant context is absent',async()=>{expect(await appDb.organization.findMany()).toEqual([]);expect(await appDb.membership.findMany()).toEqual([]);});
  it('reads only the authenticated member organization',async()=>{
    const organizations=await appDb.withOrganization(ids.userA,ids.orgA,tx=>tx.organization.findMany());
    expect(organizations.map(o=>o.id)).toEqual([ids.orgA]);
  });
  it('rejects a forged organization choice',async()=>{await expect(appDb.withOrganization(ids.userA,ids.orgB,tx=>tx.organization.findMany())).rejects.toThrow('Organization access denied');});
  it('prevents guessed IDs from exposing other organizations',async()=>{
    expect(await appDb.withOrganization(ids.userA,ids.orgA,tx=>tx.organization.findUnique({where:{id:ids.orgB}}))).toBeNull();
  });
  it('resets transaction context before pooled connections are reused',async()=>{
    await appDb.withOrganization(ids.userA,ids.orgA,tx=>tx.organization.findMany());
    expect(await appDb.organization.findMany()).toEqual([]);
    const next=await appDb.withOrganization(ids.userB,ids.orgB,tx=>tx.organization.findMany());
    expect(next.map(o=>o.id)).toEqual([ids.orgB]);
  });
  it('blocks cross-tenant audit writes and makes the audit trail append-only',async()=>{
    const row={organizationId:ids.orgB,actorId:ids.userA,action:'TEST',resourceType:'organization',resourceId:ids.orgB,requestId:randomUUID()};
    await expect(appDb.withOrganization(ids.userA,ids.orgA,tx=>tx.auditLog.create({data:row}))).rejects.toThrow();
    await appDb.withOrganization(ids.userA,ids.orgA,tx=>tx.auditLog.create({data:{...row,organizationId:ids.orgA,resourceId:ids.orgA}}));
    await expect(appDb.withOrganization(ids.userA,ids.orgA,tx=>tx.auditLog.deleteMany())).rejects.toThrow();
  });
  it('rejects inactive memberships',async()=>{
    await admin.membership.update({where:{organizationId_userId:{organizationId:ids.orgB,userId:ids.userB}},data:{active:false}});
    await expect(appDb.withOrganization(ids.userB,ids.orgB,tx=>tx.organization.findMany())).rejects.toThrow('Organization access denied');
  });
});
