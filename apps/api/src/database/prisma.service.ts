import { Injectable, OnModuleDestroy, OnModuleInit, ForbiddenException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { organizationIdSchema } from '@work/shared-schemas';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }

  /** Call only with a user ID resolved by server-side session authentication. */
  async withOrganization<T>(userId: string, organizationId: string, operation: (tx: Prisma.TransactionClient) => Promise<T>, options?:{timeout:number}): Promise<T> {
    const tenant = organizationIdSchema.parse(organizationId);
    return this.$transaction(async tx => {
      // transaction-local settings prevent context leaking through the connection pool.
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.organization_id', ${tenant}, true)`;
      const membership = await tx.membership.findUnique({where:{organizationId_userId:{organizationId:tenant,userId}}});
      if (!membership?.active) throw new ForbiddenException('Organization access denied');
      const organization=await tx.organization.findUnique({where:{id:tenant},select:{suspendedAt:true}});
      const user=await tx.user.findUnique({where:{id:userId},select:{disabledAt:true,deletedAt:true}});
      if(!organization||organization.suspendedAt||!user||user.disabledAt||user.deletedAt) throw new ForbiddenException('Organization access denied');
      return operation(tx);
    },{timeout:Math.min(30000,Math.max(5000,options?.timeout??5000))});
  }
}
