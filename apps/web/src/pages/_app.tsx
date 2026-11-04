import type { AppProps } from 'next/app';
import '../styles/globals.css';
import '../styles/platform.css';
import '../styles/work.css';
import '../styles/execution.css';
export default function App({Component,pageProps}:AppProps) {return <Component {...pageProps}/>;}
