import {useState} from 'react';
import {AdminDialog} from '../platform/forms';
import {useWorkspace} from './context';
import {useWorkData,WorkState,WorkTable,WorkPagination,type WorkList,type WorkRow} from './data';
import {WorkForm,workError} from './form';
function text(row:WorkRow,key:string,child:string){const object=row[key];return object&&typeof object==='object'?String(Reflect.get(object,child)??''):'';}
function memberName(row:WorkRow){const membership=row.membership;if(!membership||typeof membership!=='object')return '';const user=Reflect.get(membership,'user');return user&&typeof user==='object'?String(Reflect.get(user,'displayName')??''):'';}
export function MembershipDetails({team,onClose}:{team?:WorkRow;onClose:()=>void}){
  const {t,base,mutate,can}=useWorkspace();const [page,setPage]=useState(1);const [error,setError]=useState('');const endpoint=team?`${base}/teams/${team.id}/members`:`${base}/role-assignments`;const remote=useWorkData<WorkList>(`${endpoint}?page=${page}&pageSize=20`);
  return <AdminDialog title={team?`${t.teamMembers} · ${String(team.name)}`:t.roleAssignments} t={t} onClose={onClose}>
    {error&&<p className="work-error" role="alert">{error}</p>}
    {team&&can('structure.manage')&&<WorkForm fields={[{key:'membershipId',type:'reference',referenceUrl:`${base}/members`}]} t={t} onSave={async body=>{await mutate(endpoint,body);remote.reload();}}/>}
    <WorkState {...remote}><WorkTable rows={(remote.data?.items??[]).map(row=>({...row,id:team?String(row.membershipId):row.id}))} columns={[{key:'displayName',render:memberName},...(!team?[{key:'role',render:(row:WorkRow)=>text(row,'role','name')},{key:'scope'},{key:'scopeId'}]:[])]} actions={row=><button className="work-button secondary small" onClick={()=>{if(!window.confirm(t.confirm))return;setError('');void mutate(`${endpoint}/${row.id}`,undefined,'DELETE').then(remote.reload,reason=>setError(workError(t,reason)));}}>{t.revoke}</button>}/><WorkPagination page={page} total={remote.data?.total??0} onChange={setPage}/></WorkState>
  </AdminDialog>;
}
