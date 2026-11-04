import {Injectable} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import {approvalKinds,type ApprovalQuery} from '@work/shared-schemas';
import {OrganizationService} from './organization.service';
import {ExecutionService} from './execution.service';
import {MeetingService} from './meeting.service';
import {RequestService} from './request.service';
import {FinanceService} from './finance.service';
import {hasPermission} from './access';
import type {WorkIdentity} from './identity.service';
interface ApprovalItem{id:string;title:string;number?:string;status:string;createdAt:Date;href:string}
@Injectable()
export class ApprovalService{
 constructor(private readonly organizations:OrganizationService,private readonly execution:ExecutionService,private readonly meetings:MeetingService,private readonly requests:RequestService,private readonly finance:FinanceService){}
 async pending(user:WorkIdentity,org:string,q:ApprovalQuery){return this.organizations.execute(user,org,async(tx,a)=>{
  const groups:Array<{kind:typeof approvalKinds[number];items:ApprovalItem[];total:number}>=[],text={contains:q.search.replace(/[\\%_]/g,value=>'\\'+value),mode:'insensitive' as const},page=q.kind==='all'?1:q.page,paging={skip:(page-1)*q.pageSize,take:q.pageSize},orderBy=[{createdAt:'asc' as const},{id:'asc' as const}];
  for(const kind of approvalKinds){if(q.kind!=='all'&&q.kind!==kind)continue;let items:ApprovalItem[],total:number;
   if(kind==='task-review'||kind==='task-approval'){
    const permission=kind==='task-review'?'tasks.review':'tasks.approve';if(!hasPermission(a,'tasks.read')||!hasPermission(a,permission))continue;
    const status=(await tx.taskStatus.findMany({where:{organizationId:org,active:true,category:kind==='task-review'?'REVIEW':'APPROVAL'},select:{key:true}})).map(row=>row.key);
    const where:Prisma.TaskWhereInput={AND:[{organizationId:org,archivedAt:null,completedAt:null,status:{in:status},...(kind==='task-review'?{reviewerId:a.membershipId}:{approverId:a.membershipId}),OR:[{assignedToId:null},{assignedToId:{not:a.membershipId}}]},{OR:[{title:text},{number:text}]},await this.execution.taskFilter(tx,a,'tasks.read'),await this.execution.taskFilter(tx,a,permission)]};
    const rows=await tx.task.findMany({where,select:{id:true,title:true,number:true,status:true,createdAt:true},orderBy,...paging});items=rows.map(row=>({...row,href:`/app/tasks/${row.id}`}));total=await tx.task.count({where});
   }else if(kind==='meeting'){
    if(!hasPermission(a,'meetings.read')||!hasPermission(a,'meetings.approve'))continue;
    const where:Prisma.MeetingWhereInput={AND:[{organizationId:org,archivedAt:null,status:'PENDING_APPROVAL',approverId:a.membershipId,title:text,OR:[{minutesAuthorId:null},{minutesAuthorId:{not:a.membershipId}}]},this.meetings.filter(a,'meetings.read'),this.meetings.filter(a,'meetings.approve')]};
    const rows=await tx.meeting.findMany({where,select:{id:true,title:true,status:true,createdAt:true},orderBy,...paging});items=rows.map(row=>({...row,href:`/app/meetings/${row.id}`}));total=await tx.meeting.count({where});
   }else if(kind==='request'){
    if(!hasPermission(a,'requests.read')||!hasPermission(a,'requests.approve'))continue;
    const where:Prisma.InternalRequestWhereInput={AND:[{organizationId:org,status:'PENDING',requesterId:{not:a.membershipId},approvals:{some:{approverId:a.membershipId,status:'PENDING'}},OR:[{title:text},{number:text}]},this.requests.filter(a,'requests.read'),this.requests.filter(a,'requests.approve')]};
    const rows=await tx.internalRequest.findMany({where,select:{id:true,title:true,number:true,status:true,createdAt:true},orderBy,...paging});items=rows.map(row=>({...row,href:`/app/requests/${row.id}`}));total=await tx.internalRequest.count({where});
   }else{
    if(!hasPermission(a,'expenses.read')||!hasPermission(a,'expenses.approve'))continue;
    const where:Prisma.OperationalExpenseWhereInput={AND:[{organizationId:org,status:'PENDING',approverId:a.membershipId,requesterId:{not:a.membershipId},title:text},this.finance.expenseFilter(a,'expenses.read'),this.finance.expenseFilter(a,'expenses.approve')]};
    const rows=await tx.operationalExpense.findMany({where,select:{id:true,title:true,status:true,createdAt:true},orderBy,...paging});items=rows.map(row=>({...row,href:`/app/expenses/${row.id}`}));total=await tx.operationalExpense.count({where});
   }
   groups.push({kind,items,total});
  }
  return {groups,total:groups.reduce((sum,group)=>sum+group.total,0),page,pageSize:q.pageSize};
 });}
}
