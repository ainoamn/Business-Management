import {Body,CallHandler,Controller,Delete,ExecutionContext,Get,HttpException,Injectable,NestInterceptor,Param,Patch,Post,Query,Req,Res,UploadedFile,UseGuards,UseInterceptors} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import type {Response} from 'express';
import {finalize} from 'rxjs';
import {pipeline} from 'node:stream/promises';
import {documentQuerySchema,folderQuerySchema,organizationIdSchema,workQuerySchema} from '@work/shared-schemas';
import {validate} from '../common/validation';
import {environment} from '../config/environment';
import {DocumentService} from './document.service';
import type {DocumentFileInput} from './document-files';
import {IdentityService} from './identity.service';
import {WorkGuard,type WorkRequest} from './work.guard';
const uuid=(id:string)=>validate(organizationIdSchema,id);
const requestId=(response:Response)=>String(response.getHeader('x-request-id'));
@Injectable()
export class DocumentUploadInterceptor implements NestInterceptor{
 private active=0;
 constructor(private readonly identity:IdentityService,private readonly documents:DocumentService){}
 async intercept(context:ExecutionContext,next:CallHandler){if(this.active>=4)throw new HttpException('Uploads busy; retry shortly',429);const request=context.switchToHttp().getRequest<WorkRequest>();await this.documents.usage(request.workIdentity,uuid(request.params.organizationId as string));await this.identity.limit('DOCUMENT_UPLOAD',request.workIdentity.id,request,{identity:40,ip:200});if(this.active>=4)throw new HttpException('Uploads busy; retry shortly',429);this.active++;request.setTimeout(120000);return next.handle().pipe(finalize(()=>{this.active--;}));}
}
@UseGuards(WorkGuard)
@Controller('work/organizations/:organizationId')
export class DocumentController{
 constructor(private readonly documents:DocumentService){}
 @Get('documents/usage') usage(@Param('organizationId') org:string,@Req() r:WorkRequest){return this.documents.usage(r.workIdentity,uuid(org));}
 @Get('folders') folders(@Param('organizationId') org:string,@Query() q:unknown,@Req() r:WorkRequest){return this.documents.folders(r.workIdentity,uuid(org),validate(folderQuerySchema,q));}
 @Post('folders') createFolder(@Param('organizationId') org:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.documents.saveFolder(r.workIdentity,uuid(org),undefined,body,requestId(response));}
 @Get('folders/:id') folder(@Param('organizationId') org:string,@Param('id') id:string,@Req() r:WorkRequest){return this.documents.folder(r.workIdentity,uuid(org),uuid(id));}
 @Patch('folders/:id') updateFolder(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.documents.saveFolder(r.workIdentity,uuid(org),uuid(id),body,requestId(response));}
 @Delete('folders/:id') archiveFolder(@Param('organizationId') org:string,@Param('id') id:string,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.documents.archiveFolder(r.workIdentity,uuid(org),uuid(id),false,requestId(response));}
 @Post('folders/:id/restore') restoreFolder(@Param('organizationId') org:string,@Param('id') id:string,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.documents.archiveFolder(r.workIdentity,uuid(org),uuid(id),true,requestId(response));}
 @Get('folders/:id/shares') folderShares(@Param('organizationId') org:string,@Param('id') id:string,@Query() q:unknown,@Req() r:WorkRequest){return this.documents.folderShares(r.workIdentity,uuid(org),uuid(id),validate(workQuerySchema,q));}
 @Post('folders/:id/shares') shareFolder(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.documents.share(r.workIdentity,uuid(org),uuid(id),true,body,false,requestId(response));}
 @Delete('folders/:id/shares') revokeFolderShare(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.documents.share(r.workIdentity,uuid(org),uuid(id),true,body,true,requestId(response));}
 @Get('documents') documentsList(@Param('organizationId') org:string,@Query() q:unknown,@Req() r:WorkRequest){return this.documents.documents(r.workIdentity,uuid(org),validate(documentQuerySchema,q));}
 @Post('documents/upload')
 @UseInterceptors(DocumentUploadInterceptor,FileInterceptor('file',{limits:{fileSize:environment.DOCUMENT_MAX_BYTES,files:1,fields:1,fieldSize:32768,parts:2}}))
 upload(@Param('organizationId') org:string,@Body() body:{payload?:string},@UploadedFile() file:DocumentFileInput,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){let payload:unknown;try{payload=JSON.parse(body.payload??'');}catch{throw new HttpException('Invalid upload metadata',400);}return this.documents.upload(r,uuid(org),payload,file,requestId(response));}
 @Get('documents/:id') detail(@Param('organizationId') org:string,@Param('id') id:string,@Req() r:WorkRequest){return this.documents.detail(r.workIdentity,uuid(org),uuid(id));}
 @Patch('documents/:id') update(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.documents.update(r.workIdentity,uuid(org),uuid(id),body,requestId(response));}
 @Delete('documents/:id') archive(@Param('organizationId') org:string,@Param('id') id:string,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.documents.archive(r.workIdentity,uuid(org),uuid(id),false,requestId(response));}
 @Post('documents/:id/restore') restore(@Param('organizationId') org:string,@Param('id') id:string,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.documents.archive(r.workIdentity,uuid(org),uuid(id),true,requestId(response));}
 @Get('documents/:id/versions') versions(@Param('organizationId') org:string,@Param('id') id:string,@Query() q:unknown,@Req() r:WorkRequest){return this.documents.collection(r.workIdentity,uuid(org),uuid(id),'versions',validate(workQuerySchema,q));}
 @Get('documents/:id/comments') comments(@Param('organizationId') org:string,@Param('id') id:string,@Query() q:unknown,@Req() r:WorkRequest){return this.documents.collection(r.workIdentity,uuid(org),uuid(id),'comments',validate(workQuerySchema,q));}
 @Get('documents/:id/history') history(@Param('organizationId') org:string,@Param('id') id:string,@Query() q:unknown,@Req() r:WorkRequest){return this.documents.collection(r.workIdentity,uuid(org),uuid(id),'history',validate(workQuerySchema,q));}
 @Get('documents/:id/shares') shares(@Param('organizationId') org:string,@Param('id') id:string,@Query() q:unknown,@Req() r:WorkRequest){return this.documents.collection(r.workIdentity,uuid(org),uuid(id),'shares',validate(workQuerySchema,q));}
 @Post('documents/:id/comments') comment(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest){return this.documents.comment(r.workIdentity,uuid(org),uuid(id),body);}
 @Post('documents/:id/shares') share(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.documents.share(r.workIdentity,uuid(org),uuid(id),false,body,false,requestId(response));}
 @Delete('documents/:id/shares') revokeShare(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.documents.share(r.workIdentity,uuid(org),uuid(id),false,body,true,requestId(response));}
 @Post('documents/:id/links') link(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.documents.link(r.workIdentity,uuid(org),uuid(id),body,undefined,requestId(response));}
 @Delete('documents/:id/links/:linkId') unlink(@Param('organizationId') org:string,@Param('id') id:string,@Param('linkId') linkId:string,@Req() r:WorkRequest,@Res({passthrough:true}) response:Response){return this.documents.link(r.workIdentity,uuid(org),uuid(id),undefined,uuid(linkId),requestId(response));}
 @Post('documents/:id/download-link') downloadLink(@Param('organizationId') org:string,@Param('id') id:string,@Body() body:unknown,@Req() r:WorkRequest){return this.documents.downloadLink(r.workIdentity,uuid(org),uuid(id),r.workToken,body);}
 @Get('documents/:id/download') async download(@Param('organizationId') org:string,@Param('id') id:string,@Query() q:unknown,@Req() r:WorkRequest,@Res() response:Response){const result=await this.documents.download(r.workIdentity,uuid(org),uuid(id),r.workToken,q);response.setHeader('Cache-Control','private, no-store');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Content-Security-Policy',"sandbox; default-src 'none'; frame-ancestors 'self'");if(result.kind==='text')return response.json(result);response.setHeader('Content-Type',result.mime);response.setHeader('Content-Length',result.bytes);response.setHeader('Content-Disposition',`${result.inline?'inline':'attachment'}; filename="document"; filename*=UTF-8''${encodeURIComponent(result.filename)}`);try{await pipeline(result.stream,response);}catch{result.stream.destroy();if(!response.headersSent)throw new HttpException('Document download unavailable',503);response.destroy();}}
}
