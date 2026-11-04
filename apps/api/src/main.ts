import { createApp } from './bootstrap';
import { environment } from './config/environment';

async function main() {
  const app = await createApp();
  try {
    await app.listen(environment.PORT,'127.0.0.1');
  } catch (error) {
    await Promise.race([
      app.close().catch(()=>undefined),
      new Promise<void>(resolve=>{setTimeout(resolve,3000).unref();}),
    ]);
    throw error;
  }
}
main().catch(()=>{ console.error('API startup failed. Check environment, database availability and migrations.'); process.exit(1); });
