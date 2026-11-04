import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import https from 'node:https';
// Text extraction has no network requirement and never executes document scripts.
const unavailable=()=>{throw new Error('PDF network access is disabled');};
globalThis.fetch=async()=>unavailable();http.request=unavailable;http.get=unavailable;https.request=unavailable;https.get=unavailable;
function readableText(items){
 const lines=[],buckets=new Map();for(const item of items.slice(0,50000)){if(typeof item.str!=='string'||!Array.isArray(item.transform))continue;const x=item.transform[4],y=item.transform[5],size=Math.max(1,item.height||Math.hypot(item.transform[0],item.transform[1]));if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(size))continue;const key=Math.round(y*2);let line=buckets.get(key)??buckets.get(key-1)??buckets.get(key+1);if(!line){line={y,items:[]};lines.push(line);buckets.set(key,line);}line.items.push({str:item.str.normalize('NFKC'),x,width:item.width??0,size});}
 return lines.sort((a,b)=>b.y-a.y).map(line=>{const text=line.items.map(item=>item.str).join(''),arabic=(text.match(/\p{Script=Arabic}/gu)??[]).length,latin=(text.match(/\p{Script=Latin}/gu)??[]).length,rtl=arabic>latin;const ordered=line.items.sort((a,b)=>rtl?b.x-a.x:a.x-b.x);let value='',previous;for(const item of ordered){if(previous){const gap=rtl?previous.x-item.x-item.width:item.x-previous.x-previous.width;if(gap>Math.max(.5,item.size*.18)&&!/\s$/.test(value)&&!/^\s/.test(item.str))value+=' ';}value+=item.str;previous=item;}return value.trim();}).filter(Boolean).join('\n');
}
let job;
try{
 const chunks=[];let bytes=0;for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>26214400)throw new Error('PDF too large');chunks.push(chunk);}
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const root=dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json')));
 const asset=name=>join(root,name).replaceAll('\\','/')+'/';
 job=getDocument({data:new Uint8Array(Buffer.concat(chunks)),disableFontFace:true,useSystemFonts:false,isEvalSupported:false,useWorkerFetch:false,disableAutoFetch:true,disableStream:true,stopAtErrors:true,maxImageSize:0,cMapUrl:asset('cmaps'),cMapPacked:true,standardFontDataUrl:asset('standard_fonts'),wasmUrl:asset('wasm'),verbosity:0});
 const document=await job.promise;const pages=Math.min(document.numPages,200),text=[];let length=0,truncated=document.numPages>200;
 for(let number=1;number<=pages;number++){const page=await document.getPage(number),content=await page.getTextContent();const value=readableText(content.items);if(content.items.length>50000)truncated=true;const part=value.slice(0,Math.max(0,60000-length));text.push(part);length+=part.length;if(value.length>part.length){truncated=true;break;}page.cleanup();if(length>=60000){truncated=truncated||number<document.numPages;break;}}
 console.log(JSON.stringify({text:text.join('\n\n'),truncated,pages:document.numPages}));
}catch(error){console.log(JSON.stringify({error:error&&typeof error==='object'&&'name' in error&&error.name==='PasswordException'?'AI_PDF_PASSWORD_REQUIRED':'AI_DOCUMENT_UNAVAILABLE'}));}finally{await job?.destroy().catch(()=>undefined);}
