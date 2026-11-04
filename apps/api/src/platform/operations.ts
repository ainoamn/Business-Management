import {z} from 'zod';
import {platformFlagKeys} from './feature-policy';
import {ConflictException} from '@nestjs/common';
import type {Response} from 'express';
import {Controller,Get,Patch,Param,Body,Res,Injectable,Query,Req,UseGuards,ForbiddenException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {platformQuerySchema,type PlatformPermission,type PlatformQuery} from '@work/shared-schemas';
import type {PlatformActor} from '@work/shared-types';
import {PrismaService} from '../database/prisma.service';
import {PlatformGuard,type PlatformRequest} from './platform.auth';
import {authorize,validate} from './validation';

@Injectable()
export class PlatformOperationsService{
 constructor(private readonly db:PrismaService){}
 private async read<T>(actor:PlatformActor,permission:PlatformPermission,operation:(tx:Prisma.TransactionClient)=>Promise<T>){
  authorize(actor,permission);return this.db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.platform_account_id',${actor.id},true)`;await tx.$executeRaw`SELECT set_config('app.platform_session_id',${actor.sessionId},true)`;
   const [row]=await tx.$queryRaw<Array<{allowed:boolean}>>`SELECT platform_ops_can(${permission}) AS allowed`;if(!row?.allowed)throw new ForbiddenException('Permission denied');return operation(tx);
  },{timeout:15000});
 }
 flags(actor:PlatformActor){return this.read(actor,'settings.read',async tx=>{
  const rows=await tx.platformFeatureFlag.findMany(),history=await tx.platformFlagChange.findMany({orderBy:[{createdAt:'desc'},{id:'asc'}],take:20});
  return {items:platformFlagKeys.map(key=>rows.find(row=>row.key===key)??{key,enabled:true,version:0,reason:'',updatedAt:null}),history};
 });}
 saveFlag(actor:PlatformActor,key:typeof platformFlagKeys[number],body:unknown,requestId:string){const data=validate(z.object({enabled:z.boolean(),version:z.number().int().min(0),reason:z.string().trim().min(5).max(500)}).strict(),body);return this.read(actor,'settings.manage',async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'platform_flag:'+key}))`;const previous=await tx.platformFeatureFlag.findUnique({where:{key}});if((previous?.version??0)!==data.version)throw new ConflictException('Feature setting changed. Reload before saving.');
  const updated=await tx.platformFeatureFlag.upsert({where:{key},create:{key,enabled:data.enabled,reason:data.reason,updatedBy:actor.id},update:{enabled:data.enabled,reason:data.reason,updatedBy:actor.id,version:{increment:1}}});
  await tx.platformFlagChange.create({data:{key,enabled:updated.enabled,previousEnabled:previous?.enabled??true,version:updated.version,reason:data.reason,actorId:actor.id}});await tx.platformAudit.create({data:{actorId:actor.id,requestId,action:updated.enabled?'FEATURE_ENABLED':'FEATURE_DISABLED',resource:'feature_flag:'+key,resourceId:updated.id}});return updated;
 });}
 storage(actor:PlatformActor,q:PlatformQuery){return this.read(actor,'storage.read',async tx=>{
  const rows=await tx.$queryRaw<Array<{id:string;name:string;used_bytes:bigint;reserved_bytes:bigint;documents:bigint;versions:bigint;total_count:bigint}>>`SELECT * FROM platform_storage_usage(${q.search},${q.pageSize}::int,${(q.page-1)*q.pageSize}::int)`;
  return {items:rows.map(row=>({id:row.id,name:row.name,usedBytes:row.used_bytes.toString(),reservedBytes:row.reserved_bytes.toString(),documents:Number(row.documents),versions:Number(row.versions)})),total:Number(rows[0]?.total_count??0),page:q.page,pageSize:q.pageSize};
 });}
 errors(actor:PlatformActor,q:PlatformQuery){return this.read(actor,'monitoring.read',async tx=>{
  const where={...(q.search?{OR:[{route:{contains:q.search,mode:'insensitive' as const}},{category:{contains:q.search,mode:'insensitive' as const}},.../^[a-f0-9-]{36}$/i.test(q.search)?[{requestId:q.search}]:[]]}:{})};
  return {items:await tx.systemEvent.findMany({where,orderBy:[{createdAt:'desc'},{id:'asc'}],skip:(q.page-1)*q.pageSize,take:q.pageSize}),total:await tx.systemEvent.count({where}),page:q.page,pageSize:q.pageSize};
 });}
}
@Controller('platform/operations')
@UseGuards(PlatformGuard)
export class PlatformOperationsController{
 constructor(private readonly operations:PlatformOperationsService){}
 @Get('flags') flags(@Req() request:PlatformRequest){return this.operations.flags(request.platformActor);}
 @Patch('flags/:key') flag(@Req() request:PlatformRequest,@Param('key') key:string,@Body() body:unknown,@Res({passthrough:true}) response:Response){return this.operations.saveFlag(request.platformActor,validate(z.enum(platformFlagKeys),key),body,String(response.getHeader('x-request-id')));}
 @Get('storage') storage(@Req() request:PlatformRequest,@Query() query:unknown){return this.operations.storage(request.platformActor,validate(platformQuerySchema,query));}
 @Get('errors') errors(@Req() request:PlatformRequest,@Query() query:unknown){return this.operations.errors(request.platformActor,validate(platformQuerySchema,query));}
}
