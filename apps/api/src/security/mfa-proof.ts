import {UnauthorizedException} from '@nestjs/common';

export type MfaAccountType='USER'|'PLATFORM';
export interface MfaProof {accountType:MfaAccountType;accountId:string;version:number;primaryHash:string}
const issued=new WeakSet<MfaProof>();
export function issueMfaProof(value:MfaProof){issued.add(value);return value;}
export function consumeMfaProof(value:MfaProof|undefined,type:MfaAccountType,id:string,version:number,primaryHash:string){
  if(!value||!issued.delete(value)||value.accountType!==type||value.accountId!==id||value.version!==version||value.primaryHash!==primaryHash)throw new UnauthorizedException('MFA verification required');
}
