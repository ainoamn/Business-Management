import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

const STATE_COOKIE = 'bhd_oauth_state';
const ISSUER = (process.env.BHD_IDENTITY_ISSUER || 'https://id.bhd-om.com').replace(/\/$/, '');
const CLIENT_ID = (process.env.BHD_OAUTH_CLIENT_ID || 'bhd-work').trim();

function originOf(req: NextApiRequest) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${proto}://${host}`.replace(/\/$/, '');
}

function safeReturnTo(value: unknown) {
  const text = typeof value === 'string' ? value : '';
  if (!text.startsWith('/') || text.startsWith('//') || text.includes('://') || text.includes('\\')) return '/app/dashboard';
  return text.slice(0, 512);
}

function stateSecret() {
  return process.env.BHD_OAUTH_CLIENT_SECRET || process.env.MFA_CREDENTIAL_KEY || 'work-bhd-oauth-state';
}

function seal(payload: string) {
  const signature = createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

function apiOrigin() {
  const configured = process.env.API_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.VERCEL) return '';
  return 'http://127.0.0.1:4000';
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
  if (location) {
    res.redirect(upstream.status, location);
    return;
  }
  const text = await upstream.text();
  res.status(upstream.status).send(text);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const step = String(req.query.step || '');
  res.setHeader('Cache-Control', 'no-store');
  if (apiOrigin()) {
    await proxyToApi(req, res, step);
    return;
  }
  if (step !== 'start' || req.method !== 'GET') {
    res.redirect(302, '/login?error=bhd_api');
    return;
  }
  const returnTo = safeReturnTo(req.query.returnTo);
  const redirectUri = `${originOf(req)}/api/auth/bhd/callback`;
  const state = randomBytes(24).toString('base64url');
  const nonce = randomBytes(24).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const secure = originOf(req).startsWith('https://');
  res.setHeader(
    'Set-Cookie',
    `${STATE_COOKIE}=${seal(JSON.stringify({ state, nonce, verifier, returnTo, redirectUri }))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=300${secure ? '; Secure' : ''}`,
  );
  const url = new URL('/oauth/authorize', `${ISSUER}/`);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  res.redirect(302, url.toString());
}
