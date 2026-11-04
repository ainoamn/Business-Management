import {Body,Controller,Delete,Get,Param,Post,Req,UseGuards} from '@nestjs/common';
import {organizationIdSchema,integrationKindSchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {WorkGuard,type WorkRequest} from '../work/work.guard';
import {IntegrationsService,type IntegrationKind} from './integrations.service';

const uuid=(value:string)=>validate(organizationIdSchema,value);

@Controller('work/organizations/:organizationId/integrations')
@UseGuards(WorkGuard)
export class IntegrationsController {
  constructor(private readonly integrations:IntegrationsService){}

  @Get()
  list(@Req()request:WorkRequest,@Param('organizationId')organizationId:string){
    return this.integrations.list(request.workIdentity,uuid(organizationId));
  }

  @Post(':kind/connect')
  connect(
    @Req()request:WorkRequest,
    @Param('organizationId')organizationId:string,
    @Param('kind')kind:IntegrationKind,
    @Body()body:unknown
  ){
    return this.integrations.connect(request.workIdentity,uuid(organizationId),validate(integrationKindSchema,kind),body);
  }

  @Delete(':kind')
  disconnect(
    @Req()request:WorkRequest,
    @Param('organizationId')organizationId:string,
    @Param('kind')kind:IntegrationKind
  ){
    return this.integrations.disconnect(request.workIdentity,uuid(organizationId),validate(integrationKindSchema,kind));
  }
}
