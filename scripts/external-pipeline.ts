import {readFile,mkdir,writeFile,rename,open,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {Engine,notification} from '../packages/core/workflow';
import {MemoryStore} from '../packages/core/memory-store';
import {configSchema} from '../packages/core/model';
import {classifyGemini,type Http} from '../apps/automation/adapters';
import {pullExternalLeads} from '../apps/automation/external-leads';

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
  if(gemini&&(!get('GEMINI_API_KEY')||!get('GEMINI_MODEL')||!on('GEMINI_FREE_TIER_CONFIRMED')||!on('GEMINI_DATA_USE_APPROVED')))throw new Error('Complete approved Gemini settings first');
  if(telegram&&(!/^\d+:[\w-]+$/.test(get('TELEGRAM_BOT_TOKEN'))||!/^\d+$/.test(get('TELEGRAM_OWNER_CHAT_ID'))||get('TELEGRAM_OWNER_CHAT_ID')!==get('TELEGRAM_OWNER_USER_ID')))throw new Error('Private Telegram owner settings missing or mismatched');
  const limit=Number(get('EXTERNAL_LEADS_BATCH_SIZE','5'));if(!Number.isInteger(limit)||limit<1||limit>5)throw new Error('Batch must be 1–5');
  const file=preview?'data/external-preview.json':gemini?'data/external-gemini.json':'data/external-pipeline.json';
  await mkdir('data',{recursive:true});await mkdir('outputs/external',{recursive:true});
  const lock=await open(file+'.lock','wx');
  try{
    const store=new MemoryStore();let offset=0;
    try{const old=JSON.parse(await readFile(file,'utf8'));Object.assign(store,old.store);offset=old.offset;}
    catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Unreadable local state; restore before retrying');}
    const save=async()=>{await writeFile(file+'.tmp',JSON.stringify({offset,store},null,2));await rename(file+'.tmp',file);};
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
    await save();await writeFile('outputs/external/review-preview.json',JSON.stringify(alerts,null,2));
    console.log(JSON.stringify({mode:preview?'DRY RUN — real reads, local rules, preview only':'LOCAL ONE-SHOT',...result,
      total:store.leads().length,pending:store.leads().filter(l=>l.status==='PENDING_APPROVAL').length,
      gemini_attempted:gemini,methods:store.leads().map(l=>({id:l.lead_id,method:l.method,warning:l.extractionWarning})),
      telegram:telegram?'owner preview notifications':'local payloads only',gmail:'BLOCKED — no sender adapter',state:file,alerts:alerts.length},null,2));
  }finally{await lock.close();await unlink(file+'.lock');}
}
main().catch(()=>{console.error('External run failed. Check API/configuration/local state; credentials and source text are redacted.');process.exitCode=1;});
