import {priorities} from '@work/shared-schemas';
import {workLabel,type WorkText} from '../../i18n/work';
import type {WorkField} from './form';
export const choices=(t:WorkText,values:readonly string[])=>values.map(value=>({value,label:workLabel(t,value)}));
export function executionFields(t:WorkText,base:string,kind:'tasks'|'projects',settings?:Record<string,unknown>|null):WorkField[]{
  const ref=(key:string,endpoint:string,optional=true):WorkField=>({key,type:'reference',referenceUrl:`${base}/${endpoint}`,optional});
  const structure=(key:string,resource:string)=>ref(key,`structure/${resource}`);
  const member=(key:string,optional=true)=>ref(key,'members',optional);
  const configured=settings?.[kind==='tasks'?'taskCategories':'projectCategories'],suggestions=Array.isArray(configured)?configured.filter((value):value is string=>typeof value==='string'):[];
  const common:WorkField[]=[{key:'description',type:'textarea',optional:true},structure('departmentId','departments'),structure('teamId','teams'),{key:'priority',type:'select',options:choices(t,priorities)},{key:'startDate',type:'date',optional:true}];
  if(kind==='projects')return [{key:'name'},{key:'objective',type:'textarea',optional:true},...common,structure('branchId','branches'),member('managerId',false),{key:'client',optional:true},{key:'category',optional:true,suggestions},{key:'status',type:'select',options:choices(t,['PLANNED','ACTIVE','ON_HOLD','COMPLETED','CANCELLED','CLOSED'])},{key:'endDate',type:'date',optional:true},{key:'budget'}];
  return [{key:'title'},...common,ref('projectId','projects'),ref('parentTaskId','tasks'),{key:'phaseId',type:'reference',optional:true,dependsOn:'projectId',referenceUrl:`${base}/projects/{value}/records/phases`},member('assignedToId'),member('reviewerId'),member('approverId'),{key:'dueDate',type:'date',optional:true},{key:'progress',type:'number',min:0,max:99},{key:'estimatedHours'},{key:'costEstimate'},{key:'tags',type:'tags',optional:true},{key:'category',optional:true,suggestions},{key:'visibility',type:'select',options:choices(t,['PRIVATE','TEAM','ORGANIZATION'])},{key:'confidentiality',type:'select',options:choices(t,['INTERNAL','CONFIDENTIAL','RESTRICTED'])},{key:'recurrence',type:'select',options:choices(t,['NONE','DAILY','WEEKLY','MONTHLY'])},{key:'recurrenceUntil',type:'date',optional:true}];
}
