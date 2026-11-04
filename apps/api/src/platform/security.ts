export {hashPassword,verifyPassword,dummyPasswordHash,digest,csrfFor,matchesCsrf,originAllowed} from '../common/credentials';
import {platformPermissions,type PlatformPermission} from '@work/shared-schemas';
import type {PlatformActor} from '@work/shared-types';
export function allowed(actor:PlatformActor,permission:PlatformPermission){return actor.isOwner||actor.permissions.includes(permission);}
export function permissionsFor(owner:boolean,permissions:readonly string[]){return owner?[...platformPermissions]:permissions.filter(p=>platformPermissions.includes(p as PlatformPermission));}
