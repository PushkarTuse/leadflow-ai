import { publicRequestSchema, signatureMessage } from '../../packages/core/intake';
export interface ContactEnvironment { APPS_SCRIPT_URL:string; INTAKE_HMAC_SECRET:string; TURNSTILE_SECRET_KEY:string; PUBLIC_SITE_URL:string }
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
async function boundedBody(request:Request){const reader=request.body?.getReader();if(!reader)throw new Error('Missing body');let size=0;const chunks:Uint8Array[]=[];while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>16000){await reader.cancel();throw new Error('Body too large');}chunks.push(next.value);}const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(all);}
export async function handleContact(request:Request,env:ContactEnvironment,fetcher:typeof fetch=fetch):Promise<Response>{
  if(request.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
  if(!env.APPS_SCRIPT_URL||!env.INTAKE_HMAC_SECRET||!env.TURNSTILE_SECRET_KEY||!env.PUBLIC_SITE_URL)return json({ok:false,error:'Enquiry delivery is not configured yet.'},503);
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(env.APPS_SCRIPT_URL)||env.INTAKE_HMAC_SECRET.length<32)return json({ok:false,error:'Enquiry delivery configuration needs attention.'},503);
  const origin=new URL(request.url).origin;
  let configured:URL;try{configured=new URL(env.PUBLIC_SITE_URL);}catch{return json({ok:false,error:'Invalid site configuration'},503);}
  if(request.headers.get('origin')!==origin||configured.origin!==origin)return json({ok:false,error:'Request origin rejected'},403);
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))return json({ok:false,error:'Use JSON'},415);
  let raw:unknown;
  try{raw=JSON.parse(await boundedBody(request));}catch{return json({ok:false,error:'Invalid or oversized request'},400);}
  const parsed=publicRequestSchema.safeParse(raw);
  if(!parsed.success)return json({ok:false,error:'Check your name, email, project details and consent.'},400);
  if(parsed.data.website)return json({ok:false,error:'Request rejected'},400);
  try {
    const verification=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:parsed.data.turnstile_token,remoteip:request.headers.get('cf-connecting-ip')||undefined}),signal:AbortSignal.timeout(10000)});
    const challenge=await verification.json() as {success?:boolean;hostname?:string;action?:string};
    if(!verification.ok||!challenge.success||challenge.hostname!==new URL(env.PUBLIC_SITE_URL).hostname||challenge.action!=='contact')return json({ok:false,error:'Please complete the security check again.'},403);
    const {turnstile_token: _token,website: _trap,...enquiry}=parsed.data;
    const payload=JSON.stringify(enquiry),timestamp=Date.now(),nonce=crypto.randomUUID();
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.INTAKE_HMAC_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(signatureMessage(timestamp,nonce,payload)));
    const signature=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const response=await fetcher(env.APPS_SCRIPT_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({timestamp,nonce,payload,signature}),redirect:'follow',signal:AbortSignal.timeout(25000)});
    const result=await response.json() as {ok?:boolean;lead_id?:string};
    if(!response.ok||!result.ok||!/^lf_[a-f0-9]{16}$/.test(result.lead_id||''))return json({ok:false,error:'Delivery could not be confirmed. Please retry; your reference will prevent a duplicate.'},502);
    return json({ok:true,reference:result.lead_id,message:'Your enquiry has been received. The owner will review it before replying.'});
  }catch{return json({ok:false,error:'Delivery could not be confirmed. Please retry using this form.'},502);}
}
export const onRequest=({request,env}:{request:Request;env:ContactEnvironment})=>handleContact(request,env);
