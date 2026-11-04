/** @type {import('next').NextConfig} */
const apiOrigin = process.env.API_ORIGIN || (process.env.VERCEL ? '' : 'http://127.0.0.1:4000');
const identity = 'https://id.bhd-om.com';
const config = {
  distDir: process.env.WORK_NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@work/ui', '@work/shared-types', '@work/shared-schemas'],
  async rewrites() {
    if (!apiOrigin) return [];
    return {
      beforeFiles: [
        { source: '/api/auth/bhd/:path*', destination: `${apiOrigin}/api/v1/auth/bhd/:path*` },
        { source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` },
        { source: '/api/docs', destination: `${apiOrigin}/api/docs` },
        { source: '/api/docs/:path*', destination: `${apiOrigin}/api/docs/:path*` },
        { source: '/api/docs-json', destination: `${apiOrigin}/api/docs-json` },
      ],
    };
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${identity}`,
      `connect-src 'self' ${identity} ${apiOrigin || ''}`.trim(),
      `img-src 'self' data: blob: ${identity}`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};
export default config;
