/** Monthly quotas follow the subscription anniversary, including annual subscriptions. */
export function usagePeriod(anchor:Date|undefined,now=new Date()){
 if(!anchor)return {start:new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)),end:new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1))};
 const at=(month:number)=>{const year=now.getUTCFullYear(),last=new Date(Date.UTC(year,month+1,0)).getUTCDate();return new Date(Date.UTC(year,month,Math.min(anchor.getUTCDate(),last),anchor.getUTCHours(),anchor.getUTCMinutes(),anchor.getUTCSeconds(),anchor.getUTCMilliseconds()));};
 let month=now.getUTCMonth();if(at(month)>now)month--;return {start:at(month),end:at(month+1)};
}
