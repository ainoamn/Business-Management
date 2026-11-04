import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'tests/e2e',fullyParallel:true,retries:0,reporter:'list',
  use:{baseURL:'http://127.0.0.1:3000',trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
  webServer:[
    {command:'pnpm start:api',url:'http://127.0.0.1:4000/api/v1/health/live',reuseExistingServer:!process.env.CI,timeout:30000},
    {command:'pnpm start:web',url:'http://127.0.0.1:3000',reuseExistingServer:!process.env.CI,timeout:30000},
  ],
});
