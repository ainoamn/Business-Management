import {config} from 'dotenv';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
config({path:fileURLToPath(new URL('../../.env',import.meta.url)),quiet:true});
const id=process.argv[2];if(!/^[a-f0-9]{16}$/.test(id??''))throw Error('Usage: pnpm demo:start <demo id>');
if(process.env.DEPLOYMENT_ENV!=='development')throw Error('Demo runtime is local development only');
const source=new URL(process.env.DATABASE_URL);if(!['127.0.0.1','localhost'].includes(source.hostname))throw Error('Demo runtime requires local PostgreSQL');
const directory=fileURLToPath(new URL('../../.local/demos/'+id+'/',import.meta.url)),manifest=JSON.parse(await readFile(directory+'/access.json','utf8'));
if(manifest.demo!==true||manifest.id!==id||manifest.database!=='work_demo_'+id)throw Error('Invalid demo manifest');source.pathname='/'+manifest.database;
async function available(port,host){await new Promise((resolve,reject)=>{const server=createServer();server.once('error',()=>reject(Error('Demo port '+port+' is already in use')));server.listen(port,host,()=>server.close(resolve));});}
await available(4100,'127.0.0.1');await available(3100,'localhost');
const children=[],env={...process.env,NODE_ENV:'development',DATABASE_URL:source.toString(),PORT:'4100',WEB_ORIGIN:'http://localhost:3100',API_ORIGIN:'http://127.0.0.1:4100',MAIL_DELIVERY_MODE:'outbox',DOCUMENT_LOCAL_ROOT:directory+'/documents',WORK_NEXT_DIST_DIR:'.local/demo-next'};
let stopping=false;function stop(){if(stopping)return;stopping=true;process.stdin.pause();for(const child of children)if(child.pid&&child.exitCode===null){if(process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else child.kill();}}
process.once('SIGINT',stop);process.once('SIGTERM',stop);
process.stdin.setEncoding('utf8');process.stdin.on('data',data=>{if(data.trim()==='stop')stop();});
const api=spawn(process.execPath,[fileURLToPath(new URL('../../apps/api/dist/main.js',import.meta.url))],{env,windowsHide:true,stdio:'inherit'});children.push(api);
const webRequire=createRequire(new URL('../../apps/web/package.json',import.meta.url)),web=spawn(process.execPath,[webRequire.resolve('next/dist/bin/next'),'dev','--hostname','localhost','--port','3100'],{cwd:fileURLToPath(new URL('../../apps/web/',import.meta.url)),env,windowsHide:true,stdio:'inherit'});children.push(web);
for(const child of children){child.once('error',()=>{process.exitCode=1;stop();});child.once('exit',code=>{if(!stopping)process.exitCode=code??1;stop();});}
console.log('DEMO: http://localhost:3100/app — credentials: '+directory+'/access.json');
