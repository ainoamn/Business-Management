import {Body,Controller,Delete,Get,Param,Patch,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import type {Response} from 'express';
import {budgetQuerySchema,expenseQuerySchema,organizationIdSchema,workQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {FinanceService} from './finance.service';
import {WorkGuard,type WorkRequest} from './work.guard';
const uuid=(value:string)=>validate(organizationIdSchema,value);
const requestId=(response:Response)=>String(response.getHeader('x-request-id'));
@UseGuards(WorkGuard)
@Controller('work/organizations/:organizationId')
export class FinanceController{
  constructor(private readonly finance:FinanceService){}
  @Get('budgets') budgets(@Param('organizationId') org:string,@Query() query:unknown,@Req() request:WorkRequest){return this.finance.budgets(request.workIdentity,uuid(org),validate(budgetQuerySchema,query));}
  @Post('budgets') createBudget(@Param('organizationId') org:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.finance.saveBudget(request.workIdentity,uuid(org),undefined,body,requestId(response));}
  @Get('budgets/:id') budget(@Param('organizationId') org:string,@Param('id') id:string,@Req() request:WorkRequest){return this.finance.budgetDetail(request.workIdentity,uuid(org),uuid(id));}
  @Patch('budgets/:id') updateBudget(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.finance.saveBudget(request.workIdentity,uuid(org),uuid(id),body,requestId(response));}
  @Delete('budgets/:id') archiveBudget(@Param('organizationId') org:string,@Param('id') id:string,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.finance.archiveBudget(request.workIdentity,uuid(org),uuid(id),false,requestId(response));}
  @Post('budgets/:id/restore') restoreBudget(@Param('organizationId') org:string,@Param('id') id:string,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.finance.archiveBudget(request.workIdentity,uuid(org),uuid(id),true,requestId(response));}
  @Get('budgets/:id/history') budgetHistory(@Param('organizationId') org:string,@Param('id') id:string,@Query() query:unknown,@Req() request:WorkRequest){return this.finance.history(request.workIdentity,uuid(org),'budgets',uuid(id),validate(workQuerySchema,query));}
  @Get('expenses') expenses(@Param('organizationId') org:string,@Query() query:unknown,@Req() request:WorkRequest){return this.finance.expenses(request.workIdentity,uuid(org),validate(expenseQuerySchema,query));}
  @Post('expenses') createExpense(@Param('organizationId') org:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.finance.saveExpense(request.workIdentity,uuid(org),undefined,body,requestId(response));}
  @Get('expenses/:id') expense(@Param('organizationId') org:string,@Param('id') id:string,@Req() request:WorkRequest){return this.finance.expenseDetail(request.workIdentity,uuid(org),uuid(id));}
  @Patch('expenses/:id') updateExpense(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.finance.saveExpense(request.workIdentity,uuid(org),uuid(id),body,requestId(response));}
  @Post('expenses/:id/action') action(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.finance.action(request.workIdentity,uuid(org),uuid(id),body,requestId(response));}
  @Post('expenses/:id/allocate') allocate(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() request:WorkRequest,@Res({passthrough:true}) response:Response){return this.finance.allocate(request.workIdentity,uuid(org),uuid(id),body,requestId(response));}
  @Get('expenses/:id/history') expenseHistory(@Param('organizationId') org:string,@Param('id') id:string,@Query() query:unknown,@Req() request:WorkRequest){return this.finance.history(request.workIdentity,uuid(org),'expenses',uuid(id),validate(workQuerySchema,query));}
  @Get('finance/report') report(@Param('organizationId') org:string,@Query() query:unknown,@Req() request:WorkRequest){return this.finance.report(request.workIdentity,uuid(org),validate(expenseQuerySchema,query));}
}
