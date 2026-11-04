export interface CapacityAdjustment{from:string;to:string;minutesPerDay:number}
function validDate(value:string){const date=new Date(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw new Error('INVALID_CAPACITY_DATE');return date;}
export function capacityMinutes(from:string,to:string,workDays:number[],dayStart:string,dayEnd:string,adjustments:CapacityAdjustment[]=[],holidays:Array<{from:string;to:string}>=[]){
 const start=validDate(from),end=validDate(to);if(end<start||end.getTime()-start.getTime()>91*86400000||!workDays.length||workDays.some(day=>!Number.isInteger(day)||day<0||day>6))throw new Error('INVALID_CAPACITY_PERIOD');
 const minutes=(value:string)=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('INVALID_WORKING_HOURS');return Number(value.slice(0,2))*60+Number(value.slice(3));},daily=minutes(dayEnd)-minutes(dayStart);if(daily<=0)throw new Error('INVALID_WORKING_HOURS');
 for(const item of adjustments){if(validDate(item.to)<validDate(item.from)||!Number.isInteger(item.minutesPerDay)||item.minutesPerDay<0||item.minutesPerDay>1440)throw new Error('INVALID_CAPACITY_ADJUSTMENT');}
 for(const holiday of holidays)if(validDate(holiday.to)<validDate(holiday.from))throw new Error('INVALID_HOLIDAY_PERIOD');
 let total=0,days=0;for(let instant=start.getTime();instant<=end.getTime();instant+=86400000){const day=new Date(instant);const date=day.toISOString().slice(0,10);if(!workDays.includes(day.getUTCDay())||holidays.some(holiday=>holiday.from<=date&&holiday.to>=date))continue;days++;const matches=adjustments.filter(item=>item.from<=date&&item.to>=date);if(matches.length>1)throw new Error('OVERLAPPING_CAPACITY_ADJUSTMENTS');total+=matches[0]?.minutesPerDay??daily;}
 return {minutes:total,workDays:days};
}
export function currentWorkWeek(timezone:string,workDays:number[],now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),get=(kind:string)=>parts.find(part=>part.type===kind)!.value,today=validDate(`${get('year')}-${get('month')}-${get('day')}`),offset=(today.getUTCDay()-(workDays[0]??0)+7)%7,from=new Date(today.getTime()-offset*86400000),to=new Date(from.getTime()+6*86400000);return {from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10)};
}
