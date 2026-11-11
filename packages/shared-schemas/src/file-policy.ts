import {z} from 'zod';
export const documentExtensions=['pdf','png','jpg','jpeg','txt','csv','docx','xlsx','pptx'] as const;
export const filePolicySchema=z.object({version:z.number().int().positive().max(2147483646),maxFileBytes:z.number().int().min(1024).max(104857600).nullable(),allowedExtensions:z.array(z.enum(documentExtensions)).min(1).max(documentExtensions.length).refine(values=>new Set(values).size===values.length,'Duplicate extensions')}).strict();
