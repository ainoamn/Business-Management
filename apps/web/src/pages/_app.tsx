import '../bhd-switcher.css';
import type { AppProps } from 'next/app';
import Script from 'next/script';
import {BHD_IDENTITY_READY} from '../lib/identity/use-bhd-sdk';
import '../styles/globals.css';
import '../styles/platform.css';
import '../styles/work.css';
import '../styles/execution.css';
import '../styles/marketing.css';
export default function App({Component,pageProps}:AppProps) {return <><Component {...pageProps}/><Script id="bhd-identity-sdk" src="https://id.bhd-om.com/bhd-identity.js" strategy="lazyOnload" onReady={()=>{window.dispatchEvent(new Event(BHD_IDENTITY_READY));}}/></>;}
