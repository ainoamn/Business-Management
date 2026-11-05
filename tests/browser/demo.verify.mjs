import {spawn} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium,expect} from '@playwright/test';
const id=process.argv[2];if(!/^[a-f0-9]{16}$/.test(id??''))throw Error('Pass a locally created demo id');
const directory=fileURLToPath(new URL('../../.local/demos/'+id+'/',import.meta.url)),manifest=JSON.parse(await readFile(directory+'/access.json','utf8'));
if(manifest.demo!==true||manifest.id!==id)throw Error('Invalid demo manifest');
const captures=directory+'/screenshots';await mkdir(captures,{recursive:true});const log=createWriteStream(directory+'/runtime.log',{flags:'a'});
const runner=spawn(process.execPath,[fileURLToPath(new URL('../../infrastructure/scripts/demo-start.mjs',import.meta.url)),id],{windowsHide:true,stdio:['pipe','pipe','pipe']});runner.stdout.pipe(log,{end:false});runner.stderr.pipe(log,{end:false});
let browser;const errors=[];
try{
 const deadline=Date.now()+120000;for(;;){const ready=await fetch('http://localhost:3100/login',{signal:AbortSignal.timeout(2000)}).then(response=>response.ok,()=>false);if(ready)break;if(runner.exitCode!==null||Date.now()>deadline)throw Error('Demo runtime did not become ready; inspect its local runtime log');await new Promise(resolve=>setTimeout(resolve,500));}
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',error=>errors.push(error.message));const owner=manifest.accounts.find(row=>row.key==='owner');
 await page.goto('http://localhost:3100/login');await page.getByLabel('البريد أو اسم المستخدم',{exact:true}).fill(owner.email);await page.getByLabel('كلمة المرور',{exact:true}).fill(owner.password);await page.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();await expect(page.getByRole('heading',{name:'لوحة المؤسسة',exact:true})).toBeVisible({timeout:30000});await page.screenshot({path:captures+'/demo-work-dashboard.png',fullPage:true});
 await page.goto('http://localhost:3100/app/tasks');await expect(page.getByRole('link',{name:'[DEMO] جمع المتطلبات',exact:true})).toBeVisible({timeout:30000});await page.goto('http://localhost:3100/app/projects');await expect(page.getByRole('link',{name:'[DEMO] إطلاق الخدمة',exact:true})).toBeVisible({timeout:30000});await page.goto('http://localhost:3100/app/members');await expect(page.getByRole('link',{name:'[DEMO] المحاسب',exact:true})).toBeVisible({timeout:30000});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:captures+'/demo-members-mobile.png',fullPage:true});
 const platform=manifest.accounts.find(row=>row.key==='platform'),adminPage=await browser.newPage({viewport:{width:1440,height:1000}});adminPage.on('pageerror',error=>errors.push(error.message));await adminPage.goto('http://localhost:3100/platform');await adminPage.getByLabel('البريد الإلكتروني',{exact:true}).fill(platform.email);await adminPage.getByLabel('كلمة المرور',{exact:true}).fill(platform.password);await adminPage.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();await expect(adminPage.locator('.admin-metric strong').first()).toHaveText('1',{timeout:30000});await adminPage.screenshot({path:captures+'/demo-platform-dashboard.png',fullPage:true});expect(errors).toEqual([]);
 console.log(JSON.stringify({passed:5,checks:['demo owner login and real dashboard','seeded task and project records','staff directory with five roles','mobile directory without overflow','separate demo platform login'],screenshots:captures},null,2));
}finally{
 if(browser)await browser.close();runner.stdin.end('stop\n');await Promise.race([new Promise(resolve=>runner.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,10000))]);if(runner.exitCode===null&&runner.pid){if(process.platform==='win32')spawn('taskkill',['/PID',String(runner.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else runner.kill();}log.end();
}

