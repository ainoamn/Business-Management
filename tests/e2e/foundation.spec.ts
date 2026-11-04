import { expect, test } from '@playwright/test';

test('real service status, RTL/LTR and persistent preferences',async({page})=>{
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.getByRole('heading',{name:'البداية الصحيحة، لأعمال أكبر.'})).toBeVisible();
  await expect(page.getByRole('status')).toContainText('الخدمات الأساسية جاهزة',{timeout:15000});
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
  await page.getByRole('button',{name:'Check again'}).click();
  await expect(page.getByRole('status')).toContainText('Core services are ready');
});

test('shows an honest error when the API is unreachable',async({page})=>{
  await page.route('**/api/v1/health/ready',route=>route.abort());
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('تعذر الاتصال بالخادم');
  await expect(page.getByText('غير متاح',{exact:true})).toHaveCount(4);
  await page.unroute('**/api/v1/health/ready');
  await page.getByRole('button',{name:'إعادة الفحص'}).click();
  await expect(page.getByRole('status')).toContainText('الخدمات الأساسية جاهزة');
});
