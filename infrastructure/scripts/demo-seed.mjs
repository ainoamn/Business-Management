import {config} from 'dotenv';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import request from 'supertest';
config({path:fileURLToPath(new URL('../../.env',import.meta.url)),quiet:true});
if(process.env.DEPLOYMENT_ENV!=='development'||!process.env.MIGRATION_DATABASE_URL||!process.env.DATABASE_URL)throw Error('Demo creation requires local development configuration');
const source=new URL(process.env.MIGRATION_DATABASE_URL);
if(!['127.0.0.1','localhost'].includes(source.hostname))throw Error('Demo databases are local-only');
const suffix=randomBytes(8).toString('hex'),database='work_demo_'+suffix;
if(!/^work_demo_[a-f0-9]{16}$/.test(database))throw Error('Invalid demo database');
const directory=fileURLToPath(new URL('../../.local/demos/'+suffix+'/',import.meta.url));
await mkdir(directory,{recursive:true});
const require=createRequire(new URL('../../apps/api/package.json',import.meta.url)),{PrismaClient}=require('@prisma/client');
const provisioner=new PrismaClient({datasourceUrl:source.toString()});let admin,app,created=false,success=false;
const origin=process.env.WEB_ORIGIN||'http://localhost:3000',accounts=[];
try{
 await provisioner.$executeRawUnsafe(`CREATE DATABASE "${database}"`);created=true;source.pathname='/'+database;
 execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',fileURLToPath(new URL('../../apps/api/prisma/schema.prisma',import.meta.url))],{env:{...process.env,CHECKPOINT_DISABLE:'1',PRISMA_HIDE_UPDATE_MESSAGE:'1',DATABASE_URL:source.toString()},windowsHide:true,stdio:'pipe',timeout:60000});
 admin=new PrismaClient({datasourceUrl:source.toString()});const appUrl=new URL(process.env.DATABASE_URL);appUrl.pathname='/'+database;
 process.env.DATABASE_URL=appUrl.toString();process.env.MAIL_DELIVERY_MODE='outbox';process.env.DOCUMENT_LOCAL_ROOT=directory+'/documents';
 await admin.platformSettings.create({data:{id:'main',platformName:'[DEMO] منصة التدريب',supportEmail:'demo-support@example.invalid',footerText:'بيانات تجريبية محلية مستقلة'}});
 const {createApp}=require('../../apps/api/dist/bootstrap.js');app=await createApp();await app.init();
 const api=(method,path,actor)=>{let call=request(app.getHttpServer())[method]('/api/v1/work/'+path).set('Origin',origin);if(actor)call=call.set('Cookie',actor.cookie).set('X-CSRF-Token',actor.session.csrf);return call;};
 const token=async email=>{const mail=await admin.emailOutbox.findFirstOrThrow({where:{recipient:email},orderBy:{createdAt:'desc'}});return new URL(mail.textBody.match(/https?:\/\/\S+/)[0]).searchParams.get('token');};
 async function register(key,name,inviteToken){
  const email=key+'-'+suffix+'@example.invalid',password='Demo-'+randomBytes(24).toString('base64url'),username='demo_'+key+'_'+suffix;
  const result=await api('post','auth/register').send({email,username,displayName:name,password,...inviteToken?{inviteToken}:{organizationName:'[DEMO] مؤسسة التدريب — بيانات تجريبية',organizationSlug:'demo-'+suffix}}).expect(201);
  const cookie=result.headers['set-cookie'].map(value=>value.split(';')[0]).join(';');await api('post','auth/verify').send({token:await token(email)}).expect(201);
  let actor={cookie,session:(await api('get','auth/me',{cookie,session:{csrf:''}}).expect(200)).body};
  if(inviteToken){await api('post','invitations/accept',actor).send({token:inviteToken}).expect(201);actor={...actor,session:(await api('get','auth/me',actor).expect(200)).body};}
  accounts.push({key,name,email,username,password});return actor;
 }
 const owner=await register('owner','[DEMO] مالك المؤسسة'),org=owner.session.organizations[0].id,own=(method,path)=>api(method,'organizations/'+org+'/'+path,owner),member=actor=>actor.session.organizations.find(row=>row.id===org).membership_id;
 const plan=await admin.platformPlan.create({data:{name:'[DEMO] عقد تدريب محلي '+suffix,description:'بيانات تجريبية، لا تمثل اشتراكًا مدفوعًا أو دفعة مالية',price:'0.000',maxSeats:10,maxProjects:50,storageMb:100,aiCredits:0,automationRuns:100,activeWorkflows:10}});
 await admin.platformSubscription.create({data:{organizationId:org,planId:plan.id,status:'ACTIVE',seats:10,unitPrice:'0.000',endsAt:new Date(Date.now()+90*86400000)}});
 const people={owner};for(const [key,name,role] of [['general','[DEMO] المدير العام','GENERAL_MANAGER'],['manager','[DEMO] مدير العمليات','DEPARTMENT_MANAGER'],['employee','[DEMO] موظف التنفيذ','EMPLOYEE'],['accountant','[DEMO] المحاسب','ACCOUNTANT']]){const email=key+'-'+suffix+'@example.invalid';await own('post','invitations').send({email,role}).expect(201);people[key]=await register(key,name,await token(email));}
 const branch=(await own('post','structure/branches').send({name:'[DEMO] فرع مسقط'}).expect(201)).body,department=(await own('post','structure/departments').send({name:'[DEMO] العمليات',branchId:branch.id,managerId:member(people.manager)}).expect(201)).body;
 const section=(await own('post','structure/sections').send({name:'[DEMO] التنفيذ',departmentId:department.id}).expect(201)).body;
 for(const key of ['manager','employee'])await own('patch','members/'+member(people[key])).send({role:key==='manager'?'DEPARTMENT_MANAGER':'EMPLOYEE',active:true,branchId:branch.id,departmentId:department.id,sectionId:section.id,jobTitle:key==='manager'?'مدير العمليات':'منسق تنفيذ'}).expect(200);
 const team=(await own('post','structure/teams').send({name:'[DEMO] فريق الإنجاز',departmentId:department.id,leaderId:member(people.manager)}).expect(201)).body;await own('post','teams/'+team.id+'/members').send({membershipId:member(people.employee)}).expect(201);
 const projects=[];for(const name of ['[DEMO] إطلاق الخدمة','[DEMO] تحسين العمليات'])projects.push((await own('post','projects').send({name,managerId:member(people.manager),departmentId:department.id,status:'ACTIVE',budget:'1000.000'}).expect(201)).body);
 for(let i=0;i<6;i++)await own('post','tasks').send({title:'[DEMO] '+['جمع المتطلبات','إعداد خطة العمل','مراجعة المستندات','تنفيذ التحسين','متابعة التسليم','إعداد التقرير'][i],projectId:projects[i%2].id,assignedToId:member(people.employee),departmentId:department.id,estimatedHours:String(i+1),priority:i%2?'HIGH':'NORMAL',dueDate:new Date(Date.now()+(i+1)*86400000).toISOString()}).expect(201);
 for(let i=0;i<2;i++)await own('post','meetings').send({title:'[DEMO] اجتماع متابعة '+(i+1),projectId:projects[i].id,departmentId:department.id,chairId:member(people.manager),approverId:member(people.general),attendeeIds:[member(people.employee)],startsAt:new Date(Date.now()+(i+1)*86400000).toISOString(),endsAt:new Date(Date.now()+(i+1)*86400000+3600000).toISOString(),agenda:'بيانات تدريبية: مراجعة التقدم والعوائق'}).expect(201);
 await own('post','documents/upload').field('payload',JSON.stringify({requestId:randomUUID(),metadata:{title:'[DEMO] دليل تجربة آمن'}})).attach('file',Buffer.from('DEMO DATA ONLY\nTraining document. No customer information.\n'),{filename:'demo-guide.txt',contentType:'text/plain'}).expect(201);
 const budget=(await own('post','budgets').send({name:'[DEMO] ميزانية تدريب',projectId:projects[0].id,currency:'OMR',amount:'1000.000',startsAt:new Date(Date.now()-86400000).toISOString(),endsAt:new Date(Date.now()+30*86400000).toISOString()}).expect(201)).body;
 for(const [title,amount] of [['[DEMO] مصروف تجهيز','25.500'],['[DEMO] مصروف أدوات','12.000']])await own('post','expenses').send({title,projectId:projects[0].id,budgetId:budget.id,currency:'OMR',amount,expenseDate:new Date().toISOString(),approverId:member(people.accountant)}).expect(201);
 await admin.platformAccount.create({data:{email:'platform-'+suffix+'@example.invalid',displayName:'[DEMO] إدارة المنصة',passwordHash:(await admin.user.findUniqueOrThrow({where:{id:owner.session.user.id}})).passwordHash,isOwner:true}});accounts.push({...accounts[0],key:'platform',name:'[DEMO] إدارة المنصة',email:'platform-'+suffix+'@example.invalid'});
 const counts={members:await admin.membership.count(),projects:await admin.project.count(),tasks:await admin.task.count(),meetings:await admin.meeting.count(),documents:await admin.workDocument.count(),expenses:await admin.operationalExpense.count(),notifications:await admin.workNotification.count()};
 await writeFile(directory+'/access.json',JSON.stringify({demo:true,id:suffix,database,organizationId:org,createdAt:new Date().toISOString(),accounts,counts},null,2),{mode:0o600});success=true;
 console.log(JSON.stringify({demo:true,id:suffix,database,counts,credentialsFile:directory+'/access.json',start:'pnpm demo:start '+suffix},null,2));
}finally{
 if(app)await app.close();if(admin)await admin.$disconnect();
 if(created&&!success)await provisioner.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);
 await provisioner.$disconnect();
}


