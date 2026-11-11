import { config } from 'dotenv';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
config({path:fileURLToPath(new URL('../../.env',import.meta.url)),quiet:true});
if (!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is required');
const require = createRequire(new URL('../../apps/api/package.json',import.meta.url));
const cli = require.resolve('prisma/build/index.js');
const schema = fileURLToPath(new URL('../../apps/api/prisma/schema.prisma',import.meta.url));
const child = spawn(process.execPath, [cli,'migrate','deploy','--schema',schema], {
  stdio:'inherit',env:{...process.env,CHECKPOINT_DISABLE:'1',PRISMA_HIDE_UPDATE_MESSAGE:'1',DATABASE_URL:process.env.MIGRATION_DATABASE_URL},
});
child.on('error',()=>{console.error('Could not launch Prisma migration process');process.exitCode=1;});
child.on('exit',code => {process.exitCode = code ?? 1;});
