import {z} from 'zod';
import {workQuerySchema} from './work';
export const approvalKinds=['task-review','task-approval','meeting','request','expense'] as const;
export const approvalQuerySchema=workQuerySchema.extend({kind:z.enum(['all',...approvalKinds]).default('all')});
export type ApprovalQuery=z.infer<typeof approvalQuerySchema>;
