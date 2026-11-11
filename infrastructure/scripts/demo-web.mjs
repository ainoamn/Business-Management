import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer,request as upstreamRequest} from 'node:http';

if(process.env.DEPLOYMENT_ENV!=='development')throw Error('The demo web server is local development only');
const require=createRequire(new URL('../../apps/web/package.json',import.meta.url)),next=require('next');
const application=next({dev:false,dir:fileURLToPath(new URL('../../apps/web/',import.meta.url)),hostname:'localhost',port:3100});
await application.prepare();const handle=application.getRequestHandler();
// The production UI stays unchanged. Only this local demo server forwards its API
// traffic to the isolated demo API, including cookies, uploads and SSE streams.
const server=createServer((incoming,outgoing)=>{
 const path=incoming.url??'/';
 if(!/^\/api\/(?:v1(?:\/|$)|auth\/bhd(?:\/|$)|docs(?:-json)?(?:[/?]|$))/.test(path)){
  void handle(incoming,outgoing).catch(()=>{if(!outgoing.headersSent)outgoing.writeHead(500);outgoing.end('Page unavailable');});return;
 }
 const target=path.replace(/^\/api\/auth\/bhd(?=\/|$)/,'/api/v1/auth/bhd');
 const upstream=upstreamRequest({hostname:'127.0.0.1',port:4100,path:target,method:incoming.method,headers:incoming.headers},response=>{
  outgoing.writeHead(response.statusCode??502,response.headers);response.pipe(outgoing);
  response.on('error',()=>outgoing.destroy());
 });
 upstream.on('error',()=>{if(!outgoing.headersSent)outgoing.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});outgoing.end('Demo API unavailable');});
 incoming.on('aborted',()=>upstream.destroy());outgoing.on('close',()=>upstream.destroy());incoming.pipe(upstream);
});
server.listen(3100,'localhost',()=>console.log('Demo UI ready at http://localhost:3100'));
server.on('error',()=>{console.error('Demo UI could not bind its local port');process.exitCode=1;void application.close();});
function close(){server.close();server.closeAllConnections();void application.close();}
process.once('SIGINT',close);process.once('SIGTERM',close);
