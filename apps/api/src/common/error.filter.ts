import {randomUUID} from 'node:crypto';
import type {PrismaService} from '../database/prisma.service';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private pending=0;
  constructor(private readonly db?:PrismaService){}
  catch(error:unknown,host:ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const detail = error instanceof HttpException ? error.getResponse() : null;
    if (request.path === '/api/v1/health/ready' && status === 503) return response.status(status).json(detail);
    if(status>=500){
      const id=String(response.getHeader('x-request-id')??''),requestId=/^[a-f0-9-]{36}$/i.test(id)?id:randomUUID();console.error(JSON.stringify({event:'request_failed',requestId}));
      const pattern=(request.route as {path?:unknown}|undefined)?.path,route=typeof pattern==='string'?pattern.slice(0,200):'unmatched',databaseCode=error&&typeof error==='object'&&'code' in error&&typeof error.code==='string'&&/^P[0-9]{4}$/.test(error.code)?error.code:null;
      if(this.db&&this.pending<20){this.pending++;void this.db.systemEvent.createMany({data:[{requestId,category:databaseCode??'SERVER_ERROR',method:request.method.slice(0,10),route}]}).catch(()=>undefined).finally(()=>{this.pending--;});}
    }
    const code=status!==500&&detail&&typeof detail==='object'&&'code' in detail&&typeof detail.code==='string'&&/^[A-Z][A-Z0-9_]{2,59}$/.test(detail.code)?detail.code:undefined;
    return response.status(status).json({statusCode:status,code,message:status===500?'Internal server error':error instanceof HttpException?error.message:'Request failed',requestId:response.getHeader('x-request-id')});
  }
}
