import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {portfolioLinkSchema,portfolioSchema,portfolioUpdateSchema,versionSchema,type PortfolioQuery} from '@work/shared-schemas';
import {BillingEntitlementsService} from '../billing/billing-entitlements.service';
import {validate} from '../common/validation';
import {OrganizationService} from './organization.service';
import {ExecutionService} from './execution.service';
import {relatedMember,requirePermission,type WorkAccess} from './access';
import type {WorkIdentity} from './identity.service';
type Tx=Prisma.TransactionClient;
@Injectable()
export class PortfolioService {
 constructor(private readonly organizations:OrganizationService,private readonly execution:ExecutionService,private readonly entitlements:BillingEntitlementsService){}
 filter(a:WorkAccess,permission:'portfolios.read'|'portfolios.manage'):Prisma.ProjectPortfolioWhereInput {
  requirePermission(a,permission);const grants=a.grants.filter(grant=>grant.permission===permission);
  return grants.some(grant=>grant.scope==='ORGANIZATION')?{}:grants.some(grant=>grant.scope==='OWN')?{ownerId:a.membershipId}:{id:'00000000-0000-0000-0000-000000000000'};
 }
 private async row(tx:Tx,a:WorkAccess,id:string,permission:'portfolios.read'|'portfolios.manage'='portfolios.read',archived=false){
  const row=await tx.projectPortfolio.findFirst({where:{AND:[{organizationId:a.organizationId,id,...archived?{}:{archivedAt:null}},this.filter(a,permission)]},include:{owner:{select:{user:{select:{displayName:true}}}}}});
  if(!row)throw new NotFoundException('Portfolio unavailable');return {...row,ownerName:row.owner.user.displayName};
 }
 private lock(tx:Tx,org:string,id:string){return tx.$queryRaw`SELECT id FROM project_portfolios WHERE organization_id=${org}::uuid AND id=${id}::uuid FOR UPDATE`;}
 async list(user:WorkIdentity,org:string,q:PortfolioQuery){return this.organizations.execute(user,org,async(tx,a)=>{
  const where={AND:[{organizationId:org,archivedAt:q.archived?{not:null}:null,name:{contains:q.search,mode:'insensitive' as const}},this.filter(a,'portfolios.read')]},projectFilter=await this.execution.projectFilter(tx,a,'projects.read');
  const rows=await tx.projectPortfolio.findMany({where,orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(q.page-1)*q.pageSize,take:q.pageSize,include:{owner:{select:{user:{select:{displayName:true}}}},_count:{select:{projects:{where:{project:{AND:[{archivedAt:null},projectFilter]}}}}}}});
  return {items:rows.map(({owner,_count,...row})=>({...row,ownerName:owner.user.displayName,visibleProjects:_count.projects})),total:await tx.projectPortfolio.count({where})};
 });}
 async detail(user:WorkIdentity,org:string,id:string){return this.organizations.execute(user,org,async(tx,a)=>{
  const row=await this.row(tx,a,id,'portfolios.read',true),projects=await tx.project.findMany({where:{AND:[{organizationId:org,archivedAt:null,portfolios:{some:{portfolioId:id}}},await this.execution.projectFilter(tx,a,'projects.read')]},orderBy:{name:'asc'},take:500});
  const ids=projects.map(project=>project.id),canceled=(await tx.taskStatus.findMany({where:{organizationId:org,category:'CANCELLED'},select:{key:true}})).map(status=>status.key),taskWhere:Prisma.TaskWhereInput={AND:[{organizationId:org,projectId:{in:ids},archivedAt:null,status:{notIn:canceled}},await this.execution.taskFilter(tx,a,'tasks.read')]},tasks=await tx.task.groupBy({by:['projectId'],where:taskWhere,_count:{_all:true,completedAt:true}}),assignees=await tx.task.findMany({where:taskWhere,distinct:['assignedToId'],select:{assignedToId:true}});
  const financial=projects.filter(project=>this.execution.projectFinance(a,'budgets.read',project)),financialIds=financial.map(project=>project.id),costs=await tx.operationalExpense.groupBy({by:['projectId'],where:{organizationId:org,projectId:{in:financialIds},status:'APPROVED'},_sum:{baseAmount:true}}),members=await tx.projectMember.findMany({where:{organizationId:org,projectId:{in:ids}},select:{membershipId:true}});
  const totalTasks=tasks.reduce((sum,item)=>sum+item._count._all,0),completedTasks=tasks.reduce((sum,item)=>sum+item._count.completedAt,0);
  const amount=financial.reduce((sum,project)=>sum.add(project.budget),new Prisma.Decimal(0)),cost=costs.reduce((sum,item)=>sum.add(item._sum.baseAmount??0),new Prisma.Decimal(0)),fullFinance=financial.length===projects.length;
  const resources=new Set([...projects.map(project=>project.managerId),...assignees.flatMap(task=>task.assignedToId?[task.assignedToId]:[]),...members.map(member=>member.membershipId)]);
  const resourceCount=await tx.membership.count({where:{organizationId:org,active:true,id:{in:[...resources]}}});
  return {...row,summary:{visibleProjects:projects.length,visibleTasks:totalTasks,completedTasks:completedTasks,progress:totalTasks?Math.round(100*completedTasks/totalTasks):0,overdueProjects:projects.filter(project=>project.endDate&&project.endDate<new Date()&&!['COMPLETED','CLOSED','CANCELLED'].includes(project.status)).length,totalBudget:fullFinance?amount.toFixed(3):null,actualCost:fullFinance?cost.toFixed(3):null,financialProjects:financial.length,resources:resourceCount,currency:'OMR'},projects:projects.map(project=>({id:project.id,number:project.number,name:project.name,status:project.status,managerId:project.managerId,endDate:project.endDate,budget:financialIds.includes(project.id)?project.budget.toFixed(3):null,actualCost:financialIds.includes(project.id)?(costs.find(item=>item.projectId===project.id)?._sum.baseAmount??new Prisma.Decimal(0)).toFixed(3):null,tasks:(tasks.find(task=>task.projectId===project.id)?._count._all??0),completedTasks:(tasks.find(task=>task.projectId===project.id)?._count.completedAt??0)}))};
 });}
 async save(user:WorkIdentity,org:string,id:string|undefined,body:unknown,requestId:string){return this.organizations.execute(user,org,async(tx,a)=>{
  await this.entitlements.require(tx,org,'PORTFOLIOS');requirePermission(a,'portfolios.manage');const parsed=id?validate(portfolioUpdateSchema,body):validate(portfolioSchema,body),{version,...data}={...parsed,version:'version' in parsed?parsed.version:undefined};await relatedMember(tx,org,data.ownerId);
  if(!a.grants.some(grant=>grant.permission==='portfolios.manage'&&(grant.scope==='ORGANIZATION'||grant.scope==='OWN'&&data.ownerId===a.membershipId)))throw new ForbiddenException('Portfolio outside management scope');
  if(!id&&data.status==='COMPLETED')throw new BadRequestException('Create a planned or active portfolio');if(id){await this.lock(tx,org,id);const current=await this.row(tx,a,id,'portfolios.manage');if(current.version!==version)throw new ConflictException('Portfolio changed');if(data.status==='COMPLETED'&&await tx.project.count({where:{organizationId:org,archivedAt:null,portfolios:{some:{portfolioId:id}},status:{notIn:['COMPLETED','CLOSED','CANCELLED']}}}))throw new BadRequestException('Linked projects must be completed before closing the portfolio');await tx.projectPortfolio.update({where:{organizationId_id:{organizationId:org,id}},data:{...data,startsAt:data.startsAt?new Date(data.startsAt):null,endsAt:data.endsAt?new Date(data.endsAt):null,version:{increment:1}}});}
  else{if(await tx.projectPortfolio.count({where:{organizationId:org,archivedAt:null}})>=1000)throw new BadRequestException('Archive unused portfolios before adding another');id=(await tx.projectPortfolio.create({data:{organizationId:org,...data,startsAt:data.startsAt?new Date(data.startsAt):null,endsAt:data.endsAt?new Date(data.endsAt):null}})).id;}
  await this.organizations.audit(tx,user,org,requestId,'PORTFOLIO_SAVED','portfolio',id);return {id};
 });}
 async link(user:WorkIdentity,org:string,id:string,body:unknown,remove:boolean,requestId:string){return this.organizations.execute(user,org,async(tx,a)=>{
  await this.entitlements.require(tx,org,'PORTFOLIOS');const data=validate(portfolioLinkSchema,body);await this.lock(tx,org,id);const current=await this.row(tx,a,id,'portfolios.manage');if(current.version!==data.version)throw new ConflictException('Portfolio changed');await this.execution.project(tx,a,data.projectId);
  const where={organizationId:org,portfolioId:id,projectId:data.projectId};if(remove)await tx.portfolioProject.deleteMany({where});else{if(await tx.portfolioProject.count({where:{organizationId:org,portfolioId:id}})>=500)throw new BadRequestException('Portfolio supports up to 500 linked projects');await tx.portfolioProject.createMany({data:[where],skipDuplicates:true});}
  await tx.projectPortfolio.update({where:{organizationId_id:{organizationId:org,id}},data:{version:{increment:1}}});await this.organizations.audit(tx,user,org,requestId,remove?'PORTFOLIO_PROJECT_REMOVED':'PORTFOLIO_PROJECT_LINKED','portfolio',id);return {ok:true};
 });}
 async archive(user:WorkIdentity,org:string,id:string,body:unknown,restore:boolean,requestId:string){return this.organizations.execute(user,org,async(tx,a)=>{
  if(restore)await this.entitlements.require(tx,org,'PORTFOLIOS');const data=validate(versionSchema,body);await this.lock(tx,org,id);const current=await this.row(tx,a,id,'portfolios.manage',true);if(current.version!==data.version)throw new ConflictException('Portfolio changed');await tx.projectPortfolio.update({where:{organizationId_id:{organizationId:org,id}},data:{archivedAt:restore?null:new Date(),version:{increment:1}}});await this.organizations.audit(tx,user,org,requestId,restore?'PORTFOLIO_RESTORED':'PORTFOLIO_ARCHIVED','portfolio',id);return {ok:true};
 });}
}
