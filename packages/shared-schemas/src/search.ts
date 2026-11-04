import {z} from 'zod';
export const searchKinds=['tasks','projects','meetings','requests','documents','members','departments','workflows','expenses','budgets'] as const;
export const searchQuerySchema=z.object({q:z.string().trim().min(2).max(100),kind:z.enum(['all',...searchKinds]).default('all'),page:z.coerce.number().int().min(1).max(1000).default(1),pageSize:z.coerce.number().int().min(1).max(50).default(10)}).strict();
export type SearchQuery=z.infer<typeof searchQuerySchema>;
