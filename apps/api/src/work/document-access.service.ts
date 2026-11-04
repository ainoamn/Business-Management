import {Injectable,NotFoundException} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import type {WorkPermission} from '@work/shared-schemas';
import {ExecutionService} from './execution.service';
import {MeetingService} from './meeting.service';
import {RequestService} from './request.service';
import {FinanceService} from './finance.service';
import {hasPermission,requirePermission,type WorkAccess} from './access';

@Injectable()
export class DocumentAccessService{
 constructor(private readonly execution:ExecutionService,private readonly meetings:MeetingService,private readonly requests:RequestService,private readonly finance:FinanceService){}
 private scope(access:WorkAccess,permission:WorkPermission){return access.grants.filter(g=>g.permission===permission);}
 global(access:WorkAccess,permission:WorkPermission){return this.scope(access,permission).some(g=>g.scope==='ORGANIZATION');}
 folderFilter(access:WorkAccess,permission:WorkPermission='documents.read'):Prisma.DocumentFolderWhereInput{
  requirePermission(access,permission);if(this.global(access,permission))return {};
  const read=permission==='documents.read';const acl:Prisma.DocumentFolderWhereInput={OR:[{ownerId:access.membershipId},{shares:{some:{membershipId:access.membershipId,...(read?{}:{permission:'WRITE'})}}},...(read?[{visibility:'ORGANIZATION'}]:[])]};
  const OR:Prisma.DocumentFolderWhereInput[]=(read||permission==='documents.upload')?[{ancestors:{some:{ancestor:acl}}}]:[{ownerId:access.membershipId}];
  for(const grant of this.scope(access,permission)){if(grant.scope==='DEPARTMENT')OR.push({departmentId:grant.scopeId});if(grant.scope==='TEAM')OR.push({teamId:grant.scopeId});if(grant.scope==='PROJECT')OR.push({projectId:grant.scopeId});if(grant.scope==='BRANCH')OR.push({department:{branchId:grant.scopeId}});}
  return {OR};
 }
 async linkedFilter(tx:Prisma.TransactionClient,access:WorkAccess):Promise<Prisma.DocumentLinkWhereInput>{
  const OR:Prisma.DocumentLinkWhereInput[]=[];
  if(hasPermission(access,'projects.read'))OR.push({project:{AND:[{archivedAt:null},await this.execution.projectFilter(tx,access,'projects.read')]}});
  if(hasPermission(access,'tasks.read'))OR.push({task:{AND:[{archivedAt:null},await this.execution.taskFilter(tx,access,'tasks.read')]}});
  if(hasPermission(access,'meetings.read'))OR.push({meeting:{AND:[{archivedAt:null},this.meetings.filter(access,'meetings.read')]}});
  if(hasPermission(access,'requests.read'))OR.push({request:this.requests.filter(access,'requests.read')});
  if(hasPermission(access,'expenses.read'))OR.push({expense:this.finance.expenseFilter(access,'expenses.read')});
  return {OR};
 }
 async filter(tx:Prisma.TransactionClient,access:WorkAccess,permission:WorkPermission='documents.read'):Promise<Prisma.WorkDocumentWhereInput>{
  requirePermission(access,permission);if(this.global(access,permission))return {};
  const read=permission==='documents.read',comment=permission==='documents.comment',write=permission==='documents.upload';
  const OR:Prisma.WorkDocumentWhereInput[]=[{ownerId:access.membershipId}];
  if(read||comment||write){OR.push({shares:{some:{membershipId:access.membershipId,...(read?{}:{permission:{in:comment?['COMMENT','WRITE']:['WRITE']}})}}});OR.push({visibility:'FOLDER',folder:{AND:[{archivedAt:null},this.folderFilter(access,permission)]}});}
  if(read){OR.push({visibility:'ORGANIZATION'},{visibility:'LINKED',links:{some:await this.linkedFilter(tx,access)}});}
  for(const grant of this.scope(access,permission)){if(grant.scope==='DEPARTMENT')OR.push({departmentId:grant.scopeId});if(grant.scope==='TEAM')OR.push({teamId:grant.scopeId});if(grant.scope==='PROJECT')OR.push({projectId:grant.scopeId});if(grant.scope==='BRANCH')OR.push({department:{branchId:grant.scopeId}});}
  return {OR};
 }
 async folder(tx:Prisma.TransactionClient,access:WorkAccess,id:string,permission:WorkPermission='documents.read',archived=false){const folder=await tx.documentFolder.findFirst({where:{AND:[{organizationId:access.organizationId,id,...(archived?{}:{archivedAt:null})},this.folderFilter(access,permission)]}});if(!folder)throw new NotFoundException('Folder not found');return folder;}
 async document(tx:Prisma.TransactionClient,access:WorkAccess,id:string,permission:WorkPermission='documents.read',archived=false){const document=await tx.workDocument.findFirst({where:{AND:[{organizationId:access.organizationId,id,status:'ACTIVE',...(archived?{}:{archivedAt:null})},await this.filter(tx,access,permission)]}});if(!document)throw new NotFoundException('Document not found');return document;}
 async context(tx:Prisma.TransactionClient,access:WorkAccess,input:{projectId:string|null;departmentId:string|null;teamId:string|null}){if(input.projectId)await this.execution.project(tx,access,input.projectId);if(input.departmentId&&!await tx.department.findFirst({where:{id:input.departmentId,organizationId:access.organizationId,archivedAt:null}}))throw new NotFoundException('Department not found');if(input.teamId&&!await tx.team.findFirst({where:{id:input.teamId,organizationId:access.organizationId,archivedAt:null,...(input.departmentId?{departmentId:input.departmentId}:{})}}))throw new NotFoundException('Team not found');}
 async link(tx:Prisma.TransactionClient,access:WorkAccess,resource:string,id:string){const fields={projects:'projectId',tasks:'taskId',meetings:'meetingId',requests:'requestId',expenses:'expenseId'} as const;const field=fields[resource as keyof typeof fields];if(!field)throw new NotFoundException('Resource not found');const input={[field]:id};const filter=await this.linkedFilter(tx,access);const where=filter.OR??[];let exists=false;if(field==='projectId')exists=!!await tx.project.findFirst({where:{AND:[{organizationId:access.organizationId,id,archivedAt:null},await this.execution.projectFilter(tx,access,'projects.read')]}});if(field==='taskId')exists=!!await tx.task.findFirst({where:{AND:[{organizationId:access.organizationId,id,archivedAt:null},await this.execution.taskFilter(tx,access,'tasks.read')]}});if(field==='meetingId'&&hasPermission(access,'meetings.read'))exists=!!await tx.meeting.findFirst({where:{AND:[{organizationId:access.organizationId,id,archivedAt:null},this.meetings.filter(access,'meetings.read')]}});if(field==='requestId'&&hasPermission(access,'requests.read'))exists=!!await tx.internalRequest.findFirst({where:{AND:[{organizationId:access.organizationId,id},this.requests.filter(access,'requests.read')]}});if(field==='expenseId'&&hasPermission(access,'expenses.read'))exists=!!await tx.operationalExpense.findFirst({where:{AND:[{organizationId:access.organizationId,id},this.finance.expenseFilter(access,'expenses.read')]}});if(!exists||!where.length)throw new NotFoundException('Linked resource not found');return input;}
}
