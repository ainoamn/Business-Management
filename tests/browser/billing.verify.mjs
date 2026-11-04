import {config} from 'dotenv';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync,spawn} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';

config({path:fileURLToPath(new URL('../../.env',import.meta.url)),quiet:true});
const require=createRequire(new URL('../../apps/api/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const database=`billing_ui_${randomBytes(8).toString('hex')}`;
const source=new URL(process.env.MIGRATION_DATABASE_URL);
if(process.env.DEPLOYMENT_ENV!=='development'||!['127.0.0.1','localhost'].includes(source.hostname))throw new Error('Browser verification is limited to isolated local PostgreSQL databases');
const provisioner=new PrismaClient({datasourceUrl:source.toString()});
let admin,app,browser,webProcess,created=false;
const results=[];
try {
  const webReady=()=>fetch('http://127.0.0.1:3000/',{signal:globalThis.AbortSignal.timeout(1000)}).then(response=>response.ok,()=>false);
  if(!await webReady()) {
    const webRequire=createRequire(new URL('../../apps/web/package.json',import.meta.url));
    webProcess=spawn(process.execPath,[webRequire.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3000'],{cwd:fileURLToPath(new URL('../../apps/web',import.meta.url)),windowsHide:true,stdio:'ignore'});
    const deadline=Date.now()+30000;
    while(!await webReady()) {if(Date.now()>deadline||webProcess.exitCode!==null)throw new Error('Web preview failed to start');await new Promise(resolve=>setTimeout(resolve,250));}
  }
  await provisioner.$executeRawUnsafe(`CREATE DATABASE "${database}"`);created=true;
  source.pathname=`/${database}`;
  execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',fileURLToPath(new URL('../../apps/api/prisma/schema.prisma',import.meta.url))],{env:{...process.env,DATABASE_URL:source.toString()},stdio:'pipe',timeout:30000,windowsHide:true});
  admin=new PrismaClient({datasourceUrl:source.toString()});
  const url=new URL(process.env.DATABASE_URL);url.pathname=`/${database}`;process.env.DATABASE_URL=url.toString();
  const {hashPassword}=require('../../apps/api/dist/platform/security.js');
  const password=`Browser-test-${randomBytes(24).toString('hex')}`;
  const email=`browser-${randomUUID()}@example.invalid`;
  await admin.platformAccount.create({data:{email,displayName:'تحقق الإدارة — قاعدة اختبار معزولة',passwordHash:await hashPassword(password),isOwner:true}});
  await admin.platformSettings.create({data:{id:'main',platformName:'اختبار إدارة المنصة',supportEmail:email,footerText:'بيانات تحقق مؤقتة'}});
  await admin.organization.create({data:{name:'مؤسسة اختبار المتصفح',slug:`ui-${randomUUID()}`}});
  const seedCatalogue=JSON.parse(await readFile(new URL('../../infrastructure/catalog/initial-plans.json',import.meta.url),'utf8'));await admin.platformPlan.createMany({data:seedCatalogue});const free=await admin.platformPlan.findUniqueOrThrow({where:{code:'free'}}),trial=await admin.platformPlan.findUniqueOrThrow({where:{code:'business'}});await admin.billingSettings.create({data:{id:'main',freePlanId:free.id,trialPlanId:trial.id}});
  const {createApp}=require('../../apps/api/dist/bootstrap.js');app=await createApp();await app.listen(4000,'127.0.0.1');
  browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  const galleryDirectory=fileURLToPath(new URL('../../docs/testing',import.meta.url));
  await mkdir(galleryDirectory,{recursive:true});
  const capture=async name=>{await page.screenshot({path:`${galleryDirectory}/${name}.png`,fullPage:true});};
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:3000/admin');
  await expect(page.getByRole('heading',{name:'دخول المشرف',exact:true})).toBeVisible();
  await page.getByLabel('البريد الإلكتروني',{exact:true}).fill(email);
  await page.getByLabel('كلمة المرور',{exact:true}).fill(password);
  await page.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();
  await expect(page.getByRole('heading',{name:'نظرة عامة',exact:true})).toBeVisible();
  await expect(page.getByText('مؤشرات مباشرة من قاعدة البيانات.',{exact:false})).toBeVisible();
  results.push('real owner sign-in and database overview');
  await page.goto('http://127.0.0.1:3000/platform/billing');await expect(page.getByRole('heading',{name:'الاشتراكات والفوترة',exact:true,level:1})).toBeVisible();await expect(page.getByRole('cell',{name:'Starter',exact:true})).toBeVisible();await page.getByRole('row').filter({has:page.getByRole('cell',{name:'Starter',exact:true})}).getByRole('button',{name:'تعديل',exact:true}).click();await page.getByRole('dialog').getByLabel('السعر الشهري للمستخدم OMR',{exact:true}).fill('2.750');await page.getByRole('dialog').getByLabel('السعر السنوي للمستخدم OMR',{exact:true}).fill('33.000');await page.getByRole('dialog').getByLabel('أقصى مشاريع نشطة — فارغ دون حد',{exact:true}).fill('25');await page.getByRole('dialog').getByRole('button',{name:'حفظ التغييرات',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.reload();await expect(page.getByRole('cell',{name:/2.750/})).toBeVisible();const catalogue=await (await page.request.get('http://127.0.0.1:3000/api/v1/public/billing/plans')).json();expect(catalogue.items.find(row=>row.code==='starter').annualPrice).toBe('33.000');await capture('billing-admin-plans');results.push('editable monthly and annual database prices reflected in the actual public catalogue');
  await page.getByRole('button',{name:'التجربة وتعليمات السداد',exact:true}).click();await page.getByLabel('إتاحة الفواتير والسداد اليدوي',{exact:true}).check();await page.getByLabel('تعليمات السداد اليدوي ومرجع التحقق',{exact:true}).fill('تعليمات اختبار محلي: راجع التحصيل الحقيقي قبل تسجيل قيد يدوي.');await page.getByLabel('بريد دعم الفوترة',{exact:true}).fill('billing@example.invalid');await page.getByRole('button',{name:'حفظ التغييرات',exact:true}).click();await expect.poll(async()=> (await admin.billingSettings.findUnique({where:{id:'main'}}))?.manualPaymentsEnabled).toBe(true);await capture('billing-admin-settings');results.push('explicit manual settlement instructions, free/trial selection and persistent settings');
  await page.getByRole('button',{name:'قسائم الخصم',exact:true}).click();await page.getByRole('button',{name:'إضافة قسيمة',exact:true}).click();await page.getByRole('dialog').getByLabel('رمز القسيمة',{exact:true}).fill('BROWSER15');await page.getByRole('dialog').getByLabel('الاسم',{exact:true}).fill('قسيمة اختبار المتصفح');await page.getByRole('dialog').getByLabel('نسبة الخصم ٪ — عند اختيار نسبة',{exact:true}).fill('15');await page.getByRole('dialog').getByLabel('Starter',{exact:true}).check();await page.getByRole('dialog').getByLabel('تفعيل القسيمة',{exact:true}).check();await page.getByRole('dialog').getByRole('button',{name:'حفظ التغييرات',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('cell',{name:/قسيمة اختبار المتصفح/})).toBeVisible();await expect.poll(async()=> (await admin.billingCoupon.findUnique({where:{code:'BROWSER15'}}))?.basisPoints).toBe(1500);await page.getByRole('row').filter({has:page.getByRole('cell',{name:/قسيمة اختبار المتصفح/})}).getByRole('button',{name:'تعديل',exact:true}).click();await page.getByRole('dialog').getByLabel('نوع الخصم',{exact:true}).selectOption('FIXED');await page.getByRole('dialog').getByLabel('مبلغ الخصم OMR — عند اختيار مبلغ',{exact:true}).fill('0.125');await page.getByRole('dialog').getByRole('button',{name:'حفظ التغييرات',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect((await admin.billingCoupon.findUniqueOrThrow({where:{code:'BROWSER15'}})).amount.toFixed(3)).toBe('0.125');await capture('billing-admin-coupons');results.push('real percentage coupon, plan restriction and exact fixed-discount editing');
  await page.getByRole('button',{name:'English',exact:true}).click();await expect(page.getByRole('heading',{name:'Subscriptions and billing',exact:true,level:1})).toBeVisible();await expect(page.getByRole('cell',{name:/BROWSER15/})).toBeVisible();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth)).toBe(true);await capture('billing-admin-mobile-en');results.push('Arabic/English, actual loaded mobile view and no horizontal overflow');expect(errors).toEqual([]);console.log(JSON.stringify({passed:results.length,checks:results,screenshots:galleryDirectory},null,2));
}catch(error){console.error(error);if(browser)for(const [index,page] of browser.contexts().flatMap(context=>context.pages()).entries())await page.screenshot({path:fileURLToPath(new URL('../../.local/billing-browser-failure-'+index+'.png',import.meta.url)),fullPage:true}).catch(()=>undefined);throw error;}finally{if(browser)await browser.close();if(app)await app.close();if(webProcess&&webProcess.exitCode===null){const exited=new Promise(resolve=>webProcess.once('exit',resolve));webProcess.kill();await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,3000))]);}if(admin)await admin.$disconnect();if(created)await provisioner.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);await provisioner.$disconnect();}
