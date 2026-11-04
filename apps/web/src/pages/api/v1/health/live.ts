import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_request: NextApiRequest, response: NextApiResponse<{ status: 'alive' }>) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({ status: 'alive' });
}
