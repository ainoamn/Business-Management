import {SupportCenter} from '../support-center';
import {useWorkspace} from './context';
export function SupportPanel({id}:{id?:string}){const {base,session,locale}=useWorkspace();return session?<SupportCenter key={id??'list'} api={base+'/support'} href="/app/support" caseId={id} csrf={session.csrf} locale={locale}/>:null;}
