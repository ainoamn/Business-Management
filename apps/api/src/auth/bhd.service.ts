import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../database/prisma.service';
import { digest, hashPassword } from '../common/credentials';
import { environment } from '../config/environment';
import { workCookie } from '../work/identity.service';
import type { BhdIdClaims } from './bhd-identity';
import { identitySessionMaxAgeSec } from './bhd-identity';

@Injectable()
export class BhdService {
  constructor(private readonly db: PrismaService) {}

  async linkOrCreate(claims: BhdIdClaims) {
    const bySub = await this.db.user.findFirst({ where: { bhdSub: claims.sub, deletedAt: null } });
    if (bySub) {
      await this.db.user.update({
        where: { id: bySub.id },
        data: {
          displayName: claims.name || bySub.displayName,
          email: claims.email,
          emailVerifiedAt: bySub.emailVerifiedAt ?? new Date(),
        },
      });
      return bySub.id;
    }

    const byEmail = await this.db.user.findUnique({ where: { email: claims.email } });
    if (byEmail && !byEmail.deletedAt) {
      if (byEmail.bhdSub && byEmail.bhdSub !== claims.sub) {
        throw new UnauthorizedException('EMAIL_LINKED_ELSEWHERE');
      }
      // OIDC email_verified=true يوثّق البريد المحلي عند أول ربط.
      await this.db.user.update({
        where: { id: byEmail.id },
        data: {
          bhdSub: claims.sub,
          displayName: claims.name || byEmail.displayName,
          emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
        },
      });
      return byEmail.id;
    }

    const passwordHash = await hashPassword(randomBytes(32).toString('hex'));
    const created = await this.db.user.create({
      data: {
        email: claims.email,
        displayName: claims.name || claims.email.split('@')[0] || 'BHD User',
        passwordHash,
        bhdSub: claims.sub,
        emailVerifiedAt: new Date(),
      },
    });
    return created.id;
  }

  async issueProductSession(userId: string, request: Request, response: Response) {
    const maxAgeSec = await identitySessionMaxAgeSec();
    const session = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const fresh = await tx.user.findUnique({ where: { id: userId } });
      if (!fresh || fresh.disabledAt || fresh.deletedAt) throw new UnauthorizedException('Invalid credentials');
      const token = randomBytes(32).toString('hex');
      const row = await tx.userSession.create({
        data: {
          userId,
          tokenHash: digest(token),
          expiresAt: new Date(Date.now() + maxAgeSec * 1000),
          deviceName: (request.get('user-agent') ?? '').slice(0, 160),
        },
      });
      return { token, expiresAt: row.expiresAt };
    });
    response.cookie(workCookie, session.token, {
      httpOnly: true,
      secure: environment.DEPLOYMENT_ENV !== 'development',
      sameSite: 'lax',
      path: '/api/v1/work',
      expires: session.expiresAt,
    });
    return { ok: true as const, maxAgeSec, expiresAt: session.expiresAt };
  }

  async revokeRawSession(raw: string | undefined) {
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return;
    await this.db.userSession.updateMany({
      where: { tokenHash: digest(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  clearProductCookie(response: Response) {
    response.cookie(workCookie, '', {
      httpOnly: true,
      secure: environment.DEPLOYMENT_ENV !== 'development',
      sameSite: 'lax',
      path: '/api/v1/work',
      expires: new Date(0),
    });
  }
}
