export type Locale = 'ar' | 'en';
export {reportLabel} from './reports';
export type ServiceState = 'up' | 'down';
export interface Readiness {
  status: 'ready' | 'not_ready';
  checks: { database: ServiceState; redis: ServiceState; queue: ServiceState; storage: ServiceState };
  timestamp: string;
}
export interface ApiError {
  statusCode: number;
  message: string;
  requestId: string;
}

export interface PlatformActor {
  id:string;
  email:string;
  displayName:string;
  isOwner:boolean;
  permissions:string[];
  sessionId:string;
}
export interface PlatformSessionView {actor:PlatformActor;csrf:string}
export type PlatformCell=string|number|boolean|null|string[];
export type PlatformRow=Record<string,PlatformCell> & {id:string};
export interface PlatformList {items:PlatformRow[];total:number;page:number;pageSize:number}
export interface WorkUser {id:string;email:string;username:string|null;displayName:string;emailVerified:boolean;sessionId:string}
export interface WorkOrganization {id:string;name:string;slug:string;locale:string;timezone:string;role:string;membership_id:string}
export interface WorkSession {user:WorkUser;organizations:WorkOrganization[];csrf:string;developmentMail:boolean}
export interface WorkspaceAccess {membershipId:string;userId:string;organizationId:string;role:string;branchId:string|null;departmentId:string|null;grants:Array<{permission:string;scope:string;scopeId:string|null}>}
