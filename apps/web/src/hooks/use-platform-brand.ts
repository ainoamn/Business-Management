import {useEffect,useState} from 'react';
import {platformRequest} from '../services/platform';
interface SiteBrand {platformName:string;supportEmail:string;footerText:string;maintenanceMode:boolean;publicPagesEnabled:boolean}
export function usePlatformBrand() {
  const [brand,setBrand]=useState<SiteBrand>();
  useEffect(()=>{const controller=new AbortController();void platformRequest<SiteBrand>('public/site',{signal:controller.signal}).then(value=>{if(typeof value.platformName==='string'&&value.platformName)setBrand(value);},()=>undefined);return ()=>controller.abort();},[]);
  return brand;
}
