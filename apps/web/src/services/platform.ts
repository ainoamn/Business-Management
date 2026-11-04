export class PlatformHttpError extends Error {constructor(readonly status:number,readonly code?:string){super(`Request failed (${status})`);}}
export async function platformRequest<T>(path:string,options:{method?:string;body?:unknown;csrf?:string;signal?:AbortSignal}={}):Promise<T> {
  const response=await fetch(`/api/v1/${path}`,{method:options.method??'GET',credentials:'same-origin',cache:'no-store',signal:options.signal,headers:{...(options.body!==undefined&&!(options.body instanceof FormData)?{'Content-Type':'application/json'}:{}),...(options.csrf?{'X-CSRF-Token':options.csrf}:{})},body:options.body instanceof FormData?options.body:options.body!==undefined?JSON.stringify(options.body):undefined});
  if(!response.ok) {const data:unknown=await response.json().catch(()=>null);const code=data&&typeof data==='object'&&'code' in data&&typeof data.code==='string'&&/^[A-Z][A-Z0-9_]{2,59}$/.test(data.code)?data.code:undefined;throw new PlatformHttpError(response.status,code);}
  return response.json() as Promise<T>;
}
