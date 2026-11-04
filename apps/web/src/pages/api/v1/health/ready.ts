import type { NextApiRequest, NextApiResponse } from 'next';
import type { Readiness } from '@work/shared-types';

export default function handler(_request: NextApiRequest, response: NextApiResponse<Readiness>) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(503).json({
    status: 'not_ready',
    checks: { database: 'down', redis: 'down', queue: 'down', storage: 'down' },
    timestamp: new Date().toISOString(),
  });
}
