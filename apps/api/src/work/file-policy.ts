import {BadRequestException} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import {documentExtensions} from '@work/shared-schemas';
import {environment} from '../config/environment';
export async function organizationFilePolicy(tx:Prisma.TransactionClient,organizationId:string){
 const settings=await tx.organizationSettings.findUnique({where:{organizationId},select:{filePolicyVersion:true,documentMaxBytes:true,documentAllowedExtensions:true}});
 return {version:settings?.filePolicyVersion??1,maxFileBytes:settings?.documentMaxBytes??null,effectiveMaxFileBytes:Math.min(settings?.documentMaxBytes??environment.DOCUMENT_MAX_BYTES,environment.DOCUMENT_MAX_BYTES),systemMaxFileBytes:environment.DOCUMENT_MAX_BYTES,allowedExtensions:settings?.documentAllowedExtensions??[...documentExtensions],supportedExtensions:[...documentExtensions]};
}
export async function assertOrganizationFile(tx:Prisma.TransactionClient,organizationId:string,file:{filename:string;bytes:number}){
 const policy=await organizationFilePolicy(tx,organizationId),extension=file.filename.split('.').at(-1)!.toLowerCase();
 if(!policy.allowedExtensions.includes(extension))throw new BadRequestException({code:'FILE_POLICY_TYPE_REJECTED',message:'The organization does not allow this file type'});
 if(file.bytes>policy.effectiveMaxFileBytes)throw new BadRequestException({code:'FILE_POLICY_SIZE_REJECTED',message:'The file exceeds the organization upload limit'});
}
