import {Prisma} from '@prisma/client';
import type {WorkflowPredicate} from '@work/shared-schemas';
const numeric=new Set(['progress','baseAmount','remainingPercent','ageHours','dueInHours']);
export type WorkflowFacts=Partial<Record<WorkflowPredicate['conditions'][number]['field'],unknown>>;
export function workflowMatches(predicate:WorkflowPredicate,facts:WorkflowFacts){
 const matches=predicate.conditions.map(condition=>{const actual=facts[condition.field];const empty=actual===null||actual===undefined||actual===''||Array.isArray(actual)&&actual.length===0;
  if(condition.operator==='EMPTY')return empty;if(condition.operator==='NOT_EMPTY')return !empty;if(empty||condition.value===undefined)return false;
  if(numeric.has(condition.field)){try{const left=new Prisma.Decimal(String(actual)),right=new Prisma.Decimal(String(condition.value));if(!left.isFinite()||!right.isFinite())return false;switch(condition.operator){case 'EQ':return left.equals(right);case 'NE':return !left.equals(right);case 'GT':return left.greaterThan(right);case 'GTE':return left.greaterThanOrEqualTo(right);case 'LT':return left.lessThan(right);case 'LTE':return left.lessThanOrEqualTo(right);default:return false;}}catch{return false;}}
  const values=Array.isArray(actual)?actual.filter((value):value is string=>typeof value==='string'):typeof actual==='string'?[actual]:[];if(!values.length)return false;
  if(condition.operator==='IN'||condition.operator==='NOT_IN'){if(!Array.isArray(condition.value))return false;const expected=new Set(condition.value),found=values.some(value=>expected.has(value));return condition.operator==='IN'?found:!found;}
  const equal=typeof condition.value==='string'&&values.includes(condition.value);return condition.operator==='EQ'?equal:condition.operator==='NE'?!equal:false;
 });return predicate.mode==='ALL'?matches.every(Boolean):matches.some(Boolean);
}
