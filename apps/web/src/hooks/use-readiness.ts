import { useCallback, useEffect, useRef, useState } from 'react';
import type { Readiness } from '@work/shared-types';
import { fetchReadiness } from '../services/health';

export function useReadiness() {
  const [data,setData]=useState<Readiness>();
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const current = useRef<AbortController | null>(null);
  const refresh=useCallback(async ()=>{
    current.current?.abort();
    const controller = new AbortController();
    current.current=controller;
    const deadline = setTimeout(()=>controller.abort(),8000);
    setLoading(true);setError(false);
    try {setData(await fetchReadiness(controller.signal));}
    catch {if (current.current===controller) {setData(undefined);setError(true);}}
    finally {clearTimeout(deadline);if(current.current===controller) setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();return ()=>{current.current?.abort();current.current=null;};},[refresh]);
  return {data,loading,error,refresh};
}
