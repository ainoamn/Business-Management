import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error:unknown,host:ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const detail = error instanceof HttpException ? error.getResponse() : null;
    if (request.path === '/api/v1/health/ready' && status === 503) return response.status(status).json(detail);
    if (status === 500) console.error(JSON.stringify({event:'request_failed',requestId:response.getHeader('x-request-id')}));
    const code=status!==500&&detail&&typeof detail==='object'&&'code' in detail&&typeof detail.code==='string'&&/^[A-Z][A-Z0-9_]{2,59}$/.test(detail.code)?detail.code:undefined;
    return response.status(status).json({statusCode:status,code,message:status===500?'Internal server error':error instanceof HttpException?error.message:'Request failed',requestId:response.getHeader('x-request-id')});
  }
}
