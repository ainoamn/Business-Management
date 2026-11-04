import {copyFile,mkdir} from 'node:fs/promises';
const target=new URL('../../apps/api/dist/ai/',import.meta.url);await mkdir(target,{recursive:true});
await copyFile(new URL('../../apps/api/src/ai/pdf-text.mjs',import.meta.url),new URL('pdf-text.mjs',target));
