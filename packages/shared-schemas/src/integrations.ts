import {z} from 'zod';
export const integrationKinds=['GOOGLE_CALENDAR','OUTLOOK_CALENDAR','GOOGLE_DRIVE','ONEDRIVE','TEAMS','WHATSAPP_BUSINESS','EMAIL','SMS','PAYMENTS','ACCOUNTING','HR','SSO_GOOGLE','SSO_MICROSOFT','SSO_OKTA'] as const;
// Older organization configurations retain their identifiers until migrated explicitly.
export const legacyIntegrationKinds=['CALENDAR','DRIVE'] as const;
export const integrationKindSchema=z.enum([...integrationKinds,...legacyIntegrationKinds]);
export type IntegrationKind=z.infer<typeof integrationKindSchema>;
