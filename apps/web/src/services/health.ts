import type { Readiness } from '@work/shared-types';

function isReadiness(value:unknown): value is Readiness {
  if (!value || typeof value !== 'object' || !('status' in value) || !('checks' in value) || !('timestamp' in value)) return false;
  if (value.status !== 'ready' && value.status !== 'not_ready') return false;
  const checks = value.checks;
  return !!checks && typeof checks === 'object' && ['database','redis','queue','storage'].every(key=>key in checks && ['up','down'].includes(String(Reflect.get(checks,key)))) && typeof value.timestamp === 'string' && Number.isFinite(Date.parse(value.timestamp));
}
export async function fetchReadiness(signal:AbortSignal):Promise<Readiness> {
  const response = await fetch('/api/v1/health/ready',{signal,cache:'no-store'});
  const data:unknown = await response.json();
  if ((response.status !== 200 && response.status !== 503) || !isReadiness(data)) throw new Error('Readiness unavailable');
  return data;
}
