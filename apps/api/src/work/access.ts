import {ForbiddenException,NotFoundException} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import {workPermissions,type WorkPermission,type WorkScope} from '@work/shared-schemas';
export interface WorkGrant {permission:WorkPermission;scope:WorkScope;scopeId:string|null}
export interface WorkAccess {membershipId:string;userId:string;organizationId:string;role:string;branchId:string|null;departmentId:string|null;grants:WorkGrant[]}
const common:WorkPermission[]=['organization.read','members.read','structure.read','notifications.read'];
const employee:WorkPermission[]=['workload.read','projects.read','tasks.read','tasks.create','tasks.edit','tasks.comment','tasks.review','tasks.approve','documents.read','documents.upload','documents.delete','documents.share','documents.comment','time.read','time.create','meetings.read','meetings.approve','requests.read','requests.create','requests.approve','expenses.read','expenses.create','ai.use','ai.read'];
const management:WorkPermission[]=['workload.read','projects.read','projects.create','projects.edit','projects.delete','projects.manage','tasks.read','tasks.create','tasks.edit','tasks.delete','tasks.assign','tasks.review','tasks.approve','tasks.close','tasks.comment','documents.read','documents.upload','documents.delete','documents.share','documents.comment','meetings.read','meetings.manage','meetings.approve','time.read','time.create','time.manage','reports.read','reports.export','requests.read','requests.create','requests.approve','requests.manage','workflows.read','workflows.manage','ai.use','ai.read'];
export async function loadAccess(tx:Prisma.TransactionClient,userId:string,organizationId:string):Promise<WorkAccess>{
  const member=await tx.membership.findUnique({where:{organizationId_userId:{organizationId,userId}},include:{roles:{include:{role:{include:{permissions:true}}}}}});
  if(!member?.active)throw new ForbiddenException('Organization access denied');
  const grants:WorkGrant[]=[];const add=(permissions:readonly WorkPermission[],scope:WorkScope='ORGANIZATION',scopeId:string|null=null)=>{for(const permission of permissions)grants.push({permission,scope,scopeId});};
  const role=member.role;
  if(role==='ORGANIZATION_OWNER')add(workPermissions);
  else if(role==='ORGANIZATION_ADMIN')add(workPermissions.filter(permission=>!['roles.manage','organization.manage','billing.manage'].includes(permission)));
  else if(role==='GENERAL_MANAGER'){add(common);add(management);add(['portfolios.read','portfolios.manage','members.manage','structure.manage','budgets.read','expenses.read']);}
  else if(role==='DEPARTMENT_MANAGER'){add(common);add(employee,'OWN');add([...management,'structure.manage'],member.departmentId?'DEPARTMENT':'OWN',member.departmentId);}
  else if(role==='PROJECT_MANAGER'){add(common);add([...management,'budgets.read','budgets.manage'],'OWN');}
  else if(role==='TEAM_LEADER'){add(common);add(employee,'OWN');const teams=await tx.team.findMany({where:{organizationId,leaderId:member.id,archivedAt:null},select:{id:true}});for(const team of teams)add([...management,'structure.manage'],'TEAM',team.id);}
  else if(role==='ACCOUNTANT'){add(common);add(['projects.read','budgets.read','budgets.manage','expenses.read','expenses.create','expenses.approve','billing.read','reports.read','reports.export']);add(employee,'OWN');}
  else if(role==='AUDITOR'){add([...workPermissions.filter(permission=>permission.endsWith('.read')),'reports.export']);}
  else if(role==='EMPLOYEE'){add(common);add(employee,'OWN');}
  else if(role==='GUEST'){add(['organization.read','notifications.read']);add(['projects.read','tasks.read','documents.read','requests.read','meetings.read'],'OWN');}
  else {add(['organization.read','notifications.read']);add(['projects.read','tasks.read','tasks.comment','documents.read','requests.read','requests.create','meetings.read'],'OWN');}
  for(const assignment of member.roles)for(const permission of assignment.role.permissions)if(workPermissions.includes(permission.permission as WorkPermission))grants.push({permission:permission.permission as WorkPermission,scope:assignment.scope as WorkScope,scopeId:assignment.scopeId});
  return {membershipId:member.id,userId,organizationId,role,branchId:member.branchId,departmentId:member.departmentId,grants};
}
export function hasPermission(access:WorkAccess,permission:WorkPermission){return access.grants.some(grant=>grant.permission===permission);}
export function requireGlobal(access:WorkAccess,permission:WorkPermission){if(!access.grants.some(grant=>grant.permission===permission&&grant.scope==='ORGANIZATION'))throw new ForbiddenException('Permission denied');}
export function requireOwner(access:WorkAccess){if(access.role!=='ORGANIZATION_OWNER')throw new ForbiddenException('Organization owner required');}
export function requirePermission(access:WorkAccess,permission:WorkPermission){if(!hasPermission(access,permission))throw new ForbiddenException('Permission denied');}
export function scopedStructure(access:WorkAccess,permission:WorkPermission,target:{id?:string;departmentId?:string|null;branchId?:string|null;teamId?:string|null}){
  const allowed=access.grants.some(grant=>grant.permission===permission&&(grant.scope==='ORGANIZATION'||grant.scope==='DEPARTMENT'&&grant.scopeId===target.departmentId||grant.scope==='BRANCH'&&grant.scopeId===target.branchId||grant.scope==='TEAM'&&grant.scopeId===target.teamId));
  if(!allowed)throw new ForbiddenException('Outside permission scope');
}
export async function relatedMember(tx:Prisma.TransactionClient,organizationId:string,id:string|null|undefined){if(!id)return;const member=await tx.membership.findFirst({where:{id,organizationId,active:true,user:{disabledAt:null,deletedAt:null}},select:{id:true}});if(!member)throw new NotFoundException('Member not found');}
