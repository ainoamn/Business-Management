import { createHash, randomBytes } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  BHD_PRODUCT_COOKIE,
  BHD_STATE_COOKIE,
  apiOrigin,
  bhdClientId,
  cookieHeader,
  exchangeBhdCode,
  identityIssuer,
  readOauthState,
  seal,
} from '../../../../lib/bhd/product-session';

function headerValue(value: string | string[] | undefined, fallback: string) {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? fallback).split(',')[0]?.trim() || fallback;
}

function originOf(req: NextApiRequest) {
  const proto = headerValue(req.headers['x-forwarded-proto'], 'https');
  const host = headerValue(req.headers['x-forwarded-host'] || req.headers.host, '');
  return `${proto}://${host}`.replace(/\/$/, '');
}

function safeReturnTo(value: unknown) {
  const text = typeof value === 'string' ? value : '';
  if (!text.startsWith('/') || text.startsWith('//') || text.includes('://') || text.includes('\\')) return '/app/dashboard';
  return text.slice(0, 512);
}

async function proxyToApi(req: NextApiRequest, res: NextApiResponse, step: string) {
  const target = new URL(`${apiOrigin()}/api/v1/auth/bhd/${step}`);
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'step' || value === undefined) continue;
    target.searchParams.set(key, Array.isArray(value) ? value.join(',') : value);
  }
  const upstream = await fetch(target, {
    method: req.method,
    headers: {
      cookie: req.headers.cookie || '',
      authorization: String(req.headers.authorization || ''),
      'content-type': req.headers['content-type'] || 'application/json',
    },
    redirect: 'manual',
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body ?? {}),
  });
  const location = upstream.headers.get('location');
  const setCookie = upstream.headers.getSetCookie?.() || [];
  if (setCookie.length) res.setHeader('set-cookie', setCookie);
  if (location && upstream.status >= 300 && upstream.status < 400) {
    res.redirect(upstream.status, location);
    return;
  }
  const text = await upstream.text();
  res.status(upstream.status).send(text);
}

async function finishLocally(req: NextApiRequest, res: NextApiResponse, step: string) {
  const secure = originOf(req).startsWith('https://');
  if (step === 'start' && req.method === 'GET') {
    const returnTo = safeReturnTo(req.query.returnTo);
    const redirectUri = `${originOf(req)}/api/auth/bhd/callback`;
    const state = randomBytes(24).toString('base64url');
    const nonce = randomBytes(24).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    res.setHeader('Set-Cookie', cookieHeader(BHD_STATE_COOKIE, seal(JSON.stringify({ state, nonce, verifier, returnTo, redirectUri })), 300, secure));
    const url = new URL('/oauth/authorize', `${identityIssuer()}/`);
    url.searchParams.set('client_id', bhdClientId());
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid profile email');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    res.redirect(302, url.toString());
    return;
  }
  if (step === 'callback' && req.method === 'GET') {
    const saved = readOauthState(req);
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const clearState = cookieHeader(BHD_STATE_COOKIE, '', 0, secure);
    if (!saved || !code || saved.state !== state) {
      res.setHeader('Set-Cookie', clearState);
      res.redirect(302, '/login?error=bhd_state');
      return;
    }
    try {
      const session = await exchangeBhdCode(saved, code);
      const maxAge = Math.max(60, Math.floor((session.exp - Date.now()) / 1000));
      res.setHeader('Set-Cookie', [clearState, cookieHeader(BHD_PRODUCT_COOKIE, seal(JSON.stringify(session)), maxAge, secure)]);
      res.redirect(302, safeReturnTo(saved.returnTo));
    } catch (error: unknown) {
      const codeName = error instanceof Error && error.message.startsWith('bhd_') ? error.message : 'bhd_callback';
      res.setHeader('Set-Cookie', clearState);
      res.redirect(302, `/login?error=${codeName}`);
    }
    return;
  }
  if (step === 'logout') {
    res.setHeader('Set-Cookie', cookieHeader(BHD_PRODUCT_COOKIE, '', 0, secure));
    const url = new URL('/oauth/end-session', `${identityIssuer()}/`);
    url.searchParams.set('client_id', bhdClientId());
    url.searchParams.set('post_logout_redirect_uri', `${originOf(req)}/`);
    if (req.query.all === '1') url.searchParams.set('all', '1');
    res.redirect(302, url.toString());
    return;
  }
  res.redirect(302, '/login?error=bhd_callback');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const step = String(req.query.step || '');
  res.setHeader('Cache-Control', 'no-store');
  if (apiOrigin()) {
    await proxyToApi(req, res, step);
    return;
  }
  await finishLocally(req, res, step);
}
