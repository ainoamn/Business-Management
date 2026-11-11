import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
export function pushCredentialKey(value:string|undefined){
 if(!value||!/^[a-f0-9]{64}$/i.test(value))return null;
 return Buffer.from(value,'hex');
}
export function sealPushCredentials(key:Buffer,plaintext:string,id:string,revision:number){
 if(key.length!==32||Buffer.byteLength(plaintext)>4096)throw Error('PUSH_CREDENTIAL_INVALID');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(`work-push:${id}:${revision}`));
 const encrypted=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join(':');
}
export function openPushCredentials(key:Buffer,sealed:string,id:string,revision:number){
 try{if(sealed.length>6000)throw Error();const parts=sealed.split(':');if(key.length!==32||parts.length!==4||parts[0]!=='v1'||parts.slice(1).some(value=>!/^[a-z0-9_-]+$/i.test(value)))throw Error();const iv=Buffer.from(parts[1]!,'base64url'),tag=Buffer.from(parts[2]!,'base64url'),bytes=Buffer.from(parts[3]!,'base64url');if(iv.length!==12||tag.length!==16||bytes.length>4096)throw Error();const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(Buffer.from(`work-push:${id}:${revision}`));decipher.setAuthTag(tag);return Buffer.concat([decipher.update(bytes),decipher.final()]).toString('utf8');}catch{throw Error('PUSH_CREDENTIAL_INVALID');}
}
export function pushCredentialFingerprint(key:Buffer,value:string){if(key.length!==32)throw Error('PUSH_CREDENTIAL_INVALID');return createHmac('sha256',key).update('work-push-fingerprint-v1\0'+value).digest('hex');}
