import {ForbiddenException,Injectable} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import {PrismaService} from '../database/prisma.service';
import type {WorkIdentity} from './identity.service';
@Injectable()
export class WorkflowActorsService{
 constructor(private readonly db:PrismaService){}
 private identity(user:{id:string;email:string;username:string|null;displayName:string;emailVerifiedAt:Date|null;disabledAt:Date|null;deletedAt:Date|null}):WorkIdentity{if(user.disabledAt||user.deletedAt||!user.emailVerifiedAt)throw new ForbiddenException({code:'ACCOUNT_UNAVAILABLE',message:'Automation account unavailable'});return {id:user.id,email:user.email,username:user.username,displayName:user.displayName,emailVerified:true,sessionId:''};}
 /** A scheduled actor has no browser session; the active rule and current membership authorize its work. */
 async user(id:string){const user=await this.db.user.findUnique({where:{id},select:{id:true,email:true,username:true,displayName:true,emailVerifiedAt:true,disabledAt:true,deletedAt:true}});if(!user)throw new ForbiddenException({code:'ACCOUNT_UNAVAILABLE',message:'Automation account unavailable'});return this.identity(user);}
 async member(tx:Prisma.TransactionClient,organizationId:string,id:string){const member=await tx.membership.findFirst({where:{organizationId,id,active:true},include:{user:{select:{id:true,email:true,username:true,displayName:true,emailVerifiedAt:true,disabledAt:true,deletedAt:true}}}});if(!member)throw new ForbiddenException({code:'ACCOUNT_UNAVAILABLE',message:'Automation account unavailable'});return this.identity(member.user);}
}
