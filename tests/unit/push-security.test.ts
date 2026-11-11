import {describe,it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {createECDH,createPublicKey,randomBytes,randomUUID,verify} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import type {LookupAllOptions,LookupAddress} from 'node:dns';
const lookupAll:(hostname:string,options:LookupAllOptions)=>Promise<LookupAddress[]>=lookup;
import {pushCredentialKey,sealPushCredentials,openPushCredentials,pushCredentialFingerprint} from '../../apps/api/src/notifications/push-crypto';
import {isPublicPushAddress,pushEndpoint,resolvePushEndpoint} from '../../apps/api/src/notifications/push-endpoint';
import {encryptedPushRequest,vapidConfiguration,validPushSubscription,type PushLibrary} from '../../apps/api/src/notifications/web-push-adapter';
vi.mock('node:dns/promises',()=>({lookup:vi.fn()}));
const require=createRequire(new URL('../../apps/api/package.json',import.meta.url)),webpush=require('web-push') as PushLibrary,nested=createRequire(require.resolve('web-push'));
const ece=nested('http_ece') as {decrypt:(bytes:Buffer,options:{version:string;privateKey:ReturnType<typeof createECDH>;authSecret:string})=>Buffer};
describe('browser push credentials and endpoint boundary',()=>{
 it('encrypts subscription capabilities with identity and revision binding',()=>{
  const key=randomBytes(32),id=randomUUID(),plaintext=JSON.stringify({endpoint:'https://push.example.com/private-capability',keys:{auth:'private-browser-secret'}}),sealed=sealPushCredentials(key,plaintext,id,1);expect(sealed).not.toContain('private');expect(openPushCredentials(key,sealed,id,1)).toBe(plaintext);expect(()=>openPushCredentials(key,sealed,randomUUID(),1)).toThrow();expect(()=>openPushCredentials(key,sealed,id,2)).toThrow();expect(()=>openPushCredentials(randomBytes(32),sealed,id,1)).toThrow();const parts=sealed.split(':'),bytes=Buffer.from(parts[3]!,'base64url');bytes[0]=bytes[0]!^1;parts[3]=bytes.toString('base64url');expect(()=>openPushCredentials(key,parts.join(':'),id,1)).toThrow();expect(pushCredentialKey(key.toString('hex'))?.equals(key)).toBe(true);expect(pushCredentialKey('short')).toBeNull();expect(pushCredentialFingerprint(key,plaintext)).toBe(pushCredentialFingerprint(key,plaintext));expect(pushCredentialFingerprint(key,plaintext)).not.toBe(pushCredentialFingerprint(randomBytes(32),plaintext));
 });
 it('rejects private, reserved and mapped address forms',()=>{
  for(const address of ['0.0.0.0','10.1.2.3','100.100.100.200','127.0.0.1','169.254.169.254','172.31.255.1','192.168.10.2','192.0.2.1','198.18.1.1','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','::','::1','::ffff:127.0.0.1','::ffff:8.8.8.8','fc00::1','fe80::1','2001:db8::1','2002:7f00:1::'])expect(isPublicPushAddress(address),address).toBe(false);
  for(const address of ['8.8.8.8','1.1.1.1','172.32.0.1','2606:4700:4700::1111','2001:4860:4860::8888'])expect(isPublicPushAddress(address),address).toBe(true);
 });
 it('accepts only credential-free public HTTPS endpoints on the standard port',()=>{
  for(const url of ['http://push.example.com','file:///private','https://user:password@push.example.com','https://push.example.com/#secret','https://push.example.com:444/send','https://localhost/send','https://device.local/send','https://host.internal/send','https://2130706433/send','https://0x7f000001/send','https://[::1]/send','https://[::ffff:127.0.0.1]/send'])expect(()=>pushEndpoint(url),url).toThrow();expect(pushEndpoint('https://push.example.com/send?capability=opaque').protocol).toBe('https:');
 });
 it('pins a public DNS result and refuses mixed private/public answers',async()=>{
  vi.mocked(lookupAll).mockResolvedValueOnce([{address:'8.8.8.8',family:4}]);const resolved=await resolvePushEndpoint('https://push.example.com/send',Date.now()+1000);expect(resolved.address).toBe('8.8.8.8');expect(resolved.family).toBe(4);vi.mocked(lookupAll).mockResolvedValueOnce([{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}]);await expect(resolvePushEndpoint('https://push.example.com/send',Date.now()+1000)).rejects.toThrow('PUSH_ENDPOINT_REJECTED');
 });
 it('generates decryptable aes128gcm payloads and valid origin-bound ES256 VAPID signatures',()=>{
  const keys=webpush.generateVAPIDKeys(),config=vapidConfiguration('mailto:push@example.com',keys.publicKey,keys.privateKey)!;expect(config).not.toBeNull();const receiver=createECDH('prime256v1');receiver.generateKeys();const auth=randomBytes(16).toString('base64url'),subscription={endpoint:'https://push.example.com/send',keys:{p256dh:receiver.getPublicKey().toString('base64url'),auth}},payload={title:'تحديث داخل مساحة العمل',body:'Open your workspace',data:{deliveryId:randomUUID()}},request=encryptedPushRequest(config,subscription,payload);
  expect(request.headers['Content-Encoding']).toBe('aes128gcm');expect(request.headers.TTL).toBe(300);expect(request.headers.Topic).toMatch(/^[a-z0-9_-]{32}$/i);expect(JSON.parse(ece.decrypt(request.body,{version:'aes128gcm',privateKey:receiver,authSecret:auth}).toString('utf8'))).toEqual(payload);const jwt=String(request.headers.Authorization).match(/t=([^,\s]+)/)![1]!,parts=jwt.split('.'),claims=JSON.parse(Buffer.from(parts[1]!,'base64url').toString('utf8')) as {aud:string;sub:string;exp:number};expect(claims.aud).toBe('https://push.example.com');expect(claims.sub).toBe(config.subject);expect(claims.exp).toBeGreaterThan(Date.now()/1000);const point=Buffer.from(keys.publicKey,'base64url'),publicKey=createPublicKey({format:'jwk',key:{kty:'EC',crv:'P-256',x:point.subarray(1,33).toString('base64url'),y:point.subarray(33).toString('base64url')}});expect(verify('sha256',Buffer.from(parts[0]+'.'+parts[1]),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(parts[2]!,'base64url'))).toBe(true);
 });
 it('refuses mismatched VAPID keys and malformed browser encryption keys',()=>{
  const one=webpush.generateVAPIDKeys(),two=webpush.generateVAPIDKeys();expect(vapidConfiguration('mailto:push@example.com',one.publicKey,two.privateKey)).toBeNull();expect(vapidConfiguration(undefined,one.publicKey,one.privateKey)).toBeNull();expect(vapidConfiguration('https://localhost',one.publicKey,one.privateKey)).toBeNull();expect(()=>validPushSubscription({endpoint:'https://push.example.com/send',keys:{p256dh:'A'.repeat(87),auth:'A'.repeat(22)}})).toThrow();
 });
});
