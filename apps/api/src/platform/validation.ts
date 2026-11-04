import {BadRequestException,ForbiddenException} from '@nestjs/common';
import type {PlatformActor} from '@work/shared-types';
import type {PlatformPermission} from '@work/shared-schemas';
import {allowed} from './security';

export function validate<T>(schema:{safeParse(input:unknown):{success:true;data:T}|{success:false}},body:unknown):T {
  const result=schema.safeParse(body);
  if(!result.success) throw new BadRequestException('Invalid input');
  return result.data;
}
export function authorize(actor:PlatformActor,permission:PlatformPermission,ownerOnly=false) {
  if(!allowed(actor,permission)||(ownerOnly&&!actor.isOwner)) throw new ForbiddenException('Permission denied');
}
