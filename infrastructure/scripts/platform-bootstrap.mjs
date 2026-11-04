import {config} from 'dotenv';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createInterface} from 'node:readline/promises';
import {scrypt,randomBytes,randomUUID} from 'node:crypto';

config({path:fileURLToPath(new URL('../../.env',import.meta.url)),quiet:true});
if(!process.stdin.isTTY) throw new Error('Run platform:bootstrap in an interactive terminal; passwords are never accepted in command arguments.');
const require=createRequire(new URL('../../apps/api/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient({datasourceUrl:process.env.MIGRATION_DATABASE_URL});
const reader=createInterface({input:process.stdin,output:process.stdout});
async function hidden(question) {
  reader.close();
  process.stdout.write(question);
  process.stdin.setRawMode(true);process.stdin.resume();
  return new Promise(resolve=>{
    let value='';
    const handler=chunk=>{
      for(const character of chunk.toString()) {
        if(character==='\u0003') {process.stdin.setRawMode(false);process.exit(130);}
        if(character==='\r'||character==='\n') {process.stdin.off('data',handler);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');resolve(value);return;}
        if(character==='\u007f'||character==='\b') value=value.slice(0,-1);else value+=character;
      }
    };
    process.stdin.on('data',handler);
  });
}
try {
  const email=(await reader.question('Owner email: ')).trim().toLowerCase();
  const name=(await reader.question('Owner display name: ')).trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||name.length<2||name.length>120) throw new Error('Invalid email or display name');
  const password=await hidden('Owner password (12–128 characters; hidden): ');
  if(password.length<12||password.length>128) throw new Error('Password must be 12–128 characters');
  const salt=randomBytes(16).toString('hex');
  const key=await new Promise((resolve,reject)=>scrypt(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024},(error,result)=>error?reject(error):resolve(result)));
  await db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(781203341)`;
    if(await tx.platformAccount.count({where:{isOwner:true}})) throw new Error('An owner already exists. Existing accounts were not changed.');
    const owner=await tx.platformAccount.create({data:{email,displayName:name,passwordHash:`scrypt-v1$${salt}$${key.toString('hex')}`,isOwner:true}});
    await tx.platformSettings.upsert({where:{id:'main'},update:{},create:{id:'main',platformName:'Work Management Platform',supportEmail:email,footerText:''}});
    await tx.platformAudit.create({data:{actorId:owner.id,action:'OWNER_PROVISIONED',resource:'accounts',resourceId:owner.id,requestId:randomUUID()}});
  });
  console.log('Owner created. Sign in at http://127.0.0.1:3000/platform. No password was saved to a file.');
}finally{reader.close();await db.$disconnect();}
