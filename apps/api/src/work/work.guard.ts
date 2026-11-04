import {CanActivate,ExecutionContext,ForbiddenException,Injectable} from '@nestjs/common';
import type {Request} from 'express';
import {IdentityService,type WorkIdentity} from './identity.service';
import {environment} from '../config/environment';
import {matchesCsrf,originAllowed} from '../common/credentials';
export type WorkRequest=Request & {workIdentity:WorkIdentity;workToken:string};
export function assertWorkOrigin(request:Request){if(!originAllowed(request.get('origin'),environment.WEB_ORIGIN,environment.DEPLOYMENT_ENV==='development'))throw new ForbiddenException('Untrusted origin');}
@Injectable()
export class WorkGuard implements CanActivate {
  constructor(private readonly identity:IdentityService){}
  async canActivate(context:ExecutionContext){const request=context.switchToHttp().getRequest<WorkRequest>();const result=await this.identity.authenticate(request);request.workIdentity=result.identity;request.workToken=result.token;if(!['GET','HEAD','OPTIONS'].includes(request.method)){assertWorkOrigin(request);if(!matchesCsrf(result.token,request.get('x-csrf-token')))throw new ForbiddenException('CSRF validation failed');}return true;}
}
