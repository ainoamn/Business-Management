import {BadRequestException,Injectable,NotFoundException} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import {PrismaService} from '../database/prisma.service';
import {OrganizationService} from '../work/organization.service';
import {requireGlobal} from '../work/access';
import type {WorkIdentity} from '../work/identity.service';
import {
  CalendarProvider,
  DriveProvider,
  TeamsProvider,
  SsoProvider,
  UnconfiguredCalendarProvider,
  UnconfiguredDriveProvider,
  UnconfiguredTeamsProvider,
  UnconfiguredSsoProvider
} from './providers';

export type IntegrationKind='CALENDAR'|'DRIVE'|'TEAMS'|'SSO_GOOGLE'|'SSO_MICROSOFT'|'SSO_OKTA';

@Injectable()
export class IntegrationsService {
  // Provider instances (all unconfigured by default)
  calendar:CalendarProvider=new UnconfiguredCalendarProvider();
  drive:DriveProvider=new UnconfiguredDriveProvider();
  teams:TeamsProvider=new UnconfiguredTeamsProvider();
  ssoGoogle:SsoProvider=new UnconfiguredSsoProvider();
  ssoMicrosoft:SsoProvider=new UnconfiguredSsoProvider();
  ssoOkta:SsoProvider=new UnconfiguredSsoProvider();

  constructor(
    private readonly db:PrismaService,
    private readonly organizations:OrganizationService
  ){}

  /**
   * List all integrations for an organization.
   */
  async list(user:WorkIdentity,organizationId:string){
    return this.organizations.execute(user,organizationId,async(tx,access)=>{
      requireGlobal(access,'organization.manage');
      
      const integrations=await tx.organizationIntegration.findMany({
        where:{organizationId},
        select:{id:true,kind:true,status:true,createdAt:true,updatedAt:true}
      });

      const allKinds:IntegrationKind[]=['CALENDAR','DRIVE','TEAMS','SSO_GOOGLE','SSO_MICROSOFT','SSO_OKTA'];
      const existing=new Set(integrations.map(i=>i.kind));
      
      // Add missing kinds as DISCONNECTED
      const full=allKinds.map(kind=>
        integrations.find(i=>i.kind===kind)||{
          id:null,
          kind,
          status:'DISCONNECTED',
          createdAt:null,
          updatedAt:null
        }
      );

      return full;
    });
  }

  /**
   * Connect an integration (stub - returns NOT_CONFIGURED error).
   */
  async connect(user:WorkIdentity,organizationId:string,kind:IntegrationKind,config:unknown){
    return this.organizations.execute(user,organizationId,async(tx,access)=>{
      requireGlobal(access,'organization.manage');
      
      // Check if secrets/credentials exist for this integration type
      // For now, all integrations are unconfigured
      throw new BadRequestException({code:`${kind}_NOT_CONFIGURED`,message:'Integration is not configured on this server'});
    });
  }

  /**
   * Disconnect an integration.
   */
  async disconnect(user:WorkIdentity,organizationId:string,kind:IntegrationKind){
    return this.organizations.execute(user,organizationId,async(tx,access)=>{
      requireGlobal(access,'organization.manage');
      
      const integration=await tx.organizationIntegration.findUnique({
        where:{organizationId_kind:{organizationId,kind}}
      });

      if(!integration){
        throw new NotFoundException('Integration not found');
      }

      await tx.organizationIntegration.update({
        where:{id:integration.id},
        data:{status:'DISCONNECTED',configEnc:null}
      });

      return {ok:true};
    });
  }
}
