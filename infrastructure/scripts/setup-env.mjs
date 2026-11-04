import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const target = new URL('../../.env', import.meta.url);
const template = await readFile(new URL('../../.env.example', import.meta.url), 'utf8');
const replacements = new Map([
  ['REPLACE_WITH_RANDOM_OWNER_PASSWORD',randomBytes(24).toString('hex')],
  ['REPLACE_WITH_RANDOM_APP_PASSWORD',randomBytes(24).toString('hex')],
  ['REPLACE_WITH_RANDOM_REDIS_PASSWORD',randomBytes(24).toString('hex')],
  ['REPLACE_WITH_RANDOM_ACCESS_KEY',randomBytes(12).toString('hex')],
  ['REPLACE_WITH_RANDOM_SECRET_KEY',randomBytes(24).toString('hex')],
]);
let content = template;
for (const [key,value] of replacements) content = content.replaceAll(key,value);
try {
  await writeFile(target,content,{flag:'wx',mode:0o600});
  console.log('Created .env with random local credentials. Existing data was not changed.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('.env already exists; kept unchanged.');
}
