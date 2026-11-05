import {z} from 'zod';
export const platformOrganizationCreateSchema=z.object({name:z.string().trim().min(2).max(160),slug:z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(80),ownerEmail:z.string().trim().toLowerCase().email().max(254)}).strict();

export const platformResources = ['organizations','users','accounts','roles','plans','subscriptions','invoices','ledger','pages','audit'] as const;
export const platformPermissions = [
  'overview.read','organizations.read','organizations.manage','users.read','users.manage',
  'accounts.read','accounts.manage','roles.read','roles.manage','plans.read','plans.manage',
  'subscriptions.read','subscriptions.manage','invoices.read','invoices.manage','ledger.read','ledger.manage',
  'pages.read','pages.manage','audit.read','settings.read','settings.manage','security.read','security.manage','monitoring.read',
  'ai.read','ai.manage','storage.read','support.read','support.manage',
  'billing.read','billing.manage','coupons.read','coupons.manage','payments.read','payments.manage',
] as const;
export type PlatformPermission = typeof platformPermissions[number];
export type PlatformResource = typeof platformResources[number];
export const platformResourceSchema=z.enum(platformResources);
export const platformQuerySchema=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(20),search:z.string().trim().max(100).default('')}).strict();
export type PlatformQuery=z.infer<typeof platformQuerySchema>;
const name=z.string().trim().min(2).max(120);
export const platformPasswordSchema=z.string().min(12).max(128);
const email=z.string().trim().toLowerCase().email().max(254);
const uuid=z.string().uuid().toLowerCase();
const money=z.string().regex(/^(0|[1-9]\d{0,8})(\.\d{1,3})?$/);
const positiveMoney=money.refine(v=>Number(v)>0,'Positive amount required');
const date=z.string().datetime({offset:true});
export const platformLoginSchema=z.object({email,password:z.string().min(1).max(128)}).strict();
export const platformRoleSchema=z.object({name:name.max(80),permissions:z.array(z.enum(platformPermissions)).max(platformPermissions.length).refine(v=>new Set(v).size===v.length)}).strict();
export const platformAccountSchema=z.object({email,displayName:name,password:platformPasswordSchema,roleId:uuid}).strict();
export const platformAccountUpdateSchema=z.object({displayName:name,roleId:uuid,disabled:z.boolean()}).strict();
export const platformPlanSchema=z.object({name:name.max(80),description:z.string().trim().max(500),price:money,maxSeats:z.coerce.number().int().min(1).max(100000),storageMb:z.coerce.number().int().min(0).max(100000000),aiCredits:z.coerce.number().int().min(0).max(100000000),automationRuns:z.coerce.number().int().min(0).max(100000000).optional(),activeWorkflows:z.coerce.number().int().min(0).max(10000).optional(),active:z.boolean()}).strict();
export const platformSubscriptionSchema=z.object({organizationId:uuid,planId:uuid,seats:z.coerce.number().int().min(1).max(100000),status:z.enum(['TRIAL','ACTIVE','PAST_DUE','CANCELED']),endsAt:date}).strict();
export const platformInvoiceSchema=z.object({organizationId:uuid,number:z.string().trim().min(2).max(80),amount:positiveMoney,dueAt:date}).strict();
export const platformLedgerSchema=z.object({organizationId:uuid,invoiceId:uuid.optional(),reference:z.string().trim().min(3).max(100),direction:z.enum(['IN','OUT']),amount:positiveMoney,note:z.string().trim().min(3).max(500)}).strict();
export const platformPageSchema=z.object({slug:z.string().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),title:name.max(160),body:z.string().trim().min(1).max(100000),status:z.enum(['DRAFT','PUBLISHED','ARCHIVED'])}).strict();
export const platformSettingsSchema=z.object({platformName:name,supportEmail:email,footerText:z.string().trim().max(300),maintenanceMode:z.boolean(),publicPagesEnabled:z.boolean(),sessionMinutes:z.coerce.number().int().min(15).max(480)}).strict();
export const platformDisabledSchema=z.object({disabled:z.boolean()}).strict();
export const platformUserSchema=z.object({displayName:name,disabled:z.boolean()}).strict();
export const platformPasswordChangeSchema=z.object({currentPassword:z.string().min(1).max(128),newPassword:platformPasswordSchema}).strict();
export const contactSchema=z.object({name:name,email,message:z.string().trim().min(10).max(5000)}).strict();
