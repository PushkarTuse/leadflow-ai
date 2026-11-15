import {readFile,mkdir,writeFile,rename,open,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {Engine,notification} from '../packages/core/workflow';
import {MemoryStore} from '../packages/core/memory-store';
import {configSchema} from '../packages/core/model';
import {classifyGemini,type Http} from '../apps/automation/adapters';
import {pullExternalLeads} from '../apps/automation/external-leads';

interface EmailTestState{status:string;at:string;to:string;messageId:string;error:string}
const emptyEmailTest:EmailTestState={status:'DISABLED',at:'',to:'',messageId:'',error:''};

/** Structured owner digest. Contains no credentials and no lead contact details. */
function executiveSummary(store:MemoryStore,run:{imported:number;duplicates:number;invalid:number},emailTest:EmailTestState){
  const leads=store.leads();
  const gemini=leads.filter(l=>l.method==='gemini').length;
  const rules=leads.length-gemini;
  const top=leads.filter(l=>l.priority!=='LOW').sort((a,b)=>b.score-a.score).slice(0,3);
  const warned=leads.filter(l=>l.extractionWarning);
  return [
    'GEMINI EXECUTIVE ANALYSIS SUMMARY',
    `Pipeline status: ${run.imported>0?'ACTIVE — new leads qualified':'IDLE — no new leads this run'}`,
    '',
    `Processed this run: ${run.imported+run.duplicates+run.invalid} (imported ${run.imported}, duplicates ${run.duplicates}, skipped ${run.invalid})`,
    `Leads in local store: ${leads.length}`,
    `Gemini-scored: ${gemini} · rules fallback: ${rules}`,
    '',
    'Top opportunities:',
    ...(top.length
      ? top.map((l,i)=>`${i+1}. [${l.score}] ${(l.client_name_if_public||l.title||l.lead_id).slice(0,90)} — ${l.priority}`)
      : ['  none above LOW priority']),
    '',
    'Errors / skipped:',
    ...(run.invalid||warned.length
      ? [
          ...(run.invalid?[`  ${run.invalid} row(s) skipped as invalid or unsupported`]:[]),
          ...warned.slice(0,3).map(l=>`  ${l.lead_id}: ${l.extractionWarning.slice(0,120)}`),
        ]
      : ['  none']),
    '',
    `Owner email test: ${emailTest.status}${emailTest.to?` → ${emailTest.to}`:''}`,
    'No email was sent to any external lead.',
  ].join('\n');
}

/**
 * SAFE_OWNER_EMAIL_TEST: at most one clearly labelled receipt per run, addressed
 * only to OWNER_TEST_EMAIL. A discovered lead address can never be the recipient.
 */
async function ownerEmailTest(enabled:boolean,get:(key:string,fallback?:string)=>string,store:MemoryStore):Promise<EmailTestState>{
  const at=new Date().toISOString();
  if(!enabled)return {...emptyEmailTest,at};
  const to=get('OWNER_TEST_EMAIL').trim();
  const from=(get('OWNER_TEST_EMAIL_FROM')||to).trim();
  const smtpUrl=get('OWNER_TEST_SMTP_URL').trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to))
    return {status:'SKIPPED_NOT_CONFIGURED',at,to,messageId:'',error:'OWNER_TEST_EMAIL missing or invalid'};
  if(store.leads().some(l=>l.contact_email&&l.contact_email.toLowerCase()===to.toLowerCase()))
    return {status:'BLOCKED',at,to,messageId:'',error:'Owner test address matches a discovered lead'};
  const subject='[LOCAL PIPELINE TEST] LeadFlow AI verification receipt';
  const text=[
    '[LOCAL PIPELINE TEST]',
    '',
    'This is a local verification receipt from the LeadFlow AI external runner.',
    'It was sent only to the configured owner test address.',
    'No external lead was contacted and no production email path was used.',
    '',
    `Generated: ${at}`,
    `Leads in local store: ${store.leads().length}`,
  ].join('\n');
  await writeFile('outputs/external/email-test-receipt.eml',
    `To: ${to}\r\nFrom: ${from}\r\nSubject: ${subject}\r\nDate: ${new Date().toUTCString()}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${text}\r\n`);
  if(!smtpUrl)
    return {status:'SKIPPED_NOT_CONFIGURED',at,to,messageId:'',error:'OWNER_TEST_SMTP_URL missing; receipt written to outputs/external/email-test-receipt.eml'};
  const result=spawnSync(process.execPath,['scripts/owner-email-test.mjs'],{input:JSON.stringify({smtpUrl,from,to,subject,text}),encoding:'utf8',timeout:30000,maxBuffer:200000});
  if(result.status!==0)return {status:'FAILED',at,to,messageId:'',error:'SMTP delivery failed (redacted)'};
  let messageId='';
  try{messageId=String((JSON.parse(result.stdout) as {messageId?:string}).messageId||'');}catch{messageId='';}
  return {status:'SENT',at,to,messageId,error:''};
}

async function main(){
  const preview=process.argv.includes('--dry-run');
  try {const text=await readFile('.env.external','utf8');for(const line of text.split(/\r?\n/)){
    const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2].trim();
  }}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const get=(key:string,fallback='')=>process.env[key]??fallback;
  const on=(key:string)=>get(key)==='true';
  if(!preview&&!on('EXTERNAL_LEADS_ENABLED')){console.log('External ingestion OFF. Set EXTERNAL_LEADS_ENABLED=true in .env.external; preview: npm run external:run -- --dry-run');return;}
  // Intentionally local-only. Hosted APIs use the existing Apps Script connector.
  if(get('EXTERNAL_LEADS_API_ORIGIN','http://127.0.0.1:8787')!=='http://127.0.0.1:8787')throw new Error('Local runner only accepts http://127.0.0.1:8787');
  let token=get('EXTERNAL_LEADS_API_TOKEN');
  if(!token){const vars=await readFile('../leadflow-leads/.dev.vars','utf8');token=vars.split(/\r?\n/).find(l=>l.startsWith('API_TOKEN='))?.slice(10).trim()||'';}
  if(!token)throw new Error('Local API token missing');
  const gemini=!preview&&on('GEMINI_ENABLED'),telegram=!preview&&on('TELEGRAM_ENABLED');
  const safeEmailTest=!preview&&on('SAFE_OWNER_EMAIL_TEST');
  if(gemini&&(!get('GEMINI_API_KEY')||!get('GEMINI_MODEL')||!on('GEMINI_FREE_TIER_CONFIRMED')||!on('GEMINI_DATA_USE_APPROVED')))throw new Error('Complete approved Gemini settings first');
  if(telegram&&(!/^\d+:[\w-]+$/.test(get('TELEGRAM_BOT_TOKEN'))||!/^\d+$/.test(get('TELEGRAM_OWNER_CHAT_ID'))||get('TELEGRAM_OWNER_CHAT_ID')!==get('TELEGRAM_OWNER_USER_ID')))throw new Error('Private Telegram owner settings missing or mismatched');
  const limit=Number(get('EXTERNAL_LEADS_BATCH_SIZE','5'));if(!Number.isInteger(limit)||limit<1||limit>5)throw new Error('Batch must be 1–5');
  const file=preview?'data/external-preview.json':gemini?'data/external-gemini.json':'data/external-pipeline.json';
  await mkdir('data',{recursive:true});await mkdir('outputs/external',{recursive:true});
  const lock=await open(file+'.lock','wx');
  try{
    const store=new MemoryStore();let offset=0;let emailTest:EmailTestState={...emptyEmailTest};
    try{const old=JSON.parse(await readFile(file,'utf8'));Object.assign(store,old.store);offset=old.offset;if(old.emailTest)emailTest=old.emailTest as EmailTestState;}
    catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Unreadable local state; restore before retrying');}
    const save=async()=>{await writeFile(file+'.tmp',JSON.stringify({offset,store,emailTest},null,2));await rename(file+'.tmp',file);};
    let httpCount=0;
    const network:Http={json(url,request){
      if(++httpCount>16)throw new Error('Local per-run HTTP budget reached');
      const result=spawnSync(process.execPath,['scripts/external-http.mjs'],{input:JSON.stringify({url,request}),encoding:'utf8',timeout:20000,maxBuffer:2000000});
      if(result.status!==0)throw new Error('Provider request failed (redacted); interrupted batch will deduplicate on retry');
      return JSON.parse(result.stdout);
    }};
    const origin='https://local-runner.example.com',transportToken='local-adapter-transport-placeholder-only';
    const http:Http={json(url,request){
      if(url.startsWith(origin+'/leads?'))return network.json('http://127.0.0.1:8787'+url.slice(origin.length),{headers:{Authorization:`Bearer ${token}`}});
      if(!url.startsWith('https://hacker-news.firebaseio.com/v0/item/'))throw new Error('Unexpected source URL');
      if(request?.headers)throw new Error('No token may be sent to HN');return network.json(url);
    }};
    const config=configSchema.parse({ownerUserId:get('TELEGRAM_OWNER_USER_ID','local-owner'),ownerChatId:get('TELEGRAM_OWNER_CHAT_ID','local-owner')});
    const engine=new Engine(store,config,undefined,gemini?input=>classifyGemini(network,input,{enabled:true,freeTierConfirmed:true,dataUseApproved:true,apiKey:get('GEMINI_API_KEY'),model:get('GEMINI_MODEL')}):undefined);
    const result=pullExternalLeads(http,{origin,token:transportToken,offset,limit,allowedSources:get('EXTERNAL_LEADS_SOURCES','hackernews').split(',').map(s=>s.trim())},lead=>engine.ingest(lead));
    offset=result.nextOffset;await save();
    const alerts=[];
    for(const lead of store.leads().filter(l=>l.status==='PENDING_APPROVAL'&&!store.requests().some(r=>r.lead_id===l.lead_id)).slice(0,2)){
      const request=engine.prepareApproval(lead,randomBytes(12).toString('hex'));
      const alert=notification(lead,request);alerts.push({lead_id:lead.lead_id,...alert});
      if(telegram){
        // The production bot already owns callback polling. Local notifications are explicit previews,
        // without dead buttons or a competing getUpdates consumer.
        request.state='SENDING';store.request(request);await save();
        try{
          const raw=network.json(`https://api.telegram.org/bot${get('TELEGRAM_BOT_TOKEN')}/sendMessage`,{method:'post',retrySafe:false,body:{chat_id:config.ownerChatId,text:'LOCAL EXTERNAL LEAD REVIEW PREVIEW\n'+alert.text+'\nLocal-only record; no interactive approval attached. Review the original posting manually. No email will be sent.',link_preview_options:{is_disabled:true}}}) as {ok?:boolean;result?:{message_id:number;chat:{id:number;type:string}}};
          if(!raw.ok||raw.result?.chat.type!=='private'||String(raw.result.chat.id)!==config.ownerChatId)throw new Error('Wrong recipient');
          request.message_id=String(raw.result.message_id);request.state='SENT';store.request(request);await save();
        }catch{request.state='FAILED';store.request(request);await save();throw new Error('Telegram delivery uncertain; inspect bot before retrying. No automatic resend.');}
      }else{
        // Preview files should be regenerated on the next dry run, not marked as delivered.
        store.requestRows=store.requestRows.filter(r=>r.request_id!==request.request_id);
      }
    }
    // Owner-only verification receipt. Never addressed to a discovered lead.
    emailTest=await ownerEmailTest(safeEmailTest,get,store);
    await save();
    let summaryStatus='DISABLED';
    if(telegram){
      try{
        const raw=network.json(`https://api.telegram.org/bot${get('TELEGRAM_BOT_TOKEN')}/sendMessage`,{method:'post',retrySafe:false,body:{chat_id:config.ownerChatId,text:executiveSummary(store,result,emailTest),link_preview_options:{is_disabled:true}}}) as {ok?:boolean;result?:{chat:{id:number;type:string}}};
        if(!raw.ok||raw.result?.chat.type!=='private'||String(raw.result.chat.id)!==config.ownerChatId)throw new Error('Wrong recipient');
        summaryStatus='SENT';
      }catch{summaryStatus='FAILED';}
    }
    await save();await writeFile('outputs/external/review-preview.json',JSON.stringify(alerts,null,2));
    console.log(JSON.stringify({mode:preview?'DRY RUN — real reads, local rules, preview only':'LOCAL ONE-SHOT',...result,
      total:store.leads().length,pending:store.leads().filter(l=>l.status==='PENDING_APPROVAL').length,
      gemini_attempted:gemini,methods:store.leads().map(l=>({id:l.lead_id,method:l.method,warning:l.extractionWarning})),
      telegram:telegram?'owner preview notifications + executive summary':'local payloads only',
      telegram_summary:summaryStatus,
      email_test:emailTest,
      gmail:'BLOCKED — no sender adapter; owner receipt only',state:file,alerts:alerts.length},null,2));
  }finally{await lock.close();await unlink(file+'.lock');}
}
main().catch(()=>{console.error('External run failed. Check API/configuration/local state; credentials and source text are redacted.');process.exitCode=1;});
