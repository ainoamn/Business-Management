import {z} from 'zod';

export const organizationRoles=['ORGANIZATION_OWNER','ORGANIZATION_ADMIN','GENERAL_MANAGER','DEPARTMENT_MANAGER','PROJECT_MANAGER','TEAM_LEADER','EMPLOYEE','ACCOUNTANT','REQUESTER','EXTERNAL_CLIENT','AUDITOR','GUEST'] as const;
export const workPermissions=[
  'organization.read','organization.manage','members.read','members.manage','structure.read','structure.manage','roles.manage',
  'workload.read','portfolios.read','portfolios.manage','projects.read','projects.create','projects.edit','projects.delete','projects.manage',
  'tasks.read','tasks.create','tasks.edit','tasks.delete','tasks.assign','tasks.review','tasks.approve','tasks.close','tasks.comment','tasks.override_dependencies',
  'documents.read','documents.upload','documents.delete','documents.share','documents.comment','meetings.read','meetings.manage','meetings.approve',
  'time.read','time.create','time.manage','budgets.read','budgets.manage','budgets.override','expenses.read','expenses.create','expenses.approve','expenses.reverse',
  'requests.read','requests.create','requests.approve','requests.manage','workflows.read','workflows.manage','reports.read','reports.export',
  'notifications.read','ai.use','ai.read','ai.manage','integrations.manage','billing.read','billing.manage',
] as const;
export type WorkPermission=typeof workPermissions[number];
export type OrganizationRoleName=typeof organizationRoles[number];
export const workScopes=['ORGANIZATION','BRANCH','DEPARTMENT','TEAM','PROJECT','TASK','OWN'] as const;
export type WorkScope=typeof workScopes[number];
export const workQuerySchema=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(20),search:z.string().trim().max(100).default('')}).strict();
export type WorkQuery=z.infer<typeof workQuerySchema>;
const uuid=z.string().uuid().toLowerCase();
const name=z.string().trim().min(2).max(120);
const email=z.string().trim().toLowerCase().email().max(254);
const password=z.string().min(12).max(128);
export const workRegisterSchema=z.object({email,username:z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{2,39}$/),displayName:name,password,organizationName:name.max(160).optional(),organizationSlug:z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(80).optional(),inviteToken:z.string().regex(/^[a-f0-9]{64}$/).optional(),locale:z.enum(['ar','en']).default('ar')}).strict().superRefine((data,ctx)=>{if(!data.inviteToken&&(!data.organizationName||!data.organizationSlug))ctx.addIssue({code:'custom',path:['organizationName'],message:'Organization details required'});if(data.inviteToken&&(data.organizationName||data.organizationSlug))ctx.addIssue({code:'custom',path:['inviteToken'],message:'Choose invitation or new organization'});});
export const workLoginSchema=z.object({identifier:z.string().trim().toLowerCase().min(3).max(254),password:z.string().min(1).max(128)}).strict();
export const tokenSchema=z.string().regex(/^[a-f0-9]{64}$/);
export const workTokenSchema=z.object({token:tokenSchema}).strict();
export const workForgotSchema=z.object({email}).strict();
export const workResetSchema=z.object({token:tokenSchema,password}).strict();
export const workProfileSchema=z.object({displayName:name}).strict();
export const createOrganizationSchema=z.object({name:name.max(160),slug:z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(80)}).strict();
export const invitationSchema=z.object({email,role:z.enum(organizationRoles).refine(value=>value!=='ORGANIZATION_OWNER')}).strict();
export const memberUpdateSchema=z.object({role:z.enum(organizationRoles),active:z.boolean(),branchId:uuid.nullable().default(null),departmentId:uuid.nullable().default(null),sectionId:uuid.nullable().default(null),jobTitle:z.string().trim().max(120).default('')}).strict();
export const branchSchema=z.object({name,address:z.string().trim().max(500).default(''),managerId:uuid.nullable().default(null)}).strict();
export const departmentSchema=z.object({name,branchId:uuid.nullable().default(null),managerId:uuid.nullable().default(null)}).strict();
export const sectionSchema=z.object({name,departmentId:uuid}).strict();
export const teamSchema=z.object({name,departmentId:uuid.nullable().default(null),leaderId:uuid.nullable().default(null)}).strict();
export const teamMemberSchema=z.object({membershipId:uuid}).strict();
export const organizationRoleSchema=z.object({name:name.max(80),description:z.string().trim().max(500).default(''),permissions:z.array(z.enum(workPermissions)).max(workPermissions.length).refine(value=>new Set(value).size===value.length)}).strict();
export const membershipRoleSchema=z.object({membershipId:uuid,roleId:uuid,scope:z.enum(workScopes),scopeId:uuid.nullable().default(null)}).strict().superRefine((value,ctx)=>{if(!['ORGANIZATION','OWN'].includes(value.scope)&&!value.scopeId)ctx.addIssue({code:'custom',path:['scopeId'],message:'Scope target required'});if(['ORGANIZATION','OWN'].includes(value.scope)&&value.scopeId)ctx.addIssue({code:'custom',path:['scopeId'],message:'Scope target not allowed'});});
export const organizationSettingsSchema=z.object({taskCategories:z.array(z.string().trim().min(1).max(80)).max(50).refine(values=>new Set(values).size===values.length).optional(),projectCategories:z.array(z.string().trim().min(1).max(80)).max(50).refine(values=>new Set(values).size===values.length).optional(),name:name.max(160),locale:z.enum(['ar','en']),timezone:z.string().max(64).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}}),currency:z.literal('OMR'),description:z.string().trim().max(2000),businessType:z.string().trim().max(120),email:email.or(z.literal('')),phone:z.string().trim().max(40),address:z.string().trim().max(500),country:z.string().regex(/^[A-Z]{2}$/),workDays:z.array(z.number().int().min(0).max(6)).min(1).max(7).refine(value=>new Set(value).size===value.length),dayStart:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),dayEnd:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),taskPrefix:z.string().regex(/^[A-Z0-9]{1,10}$/),projectPrefix:z.string().regex(/^[A-Z0-9]{1,10}$/)}).strict().refine(value=>value.dayStart<value.dayEnd,'Workday end must follow start');
