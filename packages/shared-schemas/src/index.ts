import { z } from 'zod';
export * from './platform';
export * from './work';
export * from './execution';
export * from './operations';
export * from './finance';
export * from './documents';

export const organizationIdSchema = z.string().uuid().toLowerCase();
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEPLOYMENT_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().url().refine(v => /^postgres(ql)?:\/\//.test(v), 'PostgreSQL URL required'),
  REDIS_URL: z.string().url().refine(v => /^rediss?:\/\//.test(v), 'Redis URL required'),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(3),
  S3_SECRET_KEY: z.string().min(16),
  MAIL_DELIVERY_MODE:z.enum(['outbox','smtp']).default('outbox'),
  SMTP_URL:z.string().url().optional(),
  SMTP_FROM:z.string().email().optional(),
  DOCUMENT_STORAGE_MODE:z.enum(['local','s3']).optional(),
  DOCUMENT_LOCAL_ROOT:z.string().min(1).optional(),
  DOCUMENT_MAX_BYTES:z.coerce.number().int().min(1024).max(104857600).default(26214400),
  DOCUMENT_SCANNER_MODE:z.enum(['none','clamav']).default('none'),
  CLAMAV_HOST:z.string().min(1).max(253).default('127.0.0.1'),
  CLAMAV_PORT:z.coerce.number().int().min(1).max(65535).default(3310),
  AI_CREDENTIAL_KEY:z.string().min(32).optional(),
  MFA_CREDENTIAL_KEY:z.string().min(32).optional(),
  SMS_PROVIDER_URL:z.string().url().optional(),
  WHATSAPP_PROVIDER_URL:z.string().url().optional(),
  VAPID_PUBLIC_KEY:z.string().optional(),
  VAPID_PRIVATE_KEY:z.string().optional(),
  PAYMENT_ENDPOINT:z.string().url().optional(),
  PAYMENT_API_KEY:z.string().min(8).optional(),
  PAYMENT_WEBHOOK_SECRET:z.string().min(16).optional(),
  PAYMENT_MODE:z.enum(['SANDBOX','LIVE']).optional(),
  PAYMENT_CHECKOUT_HOSTS:z.string().min(1).optional(),
  BHD_IDENTITY_ISSUER:z.string().url().optional(),
  BHD_OAUTH_CLIENT_ID:z.string().min(1).optional(),
  BHD_OAUTH_CLIENT_SECRET:z.string().min(8).optional(),
  BHD_OAUTH_REDIRECT_URI:z.string().url().optional(),
  BHD_IDENTITY_TOKEN_SECRET:z.string().min(16).optional(),
}).superRefine((env, ctx) => {
  if (env.DEPLOYMENT_ENV !== 'development' && env.NODE_ENV !== 'test') {
    if(env.DOCUMENT_STORAGE_MODE==='local')ctx.addIssue({code:'custom',path:['DOCUMENT_STORAGE_MODE'],message:'Local document storage is limited to development'});
    for (const key of ['WEB_ORIGIN', 'S3_ENDPOINT'] as const) {
      if (!env[key].startsWith('https://')) ctx.addIssue({code:'custom',path:[key],message:'HTTPS required outside development'});
    }
    if (env.NODE_ENV !== 'production') ctx.addIssue({code:'custom',path:['NODE_ENV'],message:'Use production mode for staging and production'});
  }
});
export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    // Values are deliberately omitted so startup diagnostics never reveal secrets.
    throw new Error(`Invalid environment: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  return result.data;
}
export * from './workflows';
export * from './search';
export * from './reports';
export * from './ai';
export * from './billing';
export * from './portfolios';
export * from './approvals';
export * from './workload';

export * from './integrations';
