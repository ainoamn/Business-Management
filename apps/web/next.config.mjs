/** @type {import('next').NextConfig} */
const apiOrigin = process.env.API_ORIGIN || (process.env.VERCEL ? '' : 'http://127.0.0.1:4000');
const config = {
  reactStrictMode:true,
  poweredByHeader:false,
  transpilePackages:['@work/ui','@work/shared-types','@work/shared-schemas'],
  async rewrites() {
    if (!apiOrigin) return [];
    return {beforeFiles:[{source:'/api/v1/:path*',destination:`${apiOrigin}/api/v1/:path*`},{source:'/api/docs',destination:`${apiOrigin}/api/docs`},{source:'/api/docs/:path*',destination:`${apiOrigin}/api/docs/:path*`},{source:'/api/docs-json',destination:`${apiOrigin}/api/docs-json`}]};
  },
  async headers() {return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'}]}];},
};
export default config;
