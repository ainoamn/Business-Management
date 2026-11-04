import {ForbiddenException} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
export const platformFlagKeys=['AI','AUTOMATION','PORTFOLIOS','WORKLOAD'] as const;
export type PlatformFlagKey=typeof platformFlagKeys[number];
export async function requirePlatformFlag(tx:Prisma.TransactionClient,key:PlatformFlagKey){
 if((await tx.platformFeatureFlag.findUnique({where:{key},select:{enabled:true}}))?.enabled===false)throw new ForbiddenException({code:'FEATURE_TEMPORARILY_DISABLED',message:'This feature is temporarily disabled by the platform operator'});
}
