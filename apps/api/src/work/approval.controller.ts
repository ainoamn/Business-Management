import {Controller,Get,Param,Query,Req,UseGuards} from '@nestjs/common';
import {approvalQuerySchema,organizationIdSchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {WorkGuard,type WorkRequest} from './work.guard';
import {ApprovalService} from './approval.service';
@Controller('work/organizations/:organizationId/approvals')
@UseGuards(WorkGuard)
export class ApprovalController{
 constructor(private readonly approvals:ApprovalService){}
 @Get() pending(@Param('organizationId') org:string,@Query() query:unknown,@Req() r:WorkRequest){return this.approvals.pending(r.workIdentity,validate(organizationIdSchema,org),validate(approvalQuerySchema,query));}
}
