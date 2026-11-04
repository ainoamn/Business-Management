import {z} from 'zod';
import {workQuerySchema} from './work';
const uuid=z.string().uuid().toLowerCase(),date=z.iso.date();
export const workloadQuerySchema=workQuerySchema.extend({from:date.optional(),to:date.optional(),departmentId:uuid.optional(),teamId:uuid.optional(),membershipId:uuid.optional()}).superRefine((data,ctx)=>{if(Boolean(data.from)!==Boolean(data.to)||data.from&&data.to&&(data.from>data.to||Date.parse(data.to)-Date.parse(data.from)>91*86400000))ctx.addIssue({code:'custom',path:['to'],message:'Choose an ordered date range up to 92 days'});});
const base=z.object({membershipId:uuid,from:date,to:date,minutesPerDay:z.number().int().min(0).max(1440),reason:z.string().trim().min(5).max(500)}).strict();
const valid=(data:{from:string;to:string})=>data.from<=data.to&&Date.parse(data.to)-Date.parse(data.from)<=365*86400000;
export const capacitySchema=base.refine(valid,{path:['to'],message:'Choose an ordered range up to 366 days'});
export const capacityUpdateSchema=base.extend({version:z.number().int().positive()}).refine(valid,{path:['to'],message:'Choose an ordered range up to 366 days'});
export type WorkloadQuery=z.infer<typeof workloadQuerySchema>;
