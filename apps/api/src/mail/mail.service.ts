import {Injectable,OnApplicationBootstrap,OnModuleDestroy,ServiceUnavailableException} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import nodemailer from 'nodemailer';
import {PrismaService} from '../database/prisma.service';
import {environment} from '../config/environment';

export interface MailMessage {recipient:string;subject:string;textBody:string}
export interface MailTransport {send(message:MailMessage):Promise<void>}
class SmtpTransport implements MailTransport {
  private readonly transport=nodemailer.createTransport(environment.SMTP_URL!,{from:environment.SMTP_FROM});
  async send(message:MailMessage){await this.transport.sendMail({to:message.recipient,subject:message.subject,text:message.textBody,from:environment.SMTP_FROM});}
  close(){this.transport.close();}
}
@Injectable()
export class MailService implements OnApplicationBootstrap,OnModuleDestroy {
  private timer?:ReturnType<typeof setInterval>;
  private transport?:SmtpTransport;
  private busy=false;
  constructor(private readonly db:PrismaService){}
  assertAvailable(){if(environment.DEPLOYMENT_ENV!=='development'&&(environment.MAIL_DELIVERY_MODE!=='smtp'||!environment.SMTP_URL||!environment.SMTP_FROM))throw new ServiceUnavailableException('Email delivery must be configured before account operations');}
  async enqueue(tx:Prisma.TransactionClient,message:MailMessage){return tx.emailOutbox.create({data:message});}
  onApplicationBootstrap(){if(environment.MAIL_DELIVERY_MODE==='smtp'&&environment.SMTP_URL&&environment.SMTP_FROM){this.transport=new SmtpTransport();this.timer=setInterval(()=>void this.flush(),15000);this.timer.unref();}}
  async flush(){
    if(this.busy||!this.transport)return;this.busy=true;
    try{for(let i=0;i<20;i++){
      const row=await this.db.$transaction(async tx=>{
        const rows=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM email_outbox WHERE (status='PENDING' OR status='PROCESSING' AND processing_at<now()-interval '5 minutes') AND attempts<5 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`;
        if(!rows[0])return null;
        return tx.emailOutbox.update({where:{id:rows[0].id},data:{status:'PROCESSING',processingAt:new Date(),attempts:{increment:1}}});
      });
      if(!row)break;
      try{await this.transport.send(row);await this.db.emailOutbox.update({where:{id:row.id},data:{status:'SENT',sentAt:new Date(),processingAt:null}});}
      catch{await this.db.emailOutbox.update({where:{id:row.id},data:{status:row.attempts>=5?'FAILED':'PENDING',processingAt:null}});break;}
    }}catch{console.error(JSON.stringify({event:'email_outbox_delivery_failed'}));}finally{this.busy=false;}
  }
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);this.transport?.close();}
}
