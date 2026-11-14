import { useEffect, useRef } from 'react';
declare global { interface Window { turnstile?:{render:(node:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void} } }
interface Props {siteKey:string;resetKey:number;onVerify:(token:string)=>void;onError:()=>void}
export function Turnstile({siteKey,resetKey,onVerify,onError}:Props){
  const target=useRef<HTMLDivElement>(null);const callbacks=useRef({onVerify,onError});callbacks.current={onVerify,onError};
  useEffect(()=>{
    let widget:string|undefined,disposed=false;
    const render=()=>{if(disposed||!target.current||!window.turnstile)return;widget=window.turnstile.render(target.current,{sitekey:siteKey,action:'contact',callback:(token:string)=>callbacks.current.onVerify(token),'expired-callback':()=>callbacks.current.onVerify(''),'error-callback':()=>{callbacks.current.onVerify('');callbacks.current.onError();}});};
    let script=document.getElementById('cloudflare-turnstile') as HTMLScriptElement|null;
    if(window.turnstile)render();
    else{if(!script){script=document.createElement('script');script.id='cloudflare-turnstile';script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;document.head.appendChild(script);}script.addEventListener('load',render);script.addEventListener('error',onError);}
    return()=>{disposed=true;script?.removeEventListener('load',render);script?.removeEventListener('error',onError);if(widget&&window.turnstile)window.turnstile.remove(widget);};
  },[siteKey,resetKey,onError]);
  return <div ref={target} className="turnstile-container" role="group" aria-label="Security check"/>;
}
