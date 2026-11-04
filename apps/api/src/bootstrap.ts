import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { environment } from './config/environment';
import { ErrorFilter } from './common/error.filter';
import {json,raw} from 'express';

export async function createApp() {
  const app = await NestFactory.create(AppModule,{logger:['error','warn','log'],bodyParser:false});
  app.use('/api/v1/public/billing/webhooks',raw({type:'*/*',limit:'65536'}));
  app.use(json({limit:'512kb'}));
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use((_req:Request,res:Response,next:NextFunction)=>{
    res.setHeader('X-Request-ID',randomUUID());
    res.setHeader('Cache-Control','no-store');
    next();
  });
  app.enableCors({origin:environment.WEB_ORIGIN,credentials:true,methods:['GET','HEAD','OPTIONS','POST','PATCH','DELETE']});
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  if (environment.DEPLOYMENT_ENV === 'development') {
    SwaggerModule.setup('api/docs',app,SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('Work Management Platform API').setVersion('0.1.0').build()));
  }
  return app;
}
