import {z} from 'zod';
import {workQuerySchema} from './work';
const uuid=z.string().uuid().toLowerCase();
export const workflowTriggers=['TASK_CREATED','TASK_STATUS_CHANGED','TASK_PROGRESS_CHANGED','TASK_DUE_SOON','TASK_OVERDUE','TASK_APPROVED','REQUEST_CREATED','REQUEST_SUBMITTED','REQUEST_APPROVED','REQUEST_REJECTED','REQUEST_WAITING','EXPENSE_CREATED','EXPENSE_SUBMITTED','EXPENSE_APPROVED','EXPENSE_REJECTED','BUDGET_LOW','PROJECT_COMPLETED','PROJECT_TASKS_COMPLETED','MEETING_CREATED','MEETING_WAITING'] as const;
export const workflowTriggerSchema=z.object({kind:z.enum(workflowTriggers),projectId:uuid.nullable().default(null),departmentId:uuid.nullable().default(null),teamId:uuid.nullable().default(null),hours:z.number().min(0).max(8760).multipleOf(0.001).default(24),thresholdPercent:z.number().min(0).max(100).multipleOf(0.001).default(20)}).strict();
export const workflowFields=['status','priority','progress','assignedToId','reviewerId','approverId','projectId','departmentId','teamId','requestTypeId','baseAmount','remainingPercent','ageHours','dueInHours','tags'] as const;
export const workflowOperators=['EQ','NE','IN','NOT_IN','GT','GTE','LT','LTE','EMPTY','NOT_EMPTY'] as const;
const uuidFields=new Set(['assignedToId','reviewerId','approverId','projectId','departmentId','teamId','requestTypeId']);
const numeric=new Set(['progress','baseAmount','remainingPercent','ageHours','dueInHours']);
export const workflowConditionSchema=z.object({field:z.enum(workflowFields),operator:z.enum(workflowOperators),value:z.union([z.string().max(200),z.number().finite().min(-1000000000).max(1000000000),z.array(z.string().max(80)).min(1).max(30)]).optional()}).strict().superRefine((data,ctx)=>{if(uuidFields.has(data.field)&&data.value!==undefined&&!['EMPTY','NOT_EMPTY'].includes(data.operator)){for(const value of Array.isArray(data.value)?data.value:[data.value])if(!uuid.safeParse(value).success)ctx.addIssue({code:'custom',path:['value'],message:'A valid reference ID is required'});}if(['EMPTY','NOT_EMPTY'].includes(data.operator)){if(data.value!==undefined)ctx.addIssue({code:'custom',path:['value'],message:'Empty checks do not accept a value'});return;}if(data.value===undefined){ctx.addIssue({code:'custom',path:['value'],message:'Condition value required'});return;}if(['IN','NOT_IN'].includes(data.operator)){if(!Array.isArray(data.value)||numeric.has(data.field))ctx.addIssue({code:'custom',path:['value'],message:'Membership requires a list and a text field'});return;}if(Array.isArray(data.value)){ctx.addIssue({code:'custom',path:['value'],message:'Scalar condition required'});return;}if(numeric.has(data.field)){if(typeof data.value==='string'&&!/^-?\d{1,12}(?:\.\d{1,6})?$/.test(data.value))ctx.addIssue({code:'custom',path:['value'],message:'Numeric condition value required'});}else if(typeof data.value!=='string'||!['EQ','NE'].includes(data.operator))ctx.addIssue({code:'custom',path:['operator'],message:'Text fields support equality or membership'});}).transform(data=>!uuidFields.has(data.field)||data.value===undefined?data:{...data,value:Array.isArray(data.value)?[...new Set(data.value.map(value=>value.toLowerCase()))]:typeof data.value==='string'?data.value.toLowerCase():data.value});
export const workflowPredicateSchema=z.object({mode:z.enum(['ALL','ANY']),conditions:z.array(workflowConditionSchema).min(1).max(10)}).strict();
const notify=z.object({type:z.literal('NOTIFY'),recipients:z.array(z.enum(['ASSIGNEE','REVIEWER','APPROVER','PROJECT_MANAGER','DEPARTMENT_MANAGER','CREATOR'])).max(6).default([]),membershipIds:z.array(uuid).max(20).default([])}).strict().refine(data=>data.recipients.length+data.membershipIds.length>0,{message:'Notification recipients required',path:['recipients']});
export const workflowActionSchema=z.discriminatedUnion('type',[
 notify,
 z.object({type:z.literal('TASK_TRANSITION'),status:z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/)}).strict(),
 z.object({type:z.literal('TASK_ASSIGN'),membershipId:uuid}).strict(),
 z.object({type:z.literal('TASK_PROGRESS'),progress:z.number().int().min(0).max(99)}).strict(),
 z.object({type:z.literal('CREATE_TASK'),title:z.string().trim().min(1).max(200),description:z.string().trim().max(4000).default(''),assignedToId:uuid.nullable().default(null),priority:z.enum(['LOW','NORMAL','HIGH','URGENT','CRITICAL']).default('NORMAL'),dueAfterHours:z.number().int().min(1).max(8760).nullable().default(null)}).strict(),
 z.object({type:z.literal('REQUEST_SUBMIT')}).strict(),
 z.object({type:z.literal('EXPENSE_SUBMIT')}).strict(),
]);
const base={id:uuid,name:z.string().trim().min(1).max(120)};
export const workflowNodeSchema=z.discriminatedUnion('kind',[
 z.object({...base,kind:z.literal('condition'),predicate:workflowPredicateSchema,yes:uuid,no:uuid}).strict(),
 z.object({...base,kind:z.literal('action'),action:workflowActionSchema,next:uuid}).strict(),
 z.object({...base,kind:z.literal('delay'),seconds:z.number().int().min(1).max(2592000),next:uuid}).strict(),
 z.object({...base,kind:z.literal('end')}).strict(),
]);
export const workflowGraphSchema=z.object({entry:uuid,nodes:z.array(workflowNodeSchema).min(2).max(40)}).strict().superRefine((graph,ctx)=>{
 const nodes=new Map(graph.nodes.map(node=>[node.id,node]));const issue=(message:string)=>ctx.addIssue({code:'custom',path:['nodes'],message});if(nodes.size!==graph.nodes.length){issue('Node IDs must be unique');return;}if(!nodes.has(graph.entry)){issue('Entry node not found');return;}if(!graph.nodes.some(node=>node.kind==='action')||!graph.nodes.some(node=>node.kind==='end')){issue('An action and an end node are required');return;}
 const visited=new Set<string>(),visiting=new Set<string>();const durations=new Map<string,number>();let invalid=false;
 const visit=(id:string):number=>{if(visiting.has(id)){invalid=true;return 0;}if(visited.has(id))return durations.get(id)??0;const node=nodes.get(id);if(!node){invalid=true;return 0;}visiting.add(id);let seconds=0;if(node.kind==='condition')seconds=Math.max(visit(node.yes),visit(node.no));else if(node.kind!=='end')seconds=visit(node.next)+(node.kind==='delay'?node.seconds:0);visiting.delete(id);visited.add(id);durations.set(id,seconds);return seconds;};
 const duration=visit(graph.entry);if(invalid)issue('Workflow must be acyclic and every connection must exist');if(visited.size!==nodes.size)issue('Every node must be reachable from the entry');if(duration>7776000)issue('A workflow path cannot wait more than 90 days');
});
export const workflowSchema=z.object({name:z.string().trim().min(1).max(180),description:z.string().trim().max(4000).default(''),trigger:workflowTriggerSchema,graph:workflowGraphSchema}).strict();
export const workflowUpdateSchema=workflowSchema.extend({version:z.number().int().positive()});
export const workflowControlSchema=z.object({action:z.enum(['ACTIVATE','PAUSE','ARCHIVE','RESTORE']),version:z.number().int().positive()}).strict();
export const workflowPreviewSchema=z.object({resourceId:uuid}).strict();
export const workflowQuerySchema=workQuerySchema.extend({view:z.enum(['all','draft','active','paused','archived']).default('all')}).strict();
export type WorkflowDefinition=z.infer<typeof workflowSchema>;
export type WorkflowGraph=z.infer<typeof workflowGraphSchema>;
export type WorkflowNode=z.infer<typeof workflowNodeSchema>;
export type WorkflowAction=z.infer<typeof workflowActionSchema>;
export type WorkflowPredicate=z.infer<typeof workflowPredicateSchema>;
export type WorkflowTrigger=z.infer<typeof workflowTriggerSchema>;
export type WorkflowQuery=z.infer<typeof workflowQuerySchema>;
