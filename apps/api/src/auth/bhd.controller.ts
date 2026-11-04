import { Controller, Get, Headers, HttpException, Inject, Post, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { environment } from '../config/environment';
import { workCookie } from '../work/identity.service';
import { BhdService } from './bhd.service';
import {
  BHD_OAUTH_STATE_COOKIE,
  bhdAuthorizeUrl,
  bhdEndSessionUrl,
  bhdIdentityIssuer,
  bhdOauthClientId,
  bhdOauthClientSecret,
  bhdPostLogoutRedirectUri,
  bhdRedirectUri,
  createPkce,
  decodeOauthStateCookie,
  encodeOauthStateCookie,
  identitySessionMaxAgeSec,
  isBhdAuthorizeReady,
  isBhdIdentityReady,
  isSafeReturnTo,
  oauthStateCookieOptions,
  randomUrlToken,
  readCookie,
  requestOrigin,
  verifyBhdIdToken,
} from './bhd-identity';

@ApiExcludeController()
@ApiTags('BHD Identity')
@Controller('auth/bhd')
export class BhdController {
  constructor(@Inject(BhdService) private readonly bhd: BhdService) {}

  @Get('ready')
  ready() {
    return {
      ready: isBhdIdentityReady(),
      authorizeReady: isBhdAuthorizeReady(),
      issuer: bhdIdentityIssuer(),
      clientId: bhdOauthClientId(),
    };
  }

  @Get('start')
  start(@Req() req: Request, @Res() res: Response, @Query('returnTo') returnTo?: string) {
    if (!isBhdAuthorizeReady()) return res.redirect('/login?error=bhd_not_configured');
    const origin = requestOrigin(req);
    const redirectUri = bhdRedirectUri(origin);
    const state = randomUrlToken();
    const nonce = randomUrlToken();
    const { verifier, challenge } = createPkce();
    const safeReturn = isSafeReturnTo(returnTo) ? returnTo! : '/app/dashboard';
    const secure = environment.DEPLOYMENT_ENV !== 'development';
    res.cookie(
      BHD_OAUTH_STATE_COOKIE,
      encodeOauthStateCookie({
        state,
        nonce,
        verifier,
        returnTo: safeReturn,
        redirectUri,
      }),
      oauthStateCookieOptions(secure),
    );
    return res.redirect(
      bhdAuthorizeUrl({
        issuer: bhdIdentityIssuer(),
        clientId: bhdOauthClientId(),
        redirectUri,
        state,
        nonce,
        challenge,
      }),
    );
  }

  @Get('callback')
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const saved = decodeOauthStateCookie(readCookie(req, BHD_OAUTH_STATE_COOKIE));
    res.clearCookie(BHD_OAUTH_STATE_COOKIE, { path: '/' });
    if (!isBhdIdentityReady()) return res.redirect('/login?error=bhd_not_configured');
    if (error) return res.redirect(`/login?error=bhd_${encodeURIComponent(error)}`);
    if (!saved || !code || !state || saved.state !== state) return res.redirect('/login?error=bhd_state');
    try {
      const tokenResp = await fetch(`${bhdIdentityIssuer()}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: saved.redirectUri,
          client_id: bhdOauthClientId(),
          client_secret: bhdOauthClientSecret(),
          code_verifier: saved.verifier,
        }),
      });
      if (!tokenResp.ok) return res.redirect('/login?error=bhd_token');
      const tokens = (await tokenResp.json()) as { id_token?: string; access_token?: string };
      if (!tokens.id_token) return res.redirect('/login?error=bhd_id_token');
      const claims = await verifyBhdIdToken(
        tokens.id_token,
        {
          issuer: bhdIdentityIssuer(),
          audience: bhdOauthClientId(),
          nonce: saved.nonce,
        },
        tokens.access_token,
      );
      const userId = await this.bhd.linkOrCreate(claims);
      await this.bhd.issueProductSession(userId, req, res);
      const dest = isSafeReturnTo(saved.returnTo) ? saved.returnTo : '/app/dashboard';
      return res.redirect(dest);
    } catch {
      return res.redirect('/login?error=bhd_callback');
    }
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response, @Query('all') all?: string) {
    await this.bhd.revokeRawSession(readCookie(req, workCookie));
    this.bhd.clearProductCookie(res);
    if (!isBhdIdentityReady()) return res.redirect('/');
    const origin = requestOrigin(req);
    return res.redirect(
      bhdEndSessionUrl({
        issuer: bhdIdentityIssuer(),
        clientId: bhdOauthClientId(),
        postLogoutRedirectUri: bhdPostLogoutRedirectUri(origin),
        all: all === '1',
      }),
    );
  }

  @Post('rebind')
  async rebind(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('authorization') authorization?: string,
  ) {
    if (!isBhdIdentityReady()) throw new HttpException('BHD_NOT_READY', 503);
    const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!bearer) throw new HttpException('UNAUTHENTICATED', 401);
    const meResp = await fetch(`${bhdIdentityIssuer()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!meResp.ok) throw new HttpException('UNAUTHENTICATED', 401);
    const body = (await meResp.json()) as {
      user?: { id?: string; email?: string; name?: string };
    };
    if (!body.user?.id || !body.user.email) throw new HttpException('UNAUTHENTICATED', 401);
    const userId = await this.bhd.linkOrCreate({
      sub: body.user.id,
      email: body.user.email.trim().toLowerCase(),
      name: body.user.name ?? null,
      picture: null,
    });
    await this.bhd.revokeRawSession(readCookie(req, workCookie));
    const session = await this.bhd.issueProductSession(userId, req, res);
    return { ok: true, maxAgeSec: session.maxAgeSec || (await identitySessionMaxAgeSec()) };
  }
}
