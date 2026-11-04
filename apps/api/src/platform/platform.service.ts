import {BadRequestException,ConflictException,Injectable,NotFoundException,ServiceUnavailableException,UnauthorizedException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {platformAccountSchema,platformAccountUpdateSchema,platformDisabledSchema,platformInvoiceSchema,platformLedgerSchema,platformPageSchema,platformPlanSchema,platformRoleSchema,platformSettingsSchema,platformSubscriptionSchema,platformUserSchema,contactSchema,type PlatformPermission,type PlatformResource,type PlatformQuery} from '@work/shared-schemas';
import type {PlatformActor,PlatformList,PlatformRow} from '@work/shared-types';
import {PrismaService} from '../database/prisma.service';
import {authorize,validate} from './validation';
import {hashPassword,permissionsFor,verifyPassword} from './security';
import {MailService} from '../mail/mail.service';

type Query=PlatformQuery;
type OrganizationRow={id:string;name:string;slug:string;suspended_at:Date|null;created_at:Date;total_count:bigint};
const accountSelect={id:true,email:true,displayName:true,isOwner:true,disabledAt:true,roleId:true,createdAt:true} as const;

@Injectable()
export class PlatformService {
  constructor(private readonly db:PrismaService,private readonly mail:MailService) {}
  private async audit(tx:Prisma.TransactionClient,actor:PlatformActor,requestId:string,action:string,resource:string,id?:string) {
    await tx.platformAudit.create({data:{actorId:actor.id,requestId,action,resource,resourceId:id}});
  }
  private async mutate<T>(actor:PlatformActor,permission:PlatformPermission,requestId:string,resource:string,id:string|undefined,operation:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T> {
    authorize(actor,permission,['accounts.manage','roles.manage'].includes(permission));
    try {
      return await this.db.$transaction(async tx=>{
        const fresh=await tx.platformAccount.findUnique({where:{id:actor.id},include:{role:true}});
        const session=await tx.platformSession.findUnique({where:{id:actor.sessionId}});
        if(!fresh||fresh.disabledAt||!session||session.revokedAt||session.expiresAt<=new Date()) throw new UnauthorizedException('Session expired');
        authorize({...actor,isOwner:fresh.isOwner,permissions:permissionsFor(fresh.isOwner,fresh.role?.permissions??[])},permission,['accounts.manage','roles.manage'].includes(permission));
        await tx.$executeRaw`SELECT set_config('app.platform_account_id',${actor.id},true)`;
        const result=await operation(tx);
        const resourceId=id??(typeof result==='object'&&result&&'id' in result&&typeof result.id==='string'&&/^[a-f0-9-]{36}$/.test(result.id)?result.id:undefined);
        await this.audit(tx,actor,requestId,id?'UPDATE':'CREATE',resource,resourceId);
        return result;
      },{timeout:15000});
    } catch(error) {
      if(error instanceof Prisma.PrismaClientKnownRequestError) {
        if(error.code==='P2002') throw new ConflictException('Record already exists');
        if(error.code==='P2025') throw new NotFoundException('Record not found');
        if(error.code==='P2003') throw new BadRequestException('Invalid related record');
      }
      throw error;
    }
  }
  async list(resource:PlatformResource,query:Query,actor:PlatformActor):Promise<PlatformList> {
    authorize(actor,`${resource}.read`);
    const {search,page,pageSize}=query;
    const options={skip:(page-1)*pageSize,take:pageSize};
    const contains={contains:search,mode:'insensitive' as const};
    let items:PlatformRow[]=[];let total=0;
    switch(resource) {
      case 'organizations': {
        const rows=await this.db.$transaction(async tx=>{
          await tx.$executeRaw`SELECT set_config('app.platform_account_id',${actor.id},true)`;
          return tx.$queryRaw<OrganizationRow[]>`SELECT * FROM platform_list_organizations(${search},${pageSize}::int,${options.skip}::int)`;
        });
        items=rows.map(row=>({id:row.id,name:row.name,slug:row.slug,disabled:!!row.suspended_at,createdAt:row.created_at.toISOString()}));total=Number(rows[0]?.total_count??0);break;
      }
      case 'users': {
        const where={deletedAt:null,OR:[{email:contains},{displayName:contains}]};
        const rows=await this.db.user.findMany({where,...options,orderBy:{createdAt:'desc'},select:{id:true,email:true,displayName:true,disabledAt:true,createdAt:true}});
        items=rows.map(row=>({id:row.id,email:row.email,displayName:row.displayName,disabled:!!row.disabledAt,createdAt:row.createdAt.toISOString()}));total=await this.db.user.count({where});break;
      }
      case 'accounts': {
        const where={OR:[{email:contains},{displayName:contains}]};
        const rows=await this.db.platformAccount.findMany({where,...options,orderBy:{createdAt:'desc'},select:accountSelect});
        items=rows.map(row=>({id:row.id,email:row.email,displayName:row.displayName,isOwner:row.isOwner,disabled:!!row.disabledAt,roleId:row.roleId,createdAt:row.createdAt.toISOString()}));total=await this.db.platformAccount.count({where});break;
      }
      case 'roles': {
        const where={name:contains};items=await this.db.platformRole.findMany({where,...options,orderBy:{name:'asc'}});total=await this.db.platformRole.count({where});break;
      }
      case 'plans': {
        const where={name:contains};const rows=await this.db.platformPlan.findMany({where,...options,orderBy:{createdAt:'desc'}});
        items=rows.map(row=>({...row,price:row.price.toFixed(3),annualPrice:row.annualPrice?.toFixed(3)??null,createdAt:row.createdAt.toISOString()}));total=await this.db.platformPlan.count({where});break;
      }
      case 'subscriptions': {
        const where=search?{status:contains}:{};const rows=await this.db.platformSubscription.findMany({where,...options,orderBy:{createdAt:'desc'}});
        items=rows.map(row=>({...row,unitPrice:row.unitPrice.toFixed(3),periodStart:row.periodStart.toISOString(),usageAnchorAt:row.usageAnchorAt.toISOString(),canceledAt:row.canceledAt?.toISOString()??null,graceEndsAt:row.graceEndsAt?.toISOString()??null,endsAt:row.endsAt.toISOString(),createdAt:row.createdAt.toISOString()}));total=await this.db.platformSubscription.count({where});break;
      }
      case 'invoices': {
        const where={number:contains};const rows=await this.db.platformInvoice.findMany({where,...options,orderBy:{createdAt:'desc'}});
        items=rows.map(row=>({...row,amount:row.amount.toFixed(3),dueAt:row.dueAt.toISOString(),createdAt:row.createdAt.toISOString()}));total=await this.db.platformInvoice.count({where});break;
      }
      case 'ledger': {
        const where={OR:[{reference:contains},{note:contains}]};const rows=await this.db.platformLedgerEntry.findMany({where,...options,orderBy:{createdAt:'desc'}});
        items=rows.map(row=>({...row,amount:row.amount.toFixed(3),createdAt:row.createdAt.toISOString()}));total=await this.db.platformLedgerEntry.count({where});break;
      }
      case 'pages': {
        const where={OR:[{title:contains},{slug:contains}]};const rows=await this.db.platformPage.findMany({where,...options,orderBy:{updatedAt:'desc'}});
        items=rows.map(row=>({...row,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString()}));total=await this.db.platformPage.count({where});break;
      }
      case 'audit': {
        const where={OR:[{action:contains},{resource:contains}]};const rows=await this.db.platformAudit.findMany({where,...options,orderBy:{createdAt:'desc'}});
        items=rows.map(row=>({...row,createdAt:row.createdAt.toISOString()}));total=await this.db.platformAudit.count({where});break;
      }
    }
    return {items,total,page,pageSize};
  }
  async create(resource:PlatformResource,body:unknown,actor:PlatformActor,requestId:string) {
    return this.mutate(actor,`${resource}.manage` as PlatformPermission,requestId,resource,undefined,async tx=>{
      switch(resource) {
        case 'roles':return tx.platformRole.create({data:validate(platformRoleSchema,body)});
        case 'accounts': {
          const data=validate(platformAccountSchema,body);const passwordHash=await hashPassword(data.password);
          return tx.platformAccount.create({data:{email:data.email,displayName:data.displayName,roleId:data.roleId,passwordHash},select:accountSelect});
        }
        case 'plans':return tx.platformPlan.create({data:validate(platformPlanSchema,body)});
        case 'subscriptions': {
          const data=validate(platformSubscriptionSchema,body);const plan=await tx.platformPlan.findUnique({where:{id:data.planId}});
          if(!plan?.active||data.seats>plan.maxSeats||new Date(data.endsAt)<=new Date()) throw new BadRequestException('Invalid plan, seat limit or expiration');
          // Authorization-aware function validates existence without exposing tenant content.
          const exists=await tx.$queryRaw<Array<{valid:boolean}>>`SELECT platform_organization_exists(${data.organizationId}::uuid) AS valid`;
          if(!exists[0]?.valid) throw new BadRequestException('Organization unavailable');
          return tx.platformSubscription.create({data:{...data,unitPrice:plan.price,endsAt:new Date(data.endsAt)}});
        }
        case 'invoices': {
          const data=validate(platformInvoiceSchema,body);
          return tx.platformInvoice.create({data:{...data,dueAt:new Date(data.dueAt)}});
        }
        case 'ledger': {
          const data=validate(platformLedgerSchema,body);
          if(data.invoiceId) {
            await tx.$queryRaw`SELECT id FROM platform_invoices WHERE id=${data.invoiceId}::uuid FOR UPDATE`;
            const invoice=await tx.platformInvoice.findUnique({where:{id:data.invoiceId}});
            if(!invoice||invoice.organizationId!==data.organizationId||invoice.status==='VOID') throw new BadRequestException('Invalid invoice');
          }
          const created=await tx.platformLedgerEntry.create({data:{...data,actorId:actor.id}});
          if(data.invoiceId) {
            const sums=await tx.platformLedgerEntry.groupBy({by:['direction'],where:{invoiceId:data.invoiceId},_sum:{amount:true}});
            const net=(sums.find(r=>r.direction==='IN')?._sum.amount??new Prisma.Decimal(0)).minus(sums.find(r=>r.direction==='OUT')?._sum.amount??new Prisma.Decimal(0));
            const invoice=await tx.platformInvoice.findUniqueOrThrow({where:{id:data.invoiceId}});
            await tx.platformInvoice.update({where:{id:invoice.id},data:{status:net.greaterThanOrEqualTo(invoice.amount)?'PAID':'ISSUED'}});
          }
          return created;
        }
        case 'pages':return tx.platformPage.create({data:validate(platformPageSchema,body)});
        default:throw new BadRequestException('Resource cannot be created here');
      }
    });
  }
  async update(resource:PlatformResource,id:string,body:unknown,actor:PlatformActor,requestId:string) {
    return this.mutate(actor,`${resource}.manage` as PlatformPermission,requestId,resource,id,async tx=>{
      switch(resource) {
        case 'organizations': {
          const data=validate(platformDisabledSchema,body);
          const result=await tx.$queryRaw<Array<{id:string}>>`SELECT platform_suspend_organization(${id}::uuid,${data.disabled}) AS id`;
          if(!result[0]?.id) throw new NotFoundException('Organization not found');return {id};
        }
        case 'users': {
          const data=validate(platformUserSchema,body);
          await tx.user.update({where:{id},data:{displayName:data.displayName,disabledAt:data.disabled?new Date():null},select:{id:true}});
          if(data.disabled) await tx.userSession.updateMany({where:{userId:id,revokedAt:null},data:{revokedAt:new Date()}});return {id};
        }
        case 'accounts': {
          const data=validate(platformAccountUpdateSchema,body);
          const existing=await tx.platformAccount.findUnique({where:{id}});
          if(!existing||existing.isOwner||id===actor.id) throw new BadRequestException('Owner and own access cannot be changed here');
          await tx.platformAccount.update({where:{id},data:{displayName:data.displayName,roleId:data.roleId,disabledAt:data.disabled?new Date():null},select:{id:true}});
          await tx.platformSession.updateMany({where:{accountId:id,revokedAt:null},data:{revokedAt:new Date()}});return {id};
        }
        case 'roles':return tx.platformRole.update({where:{id},data:validate(platformRoleSchema,body)});
        case 'plans':{const data=validate(platformPlanSchema,body),settings=await tx.billingSettings.findUnique({where:{id:'main'}});if(settings?.freePlanId===id&&(!new Prisma.Decimal(data.price).isZero()||!data.active))throw new BadRequestException('The configured free plan must stay active and zero-priced');if(settings?.trialPlanId===id&&(!data.active||data.maxSeats<settings.trialSeats))throw new BadRequestException('The configured trial plan must cover its trial seats');return tx.platformPlan.update({where:{id},data:{...data,version:{increment:1}}});}
        case 'subscriptions': {
          const status=validate(platformSubscriptionSchema.pick({status:true}),body).status;
          return tx.platformSubscription.update({where:{id},data:{status,version:{increment:1}}});
        }
        case 'invoices': {
          validate(platformDisabledSchema,body);
          await tx.$queryRaw`SELECT id FROM platform_invoices WHERE id=${id}::uuid FOR UPDATE`;
          if(await tx.platformLedgerEntry.count({where:{invoiceId:id}})) throw new BadRequestException('An invoice with ledger entries cannot be voided');
          return tx.platformInvoice.update({where:{id},data:{status:'VOID'}});
        }
        case 'pages':return tx.platformPage.update({where:{id},data:validate(platformPageSchema,body)});
        default:throw new BadRequestException('This record is immutable');
      }
    });
  }
  async overview(actor:PlatformActor) {
    authorize(actor,'overview.read');
    const [organizations,users,accounts,plans,subscriptions,invoices,pages,incoming,outgoing]=await Promise.all([
      this.db.$transaction(async tx=>{await tx.$executeRaw`SELECT set_config('app.platform_account_id',${actor.id},true)`;return tx.$queryRaw<Array<{count:bigint}>>`SELECT platform_organization_count() AS count`;}),
      this.db.user.count({where:{deletedAt:null}}),this.db.platformAccount.count({where:{disabledAt:null}}),this.db.platformPlan.count({where:{active:true}}),
      this.db.platformSubscription.count({where:{status:'ACTIVE',endsAt:{gt:new Date()}}}),this.db.platformInvoice.count({where:{status:'ISSUED'}}),this.db.platformPage.count({where:{status:'PUBLISHED'}}),
      this.db.platformLedgerEntry.aggregate({where:{direction:'IN'},_sum:{amount:true}}),this.db.platformLedgerEntry.aggregate({where:{direction:'OUT'},_sum:{amount:true}}),
    ]);
    return {organizations:Number(organizations[0]?.count??0),users,accounts,plans,subscriptions,invoices,pages,manualNet:(incoming._sum.amount??new Prisma.Decimal(0)).minus(outgoing._sum.amount??new Prisma.Decimal(0)).toFixed(3),currency:'OMR'};
  }
  async settings(actor:PlatformActor) {authorize(actor,'settings.read');return this.db.platformSettings.findUniqueOrThrow({where:{id:'main'}});}
  async saveSettings(body:unknown,actor:PlatformActor,requestId:string) {
    const data=validate(platformSettingsSchema,body);
    return this.mutate(actor,'settings.manage',requestId,'settings',undefined,tx=>tx.platformSettings.update({where:{id:'main'},data}));
  }
  async sessions(actor:PlatformActor) {
    authorize(actor,'security.read');
    const rows=await this.db.platformSession.findMany({where:{revokedAt:null,expiresAt:{gt:new Date()}},orderBy:{createdAt:'desc'},take:100,select:{id:true,accountId:true,createdAt:true,expiresAt:true}});
    return {items:rows.map(r=>({...r,createdAt:r.createdAt.toISOString(),expiresAt:r.expiresAt.toISOString()}))};
  }
  async revoke(id:string,actor:PlatformActor,requestId:string) {
    return this.mutate(actor,'security.manage',requestId,'sessions',id,async tx=>{
      const target=await tx.platformSession.findUnique({where:{id},include:{account:true}});
      if(!target||(!actor.isOwner&&target.account.isOwner)) throw new BadRequestException('Session unavailable');
      await tx.platformSession.update({where:{id},data:{revokedAt:new Date()}});return {id};
    });
  }
  async changePassword(actor:PlatformActor,currentPassword:string,newPassword:string,requestId:string) {
    const current=await this.db.platformAccount.findUniqueOrThrow({where:{id:actor.id}});
    if(!await verifyPassword(currentPassword,current.passwordHash)) throw new UnauthorizedException('Invalid credentials');
    const passwordHash=await hashPassword(newPassword);
    await this.db.$transaction(async tx=>{
      const fresh=await tx.platformAccount.findUniqueOrThrow({where:{id:actor.id}});
      if(fresh.passwordHash!==current.passwordHash||fresh.disabledAt) throw new ConflictException('Account changed; sign in again');
      await tx.platformAccount.update({where:{id:actor.id},data:{passwordHash}});
      await tx.platformSession.updateMany({where:{accountId:actor.id,revokedAt:null},data:{revokedAt:new Date()}});
      await this.audit(tx,actor,requestId,'PASSWORD_CHANGED','security',actor.id);
    });
    return {ok:true};
  }
  async logout(actor:PlatformActor,requestId:string) {
    await this.db.$transaction(async tx=>{await tx.platformSession.update({where:{id:actor.sessionId},data:{revokedAt:new Date()}});await this.audit(tx,actor,requestId,'LOGOUT','security');});
    return {ok:true};
  }
  async site() {
    const settings=await this.db.platformSettings.findUnique({where:{id:'main'}});
    if(!settings) throw new ServiceUnavailableException('Site not configured');
    return {platformName:settings.platformName,supportEmail:settings.supportEmail,footerText:settings.footerText,maintenanceMode:settings.maintenanceMode,publicPagesEnabled:settings.publicPagesEnabled};
  }
  async publicPage(slug:string) {
    const site=await this.site();
    if(site.maintenanceMode) throw new ServiceUnavailableException('Site maintenance');
    if(!site.publicPagesEnabled) throw new NotFoundException('Page not found');
    const page=await this.db.platformPage.findUnique({where:{slug},select:{title:true,body:true,status:true}});
    if(!page||page.status!=='PUBLISHED') throw new NotFoundException('Page not found');
    return {title:page.title,body:page.body,platformName:site.platformName,footerText:site.footerText};
  }
  async contact(data:ReturnType<typeof contactSchema.parse>) {
    const settings=await this.db.platformSettings.findUnique({where:{id:'main'}});
    if(!settings?.supportEmail) throw new ServiceUnavailableException('Support email not configured');
    await this.db.$transaction(async tx=>{
      await this.mail.enqueue(tx,{recipient:settings.supportEmail,subject:`Contact form: ${data.name}`,textBody:`Name: ${data.name}\nEmail: ${data.email}\n\n${data.message}`});
    });
    return {ok:true};
  }
  async plans() {
    const rows=await this.db.platformPlan.findMany({where:{active:true},orderBy:{price:'asc'}});
    return rows.map(row=>({id:row.id,name:row.name,description:row.description,price:row.price.toFixed(3),maxSeats:row.maxSeats,storageMb:row.storageMb,aiCredits:row.aiCredits,active:row.active}));
  }
}
