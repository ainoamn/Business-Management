import type { NextApiRequest, NextApiResponse } from 'next';
import { apiOrigin, readProductSession, workSessionFromProduct } from '../../../../../lib/bhd/product-session';

async function proxy(req: NextApiRequest, res: NextApiResponse) {
  const upstream = await fetch(`${apiOrigin()}/api/v1/work/auth/me`, {
    method: 'GET',
    headers: { cookie: req.headers.cookie || '' },
    redirect: 'manual',
  });
  const text = await upstream.text();
  res.status(upstream.status).send(text);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }
  if (apiOrigin()) {
    await proxy(req, res);
    return;
  }
  const session = readProductSession(req);
  if (!session) {
    res.status(401).json({ message: 'Sign in required' });
    return;
  }
  res.status(200).json(workSessionFromProduct(session));
}
