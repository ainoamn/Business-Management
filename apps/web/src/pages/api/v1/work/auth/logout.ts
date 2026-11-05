import type { NextApiRequest, NextApiResponse } from 'next';
import { BHD_PRODUCT_COOKIE, apiOrigin, cookieHeader } from '../../../../../lib/bhd/product-session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (apiOrigin()) {
    const upstream = await fetch(`${apiOrigin()}/api/v1/work/auth/logout`, {
      method: req.method || 'POST',
      headers: {
        cookie: req.headers.cookie || '',
        'content-type': req.headers['content-type'] || 'application/json',
        'x-csrf-token': String(req.headers['x-csrf-token'] || ''),
      },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body ?? {}),
    });
    const text = await upstream.text();
    const setCookie = upstream.headers.getSetCookie?.() || [];
    if (setCookie.length) res.setHeader('set-cookie', setCookie);
    res.status(upstream.status).send(text);
    return;
  }
  const secure = String(req.headers['x-forwarded-proto'] || '').includes('https');
  res.setHeader('Set-Cookie', cookieHeader(BHD_PRODUCT_COOKIE, '', 0, secure));
  res.status(200).json({ ok: true });
}
