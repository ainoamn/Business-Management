import {BadRequestException,ConflictException,ForbiddenException,Injectable,Logger,NotFoundException,UnauthorizedException,type OnApplicationBootstrap,type OnModuleDestroy} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {WorkQuery} from '@work/shared-schemas';
import {PrismaService} from '../database/prisma.service';
import {OrganizationService} from '../work/organization.service';
import type {WorkIdentity} from '../work/identity.service';
import {loadAccess,type WorkAccess} from '../work/access';
import {WorkflowResourcesService,type WorkflowResourceType} from '../work/workflow-resources.service';
import {validate} from '../common/validation';
import {NotificationChannelProviders,type PushSubscription} from './channel-providers';
import {openPushCredentials,pushCredentialFingerprint,sealPushCredentials} from './push-crypto';
import {resolvePushEndpoint,PushEndpointRejected} from './push-endpoint';
import {PushDeliveryFailure,validPushSubscription} from './web-push-adapter';
const subscriptionSchema=z.object({endpoint:z.string().url().max(1000),keys:z.object({p256dh:z.string().length(87),auth:z.string().length(22)}).strict()}).strict();
interface Claim{id:string;organization_id:string;membership_id:string;user_id:string;user_session_id:string;notification_id:string;subscription_id:string;subscription_revision:number;lease_token:string;credentials_enc:string;vapid_key_hash:string;locale:string;resource_type:string;resource_id:string}
const resources:Record<string,WorkflowResourceType|undefined>={tasks:'TASK',projects:'PROJECT',meetings:'MEETING',requests:'REQUEST',expenses:'EXPENSE',budgets:'BUDGET'};
@Injectable()
export class PushService implements OnApplicationBootstrap,OnModuleDestroy{
 private readonly logger=new Logger(PushService.name);private timer:ReturnType<typeof setInterval>|undefined;private pending:Promise<number>|undefined;private stopping=false;
 constructor(private readonly db:PrismaService,private readonly organizations:OrganizationService,private readonly records:WorkflowResourcesService,private readonly channels:NotificationChannelProviders){}
 onApplicationBootstrap(){if(this.channels.push.isEnabled()){this.timer=setInterval(()=>{void this.dispatch().catch(()=>this.logger.error('Push dispatch failed'));},5000);this.timer.unref();}}
 async onModuleDestroy(){this.stopping=true;if(this.timer)clearInterval(this.timer);await this.pending?.catch(()=>undefined);}
 config(user:WorkIdentity,org:string){return this.organizations.execute(user,org,async()=>({configured:this.channels.push.isEnabled(),publicKey:this.channels.push.getPublicKey()??null,applicationKeyHash:this.channels.push.getApplicationKeyHash()??null}));}
 devices(user:WorkIdentity,org:string,q:WorkQuery){return this.organizations.execute(user,org,async(tx,a)=>{const where={organizationId:org,membershipId:a.membershipId};const rows=await tx.pushSubscription.findMany({where,select:{id:true,userAgent:true,createdAt:true,updatedAt:true,userSessionId:true,userSession:{select:{expiresAt:true,revokedAt:true}},endpointHash:true,vapidKeyHash:true,disabledAt:true},orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(q.page-1)*q.pageSize,take:q.pageSize});return {items:rows.map(({userSessionId,userSession,...row})=>({...row,currentSession:userSessionId===user.sessionId,active:row.disabledAt===null&&!!userSession&&!userSession.revokedAt&&userSession.expiresAt>new Date()&&row.vapidKeyHash===this.channels.push.getApplicationKeyHash()})),total:await tx.pushSubscription.count({where})};});}
 async register(user:WorkIdentity,org:string,body:unknown,agent:string,requestId:string){
  await this.organizations.execute(user,org,async()=>undefined);
  const provider=this.channels.push,key=provider.getCredentialKey(),keyHash=provider.getApplicationKeyHash();if(!provider.isEnabled()||!key||!keyHash)throw new BadRequestException({code:'PUSH_NOT_CONFIGURED',message:'Browser push is not configured'});
  const input=validate(subscriptionSchema,body);let subscription:PushSubscription;try{subscription=validPushSubscription(input);}catch{throw new BadRequestException({code:'PUSH_SUBSCRIPTION_INVALID',message:'Invalid browser subscription'});}
  try{await resolvePushEndpoint(subscription.endpoint,Date.now()+3000);}catch{throw new BadRequestException({code:'PUSH_ENDPOINT_REJECTED',message:'Push endpoint is unavailable or disallowed'});}
  const hash=createHash('sha256').update(subscription.endpoint).digest('hex'),serialized=JSON.stringify(subscription),fingerprint=pushCredentialFingerprint(key,serialized+'\0'+user.sessionId+'\0'+keyHash);
  try{return await this.organizations.execute(user,org,async(tx,a)=>{
   const [session]=await tx.$queryRaw<Array<{member_id:string|null}>>`SELECT work_push_member(${user.sessionId}::uuid) AS member_id`;if(session?.member_id!==a.membershipId)throw new UnauthorizedException('Session expired');
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'push-user:'+user.id}))`;await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'push-endpoint:'+hash}))`;
   const current=await tx.pushSubscription.findFirst({where:{organizationId:org,membershipId:a.membershipId,endpointHash:hash}}),same=current?.disabledAt===null&&current.userSessionId===user.sessionId&&current.credentialFingerprint===fingerprint&&current.vapidKeyHash===keyHash,id=current?.id??randomUUID(),revision=current?same?current.revision:current.revision+1:1,enc=same&&current.credentialsEnc?current.credentialsEnc:sealPushCredentials(key,serialized,id,revision),preference=await tx.notificationPreference.findUnique({where:{organizationId_membershipId:{organizationId:org,membershipId:a.membershipId}}});
   await tx.$queryRaw`SELECT work_register_push_subscription(${id}::uuid,${user.sessionId}::uuid,${hash},${fingerprint},${enc},${keyHash},${revision}::int,${agent.slice(0,500)})`;
   if(!same||!preference?.pushEnabled)await this.organizations.audit(tx,user,org,requestId,'PUSH_DEVICE_ENABLED','push_device',id);return {id,revision};
  });}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2010'){if(error.meta?.code==='23514')throw new BadRequestException({code:'PUSH_DEVICE_LIMIT',message:'Revoke a device before adding more'});if(error.meta?.code==='40001')throw new ConflictException('Push device changed');if(error.meta?.code==='42501')throw new UnauthorizedException('Session expired');}throw error;}
 }
 revoke(user:WorkIdentity,org:string,id:string,requestId:string){return this.organizations.execute(user,org,async(tx,a)=>{
  const row=await tx.pushSubscription.findFirst({where:{organizationId:org,membershipId:a.membershipId,id},select:{disabledAt:true,credentialsEnc:true,keysJson:true,endpoint:true}});if(!row)throw new NotFoundException('Push device not found');
  const [result]=await tx.$queryRaw<Array<{ok:boolean}>>`SELECT work_revoke_push_subscription(${id}::uuid,${user.sessionId}::uuid) AS ok`;if(!result?.ok)throw new NotFoundException('Push device not found');if(!row.disabledAt||row.credentialsEnc||row.keysJson!=='{}'||!row.endpoint.startsWith('disabled:'))await this.organizations.audit(tx,user,org,requestId,'PUSH_DEVICE_REVOKED','push_device',id);return {ok:true};
 });}
 private canRead(tx:Prisma.TransactionClient,a:WorkAccess,type:string,id:string){const kind=resources[type];if(kind)return this.records.canRead(tx,a,kind,id);if(type==='support')return tx.supportCase.count({where:{organizationId:a.organizationId,id,creatorId:a.membershipId}}).then(count=>count>0);return Promise.resolve(false);}
 async claimDisplay(user:WorkIdentity,org:string,id:string){return this.organizations.execute(user,org,async(tx,a)=>{if(!this.channels.push.isEnabled())return {show:false};
  const delivery=await tx.pushDelivery.findFirst({where:{organizationId:org,membershipId:a.membershipId,id,userSessionId:user.sessionId},select:{notification:{select:{resourceType:true,resourceId:true}},subscription:{select:{vapidKeyHash:true}}}});
  if(!delivery||delivery.subscription.vapidKeyHash!==this.channels.push.getApplicationKeyHash())return {show:false};const note=delivery.notification;
  try{if(!await this.canRead(tx,a,note.resourceType,note.resourceId))return {show:false};}catch(error){if(error instanceof ForbiddenException||error instanceof NotFoundException)return {show:false};throw error;}
  const [claimed]=await tx.$queryRaw<Array<{show:boolean}>>`SELECT work_claim_push_display(${id}::uuid,${user.sessionId}::uuid) AS show`;if(!claimed?.show)return {show:false};const organization=await tx.organization.findUniqueOrThrow({where:{id:org},select:{locale:true}}),arabic=organization.locale==='ar',href='/app/'+note.resourceType+'/'+note.resourceId+'?organizationId='+org;
  return {show:true,title:arabic?'تحديث في مساحة العمل':'Workspace update',body:arabic?'لديك تحديث جديد. افتح المنصة لمراجعته.':'You have a new update. Open your workspace to review it.',href,tag:'work-push:'+id,deliveryId:id,organizationId:org,recipientUserId:user.id,recipientSessionId:user.sessionId};
 });}
 dispatch(){if(this.pending||this.stopping||!this.channels.push.isEnabled())return Promise.resolve(0);const run=this.run().finally(()=>{if(this.pending===run)this.pending=undefined;});this.pending=run;return run;}
 private async run(){let count=0;for(let batch=0;batch<5&&!this.stopping;batch++){const rows=await this.db.$queryRaw<Claim[]>`SELECT * FROM work_claim_push_deliveries(2)`;if(!rows.length)break;count+=rows.length;await Promise.all(rows.map(row=>this.process(row).catch(()=>this.logger.error('Push delivery settlement failed'))));}return count;}
 private async finish(job:Claim,outcome:string,code:string|null,status:number|null=null,delay=60){await this.db.$queryRaw`SELECT work_finish_push_delivery(${job.id}::uuid,${job.lease_token}::uuid,${outcome},${status}::int,${delay}::int,${code})`;}
 private async process(job:Claim){
  try{
   const provider=this.channels.push,key=provider.getCredentialKey();if(!provider.isEnabled()||!key){await this.finish(job,'RETRY','PUSH_NOT_CONFIGURED');return;}if(job.vapid_key_hash!==provider.getApplicationKeyHash()){await this.finish(job,'CANCELLED','PUSH_SIGNING_KEY_CHANGED');return;}
   let allowed=false;try{allowed=await this.db.withOrganization(job.user_id,job.organization_id,async tx=>this.canRead(tx,await loadAccess(tx,job.user_id,job.organization_id),job.resource_type,job.resource_id));}catch(error){if(!(error instanceof ForbiddenException)&&!(error instanceof NotFoundException))throw error;}if(!allowed){await this.finish(job,'CANCELLED','PUSH_ACCESS_REVOKED');return;}
   const [ready]=await this.db.$queryRaw<Array<{ready:boolean}>>`SELECT work_confirm_push_delivery(${job.id}::uuid,${job.lease_token}::uuid) AS ready`;if(!ready?.ready)return;
   let subscription:PushSubscription;try{subscription=validPushSubscription(validate(subscriptionSchema,JSON.parse(openPushCredentials(key,job.credentials_enc,job.subscription_id,job.subscription_revision))));}catch{await this.finish(job,'EXPIRED','PUSH_CREDENTIAL_INVALID');return;}
   const response=await provider.send(subscription,{title:'Workspace update',body:'Open your workspace to review a new update.',data:{deliveryId:job.id,organizationId:job.organization_id,recipientUserId:job.user_id,recipientSessionId:job.user_session_id}});if(!Number.isInteger(response.statusCode)||response.statusCode<200||response.statusCode>=300)throw new PushDeliveryFailure('PUSH_PROVIDER_ERROR',true);
   await this.finish(job,'ACCEPTED',null,response.statusCode);
  }catch(error){if(error instanceof PushDeliveryFailure)await this.finish(job,error.code==='PUSH_SUBSCRIPTION_EXPIRED'?'EXPIRED':error.retryable?'RETRY':'FAILED',error.code,error.statusCode,error.retryAfterSeconds??60);else if(error instanceof PushEndpointRejected)await this.finish(job,'EXPIRED','PUSH_ENDPOINT_REJECTED');else await this.finish(job,'RETRY','PUSH_DELIVERY_UNCERTAIN');}
 }
}
