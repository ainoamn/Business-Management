import {PortfolioService} from './portfolio.service';
import {Injectable} from '@nestjs/common';
import {searchKinds,type SearchQuery,type WorkPermission} from '@work/shared-schemas';
import {OrganizationService} from './organization.service';
import {ExecutionService} from './execution.service';
import {MeetingService} from './meeting.service';
import {RequestService} from './request.service';
import {DocumentAccessService} from './document-access.service';
import {WorkflowService} from './workflow.service';
import {FinanceService} from './finance.service';
import {hasPermission} from './access';
import type {WorkIdentity} from './identity.service';
export interface SearchHit {id:string;title:string;number?:string;status?:string;href:string}
@Injectable()
export class SearchService{
 constructor(private readonly organizations:OrganizationService,private readonly execution:ExecutionService,private readonly meetings:MeetingService,private readonly requests:RequestService,private readonly documents:DocumentAccessService,private readonly workflows:WorkflowService,private readonly finance:FinanceService,private readonly portfolios:PortfolioService){}
 async search(user:WorkIdentity,org:string,q:SearchQuery){return this.organizations.execute(user,org,async(tx,a)=>{
  const literal=q.q.replace(/[\\%_]/g,value=>'\\'+value);
  const groups:Array<{kind:string;items:SearchHit[];total:number}>=[],text={contains:literal,mode:'insensitive' as const},paging={take:q.pageSize,skip:(q.page-1)*q.pageSize},order={id:'asc' as const};
  for(const kind of searchKinds){if(q.kind!=='all'&&q.kind!==kind)continue;const permission:WorkPermission=kind==='members'?'members.read':kind==='departments'?'structure.read':`${kind}.read` as WorkPermission;if(kind==='decisions'?!hasPermission(a,'projects.read')&&!hasPermission(a,'meetings.read'):!hasPermission(a,permission))continue;let items:SearchHit[]=[],total=0;
   if(kind==='decisions'){
    // Stable project-then-meeting ordering preserves pagination across both sources.
    const projectsAllowed=hasPermission(a,'projects.read'),meetingsAllowed=hasPermission(a,'meetings.read');
    const projectWhere={organizationId:org,title:text,project:{AND:[{organizationId:org,archivedAt:null},projectsAllowed?await this.execution.projectFilter(tx,a,'projects.read'):{id:'00000000-0000-0000-0000-000000000000'}]}},meetingWhere={organizationId:org,title:text,meeting:{AND:[{organizationId:org,archivedAt:null},meetingsAllowed?this.meetings.filter(a,'meetings.read'):{id:'00000000-0000-0000-0000-000000000000'}]}};

    const projectCount=projectsAllowed?await tx.projectDecision.count({where:projectWhere}):0,meetingCount=meetingsAllowed?await tx.meetingDecision.count({where:meetingWhere}):0;
    if(projectsAllowed&&paging.skip<projectCount){const rows=await tx.projectDecision.findMany({where:projectWhere,select:{id:true,title:true,projectId:true},...paging,orderBy:order});items.push(...rows.map(row=>({id:'project:'+row.id,title:row.title,href:'/app/projects/'+row.projectId+'#decisions'})));}
    if(meetingsAllowed&&items.length<q.pageSize){const rows=await tx.meetingDecision.findMany({where:meetingWhere,select:{id:true,title:true,meetingId:true},skip:Math.max(0,paging.skip-projectCount),take:q.pageSize-items.length,orderBy:order});items.push(...rows.map(row=>({id:'meeting:'+row.id,title:row.title,href:'/app/meetings/'+row.meetingId+'#decisions'})));}
    total=projectCount+meetingCount;
   }
   else if(kind==='portfolios'){const where={AND:[{organizationId:org,archivedAt:null,name:text},this.portfolios.filter(a,'portfolios.read')]};const rows=await tx.projectPortfolio.findMany({where,select:{id:true,name:true,status:true},...paging,orderBy:order});items=rows.map(({name,...row})=>({...row,title:name,href:`/app/portfolios/${row.id}`}));total=await tx.projectPortfolio.count({where});}
   else if(kind==='tasks'){const where={AND:[{organizationId:org,archivedAt:null,OR:[{title:text},{number:text}]},await this.execution.taskFilter(tx,a,'tasks.read')]};const rows=await tx.task.findMany({where,select:{id:true,title:true,number:true,status:true},...paging,orderBy:order});items=rows.map(row=>({...row,href:`/app/tasks/${row.id}`}));total=await tx.task.count({where});}
   else if(kind==='projects'){const where={AND:[{organizationId:org,archivedAt:null,OR:[{name:text},{number:text}]},await this.execution.projectFilter(tx,a,'projects.read')]};const rows=await tx.project.findMany({where,select:{id:true,name:true,number:true,status:true},...paging,orderBy:order});items=rows.map(({name,...row})=>({...row,title:name,href:`/app/projects/${row.id}`}));total=await tx.project.count({where});}
   else if(kind==='meetings'){const where={AND:[{organizationId:org,archivedAt:null,title:text},this.meetings.filter(a,'meetings.read')]};const rows=await tx.meeting.findMany({where,select:{id:true,title:true,status:true},...paging,orderBy:order});items=rows.map(row=>({...row,href:`/app/meetings/${row.id}`}));total=await tx.meeting.count({where});}
   else if(kind==='requests'){const where={AND:[{organizationId:org,OR:[{title:text},{number:text}]},this.requests.filter(a,'requests.read')]};const rows=await tx.internalRequest.findMany({where,select:{id:true,title:true,status:true,number:true},...paging,orderBy:order});items=rows.map(row=>({...row,href:`/app/requests/${row.id}`}));total=await tx.internalRequest.count({where});}
   else if(kind==='documents'){const where={AND:[{organizationId:org,status:'ACTIVE',archivedAt:null,title:text},await this.documents.filter(tx,a)]};const rows=await tx.workDocument.findMany({where,select:{id:true,title:true},...paging,orderBy:order});items=rows.map(row=>({...row,href:`/app/documents/${row.id}`}));total=await tx.workDocument.count({where});}
   else if(kind==='workflows'){const where={AND:[{organizationId:org,status:{not:'ARCHIVED'},name:text},this.workflows.filter(a)]};const rows=await tx.workflow.findMany({where,select:{id:true,name:true,status:true},...paging,orderBy:order});items=rows.map(({name,...row})=>({...row,title:name,href:`/app/workflows/${row.id}`}));total=await tx.workflow.count({where});}
   else if(kind==='expenses'){const where={AND:[{organizationId:org,title:text},this.finance.expenseFilter(a,'expenses.read')]};const rows=await tx.operationalExpense.findMany({where,select:{id:true,title:true,status:true},...paging,orderBy:order});items=rows.map(row=>({...row,href:`/app/expenses/${row.id}`}));total=await tx.operationalExpense.count({where});}
   else if(kind==='budgets'){const where={AND:[{organizationId:org,archivedAt:null,name:text},await this.finance.budgetFilter(tx,a,'budgets.read')]};const rows=await tx.operationalBudget.findMany({where,select:{id:true,name:true},...paging,orderBy:order});items=rows.map(({name,...row})=>({...row,title:name,href:`/app/budgets/${row.id}`}));total=await tx.operationalBudget.count({where});}
   else if(kind==='members'){const where={organizationId:org,active:true,user:{disabledAt:null,deletedAt:null,OR:[{displayName:text},{email:text}]}};const rows=await tx.membership.findMany({where,select:{id:true,user:{select:{displayName:true}}},...paging,orderBy:order});items=rows.map(row=>({id:row.id,title:row.user.displayName,href:`/app/members?search=${encodeURIComponent(row.user.displayName)}`}));total=await tx.membership.count({where});}
   else if(kind==='departments'){const where={organizationId:org,archivedAt:null,name:text};const rows=await tx.department.findMany({where,select:{id:true,name:true},...paging,orderBy:order});items=rows.map(row=>({id:row.id,title:row.name,href:`/app/departments?search=${encodeURIComponent(row.name)}`}));total=await tx.department.count({where});}
   groups.push({kind,items,total});
  }return {query:q.q,page:q.page,pageSize:q.pageSize,groups,total:groups.reduce((sum,group)=>sum+group.total,0)};
 });}
}
