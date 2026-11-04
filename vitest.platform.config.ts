import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/integration/platform-admin.test.ts'],environment:'node',testTimeout:30000,hookTimeout:60000,fileParallelism:false}});
