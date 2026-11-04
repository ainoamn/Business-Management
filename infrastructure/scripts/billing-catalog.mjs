import {config} from 'dotenv';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
config({path:new URL('../../.env',import.meta.url),quiet:true});
const require=createRequire(new URL('../../apps/api/package.json',import.meta.url)),{PrismaClient}=require('@prisma/client');
const {platformPlanSchema,billingPlanDetailsSchema}=require('@work/shared-schemas');
const connection=new URL(process.env.MIGRATION_DATABASE_URL??'');
if(!['127.0.0.1','localhost'].includes(connection.hostname)&&process.env.BILLING_CATALOG_ALLOW_REMOTE!=='1')throw new Error('Remote catalogue installation requires explicit operator configuration');
const source=JSON.parse(await readFile(new URL('../catalog/initial-plans.json',import.meta.url),'utf8'));
if(!Array.isArray(source)||source.length!==5)throw new Error('Expected the reviewed five-plan initial catalogue');
const plans=source.map(input=>{const {code,annualPrice,maxProjects,features,trialDays,graceDays,customPricing,public:isPublic,...basic}=input;return {...platformPlanSchema.parse(basic),...billingPlanDetailsSchema.parse({version:1,code,annualPrice,maxProjects,features,trialDays,graceDays,customPricing,public:isPublic})};});
const db=new PrismaClient({datasourceUrl:connection.toString()});
try{const report=await db.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('BILLING_INITIAL_CATALOGUE'))`;let installed=0;const skipped=[];for(const data of plans){const existing=await tx.platformPlan.findFirst({where:{OR:[{code:data.code},{name:data.name}]}});if(existing){skipped.push(data.code);continue;}await tx.platformPlan.create({data});installed++;}const free=await tx.platformPlan.findUnique({where:{code:'free'}}),trial=await tx.platformPlan.findUnique({where:{code:'business'}});if(!await tx.billingSettings.findUnique({where:{id:'main'}}))await tx.billingSettings.create({data:{id:'main',freePlanId:free?.active&&!free.customPricing&&free.price.isZero()?free.id:null,trialPlanId:trial?.active&&!trial.customPricing&&trial.trialDays>0?trial.id:null}});if(installed)await tx.platformAudit.create({data:{requestId:randomUUID(),action:'INITIAL_BILLING_CATALOGUE_INSTALLED',resource:'plans'}});return {installed,preservedExisting:skipped,paymentEnabled:false};},{timeout:15000});console.log(JSON.stringify(report));}finally{await db.$disconnect();}
