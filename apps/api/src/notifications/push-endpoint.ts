import {lookup} from 'node:dns/promises';
import {BlockList,isIP} from 'node:net';
const blocked=new BlockList();
for(const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const)blocked.addSubnet(address,prefix,'ipv4');
for(const [address,prefix] of [['2001::',32],['2001:10::',28],['2001:db8::',32],['2002::',16]] as const)blocked.addSubnet(address,prefix,'ipv6');
const globalV6=new BlockList();globalV6.addSubnet('2000::',3,'ipv6');
export class PushEndpointRejected extends Error{constructor(){super('PUSH_ENDPOINT_REJECTED');}}
export function isPublicPushAddress(address:string){const family=isIP(address);return family===4?!blocked.check(address,'ipv4'):family===6&&globalV6.check(address,'ipv6')&&!blocked.check(address,'ipv6');}
export function pushEndpoint(value:string){
 let url:URL;try{url=new URL(value);}catch{throw new PushEndpointRejected();}
 const hostname=url.hostname.replace(/^\[|\]$/g,'');
 if(value.length>1000||url.protocol!=='https:'||url.username||url.password||url.hash||url.port&&url.port!=='443'||!hostname||hostname.length>253||!isIP(hostname)&&(!hostname.includes('.')||/(?:^|\.)(?:localhost|local|internal|home|invalid|test)$/.test(hostname))||isIP(hostname)&&!isPublicPushAddress(hostname))throw new PushEndpointRejected();
 return url;
}
export async function resolvePushEndpoint(value:string,deadline:number){
 const url=pushEndpoint(value),hostname=url.hostname.replace(/^\[|\]$/g,'');
 if(isIP(hostname))return {url,address:hostname,family:isIP(hostname) as 4|6};
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{const addresses=await Promise.race([lookup(hostname,{all:true,verbatim:true}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('PUSH_NETWORK_TIMEOUT')),Math.max(1,deadline-Date.now()));timer.unref();})]);if(!addresses.length||addresses.some(row=>!isPublicPushAddress(row.address)))throw new PushEndpointRejected();const chosen=addresses[0]!;return {url,address:chosen.address,family:chosen.family as 4|6};}finally{if(timer)clearTimeout(timer);}
}
