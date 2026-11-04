import {createCipheriv,createDecipheriv,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

/**
 * MFA credential encryption key (32 bytes).
 * Falls back to AI_CREDENTIAL_KEY if MFA_CREDENTIAL_KEY not set.
 */
export function parseMfaKey(value:string){
  const key=/^[a-fA-F0-9]{64}$/.test(value)?Buffer.from(value,'hex')
    :/^[A-Za-z0-9+/]{43}=$/.test(value)?Buffer.from(value,'base64'):null;
  if(!key||key.length!==32)throw new Error('MFA_CREDENTIAL_KEY_INVALID');
  return key;
}

/**
 * Seal MFA secret for storage (AES-256-GCM).
 */
export function sealMfaSecret(key:Buffer,secret:string,accountId:string,accountType:string){
  if(key.length!==32)throw new Error('MFA_CREDENTIAL_KEY_INVALID');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(`mfa:secret:${accountType}:${accountId}`));
  const data=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join(':');
}

/**
 * Open MFA secret from storage.
 */
export function openMfaSecret(key:Buffer,sealed:string,accountId:string,accountType:string){
  const parts=sealed.split(':');
  if(parts.length!==4||parts[0]!=='v1'||parts.slice(1).some(value=>!/^[a-zA-Z0-9_-]+$/.test(value)))
    throw new Error('MFA_SECRET_INVALID');
  const iv=Buffer.from(parts[1]!,'base64url'),
    tag=Buffer.from(parts[2]!,'base64url'),
    data=Buffer.from(parts[3]!,'base64url');
  if(iv.length!==12||tag.length!==16||data.length>200)throw new Error('MFA_SECRET_INVALID');
  const decipher=createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAAD(Buffer.from(`mfa:secret:${accountType}:${accountId}`));
  decipher.setAuthTag(tag);
  try{
    return Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8');
  }catch{
    throw new Error('MFA_SECRET_INVALID');
  }
}

/**
 * Generate a random base32 secret for TOTP (20 bytes = 160 bits).
 */
export function generateTotpSecret():string{
  const bytes=randomBytes(20);
  return base32Encode(bytes);
}

/**
 * Generate TOTP code using RFC 6238 (SHA1, 30s window, 6 digits).
 */
export function generateTotpCode(secret:string,time:number=Date.now()):string{
  const counter=Math.floor(time/30000);
  const secretBytes=base32Decode(secret);
  const counterBuffer=Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac=createHmac('sha1',secretBytes).update(counterBuffer).digest();
  const offset=hmac[19]!&0x0f;
  const code=((hmac[offset]!&0x7f)<<24|(hmac[offset+1]!)<<16|(hmac[offset+2]!)<<8|hmac[offset+3]!)%1000000;
  return code.toString().padStart(6,'0');
}

/**
 * Verify TOTP code (checks current window ±1).
 */
export function verifyTotpCode(secret:string,code:string,time:number=Date.now()):boolean{
  return matchingTotpCounter(secret,code,time)!==null;
}

export function normalizeMfaCode(code:string){
  return code.trim().replace(/[٠-٩۰-۹]/g,value=>String(value.charCodeAt(0)-(value>='۰'?0x6f0:0x660))).replace(/[\s-]/g,'').toUpperCase();
}

export function matchingTotpCounter(secret:string,code:string,time:number=Date.now()):bigint|null{
  code=normalizeMfaCode(code);
  if(!/^\d{6}$/.test(code))return null;
  for(const offset of [-1,0,1]){
    const testTime=time+offset*30000;
    if(testTime>=0&&timingSafeEqual(Buffer.from(generateTotpCode(secret,testTime)),Buffer.from(code)))return BigInt(Math.floor(testTime/30000));
  }
  return null;
}

/**
 * Eight independent 128-bit recovery codes, displayed in readable groups.
 */
export function generateRecoveryCodes():string[]{
  const codes:string[]=[];
  for(let i=0;i<8;i++){
    const bytes=randomBytes(16);
    codes.push(bytes.toString('hex').toUpperCase().match(/.{8}/g)!.join('-'));
  }
  return codes;
}

/**
 * Hash recovery code for storage.
 */
export function hashRecoveryCode(code:string):string{
  return createHmac('sha256',Buffer.from('recovery-code-v1')).update(normalizeMfaCode(code)).digest('hex');
}

/**
 * Generate otpauth:// URI for QR code.
 */
export function generateTotpUri(secret:string,label:string,issuer:string='WorkManagement'):string{
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// Base32 encoding/decoding (RFC 4648)
const BASE32_ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(bytes:Buffer):string{
  let result='',bits=0,value=0;
  for(const byte of bytes){
    value=(value<<8)|byte;
    bits+=8;
    while(bits>=5){
      result+=BASE32_ALPHABET[(value>>>(bits-5))&31];
      bits-=5;
    }
  }
  if(bits>0)result+=BASE32_ALPHABET[(value<<(5-bits))&31];
  return result;
}

function base32Decode(str:string):Buffer{
  str=str.replace(/=+$/,'').toUpperCase();
  const bytes:number[]=[];
  let bits=0,value=0;
  for(const char of str){
    const index=BASE32_ALPHABET.indexOf(char);
    if(index===-1)throw new Error('INVALID_BASE32');
    value=(value<<5)|index;
    bits+=5;
    if(bits>=8){
      bytes.push((value>>>(bits-8))&255);
      bits-=8;
    }
  }
  return Buffer.from(bytes);
}
