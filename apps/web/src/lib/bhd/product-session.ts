import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextApiRequest } from 'next';

export const BHD_STATE_COOKIE = 'bhd_oauth_state';
export const BHD_PRODUCT_COOKIE = 'bhd_product_session';
const ISSUER = (process.env.BHD_IDENTITY_ISSUER || 'https://id.bhd-om.com').replace(/\/$/, '');
const CLIENT_ID = (process.env.BHD_OAUTH_CLIENT_ID || 'bhd-work').trim();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OauthState = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  redirectUri: string;
};

export type ProductSession = {
  sub: string;
  email: string;
  name: string;
  exp: number;
};

export function apiOrigin() {
  const configured = process.env.API_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.VERCEL) return '';
  return 'http://127.0.0.1:4000';
}

export function identityIssuer() {
  return ISSUER;
}

export function bhdClientId() {
  return CLIENT_ID;
}

function stateSecret() {
  return process.env.BHD_OAUTH_CLIENT_SECRET || process.env.MFA_CREDENTIAL_KEY || 'work-bhd-oauth-state';
}

export function seal(payload: string) {
  const body = Buffer.from(payload).toString('base64url');
  const signature = createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  return `${body}.${signature}`;
}

export function openSeal(value: string) {
  const [body, supplied, extra] = value.split('.');
  if (!body || !supplied || extra) return null;
  let payload = '';
  try {
    payload = Buffer.from(body, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expected = createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return payload;
}

export function readCookie(req: NextApiRequest, name: string) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const text = part.trim();
    const eq = text.indexOf('=');
    if (eq <= 0) continue;
    if (text.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(text.slice(eq + 1));
    } catch {
      return text.slice(eq + 1);
    }
  }
  return '';
}

export function cookieHeader(name: string, value: string, maxAge: number, secure: boolean) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function readOauthState(req: NextApiRequest): OauthState | null {
  const payload = openSeal(readCookie(req, BHD_STATE_COOKIE));
  if (!payload) return null;
  try {
    const data = JSON.parse(payload) as OauthState;
    if (!data.state || !data.nonce || !data.verifier || !data.redirectUri) return null;
    return data;
  } catch {
    return null;
  }
}

export function readProductSession(req: NextApiRequest): ProductSession | null {
  const payload = openSeal(readCookie(req, BHD_PRODUCT_COOKIE));
  if (!payload) return null;
  try {
    const data = JSON.parse(payload) as ProductSession;
    if (!data.sub || !UUID_RE.test(data.sub) || !data.email || !data.exp || data.exp <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function workSessionFromProduct(session: ProductSession) {
  const csrf = createHmac('sha256', session.sub).update('platform-csrf-v1').digest('hex');
  return {
    user: {
      id: session.sub,
      email: session.email,
      username: null,
      displayName: session.name || session.email,
      emailVerified: true,
      sessionId: createHash('sha256').update(session.sub).digest('hex').slice(0, 32),
      bhdSub: session.sub,
    },
    organizations: [],
    csrf,
    developmentMail: false,
  };
}

function jwtPayload(token: string) {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function sessionLifetimeSec() {
  try {
    const response = await fetch(`${ISSUER}/api/bhd/runtime`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return 3456000;
    const body = (await response.json()) as { session?: { maxAgeSec?: number } };
    const value = Number(body.session?.maxAgeSec);
    return Number.isFinite(value) && value >= 86400 ? value : 3456000;
  } catch {
    return 3456000;
  }
}

export async function exchangeBhdCode(saved: OauthState, code: string): Promise<ProductSession> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: saved.redirectUri,
    client_id: CLIENT_ID,
    code_verifier: saved.verifier,
  });
  const secret = process.env.BHD_OAUTH_CLIENT_SECRET?.trim();
  if (secret) body.set('client_secret', secret);
  const tokenResp = await fetch(`${ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!tokenResp.ok) throw new Error('bhd_token');
  const tokens = (await tokenResp.json()) as { id_token?: string; access_token?: string };
  if (!tokens.id_token || !tokens.access_token) throw new Error('bhd_id_token');
  const claims = jwtPayload(tokens.id_token);
  if (!claims || claims.nonce !== saved.nonce || claims.aud !== CLIENT_ID) throw new Error('bhd_callback');
  if (typeof claims.sub !== 'string' || !UUID_RE.test(claims.sub)) throw new Error('bhd_callback');
  const infoResp = await fetch(`${ISSUER}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoResp.ok) throw new Error('bhd_callback');
  const info = (await infoResp.json()) as { sub?: string; email?: string; name?: string };
  if (!info.sub || info.sub !== claims.sub || !info.email?.includes('@')) throw new Error('bhd_callback');
  const maxAgeSec = await sessionLifetimeSec();
  return {
    sub: info.sub,
    email: info.email.trim().toLowerCase(),
    name: info.name || (typeof claims.name === 'string' ? claims.name : info.email),
    exp: Date.now() + maxAgeSec * 1000,
  };
}
