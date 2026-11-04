import {requirePlatformFlag} from '../platform/feature-policy';
import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {capacitySchema,capacityUpdateSchema,versionSchema,type WorkQuery,type WorkloadQuery} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {BillingEntitlementsService} from '../billing/billing-entitlements.service';
import {OrganizationService} from './organization.service';
import {ExecutionService} from './execution.service';
import {TimeService} from './time.service';
import {hasPermission,relatedMember,requireGlobal,requirePermission,type WorkAccess} from './access';
import type {WorkIdentity} from './identity.service';
import {capacityMinutes,currentWorkWeek} from './work-capacity';
type Tx=Prisma.TransactionClient;
@Injectable()
export class WorkloadService {
 constructor(private readonly organizations:OrganizationService,private readonly execution:ExecutionService,private readonly time:TimeService,private readonly entitlements:BillingEntitlementsService){}
 private async scope(tx:Tx,a:WorkAccess):Promise<Prisma.MembershipWhereInput>{
  requirePermission(a,'workload.read');const OR:Prisma.MembershipWhereInput[]=[];
  for(const grant of a.grants.filter(item=>item.permission==='workload.read')){
   if(grant.scope==='ORGANIZATION')return {};
   if(grant.scope==='OWN'){OR.push({id:a.membershipId});if(a.role==='PROJECT_MANAGER'){const projects=await tx.project.findMany({where:{organizationId:a.organizationId,managerId:a.membershipId,archivedAt:null},select:{id:true}}),projectIds=projects.map(project=>project.id),members=await tx.projectMember.findMany({where:{organizationId:a.organizationId,projectId:{in:projectIds}},select:{membershipId:true}}),assigned=await tx.task.findMany({where:{organizationId:a.organizationId,projectId:{in:projectIds},archivedAt:null,assignedToId:{not:null}},distinct:['assignedToId'],select:{assignedToId:true}});OR.push({id:{in:[...members.map(row=>row.membershipId),...assigned.flatMap(row=>row.assignedToId?[row.assignedToId]:[])]}});}}
   else if(grant.scope==='DEPARTMENT'&&grant.scopeId)OR.push({departmentId:grant.scopeId});
   else if(grant.scope==='BRANCH'&&grant.scopeId)OR.push({branchId:grant.scopeId});
   else if(grant.scope==='TEAM'&&grant.scopeId)OR.push({teams:{some:{teamId:grant.scopeId,team:{archivedAt:null}}}});
   else if(grant.scope==='PROJECT'&&grant.scopeId){const project=await tx.project.findFirst({where:{organizationId:a.organizationId,id:grant.scopeId,archivedAt:null},select:{managerId:true}});if(project){const members=await tx.projectMember.findMany({where:{organizationId:a.organizationId,projectId:grant.scopeId},select:{membershipId:true}});OR.push({id:{in:[project.managerId,...members.map(row=>row.membershipId)]}});}}
  }
  return {OR:OR.length?OR:[{id:'00000000-0000-0000-0000-000000000000'}]};
 }
 async list(user:WorkIdentity,org:string,q:WorkloadQuery){return this.organizations.execute(user,org,async(tx,a)=>{
  requirePermission(a,'workload.read');await requirePlatformFlag(tx,'WORKLOAD');await this.entitlements.require(tx,org,'ADVANCED_REPORTS');const organization=await tx.organization.findUniqueOrThrow({where:{id:org},include:{settings:true}}),workDays=organization.settings?.workDays??[0,1,2,3,4],dayStart=organization.settings?.dayStart??'08:00',dayEnd=organization.settings?.dayEnd??'17:00',window=q.from&&q.to?{from:q.from,to:q.to}:currentWorkWeek(organization.timezone,workDays);
  const where:Prisma.MembershipWhereInput={AND:[{organizationId:org,active:true,user:{disabledAt:null,deletedAt:null,displayName:{contains:q.search.replace(/[\\%_]/g,value=>'\\'+value),mode:'insensitive'}},...(q.departmentId?{departmentId:q.departmentId}:{}),...(q.teamId?{teams:{some:{teamId:q.teamId}}}:{}),...(q.membershipId?{id:q.membershipId}:{})},await this.scope(tx,a)]};
  const people=await tx.membership.findMany({where,orderBy:[{user:{displayName:'asc'}},{id:'asc'}],skip:(q.page-1)*q.pageSize,take:q.pageSize,select:{id:true,jobTitle:true,departmentId:true,user:{select:{displayName:true}}}}),ids=people.map(person=>person.id),bounds=(await tx.$queryRaw<Array<{starts:Date;ends:Date}>>`SELECT (${window.from}::date::timestamp AT TIME ZONE ${organization.timezone}) AS starts,((${window.to}::date+1)::timestamp AT TIME ZONE ${organization.timezone}) AS ends`)[0]!;
  const holidays=(await tx.organizationHoliday.findMany({where:{organizationId:org,archivedAt:null,startsOn:{lte:new Date(window.to)},endsOn:{gte:new Date(window.from)}},select:{startsOn:true,endsOn:true}})).map(row=>({from:row.startsOn.toISOString().slice(0,10),to:row.endsOn.toISOString().slice(0,10)}));
  const overrides=await tx.membershipCapacity.findMany({where:{organizationId:org,membershipId:{in:ids},archivedAt:null,startsOn:{lte:new Date(window.to)},endsOn:{gte:new Date(window.from)}}}),canTasks=hasPermission(a,'tasks.read'),canTime=hasPermission(a,'time.read'),now=new Date();
  const facts=new Map(ids.map(id=>[id,{open:0,overdue:0,remaining:new Prisma.Decimal(0),seconds:0,undated:0}]));
  if(canTasks&&ids.length){
   const closed=(await tx.taskStatus.findMany({where:{organizationId:org,category:{in:['DONE','CANCELLED']}},select:{key:true}})).map(status=>status.key),tasks:Prisma.TaskWhereInput={AND:[{organizationId:org,assignedToId:{in:ids},archivedAt:null,completedAt:null,status:{notIn:closed}},await this.execution.taskFilter(tx,a,'tasks.read')]};
   if(await tx.task.count({where:tasks})>50000)throw new BadRequestException({code:'WORKLOAD_TOO_LARGE',message:'Choose fewer members to calculate this workload'});
   let cursor:string|undefined;for(;;){const batch=await tx.task.findMany({where:{AND:[tasks,...cursor?[{id:{gt:cursor}}]:[]]},orderBy:{id:'asc'},take:1000,select:{id:true,assignedToId:true,estimatedHours:true,progress:true,startDate:true,dueDate:true}});if(!batch.length)break;
    for(const task of batch){const value=facts.get(task.assignedToId!)!;value.open++;if(task.dueDate&&task.dueDate<now)value.overdue++;if(!task.dueDate)value.undated++;if((!task.dueDate||task.dueDate<bounds.ends)&&(!task.startDate||task.startDate<bounds.ends))value.remaining=value.remaining.add(task.estimatedHours.mul(100-task.progress).div(100));}cursor=batch.at(-1)!.id;
   }
  }
  if(canTime&&ids.length){
   const entries:Prisma.TimeEntryWhereInput={AND:[{organizationId:org,membershipId:{in:ids},startedAt:{lt:bounds.ends},endedAt:{gt:bounds.starts}},await this.time.scope(tx,a,'time.read')]};if(await tx.timeEntry.count({where:entries})>50000)throw new BadRequestException({code:'WORKLOAD_TOO_LARGE',message:'Choose fewer members or a shorter period'});
   let cursor:string|undefined;for(;;){const batch=await tx.timeEntry.findMany({where:{AND:[entries,...cursor?[{id:{gt:cursor}}]:[]]},orderBy:{id:'asc'},take:1000,select:{id:true,membershipId:true,startedAt:true,endedAt:true}});if(!batch.length)break;for(const entry of batch)facts.get(entry.membershipId)!.seconds+=Math.max(0,Math.floor((Math.min(entry.endedAt.getTime(),bounds.ends.getTime())-Math.max(entry.startedAt.getTime(),bounds.starts.getTime()))/1000));cursor=batch.at(-1)!.id;}
  }
  const globalTasks=a.grants.some(grant=>grant.permission==='tasks.read'&&grant.scope==='ORGANIZATION'),ownTasks=a.grants.some(grant=>grant.permission==='tasks.read'&&grant.scope==='OWN'),items=people.map(person=>{
   const capacity=capacityMinutes(window.from,window.to,workDays,dayStart,dayEnd,overrides.filter(item=>item.membershipId===person.id).map(item=>({from:item.startsOn.toISOString().slice(0,10),to:item.endsOn.toISOString().slice(0,10),minutesPerDay:item.minutesPerDay})),holidays),value=facts.get(person.id)!,complete=globalTasks||person.id===a.membershipId&&ownTasks,nominal=new Prisma.Decimal(capacity.minutes).div(60),balance=nominal.sub(value.remaining);
   return {id:person.id,name:person.user.displayName,jobTitle:person.jobTitle,departmentId:person.departmentId,openTasks:canTasks?value.open:null,overdueTasks:canTasks?value.overdue:null,undatedTasks:canTasks?value.undated:null,remainingHours:canTasks?value.remaining.toFixed(3):null,loggedHours:canTime?new Prisma.Decimal(value.seconds).div(3600).toFixed(3):null,capacityHours:nominal.toFixed(3),availableHours:complete?balance.toFixed(3):null,overloadHours:complete?Prisma.Decimal.max(0,balance.neg()).toFixed(3):null,completeTaskVisibility:complete,workDays:capacity.workDays};
  });
  return {items,total:await tx.membership.count({where}),window,holidays,timezone:organization.timezone,dayStart,dayEnd,workDays,canManageCapacity:a.grants.some(grant=>grant.permission==='members.manage'&&grant.scope==='ORGANIZATION')};
 },{timeout:30000});}
 async capacities(user:WorkIdentity,org:string,membershipId:string,q:WorkQuery){return this.organizations.execute(user,org,async(tx,a)=>{requireGlobal(a,'members.manage');if(!await tx.membership.findFirst({where:{organizationId:org,id:membershipId}}))throw new NotFoundException('Member unavailable');const rows=await tx.membershipCapacity.findMany({where:{organizationId:org,membershipId},orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(q.page-1)*q.pageSize,take:q.pageSize});return {items:rows.map(row=>({...row,from:row.startsOn.toISOString().slice(0,10),to:row.endsOn.toISOString().slice(0,10)})),total:await tx.membershipCapacity.count({where:{organizationId:org,membershipId}})};});}
 async saveCapacity(user:WorkIdentity,org:string,id:string|undefined,body:unknown,requestId:string){return this.organizations.execute(user,org,async(tx,a)=>{
  requireGlobal(a,'members.manage');await requirePlatformFlag(tx,'WORKLOAD');await this.entitlements.require(tx,org,'ADVANCED_REPORTS');const parsed=id?validate(capacityUpdateSchema,body):validate(capacitySchema,body),{version,...data}={...parsed,version:'version' in parsed?parsed.version:undefined};await relatedMember(tx,org,data.membershipId);await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'CAPACITY:'+org+':'+data.membershipId}))`;
  if(id){const current=await tx.membershipCapacity.findFirst({where:{organizationId:org,id,archivedAt:null}});if(!current)throw new NotFoundException('Capacity adjustment unavailable');if(current.membershipId!==data.membershipId||current.version!==version)throw new ConflictException('Capacity adjustment changed');}
  const startsOn=new Date(data.from),endsOn=new Date(data.to);if(await tx.membershipCapacity.count({where:{organizationId:org,membershipId:data.membershipId,archivedAt:null,...id?{id:{not:id}}:{},startsOn:{lte:endsOn},endsOn:{gte:startsOn}}}))throw new ConflictException('Capacity periods must not overlap');
  const values={startsOn,endsOn,minutesPerDay:data.minutesPerDay,reason:data.reason};const saved=id?await tx.membershipCapacity.update({where:{organizationId_id:{organizationId:org,id}},data:{...values,version:{increment:1}}}):await tx.membershipCapacity.create({data:{...values,organizationId:org,membershipId:data.membershipId,createdById:a.membershipId}});await this.organizations.audit(tx,user,org,requestId,'MEMBER_CAPACITY_UPDATED','member_capacity',saved.id);return {id:saved.id,version:saved.version};
 });}
 async archiveCapacity(user:WorkIdentity,org:string,id:string,body:unknown,requestId:string){return this.organizations.execute(user,org,async(tx,a)=>{requireGlobal(a,'members.manage');const data=validate(versionSchema,body),row=await tx.membershipCapacity.findFirst({where:{organizationId:org,id,archivedAt:null}});if(!row)throw new NotFoundException('Capacity adjustment unavailable');await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'CAPACITY:'+org+':'+row.membershipId}))`;const changed=await tx.membershipCapacity.updateMany({where:{organizationId:org,id,version:data.version,archivedAt:null},data:{archivedAt:new Date(),version:{increment:1}}});if(!changed.count)throw new ConflictException('Capacity adjustment changed');await this.organizations.audit(tx,user,org,requestId,'MEMBER_CAPACITY_ARCHIVED','member_capacity',id);return {ok:true};});}
}
