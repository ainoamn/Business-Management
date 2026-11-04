import { expect, test } from '@playwright/test';

// UI-only fixtures verify rendering and recovery. They do NOT prove that
// PostgreSQL, Redis, the worker, or S3 are available; integration/E2E do that.
const healthy={status:'ready',checks:{database:'up',redis:'up',queue:'up',storage:'up'},timestamp:'2026-11-03T08:00:00.000Z'};
test('renders service states, language, theme and mobile layout from a contract fixture',async({page})=>{
  await page.route('**/api/v1/health/ready',route=>route.fulfill({json:healthy}));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.getByRole('status')).toContainText('الخدمات الأساسية جاهزة');
  await expect(page.getByText('متصل',{exact:true})).toHaveCount(4);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'English',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('dir','ltr');
  await expect(page.getByRole('heading',{name:'Built for the work ahead.'})).toBeVisible();
  await page.getByRole('button',{name:'Toggle appearance'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir','ltr');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('renders an unreachable API and recovers on retry using explicit fixtures',async({page})=>{
  let failed=true;
  await page.route('**/api/v1/health/ready',route=>failed?route.abort():route.fulfill({json:healthy}));
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('تعذر الاتصال بالخادم');
  await expect(page.getByText('غير متاح',{exact:true})).toHaveCount(4);
  failed=false;
  await page.getByRole('button',{name:'إعادة الفحص'}).click();
  await expect(page.getByRole('status')).toContainText('الخدمات الأساسية جاهزة');
});
test('renders partial dependency failure without reporting success',async({page})=>{
  await page.route('**/api/v1/health/ready',route=>route.fulfill({status:503,json:{...healthy,status:'not_ready',checks:{...healthy.checks,storage:'down'}}}));
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('تحتاج بعض الخدمات إلى التشغيل');
  await expect(page.getByText('متصل',{exact:true})).toHaveCount(3);
  await expect(page.getByText('غير متاح',{exact:true})).toHaveCount(1);
});
