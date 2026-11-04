/** Contracts for future vendor adapters. No employee data is transferred until a configured adapter is installed. */
export interface AccountingDocument {
 externalId:string;
 reference:string;
 currency:string;
 // Decimal text; never convert monetary amounts to binary floating point.
 amount:string;
 occurredOn:string;
}
export interface AccountingProvider {
 exportDocument(document:AccountingDocument,idempotencyKey:string):Promise<{externalId:string}>;
 documentStatus(externalId:string):Promise<'PENDING'|'POSTED'|'REJECTED'>;
}
export interface HrEmployee {
 externalId:string;
 email:string;
 displayName:string;
 active:boolean;
 jobTitle?:string;
 departmentExternalId?:string;
 managerExternalId?:string;
}
export interface HrProvider {
 employees(cursor?:string):Promise<{items:HrEmployee[];nextCursor?:string}>;
}
export class UnconfiguredAccountingProvider implements AccountingProvider {
 async exportDocument():Promise<{externalId:string}>{throw new Error('ACCOUNTING_NOT_CONFIGURED');}
 async documentStatus():Promise<'PENDING'|'POSTED'|'REJECTED'>{throw new Error('ACCOUNTING_NOT_CONFIGURED');}
}
export class UnconfiguredHrProvider implements HrProvider {
 async employees():Promise<{items:HrEmployee[];nextCursor?:string}>{throw new Error('HR_NOT_CONFIGURED');}
}
