import {Controller,Get,Param,Query,Req,UseGuards} from '@nestjs/common';
import {organizationIdSchema,searchQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {WorkGuard,type WorkRequest} from './work.guard';
import {SearchService} from './search.service';
@UseGuards(WorkGuard)
@Controller('work/organizations/:organizationId/search')
export class SearchController{
 constructor(private readonly search:SearchService){}
 @Get() find(@Param('organizationId') org:string,@Query() q:unknown,@Req() r:WorkRequest){return this.search.search(r.workIdentity,validate(organizationIdSchema,org),validate(searchQuerySchema,q));}
}
