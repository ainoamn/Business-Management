import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {createRequire} from 'node:module';
import {randomBytes,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import request from 'supertest';
import type {INestApplication} from '@nestjs/common';
import type {PrismaClient} from '@prisma/client';
import type {PlatformSessionView} from '../../packages/shared-types/src';

const require=createRequire(new URL('../../apps/api/package.json',import.meta.url));
const {PrismaClient:Client}=require('@prisma/client') as {PrismaClient:typeof import('@prisma/client').PrismaClient};
const origin='http://localhost:3000';
const database=`platform_test_${randomBytes(8).toString('hex')}`;
const originalAppUrl=process.env.DATABASE_URL;
const suffix=randomUUID();
const password=`Test-only-${randomBytes(20).toString('hex')}`;
const email=`owner-${suffix}@example.invalid`;
const readerEmail=`reader-${suffix}@example.invalid`;
let provisioning:PrismaClient;let admin:PrismaClient;let appDb:PrismaClient;let app:INestApplication;
let owner:PlatformSessionView;let reader:PlatformSessionView;let ownerCookie:string;let readerCookie:string;
let roleId:string;let orgId:string;let userId:string;let accountId:string;let planId:string;let invoiceId:string;let created=false;

function ownerRequest(method:'get'|'post'|'patch',path:string) {return request(app.getHttpServer())[method](`/api/v1/platform/${path}`).set('Cookie',ownerCookie).set('Origin',origin).set('X-CSRF-Token',owner.csrf);}
beforeAll(async()=>{
  if(!process.env.MIGRATION_DATABASE_URL)throw new Error('A local PostgreSQL migration connection is required');
  const source=new URL(process.env.MIGRATION_DATABASE_URL);
  if(!['127.0.0.1','localhost'].includes(source.hostname)||process.env.DEPLOYMENT_ENV!=='development')throw new Error('Platform tests are limited to local development PostgreSQL');
  provisioning=new Client({datasourceUrl:source.toString()});await provisioning.$connect();
  // A fresh database protects application settings and customer records from tests.
  await provisioning.$executeRawUnsafe(`CREATE DATABASE "${database}"`);created=true;
  source.pathname=`/${database}`;
  execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',fileURLToPath(new URL('../../apps/api/prisma/schema.prisma',import.meta.url))],{env:{...process.env,DATABASE_URL:source.toString()},stdio:'pipe',timeout:30000,windowsHide:true});
  admin=new Client({datasourceUrl:source.toString()});
  const appUrl=new URL(process.env.DATABASE_URL!);appUrl.pathname=`/${database}`;process.env.DATABASE_URL=appUrl.toString();
  const {hashPassword}=require('../../apps/api/dist/platform/security.js') as typeof import('../../apps/api/src/platform/security');
  const hash=await hashPassword(password);
  const role=await admin.platformRole.create({data:{name:'Read plans only',permissions:['plans.read']}});roleId=role.id;
  const ownerAccount=await admin.platformAccount.create({data:{email,displayName:'Integration owner',isOwner:true,passwordHash:hash}});accountId=ownerAccount.id;
  await admin.platformAccount.create({data:{email:readerEmail,displayName:'Read-only admin',roleId,passwordHash:hash}});
  await admin.platformSettings.create({data:{id:'main',platformName:'Integration test site',supportEmail:email,footerText:'Test only'}});
  const org=await admin.organization.create({data:{name:'Integration organization',slug:`test-${suffix}`}});orgId=org.id;
  const user=await admin.user.create({data:{email:`user-${suffix}@example.invalid`,displayName:'Organization member',passwordHash:hash}});userId=user.id;
  await admin.membership.create({data:{userId,organizationId:orgId,role:'EMPLOYEE'}});
  const {createApp}=require('../../apps/api/dist/bootstrap.js') as typeof import('../../apps/api/src/bootstrap');
  app=await createApp();await app.init();
  appDb=new Client({datasourceUrl:appUrl.toString()});
  const signIn=await request(app.getHttpServer()).post('/api/v1/platform/auth/login').set('Origin',origin).send({email,password}).expect(201);
  owner=signIn.body as PlatformSessionView;ownerCookie=(signIn.headers['set-cookie'] as unknown as string[]).map(v=>v.split(';')[0]).join(';');
  const readSignIn=await request(app.getHttpServer()).post('/api/v1/platform/auth/login').set('Origin',origin).send({email:readerEmail,password}).expect(201);
  reader=readSignIn.body as PlatformSessionView;readerCookie=(readSignIn.headers['set-cookie'] as unknown as string[]).map(v=>v.split(';')[0]).join(';');
});
afterAll(async()=>{
  if(app)await app.close();if(appDb)await appDb.$disconnect();if(admin)await admin.$disconnect();
  if(provisioning){if(created)await provisioning.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);await provisioning.$disconnect();}
  if(originalAppUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=originalAppUrl;
});

describe('platform access boundaries',()=>{
  it('requires a platform session and never accepts an organization identity',async()=>{
    await request(app.getHttpServer()).get('/api/v1/platform/overview').expect(401);
    const result=await ownerRequest('get','auth/me').expect(200);
    expect(result.body.actor.id).toBe(accountId);expect(result.body).not.toHaveProperty('passwordHash');expect(result.body).not.toHaveProperty('tokenHash');
  });
  it('requires both trusted Origin and session-bound CSRF for writes',async()=>{
    await request(app.getHttpServer()).post('/api/v1/platform/resources/roles').set('Cookie',ownerCookie).set('Origin',origin).send({name:'Denied',permissions:[]}).expect(403);
    await request(app.getHttpServer()).post('/api/v1/platform/resources/roles').set('Cookie',ownerCookie).set('Origin','https://evil.example').set('X-CSRF-Token',owner.csrf).send({name:'Denied',permissions:[]}).expect(403);
  });
  it('enforces read-only permission and denies privilege escalation',async()=>{
    await request(app.getHttpServer()).get('/api/v1/platform/resources/plans').set('Cookie',readerCookie).expect(200);
    await request(app.getHttpServer()).get('/api/v1/platform/resources/accounts').set('Cookie',readerCookie).expect(403);
    await request(app.getHttpServer()).post('/api/v1/platform/resources/roles').set('Cookie',readerCookie).set('Origin',origin).set('X-CSRF-Token',reader.csrf).send({name:'Escalate',permissions:['accounts.manage']}).expect(403);
  });
  it('protects the owner account from disabling and role reassignment',async()=>{
    await ownerRequest('patch',`resources/accounts/${accountId}`).send({displayName:'Changed',roleId,disabled:true}).expect(400);
    expect((await admin.platformAccount.findUniqueOrThrow({where:{id:accountId}})).disabledAt).toBeNull();
  });
  it('exposes organization metadata without disabling row-level isolation',async()=>{
    const result=await ownerRequest('get','resources/organizations').expect(200);
    expect(result.body.items[0].id).toBe(orgId);expect(await appDb.organization.findMany()).toEqual([]);
  });
});

describe('plans, subscriptions, invoices and immutable manual ledger',()=>{
  it('saves a plan and rejects over-limit seats',async()=>{
    const result=await ownerRequest('post','resources/plans').send({name:'Verified plan',description:'Integration fixture',price:'2.500',maxSeats:3,storageMb:512,aiCredits:10,active:true}).expect(201);planId=result.body.id;
    await ownerRequest('post','resources/subscriptions').send({organizationId:orgId,planId,seats:4,status:'ACTIVE',endsAt:new Date(Date.now()+86400000).toISOString()}).expect(400);
    const subscription=await ownerRequest('post','resources/subscriptions').send({organizationId:orgId,planId,seats:3,status:'ACTIVE',endsAt:new Date(Date.now()+86400000).toISOString()}).expect(201);
    expect(subscription.body.unitPrice).toBe('2.5');
  });
  it('keeps subscription price snapshots after plan edits',async()=>{
    await ownerRequest('patch',`resources/plans/${planId}`).send({name:'Verified plan',description:'New price',price:'7.500',maxSeats:3,storageMb:512,aiCredits:10,active:true}).expect(200);
    const result=await ownerRequest('get','resources/subscriptions').expect(200);expect(result.body.items[0].unitPrice).toBe('2.500');
  });
  it('records exact OMR amounts, prevents duplicate references and settles only the manual ledger',async()=>{
    const invoice=await ownerRequest('post','resources/invoices').send({organizationId:orgId,number:`INV-${suffix}`,amount:'0.010',dueAt:new Date(Date.now()+86400000).toISOString()}).expect(201);invoiceId=invoice.body.id;
    const body={organizationId:orgId,invoiceId,reference:`receipt-${suffix}`,direction:'IN',amount:'0.010',note:'Documented manual receipt'};
    await ownerRequest('post','resources/ledger').send(body).expect(201);
    await ownerRequest('post','resources/ledger').send(body).expect(409);
    const rows=await ownerRequest('get','resources/ledger').expect(200);expect(rows.body.total).toBe(1);expect(rows.body.items[0].amount).toBe('0.010');
    expect((await admin.platformInvoice.findUniqueOrThrow({where:{id:invoiceId}})).status).toBe('PAID');
    await expect(appDb.platformLedgerEntry.deleteMany()).rejects.toThrow();
  });
  it('keeps posted invoices from being voided and supports a compensating entry',async()=>{
    await ownerRequest('patch',`resources/invoices/${invoiceId}`).send({disabled:true}).expect(400);
    await ownerRequest('post','resources/ledger').send({organizationId:orgId,invoiceId,reference:`refund-${suffix}`,direction:'OUT',amount:'0.010',note:'Manual compensating entry'}).expect(201);
    expect((await admin.platformInvoice.findUniqueOrThrow({where:{id:invoiceId}})).status).toBe('ISSUED');
  });
});

describe('publishing, security operations and audits',()=>{
  it('hides draft pages, publishes safe text and honors maintenance',async()=>{
    const body={title:'Verified page',slug:`safe-${suffix}`,body:'<script>never execute this</script>',status:'DRAFT'};
    const page=await ownerRequest('post','resources/pages').send(body).expect(201);
    await request(app.getHttpServer()).get(`/api/v1/public/pages/${body.slug}`).expect(404);
    await ownerRequest('patch',`resources/pages/${page.body.id}`).send({...body,status:'PUBLISHED'}).expect(200);
    const publicPage=await request(app.getHttpServer()).get(`/api/v1/public/pages/${body.slug}`).expect(200);expect(publicPage.body.body).toBe(body.body);
    await ownerRequest('patch','settings').send({platformName:'Verified site',supportEmail:email,footerText:'Footer',maintenanceMode:true,publicPagesEnabled:true,sessionMinutes:60}).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/public/pages/${body.slug}`).expect(503);
    await ownerRequest('get','auth/me').expect(200);
  });
  it('suspends organizations without deleting their records',async()=>{
    await ownerRequest('patch',`resources/organizations/${orgId}`).send({disabled:true}).expect(200);
    expect((await admin.organization.findUniqueOrThrow({where:{id:orgId}})).suspendedAt).not.toBeNull();
    await ownerRequest('patch',`resources/organizations/${orgId}`).send({disabled:false}).expect(200);
  });
  it('revokes user sessions when disabling access',async()=>{
    const session=await admin.userSession.create({data:{userId,tokenHash:randomBytes(32).toString('hex'),expiresAt:new Date(Date.now()+60000)}});
    await ownerRequest('patch',`resources/users/${userId}`).send({displayName:'Organization member',disabled:true}).expect(200);
    expect((await admin.userSession.findUniqueOrThrow({where:{id:session.id}})).revokedAt).not.toBeNull();
  });
  it('writes an append-only audit trail without credentials',async()=>{
    const response=await ownerRequest('get','resources/audit').expect(200);
    expect(response.body.total).toBeGreaterThan(5);expect(JSON.stringify(response.body)).not.toContain(password);
    await expect(appDb.platformAudit.deleteMany()).rejects.toThrow();
  });
  it('reports actual storage metadata with explicit platform permission and no customer file contents',async()=>{
   await admin.organizationStorageUsage.upsert({where:{organizationId:orgId},create:{organizationId:orgId,usedBytes:1234n,reservedBytes:56n},update:{usedBytes:1234n,reservedBytes:56n}});
   const response=await ownerRequest('get','operations/storage').expect(200),row=response.body.items.find((row:{id:string})=>row.id===orgId);expect(row.usedBytes).toBe('1234');expect(row.reservedBytes).toBe('56');expect(Object.keys(row).sort()).toEqual(['documents','id','name','reservedBytes','usedBytes','versions']);
   await request(app.getHttpServer()).get('/api/v1/platform/operations/storage').set('Cookie',readerCookie).expect(403);
   const literal=await ownerRequest('get','operations/storage').query({search:'%_'}).expect(200);expect(literal.body.total).toBe(0);
  });
  it('records safe server-error metadata and enforces append-only access in PostgreSQL',async()=>{
   const {ErrorFilter}=require('../../apps/api/dist/common/error.filter.js') as typeof import('../../apps/api/src/common/error.filter');const {PrismaService}=require('../../apps/api/dist/database/prisma.service.js') as typeof import('../../apps/api/src/database/prisma.service');const id=randomUUID(),runtime=app.get(PrismaService);
   const res={getHeader:()=>id,status:()=>res,json:(value:unknown)=>value},req={method:'POST',path:'/api/v1/fixture/secret',route:{path:'/fixture/:id'},body:{password:'never-record-this'}};
   const host={switchToHttp:()=>({getRequest:()=>req,getResponse:()=>res})} as unknown as import('@nestjs/common').ArgumentsHost;new ErrorFilter(runtime).catch(new Error('never-record-this'),host);
   await expect.poll(()=>admin.systemEvent.count({where:{requestId:id}})).toBe(1);const stored=await admin.systemEvent.findFirstOrThrow({where:{requestId:id}});expect(stored.route).toBe('/fixture/:id');expect(stored.category).toBe('SERVER_ERROR');expect(JSON.stringify(stored)).not.toContain('never-record-this');
   const response=await ownerRequest('get','operations/errors').query({search:id}).expect(200);expect(response.body.total).toBe(1);expect(response.body.items[0].requestId).toBe(id);
   await request(app.getHttpServer()).get('/api/v1/platform/operations/errors').set('Cookie',readerCookie).expect(403);expect(await appDb.systemEvent.count()).toBe(0);await expect(appDb.systemEvent.updateMany({data:{category:'FORGED'}})).rejects.toThrow();
  });
  it('controls actual runtime features with version protection and append-only change history',async()=>{
   const initial=await ownerRequest('get','operations/flags').expect(200);expect(initial.body.items).toHaveLength(4);expect(initial.body.items.every((row:{enabled:boolean;version:number})=>row.enabled&&row.version===0)).toBe(true);
   const body={enabled:false,version:0,reason:'Isolated feature control verification'};await ownerRequest('patch','operations/flags/UNKNOWN').send(body).expect(400);await request(app.getHttpServer()).patch('/api/v1/platform/operations/flags/AI').set('Origin',origin).set('Cookie',readerCookie).set('X-CSRF-Token',reader.csrf).send(body).expect(403);
   await ownerRequest('patch','operations/flags/AI').send(body).expect(200);await ownerRequest('patch','operations/flags/AI').send(body).expect(409);await ownerRequest('patch','operations/flags/AUTOMATION').send(body).expect(200);
   const org=await admin.organization.create({data:{name:'Flag runtime fixture',slug:'flags-'+randomBytes(8).toString('hex')}}),user=await admin.user.create({data:{email:'flags-'+randomBytes(8).toString('hex')+'@example.invalid',displayName:'Flag runtime fixture',passwordHash:'Fixture only',emailVerifiedAt:new Date()}}),member=await admin.membership.create({data:{organizationId:org.id,userId:user.id,role:'ORGANIZATION_OWNER'}}),plan=await admin.platformPlan.create({data:{name:'Flag plan '+randomBytes(8).toString('hex'),description:'Isolated contract',price:'4.500',maxSeats:3,storageMb:100,aiCredits:100,automationRuns:100,activeWorkflows:5}});await admin.platformSubscription.create({data:{organizationId:org.id,planId:plan.id,status:'ACTIVE',seats:3,unitPrice:'4.500',endsAt:new Date(Date.now()+86400000)}});
   const {PrismaService}=require('../../apps/api/dist/database/prisma.service.js') as typeof import('../../apps/api/src/database/prisma.service'),{BillingEntitlementsService}=require('../../apps/api/dist/billing/billing-entitlements.service.js') as typeof import('../../apps/api/src/billing/billing-entitlements.service'),{AiQuotaService}=require('../../apps/api/dist/ai/ai-quota.service.js') as typeof import('../../apps/api/src/ai/ai-quota.service');const runtime=app.get(PrismaService);
   const paused=await runtime.withOrganization(user.id,org.id,tx=>app.get(BillingEntitlementsService).current(tx,org.id));expect(paused.features).not.toContain('AUTOMATION');expect(paused.automationRuns).toBe(0);expect(paused.aiCredits).toBe(0);
   await expect(runtime.withOrganization(user.id,org.id,tx=>app.get(AiQuotaService).model(tx,{userId:user.id,organizationId:org.id,membershipId:member.id,role:'ORGANIZATION_OWNER',branchId:null,departmentId:null,grants:[{permission:'ai.use',scope:'ORGANIZATION',scopeId:null}]}))).rejects.toThrow('temporarily disabled');
   for(const key of ['AI','AUTOMATION'])await ownerRequest('patch','operations/flags/'+key).send({enabled:true,version:1,reason:'Restore fixture availability'}).expect(200);
   const resumed=await runtime.withOrganization(user.id,org.id,tx=>app.get(BillingEntitlementsService).current(tx,org.id));expect(resumed.automationRuns).toBe(100);expect(resumed.aiCredits).toBe(100);const history=await ownerRequest('get','operations/flags').expect(200);expect(history.body.history).toHaveLength(4);await expect(appDb.platformFlagChange.updateMany({data:{reason:'FORGED'}})).rejects.toThrow();
  });
  it('limits integration monitoring to aggregate states and freshly authorized platform settings readers',async()=>{
   const secret='integration-secret-'+randomBytes(12).toString('hex');await admin.organizationIntegration.create({data:{organizationId:orgId,kind:'GOOGLE_CALENDAR',status:'CONNECTED',configEnc:secret}});
   const result=await ownerRequest('get','operations/integrations').expect(200);expect(result.body.items.find((row:{kind:string})=>row.kind==='GOOGLE_CALENDAR')).toMatchObject({connected:1,adapterStatus:'NOT_CONFIGURED'});expect(result.body.items.some((row:{kind:string})=>row.kind==='ACCOUNTING')).toBe(true);expect(JSON.stringify(result.body)).not.toContain(secret);expect(JSON.stringify(result.body)).not.toContain(orgId);
   await request(app.getHttpServer()).get('/api/v1/platform/operations/integrations').set('Cookie',readerCookie).expect(403);await expect(appDb.$queryRawUnsafe('SELECT * FROM platform_integration_counts()')).rejects.toThrow();
  });
  it('creates an organization for a verified active existing user and audits it without creating another account or subscription',async()=>{
   const target=await admin.user.create({data:{email:'provision-'+randomBytes(8).toString('hex')+'@example.invalid',displayName:'Provisioned owner',passwordHash:'Not a login credential',emailVerifiedAt:new Date()}}),body={name:'Administratively provisioned organization',slug:'provision-'+randomBytes(8).toString('hex'),ownerEmail:target.email};
   const accounts=await admin.user.count(),subscriptions=await admin.platformSubscription.count();const createdOrg=await ownerRequest('post','resources/organizations').send(body).expect(201);expect(await admin.user.count()).toBe(accounts);expect(await admin.platformSubscription.count()).toBe(subscriptions);expect(await admin.membership.findFirst({where:{organizationId:createdOrg.body.id,userId:target.id,role:'ORGANIZATION_OWNER',active:true}})).not.toBeNull();expect(await admin.organizationSettings.findUnique({where:{organizationId:createdOrg.body.id}})).not.toBeNull();expect(await admin.platformAudit.count({where:{resource:'organizations',resourceId:createdOrg.body.id,action:'CREATE',actorId:owner.actor.id}})).toBe(1);
   await ownerRequest('post','resources/organizations').send(body).expect(409);await request(app.getHttpServer()).post('/api/v1/platform/resources/organizations').set('Cookie',readerCookie).set('Origin',origin).set('X-CSRF-Token',reader.csrf).send({...body,slug:body.slug+'-forbidden'}).expect(403);
   await expect(appDb.$queryRawUnsafe('SELECT platform_create_organization($1::uuid,$2,$3,$4)',randomUUID(),'Denied direct call',body.slug+'-denied',target.email)).rejects.toThrow();
  });
  it('rejects nonexistent, unverified and disabled proposed owners without partial organization creation',async()=>{
   const target=await admin.user.create({data:{email:'unverified-'+randomBytes(8).toString('hex')+'@example.invalid',displayName:'Unverified owner',passwordHash:'Not a login credential'}}),slug='invalid-owner-'+randomBytes(8).toString('hex'),body={name:'Must not be created',slug,ownerEmail:target.email};await ownerRequest('post','resources/organizations').send(body).expect(400);await admin.user.update({where:{id:target.id},data:{emailVerifiedAt:new Date(),disabledAt:new Date()}});await ownerRequest('post','resources/organizations').send(body).expect(400);await ownerRequest('post','resources/organizations').send({...body,ownerEmail:'missing-'+randomBytes(8).toString('hex')+'@example.invalid'}).expect(400);expect(await admin.organization.count({where:{slug}})).toBe(0);
  });
  it('revokes admin sessions and rejects their reuse',async()=>{
    await ownerRequest('post',`security/sessions/${reader.actor.sessionId}/revoke`).expect(201);
    await request(app.getHttpServer()).get('/api/v1/platform/resources/plans').set('Cookie',readerCookie).expect(401);
  });
  it('limits repeated sign-in attempts',async()=>{
    const unknown=`missing-${suffix}@example.invalid`;
    for(let i=0;i<5;i++)await request(app.getHttpServer()).post('/api/v1/platform/auth/login').set('Origin',origin).send({email:unknown,password:'Wrong-password-456'}).expect(401);
    await request(app.getHttpServer()).post('/api/v1/platform/auth/login').set('Origin',origin).send({email:unknown,password:'Wrong-password-456'}).expect(429);
  });
  it('changes the owner password and invalidates all previous sessions',async()=>{
    const newPassword=`New-test-${randomBytes(20).toString('hex')}`;
    await ownerRequest('post','auth/password').send({currentPassword:password,newPassword}).expect(201);
    await ownerRequest('get','auth/me').expect(401);
    await request(app.getHttpServer()).post('/api/v1/platform/auth/login').set('Origin',origin).send({email,password:newPassword}).expect(201);
  });
});
