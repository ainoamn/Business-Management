import type {PlatformResource} from '@work/shared-schemas';
export interface AdminField {key:string;default?:string;type?:'text'|'email'|'password'|'number'|'money'|'textarea'|'checkbox'|'select'|'reference'|'permissions'|'date';options?:string[];resource?:PlatformResource;optional?:boolean}
export function fieldsFor(resource:PlatformResource,editing:boolean):AdminField[] {
  switch(resource) {
    case 'organizations':return editing?[{key:'disabled',type:'checkbox'}]:[{key:'name'},{key:'slug'},{key:'ownerEmail',type:'email'}];
    case 'users':return [{key:'displayName'},{key:'disabled',type:'checkbox'}];
    case 'roles':return [{key:'name'},{key:'permissions',type:'permissions'}];
    case 'accounts':return [...(!editing?[{key:'email',type:'email' as const},{key:'password',type:'password' as const}]:[]),{key:'displayName'},{key:'roleId',type:'reference',resource:'roles'},...(editing?[{key:'disabled',type:'checkbox' as const}]:[])];
    case 'plans':return [{key:'name'},{key:'description',type:'textarea'},{key:'price',type:'money'},{key:'maxSeats',type:'number'},{key:'storageMb',type:'number'},{key:'aiCredits',type:'number'},{key:'automationRuns',type:'number',default:'100'},{key:'activeWorkflows',type:'number',default:'5'},{key:'active',type:'checkbox'}];
    case 'subscriptions':return [...(!editing?[{key:'organizationId',type:'reference' as const,resource:'organizations' as const},{key:'planId',type:'reference' as const,resource:'plans' as const},{key:'seats',type:'number' as const},{key:'endsAt',type:'date' as const}]:[]),{key:'status',type:'select',options:['TRIAL','ACTIVE','PAST_DUE','CANCELED']}];
    case 'invoices':return [{key:'organizationId',type:'reference',resource:'organizations'},{key:'number'},{key:'amount',type:'money'},{key:'dueAt',type:'date'}];
    case 'ledger':return [{key:'organizationId',type:'reference',resource:'organizations'},{key:'invoiceId',type:'reference',resource:'invoices',optional:true},{key:'reference'},{key:'direction',type:'select',options:['IN','OUT']},{key:'amount',type:'money'},{key:'note',type:'textarea'}];
    case 'pages':return [{key:'title'},{key:'slug'},{key:'body',type:'textarea'},{key:'status',type:'select',options:['DRAFT','PUBLISHED','ARCHIVED']}];
    case 'audit':return [];
  }
}
export const settingsFields:AdminField[]=[{key:'platformName'},{key:'supportEmail',type:'email'},{key:'footerText',type:'textarea'},{key:'maintenanceMode',type:'checkbox'},{key:'publicPagesEnabled',type:'checkbox'},{key:'sessionMinutes',type:'number'}];
export const columns:Record<PlatformResource,string[]>={organizations:['name','slug','disabled','id'],users:['displayName','email','disabled','id'],accounts:['displayName','email','isOwner','roleId','disabled'],roles:['name','permissions','id'],plans:['name','price','maxSeats','storageMb','aiCredits','automationRuns','activeWorkflows','active'],subscriptions:['organizationId','planId','status','seats','unitPrice','endsAt'],invoices:['number','organizationId','amount','status','dueAt','id'],ledger:['reference','organizationId','direction','amount','note','createdAt'],pages:['title','slug','status','updatedAt'],audit:['createdAt','action','resource','resourceId','actorId','requestId']};
