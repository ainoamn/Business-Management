import {useEffect,useState} from 'react';
export const BHD_IDENTITY_READY='bhd:identity-ready';
/** Retry optional identity consumers if the SDK arrives after their initial timeout. */
export function useBhdSdkRevision(){
 const [revision,setRevision]=useState(0);
 useEffect(()=>{const ready=()=>setRevision(value=>value+1);window.addEventListener(BHD_IDENTITY_READY,ready);return ()=>window.removeEventListener(BHD_IDENTITY_READY,ready);},[]);
 return revision;
}
