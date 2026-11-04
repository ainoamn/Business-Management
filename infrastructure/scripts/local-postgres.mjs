import {config} from 'dotenv';
import {fileURLToPath} from 'node:url';
import {access,mkdir,mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';

config({path:fileURLToPath(new URL('../../.env',import.meta.url)),quiet:true});
if(process.platform!=='win32'||process.env.DEPLOYMENT_ENV!=='development') throw new Error('This optional native PostgreSQL launcher is for local Windows development only');
const {initdb,pg_ctl}=await import('@embedded-postgres/windows-x64');
const directory=fileURLToPath(new URL('../../.local/postgres',import.meta.url));
const logfile=fileURLToPath(new URL('../../.local/postgres.log',import.meta.url));
const ownerUrl=new URL(process.env.MIGRATION_DATABASE_URL);
if(ownerUrl.hostname!=='127.0.0.1'||ownerUrl.port!=='55432') throw new Error('Native development database must use 127.0.0.1:55432');
const user=decodeURIComponent(ownerUrl.username);
const password=decodeURIComponent(ownerUrl.password);
const database=ownerUrl.pathname.slice(1);
if(!/^[a-z][a-z0-9_]*$/.test(user)||!/^[a-z][a-z0-9_]*$/.test(database)) throw new Error('Invalid local database identifiers');
async function execute(binary,args,input) {
  return new Promise((resolve,reject)=>{
    const child=spawn(binary,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let output='';
    child.stdout.on('data',data=>{output+=data;});child.stderr.on('data',data=>{output+=data;});
    child.on('error',reject);child.on('exit',code=>code===0?resolve(output):reject(new Error(output.slice(-2500))));
    child.stdin.end(input);
  });
}
await mkdir(directory,{recursive:true});
const initialized=await access(`${directory}/PG_VERSION`).then(()=>true,()=>false);
if(!initialized) {
  const temporary=await mkdtemp(join(tmpdir(),'work-pg-'));
  const passwordFile=join(temporary,'init-password');
  try{await writeFile(passwordFile,`${password}\n`,{flag:'wx',mode:0o600});await execute(initdb,['-D',directory,'-U',user,'--encoding=UTF8','--locale=C','--auth=scram-sha-256',`--pwfile=${passwordFile}`]);}
  finally{await unlink(passwordFile).catch(()=>undefined);await rmdir(temporary).catch(()=>undefined);}
}
if(process.argv.includes('--stop')) {await execute(pg_ctl,['-D',directory,'-w','stop','-m','fast']);console.log('Stopped project-local PostgreSQL; data preserved.');process.exit(0);}
const running=await execute(pg_ctl,['-D',directory,'status']).then(()=>true,()=>false);
if(!running) await execute(pg_ctl,['-D',directory,'-l',logfile,'-w','-t','30','-o','-h 127.0.0.1 -p 55432','start']);
const require=createRequire(new URL('../../apps/api/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
ownerUrl.pathname='/postgres';
const admin=new PrismaClient({datasourceUrl:ownerUrl.toString()});
try {
  await admin.$connect();
  const roles=await admin.$queryRaw`SELECT 1 FROM pg_roles WHERE rolname='work_app'`;
  if(!roles.length) {
    const statements=await admin.$queryRaw`SELECT format('CREATE ROLE work_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L',${process.env.APP_DATABASE_PASSWORD}) AS sql`;
    await admin.$executeRawUnsafe(statements[0].sql);
  }
  const databases=await admin.$queryRaw`SELECT 1 FROM pg_database WHERE datname=${database}`;
  if(!databases.length) await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
}finally{await admin.$disconnect();}
const target=new PrismaClient({datasourceUrl:process.env.MIGRATION_DATABASE_URL});
try{await target.$executeRawUnsafe('REVOKE CREATE ON SCHEMA public FROM PUBLIC');await target.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO work_app');}finally{await target.$disconnect();}
console.log('Project-local PostgreSQL ready on 127.0.0.1:55432. Existing clusters and other services were not changed.');
// pg_ctl has detached the database server. Do not retain the launcher (and its
// loaded Prisma DLL) after all provisioning connections have been closed.
process.exit(0);
