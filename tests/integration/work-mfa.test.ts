import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import request from 'supertest';
import type {INestApplication} from '@nestjs/common';
import type {PrismaClient} from '@prisma/client';
const require=createRequire(new URL('../../apps/api/package.json',import.meta.url));
const {PrismaClient:Client}=require('@prisma/client') as {PrismaClient:typeof import('@prisma/client').PrismaClient};
const suffix=randomBytes(8).toString('hex'),database=`mfa_test_${suffix}`,origin='http://localhost:3000',password=`Fixture-${randomBytes(20).toString('hex')}`;
const keys=['DATABASE_URL','NODE_ENV','MFA_CREDENTIAL_KEY'] as const,original=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
let provisioner:PrismaClient,admin:PrismaClient,app:INestApplication,created=false;
let totp:(secret:string,time?:number)=>string;
const cookie=(headers:Record<string,unknown>)=>(headers['set-cookie'] as string[]).map(value=>value.split(';')[0]).join(';');
beforeAll(async()=>{
 if(!process.env.MIGRATION_DATABASE_URL||process.env.DEPLOYMENT_ENV!=='development')throw new Error('Isolated local development database required');const source=new URL(process.env.MIGRATION_DATABASE_URL);if(!['127.0.0.1','localhost'].includes(source.hostname))throw new Error('Local only');
 provisioner=new Client({datasourceUrl:source.toString()});await provisioner.$executeRawUnsafe(`CREATE DATABASE "${database}"`);created=true;source.pathname=`/${database}`;
 execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',fileURLToPath(new URL('../../apps/api/prisma/schema.prisma',import.meta.url))],{env:{...process.env,DATABASE_URL:source.toString()},windowsHide:true,stdio:'pipe',timeout:30000});admin=new Client({datasourceUrl:source.toString()});const runtime=new URL(original.DATABASE_URL!);runtime.pathname=`/${database}`;process.env.DATABASE_URL=runtime.toString();process.env.NODE_ENV='test';process.env.MFA_CREDENTIAL_KEY=randomBytes(32).toString('base64');
 totp=require('../../apps/api/dist/security/mfa.js').generateTotpCode;
 const {createApp}=require('../../apps/api/dist/bootstrap.js') as typeof import('../../apps/api/src/bootstrap');app=await createApp();await app.init();
});
afterAll(async()=>{if(app)await app.close();if(admin)await admin.$disconnect();if(provisioner){if(created)await provisioner.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);await provisioner.$disconnect();}for(const key of keys){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}});
for(const namespace of ['work','platform'] as const){
 const type=namespace==='work'?'USER':'PLATFORM',email=`${namespace}-${suffix}@example.invalid`;
 let id:string,csrf:string,sessionCookie:string,oldCookie:string,setup:{secret:string;setupToken:string},recovery:string[],challenge:string;
 function call(method:'get'|'post'|'delete',path:string){return request(app.getHttpServer())[method](`/api/v1/${namespace}/${path}`).set('Origin',origin).set('Cookie',sessionCookie).set('X-CSRF-Token',csrf??'');}
 function login(){return request(app.getHttpServer()).post(`/api/v1/${namespace}/auth/login`).set('Origin',origin).send(namespace==='work'?{identifier:email,password}:{email,password});}
 async function refresh(headers?:Record<string,unknown>){if(headers)sessionCookie=cookie(headers);const me=await call('get','auth/me').expect(200);csrf=me.body.csrf;}
 describe(`${namespace} real MFA lifecycle`,()=>{
  it('starts from actual password login and rejects unconfirmed or forged enrollment',async()=>{
   const {hashPassword}=require('../../apps/api/dist/common/credentials.js') as typeof import('../../apps/api/src/common/credentials');const passwordHash=await hashPassword(password);
   id=namespace==='work'?(await admin.user.create({data:{email,displayName:'MFA fixture',passwordHash,emailVerifiedAt:new Date()}})).id:(await admin.platformAccount.create({data:{email,displayName:'MFA fixture',passwordHash,isOwner:true}})).id;
   const result=await login().expect(201);await refresh(result.headers);oldCookie=sessionCookie;
   await call('post','mfa/enroll/start').send({label:'Fixture'}).expect(400);
   await call('post','mfa/enroll/start').send({label:'Fixture',currentPassword:'wrong-password'}).expect(401);
   setup=(await call('post','mfa/enroll/start').send({label:'Fixture',currentPassword:password}).expect(201)).body;
   await call('post','mfa/enroll/complete').send({secret:setup.secret,code:totp(setup.secret)}).expect(400);
   expect(setup.setupToken).toMatch(/^[a-f0-9]{64}$/);
  });
  it('binds setup to its session, activates once, rotates sessions and issues strong backups',async()=>{
   const other=await login().expect(201),otherCookie=cookie(other.headers),me=await request(app.getHttpServer()).get(`/api/v1/${namespace}/auth/me`).set('Cookie',otherCookie).expect(200);
   await request(app.getHttpServer()).post(`/api/v1/${namespace}/mfa/enroll/complete`).set('Origin',origin).set('Cookie',otherCookie).set('X-CSRF-Token',me.body.csrf).send({setupToken:setup.setupToken,code:totp(setup.secret)}).expect(400);
   const enabled=await call('post','mfa/enroll/complete').send({setupToken:setup.setupToken,code:totp(setup.secret)}).expect(201);recovery=enabled.body.recoveryCodes;expect(recovery).toHaveLength(8);expect(recovery[0]).toHaveLength(35);expect(enabled.body.proof).toBeUndefined();await refresh(enabled.headers);
   for(const revoked of [oldCookie,otherCookie])await request(app.getHttpServer()).get(`/api/v1/${namespace}/auth/me`).set('Cookie',revoked).expect(401);
   expect((await call('get','mfa/status').expect(200)).body.mfaEnabled).toBe(true);
   await call('post','mfa/enroll/start').send({label:'Replace',currentPassword:password}).expect(409);
   const rows=await admin.mfaRecoveryCode.findMany({where:{accountType:type,accountId:id}});expect(rows.every(row=>!recovery.includes(row.codeHash))).toBe(true);
  });
  it('requires MFA after password login and rejects bad origins, wrong namespaces and reused TOTP',async()=>{
   const result=await login().expect(201);expect(result.headers['set-cookie']).toBeUndefined();expect(result.body.mfaRequired).toBe(true);challenge=result.body.challengeToken;
   const body={challengeToken:challenge,code:totp(setup.secret)};
   await request(app.getHttpServer()).post(`/api/v1/${namespace}/auth/mfa/verify`).set('Origin','https://untrusted.example').send(body).expect(403);
   await request(app.getHttpServer()).post(`/api/v1/${namespace==='work'?'platform':'work'}/auth/mfa/verify`).set('Origin',origin).send(body).expect(401);
   await call('post','auth/mfa/verify').send(body).expect(401);
   const signedIn=await call('post','auth/mfa/verify').send({...body,code:totp(setup.secret,Date.now()+30000)}).expect(201);await refresh(signedIn.headers);
   await call('post','auth/mfa/verify').send({...body,code:recovery[7]}).expect(401);
  });
  it('consumes recovery codes atomically across concurrent login challenges',async()=>{
   const a=(await login().expect(201)).body.challengeToken,b=(await login().expect(201)).body.challengeToken;
   const results=await Promise.all([a,b].map(challengeToken=>call('post','auth/mfa/verify').send({challengeToken,code:recovery[0]!.toLowerCase()})));
   expect(results.map(value=>value.status).sort()).toEqual([201,401]);expect(await admin.mfaRecoveryCode.count({where:{accountType:type,accountId:id,usedAt:{not:null}}})).toBe(1);
   const success=results.find(value=>value.status===201)!;await refresh(success.headers);
  });
  it('persists failed attempts, expires a challenge after five and invalidates it after credential changes',async()=>{
   // Fixture challenges exercise the same public verification path without bypassing primary sign-in limits.
   const {digest}=require('../../apps/api/dist/common/credentials.js') as typeof import('../../apps/api/src/common/credentials');const account=namespace==='work'?await admin.user.findUniqueOrThrow({where:{id}}):await admin.platformAccount.findUniqueOrThrow({where:{id}});
   const token=randomBytes(32).toString('hex');await admin.pendingMfaChallenge.create({data:{accountType:type,accountId:id,tokenHash:digest(token),primaryCredentialHash:digest(account.passwordHash),credentialVersion:account.mfaVersion,expiresAt:new Date(Date.now()+60000)}});
   for(let n=0;n<5;n++)await call('post','auth/mfa/verify').send({challengeToken:token,code:'INVALID-CODE'}).expect(401);
   expect((await admin.pendingMfaChallenge.findUniqueOrThrow({where:{tokenHash:digest(token)}})).attempts).toBe(5);
   await call('post','auth/mfa/verify').send({challengeToken:token,code:recovery[1]}).expect(401);
   const stale=randomBytes(32).toString('hex');await admin.pendingMfaChallenge.create({data:{accountType:type,accountId:id,tokenHash:digest(stale),primaryCredentialHash:digest('outdated-password-hash'),credentialVersion:account.mfaVersion,expiresAt:new Date(Date.now()+60000)}});
   await call('post','auth/mfa/verify').send({challengeToken:stale,code:recovery[1]}).expect(401);
  });
  it('requires password and a fresh factor to disable, revokes sessions and records events without secrets',async()=>{
   await call('delete','mfa').send({code:recovery[2]}).expect(400);
   const previous=sessionCookie,disabled=await call('delete','mfa').send({currentPassword:password,code:recovery[2]}).expect(200);await refresh(disabled.headers);
   await request(app.getHttpServer()).get(`/api/v1/${namespace}/auth/me`).set('Cookie',previous).expect(401);
   expect((await call('get','mfa/status').expect(200)).body.mfaEnabled).toBe(false);
   expect(await admin.mfaRecoveryCode.count({where:{accountType:type,accountId:id}})).toBe(0);
   const events=await admin.mfaSecurityEvent.findMany({where:{accountType:type,accountId:id}});expect(events.map(row=>row.action)).toContain('MFA_ENABLED');expect(events.map(row=>row.action)).toContain('MFA_DISABLED');expect(JSON.stringify(events)).not.toContain(setup.secret);
  });
  it('enforces durable account attempt limits across expired and reused challenges',async()=>{
   let limited=false;for(let n=0;n<25;n++){const result=await call('post','auth/mfa/verify').send({challengeToken:challenge,code:'INVALID-CODE'});if(result.status===429){limited=true;break;}expect(result.status).toBe(401);}expect(limited).toBe(true);
  });
 });
}

