import {z} from 'zod';
import {workQuerySchema} from './work';
const uuid=z.string().uuid().toLowerCase(),optionalId=uuid.nullable().default(null),date=z.string().datetime({offset:true});
export const financeCurrencies=['OMR','USD','AED','SAR','QAR','KWD','BHD'] as const;
// SIX ISO 4217 List One, published 2026-09-17, checked 2026-11-03.
// https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml
export const financeMinorUnits={OMR:3,USD:2,AED:2,SAR:2,QAR:2,KWD:3,BHD:3} as const;
const amount=z.string().regex(/^\d{1,15}(?:\.\d{1,3})?$/);
const budget=z.object({name:z.string().trim().min(2).max(180),projectId:optionalId,currency:z.enum(financeCurrencies).default('OMR'),amount,startsAt:date,endsAt:date}).strict();
const budgetDates=(value:{startsAt:string;endsAt:string})=>new Date(value.endsAt)>=new Date(value.startsAt);
export const budgetSchema=budget.refine(budgetDates,{message:'Budget dates are reversed'});
export const budgetUpdateSchema=budget.extend({version:z.number().int().positive()}).refine(budgetDates,{message:'Budget dates are reversed'});
export const budgetQuerySchema=workQuerySchema.extend({projectId:uuid.optional(),view:z.enum(['active','archived']).default('active')}).strict();
export type BudgetQuery=z.infer<typeof budgetQuerySchema>;
const expense=z.object({title:z.string().trim().min(2).max(180),projectId:optionalId,taskId:optionalId,budgetId:optionalId,supplier:z.string().trim().max(180).default(''),category:z.string().trim().max(80).default(''),currency:z.enum(financeCurrencies).default('OMR'),amount,exchangeRate:z.string().regex(/^\d{1,11}(?:\.\d{1,9})?$/).default('1'),rateSource:z.string().trim().max(300).default(''),rateDate:date.nullable().default(null),expenseDate:date,approverId:uuid}).strict();
export const expenseSchema=expense;
export const expenseUpdateSchema=expense.extend({version:z.number().int().positive()});
export const expenseQuerySchema=workQuerySchema.extend({projectId:uuid.optional(),budgetId:uuid.optional(),status:z.enum(['DRAFT','PENDING','APPROVED','REJECTED','CANCELLED','REVERSED']).optional(),view:z.enum(['all','mine','approval']).default('all'),from:date.optional(),to:date.optional()}).strict();
export type ExpenseQuery=z.infer<typeof expenseQuerySchema>;
export const expenseActionSchema=z.object({action:z.enum(['SUBMIT','APPROVE','REJECT','CANCEL','REVERSE']),version:z.number().int().positive(),reason:z.string().trim().max(2000).default(''),overrideBudget:z.boolean().default(false)}).strict();
export const expenseAllocationSchema=z.object({budgetId:uuid.nullable(),version:z.number().int().positive(),reason:z.string().trim().min(1).max(2000)}).strict();
