import {z} from 'zod';
import {workQuerySchema} from './work';
import {reportQuerySchema} from './reports';
import {projectSchema,taskSchema} from './execution';
const uuid=z.string().uuid().toLowerCase();
const usd=z.string().regex(/^(0|[1-9]\d{0,8})(\.\d{1,9})?$/);
export const aiPurposes=['ASSISTANT','TASK_PLAN','PROJECT_PLAN','MEETING_SUMMARY','DOCUMENT_SUMMARY','PERFORMANCE','DELAY_ANALYSIS','TRANSLATE','WORK_REPORT','SEARCH'] as const;
export const aiProviderSchema=z.object({name:z.string().trim().min(2).max(120),kind:z.enum(['OPENAI_RESPONSES','OPENAI_COMPATIBLE']),apiKey:z.string().regex(/^[\x21-\x7e]{8,1000}$/).optional(),active:z.boolean().default(false),monthlyBudgetUsd:usd,maxConcurrent:z.number().int().min(1).max(20).default(4)}).strict();
export const aiProviderUpdateSchema=aiProviderSchema.extend({version:z.number().int().positive()});
export const aiModelSchema=z.object({providerId:uuid,name:z.string().trim().min(1).max(120),identifier:z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9._:/-]+$/),inputPriceUsd:usd,cachedInputPriceUsd:usd,outputPriceUsd:usd,creditsPerThousandTokens:z.number().int().min(1).max(1000).default(1),maxOutputTokens:z.number().int().min(256).max(8192).default(2048),maxInputBytes:z.number().int().min(4096).max(65536).default(32768),active:z.boolean().default(false),priceSource:z.string().trim().min(1).max(500),priceDate:z.iso.datetime({offset:true})}).strict();
export const aiModelUpdateSchema=aiModelSchema.omit({providerId:true}).extend({version:z.number().int().positive()});
export const aiPromptSchema=z.object({kind:z.enum(aiPurposes),instructions:z.string().trim().min(1).max(8000),version:z.number().int().min(0)}).strict();
export const aiSettingsSchema=z.object({enabled:z.boolean(),preferredModelId:uuid.nullable().default(null),allowedModelIds:z.array(uuid).max(20).refine(ids=>new Set(ids).size===ids.length).default([]),monthlySpendLimitUsd:usd.nullable().default(null),memberDailyCredits:z.number().int().min(1).max(1000000).nullable().default(null),externalDataConsent:z.boolean(),version:z.number().int().min(0)}).strict().refine(data=>!data.enabled||data.allowedModelIds.length>0,{message:'Select an allowed model before enabling AI',path:['allowedModelIds']}).refine(data=>data.preferredModelId===null||data.allowedModelIds.includes(data.preferredModelId),{message:'Preferred model must be allowed',path:['preferredModelId']}).refine(data=>!data.enabled||data.externalDataConsent,{message:'Enabling AI requires external data consent',path:['externalDataConsent']});
export const aiContextSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('MY_WORK')}).strict(),
 z.object({kind:z.enum(['TASK','PROJECT','MEETING','DOCUMENT','REQUEST']),id:uuid}).strict(),
 z.object({kind:z.literal('SEARCH'),query:z.string().trim().min(2).max(100)}).strict(),
 z.object({kind:z.literal('REPORT'),query:reportQuerySchema}).strict(),
]);
export const aiRequestSchema=z.object({clientKey:uuid,maximumCredits:z.number().int().min(1).max(1000000),maximumEstimatedUsd:usd,conversationId:uuid.optional(),modelId:uuid.optional(),purpose:z.enum(aiPurposes).default('ASSISTANT'),prompt:z.string().trim().min(1).max(8000),locale:z.enum(['ar','en']).default('ar'),context:aiContextSchema}).strict();
export const aiEstimateSchema=aiRequestSchema.omit({clientKey:true,maximumCredits:true,maximumEstimatedUsd:true});
const phase=z.object({name:z.string().trim().min(1).max(180),description:z.string().max(4000),durationDays:z.number().int().min(1).max(3650)}).strict();
const task=z.object({title:z.string().trim().min(1).max(180),description:z.string().max(4000),phaseIndex:z.number().int().min(0).max(19).nullable(),durationDays:z.number().int().min(1).max(3650),priority:z.enum(['LOW','NORMAL','HIGH','URGENT','CRITICAL']),predecessors:z.array(z.number().int().min(0).max(49)).max(49)}).strict();
export const aiProposalSchema=z.object({kind:z.enum(['CREATE_TASK','CREATE_PROJECT']),title:z.string().trim().min(1).max(180),description:z.string().max(4000),objective:z.string().max(4000),phases:z.array(phase).max(20),tasks:z.array(task).max(50),risks:z.array(z.object({title:z.string().min(1).max(180),likelihood:z.number().int().min(1).max(5),impact:z.number().int().min(1).max(5),mitigation:z.string().max(4000)}).strict()).max(20),requirements:z.array(z.string().max(400)).max(20),metrics:z.array(z.object({label:z.string().max(180),target:z.string().max(180)}).strict()).max(20)}).strict().superRefine((data,ctx)=>{data.tasks.forEach((task,index)=>{if(task.phaseIndex!==null&&task.phaseIndex>=data.phases.length)ctx.addIssue({code:'custom',path:['tasks',index,'phaseIndex'],message:'Phase not found'});if(task.predecessors.some(id=>id>=index)||new Set(task.predecessors).size!==task.predecessors.length)ctx.addIssue({code:'custom',path:['tasks',index,'predecessors'],message:'Predecessors must be unique earlier tasks'});});if(data.kind==='CREATE_TASK'&&(data.phases.length||data.tasks.length||data.risks.length))ctx.addIssue({code:'custom',path:['kind'],message:'Single-task drafts do not contain project records'});});
export const aiResponseSchema=z.object({answer:z.string().max(32000),sources:z.array(z.string().regex(/^s\d{1,4}$/)).max(100),confidence:z.enum(['LOW','MEDIUM','HIGH']),dataSufficiency:z.enum(['NONE','PARTIAL','SUFFICIENT']),limitations:z.string().max(4000),proposals:z.array(aiProposalSchema).max(5)}).strict();
export const aiDraftUpdateSchema=z.object({version:z.number().int().positive(),proposal:aiProposalSchema}).strict();
export const aiDraftConfirmSchema=z.object({version:z.number().int().positive(),task:taskSchema.optional(),project:projectSchema.optional(),includePlan:z.boolean().default(false)}).strict().refine(data=>!!data.task!==!!data.project,{message:'Review exactly one task or project'}).refine(data=>!data.includePlan||!!data.project,{message:'A project plan requires a project'});
export const aiDraftDiscardSchema=z.object({version:z.number().int().positive()}).strict();
export const aiReconcileSchema=z.object({inputTokens:z.number().int().min(0).max(100000),cachedTokens:z.number().int().min(0).max(100000),outputTokens:z.number().int().min(0).max(8192),reason:z.string().trim().min(5).max(500)}).strict().refine(data=>data.cachedTokens<=data.inputTokens,{message:'Cached tokens cannot exceed input tokens'});
export const aiCreditGrantSchema=z.object({organizationId:uuid,credits:z.number().int().min(1).max(100000000),reference:z.string().trim().min(3).max(114),reason:z.string().trim().min(5).max(500)}).strict();
export const aiHistoryQuerySchema=workQuerySchema.extend({view:z.enum(['active','archived']).default('active')});
export type AiRequestInput=z.infer<typeof aiRequestSchema>;
export type AiContextInput=z.infer<typeof aiContextSchema>;
export type AiResponse=z.infer<typeof aiResponseSchema>;
export type AiProposal=z.infer<typeof aiProposalSchema>;
export const aiResponseJsonSchema=z.toJSONSchema(aiResponseSchema,{target:'draft-7'});
