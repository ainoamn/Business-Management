import {createHash,createHmac,randomBytes,scrypt as derive,timingSafeEqual} from 'node:crypto';
const options={N:131072,r:8,p:1,maxmem:256*1024*1024};
function scrypt(password:string,salt:string):Promise<Buffer>{return new Promise((resolve,reject)=>derive(password,salt,64,options,(error,key)=>error?reject(error):resolve(key)));}
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt);return `scrypt-v1$${salt}$${key.toString('hex')}`;}
export async function verifyPassword(password:string,hash:string){const [version,salt,stored]=hash.split('$');if(version!=='scrypt-v1'||!salt||!stored||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(stored))return false;const key=await scrypt(password,salt);return timingSafeEqual(key,Buffer.from(stored,'hex'));}
export const dummyPasswordHash=`scrypt-v1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
export function digest(value:string){return createHash('sha256').update(value).digest('hex');}
export function csrfFor(token:string){return createHmac('sha256',token).update('platform-csrf-v1').digest('hex');}
export function matchesCsrf(token:string,provided:string|undefined){return !!provided&&/^[a-f0-9]{64}$/.test(provided)&&timingSafeEqual(Buffer.from(csrfFor(token),'hex'),Buffer.from(provided,'hex'));}
export function originAllowed(origin:string|undefined,configured:string,development:boolean){if(!origin)return false;if(origin===new URL(configured).origin)return true;if(!development)return false;try{const a=new URL(origin),b=new URL(configured);return a.protocol==='http:'&&b.protocol==='http:'&&['localhost','127.0.0.1'].includes(a.hostname)&&['localhost','127.0.0.1'].includes(b.hostname)&&a.port===b.port&&a.origin===origin;}catch{return false;}}
