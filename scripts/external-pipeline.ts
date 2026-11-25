import {readFile,mkdir,writeFile,rename,open,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {Engine,canRouteDiscoveryLead,isDiscoveryCandidate,notification} from '../packages/core/workflow';
import {MemoryStore} from '../packages/core/memory-store';
import {configSchema} from '../packages/core/model';
import {canonicalEvidence,defaultQualificationPolicy,extractRuleEvidence,FREELANCE_BUYER_SOURCES,prefilterDiscovery,qualificationVersions,scoreFreelanceQualification} from '../packages/core/qualification';
import {discoveryAiBanner,providerHealthLine,type DiscoveryAiHealth} from '../packages/core/discovery-ai-health';
import {classifyGemini,openAICompletionEndpoint,type Http} from '../apps/automation/adapters';
import {pullExternalLeads,type ExternalCursor} from '../apps/automation/external-leads';
import {loopbackOrigin,stateDirectory} from './external-local-config.mjs';
import {discoveryAiChain,freeDiscoveryBackups,type DiscoveryProvider,type DiscoveryCache} from './external-discovery-ai';

interface EmailTestState{status:string;at:string;to:string;messageId:string;error:string}
const emptyEmailTest:EmailTestState={status:'DISABLED',at:'',to:'',messageId:'',error:''};

/**
 * Validates the URL shape only. The host, port and TLS mode are provider-neutral;
 * credentials are never returned, logged or echoed. Returns null when the value
 * is missing or cannot be used as an SMTP endpoint.
 */
function parseSmtpUrl(value:string):{host:string;port:number;secure:boolean}|null{
  if(!value)return null;
  let url:URL;
  try{url=new URL(value);}catch{return null;}
  if(url.protocol!=='smtp:'&&url.protocol!=='smtps:')return null;
  if(!url.hostname||/\s/.test(url.hostname))return null;
  if(url.pathname&&url.pathname!=='/')return null;
  if(url.search||url.hash)return null;
  const port=Number(url.port||(url.protocol==='smtps:'?'465':'587'));
  if(!Number.isInteger(port)||port<1||port>65535)return null;
  return {host:url.hostname,port,secure:url.protocol==='smtps:'};
}

/** Turns a redacted SMTP stage into an actionable next step. Never includes credentials or a provider name. */
function smtpHint(stage:string,code:number):string{
  if(stage==='auth-pass'&&(code===535||code===534))
    return 'The SMTP provider rejected the credentials. Check the username and the password or API key in OWNER_TEST_SMTP_URL; many providers require an app-specific password or API key rather than an account password';
  if(stage==='auth')return 'The server did not offer a supported AUTH mechanism; check the port and TLS mode';
  if(stage==='auth-user')return 'The SMTP username was rejected; check the username in OWNER_TEST_SMTP_URL';
  if(stage==='mail-from')return 'OWNER_TEST_EMAIL_FROM must be an address the SMTP provider allows you to send from';
  if(stage==='rcpt')return 'The relay rejected the recipient address';
  if(stage==='queued'&&(code===550||code===554))
    return 'The provider accepted the connection and credentials but rejected the message. OWNER_TEST_EMAIL_FROM must be on a domain verified with the provider; Resend requires a verified domain, and its onboarding@resend.dev sender only delivers to the account owner address';
  if(stage==='queued')return 'The provider rejected the message after accepting the envelope; check the From address and the provider dashboard for a suppression or policy reason';
  if(stage==='connect')return 'Nothing accepted the connection on that host and port';
  if(stage==='starttls')return 'STARTTLS was refused; try smtps:// on port 465';
  if(stage==='greeting')return 'The host answered but not as an SMTP server';
  if(stage==='timeout')return 'The relay did not respond; check the host and port';
  return '';
}

/** Structured owner digest. Contains no credentials and no lead contact details. */
function executiveSummary(store:MemoryStore,run:{imported:number;duplicates:number;invalid:number},emailTest:EmailTestState,aiHealth:DiscoveryAiHealth){
  const allRecords=store.leads();
  const discovery=allRecords.filter(isDiscoveryCandidate);
  const eligible=discovery.filter(canRouteDiscoveryLead);
  const rejected=discovery.filter(lead=>!canRouteDiscoveryLead(lead));
  const blocked=discovery.filter(lead=>lead.qualification_audit?.decision_source==="SOURCE_GUARD").length;
  const inbound=allRecords.filter(l=>!isDiscoveryCandidate(l));
  const reasonCounts=new Map<string,number>();
  for(const candidate of rejected){
    const reason=candidate.qualification?.rejection_reason;
    if(reason)reasonCounts.set(reason,(reasonCounts.get(reason)||0)+1);
  }
  const top=eligible.sort((a,b)=>(b.qualification?.quality_score??0)-(a.qualification?.quality_score??0)).slice(0,3);
  const warned=allRecords.filter(l=>l.extractionWarning||l.qualification_audit?.warnings?.length);
  const safeEvidence=(l:typeof top[number])=>
    (l.qualification?.evidence_quotes||[])
      .filter(q=>q.field!=='contact')
      .slice(0,3)
      .map(q=>`${q.field}: ${q.quote.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,'[email]').replace(/https?:\/\/\S+/gi,'[link]').slice(0,100)}`);
  return [
    'FREELANCE QUALIFICATION SUMMARY',
    `Pipeline status: ${run.imported>0?'ACTIVE — new candidates processed':'IDLE — no new candidates this run'}`,
    '',
    `Processed this run: ${run.imported+run.duplicates+run.invalid} (imported ${run.imported}, duplicates ${run.duplicates}, skipped ${run.invalid})`,
    `Raw candidates: ${discovery.length}`,
    `Accepted candidates: ${eligible.length}`,
    `Rejected candidates: ${rejected.length}`,
    `Blocked by source check: ${blocked}`,
    `Finalized this run: AI ${aiHealth.finalizedBy.ai}, rules ${aiHealth.finalizedBy.rules}, source check ${aiHealth.finalizedBy.sourceGuard}`,
    discoveryAiBanner(aiHealth) || '',
    ...aiHealth.providers.map(providerHealthLine),
    reasonCounts.size?`Primary reasons: ${[...reasonCounts].map(([reason,count])=>`${reason} (${count})`).join(', ')}`:'',
    inbound.length?`  • Consented inbound enquiries: ${inbound.length}`:'',
    '',
    'Top accepted opportunities:',
    ...(top.length
      ? top.flatMap((l,i)=>[
          `${i+1}. ${(l.client_name_if_public||l.title||l.lead_id).slice(0,90)} — ${l.qualification?.priority}, ${l.qualification?.quality_score}/100, ${Math.round((l.qualification?.confidence_score||0)*100)}% confidence (${l.qualification_audit?.method||'unknown'})`,
          ...(safeEvidence(l).length?[`   Evidence: ${safeEvidence(l).join(' · ')}`]:[]),
        ])
      : ['  none']),
    '',
    'Errors / skipped:',
    ...(run.invalid||warned.length
      ? [
          ...(run.invalid?[`  ${run.invalid} row(s) skipped as invalid or unsupported`]:[]),
          ...warned.slice(0,3).map(l=>`  ${l.lead_id}: ${(l.extractionWarning||l.qualification_audit?.warnings?.join('; ')||'').slice(0,120)}`),
        ]
      : ['  none']),
    '',
    `Owner email test: ${emailTest.status}${emailTest.to?` → ${emailTest.to}`:''}${emailTest.error?` (${emailTest.error})`:''}`,
    'No email was sent to any external lead.',
  ].filter(Boolean).join('\n');
}

/**
 * SAFE_OWNER_EMAIL_TEST: at most one clearly labelled receipt per run, addressed
 * only to OWNER_TEST_EMAIL. A discovered lead address can never be the recipient.
 * The SMTP endpoint is read from OWNER_TEST_SMTP_URL and is provider-neutral.
 * Failure detail is limited to the SMTP stage and response code; credentials and
 * the SMTP URL are never returned.
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
  if(!parseSmtpUrl(smtpUrl))
    return {status:'SKIPPED_NOT_CONFIGURED',at,to,messageId:'',error:'OWNER_TEST_SMTP_URL missing or invalid; receipt written to outputs/external/email-test-receipt.eml'};
  const result=spawnSync(process.execPath,['scripts/owner-email-test.mjs'],{input:JSON.stringify({smtpUrl,from,to,subject,text}),encoding:'utf8',timeout:30000,maxBuffer:200000});
  let parsed:{ok?:boolean;messageId?:string;stage?:string;code?:number;message?:string}={};
  try{parsed=JSON.parse(result.stdout||'{}');}catch{parsed={};}
  if(result.status!==0||!parsed.ok){
    const stage=String(parsed.stage||'');
    const hint=smtpHint(stage,Number(parsed.code||0));
    const detail=stage
      ?`SMTP ${stage} failed${parsed.code?` (code ${parsed.code})`:''}${parsed.message?` — ${parsed.message}`:''}${hint?`. ${hint}`:''}`
      :result.error?'SMTP transport could not start':'SMTP transport ended without a receipt';
    return {status:'FAILED',at,to,messageId:'',error:detail.slice(0,300)};
  }
  return {status:'SENT',at,to,messageId:String(parsed.messageId||''),error:''};
}

async function main(){
  const preview=process.argv.includes('--dry-run');
  try {const text=await readFile('.env.external','utf8');for(const line of text.split(/\r?\n/)){
    const m=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/);if(m&&process.env[m[1]]===undefined)process.env[m[1]]=m[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const get=(key:string,fallback='')=>process.env[key]??fallback;
  const on=(key:string)=>get(key)==='true';
  const complete=process.argv.includes('--complete');
  const collectSources=complete||process.argv.includes('--collect');
  const drain=process.argv.includes('--drain');
  const requalifyMissing=process.argv.includes('--requalify-missing')||
    ['1','true'].includes(get('REQUALIFY_MISSING').toLowerCase());
  const requalifyAll=process.argv.includes('--requalify-all')||
    ['1','true'].includes(get('FORCE_REQUALIFY').toLowerCase());
  const retryDiscoveryAi=process.argv.includes('--retry-discovery-ai');
  const recheckAccepted=process.argv.includes('--recheck-accepted');
  const reviewSourceGuards=process.argv.includes('--review-source-guards');
  const reconsiderScoped=process.argv.includes('--reconsider-scoped');
  const refreshAuthorizedImports=process.argv.includes('--refresh-authorized-imports');
  const replayStored=requalifyAll||retryDiscoveryAi||recheckAccepted||reviewSourceGuards||reconsiderScoped;
  const requalificationRun=requalifyMissing||replayStored;
  const qualificationMode=get('FREELANCE_QUALIFICATION_MODE','shadow');
  if(qualificationMode!=='shadow'&&qualificationMode!=='enforce')
    throw new Error('FREELANCE_QUALIFICATION_MODE must be shadow or enforce');
  const allowDiscoveryNotifications=qualificationMode==='enforce'&&!requalificationRun;
  if(!preview&&!on('EXTERNAL_LEADS_ENABLED')){console.log('External ingestion OFF. Set EXTERNAL_LEADS_ENABLED=true in .env.external; preview: npm run external:run -- --dry-run');return;}
  // Intentionally local-only. Hosted APIs use the existing Apps Script connector.
  const upstream=loopbackOrigin(get('EXTERNAL_LEADS_API_ORIGIN','http://127.0.0.1:8787'));
  process.env.EXTERNAL_LEADS_API_ORIGIN=upstream;
  const allowedSources=[...new Set(get('EXTERNAL_LEADS_SOURCES','hackernews,wordpress_jobs_rss,authorized_projects').split(',').map(s=>s.trim()))].sort();
  const buyerSources=new Set<string>(FREELANCE_BUYER_SOURCES);
  if(allowedSources.some(source=>!buyerSources.has(source)))throw new Error('Invalid external source allowlist');
  if(refreshAuthorizedImports && (allowedSources.length!==1||allowedSources[0]!=='authorized_projects'||replayStored||preview))
    throw new Error('Authorized import refresh requires an authorized-projects-only run');
  let token=get('EXTERNAL_LEADS_API_TOKEN');
  if(!token&&!replayStored){const vars=await readFile('../leadflow-leads/.dev.vars','utf8');token=vars.split(/\r?\n/).find(l=>l.startsWith('API_TOKEN='))?.slice(10).trim()||'';}
  if(!token&&!replayStored)throw new Error('Local API token missing');
  if(collectSources){
    if(preview||requalificationRun||drain&&!complete)throw new Error('Run source collection as a separate command');
    const collectLimit=Number(process.argv.find(arg=>arg.startsWith('--limit='))?.slice(8)??20);
    if(!Number.isInteger(collectLimit)||collectLimit<1||collectLimit>100)throw new Error('Collection limit must be 1–100 per feed');
    const option=(name:string,fallback:number,min:number,max:number)=>{
      const value=Number(process.argv.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3)??fallback);
      if(!Number.isInteger(value)||value<min||value>max)throw new Error(`Invalid --${name}`);
      return value;
    };
    const target=option('max-candidates',500,1,500);
    const days=option('fresh-days',14,1,30);
    const pages=option('pages',5,1,7);
    const deadline=Date.now()+option('max-seconds',240,5,600)*1000;
    let unique=0;
    for(const source of allowedSources){
      if(source==='authorized_projects'){
        console.log(JSON.stringify({source,state:'IMPORT_ONLY',raw:0,fetched:0,inserted:0,duplicates:0}));
        continue;
      }
      if(unique>=target||Date.now()>=deadline){
        console.log(JSON.stringify({source,state:'BUDGET_REACHED',raw:0,fetched:0,inserted:0,duplicates:0}));
        continue;
      }
      try{
        const response=await fetch(`${upstream}/collect/${source}?limit=${Math.min(collectLimit,target-unique)}&freshDays=${days}&pages=${pages}`,{
          method:'POST',headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(Math.min(115000,Math.max(1,deadline-Date.now()))),
        });
        const {state,fetched,inserted,duplicates,raw,filtered,accepted,error,filterReasons}=await response.json();
        unique+=Number(inserted)||0;
        const problem=typeof error==='string'&&/^[A-Z\d_]{3,65}$/.test(error)?error:undefined;
        console.log(JSON.stringify({source,http:response.status,state,raw,filtered,passedCollector:accepted,fetched,inserted,duplicates,filterReasons,problem}));
        if(!response.ok)process.exitCode=1;
      }catch{
        console.log(JSON.stringify({source,state:'PROVIDER_UNAVAILABLE',raw:0,fetched:0,inserted:0,duplicates:0}));
        console.error(`Collection failed for ${source}. Check the local API and source status.`);
        process.exitCode=1;
      }
    }
    if(!complete)return;
  }
  if(drain&&replayStored)throw new Error('Use --drain for new candidates or --retry-discovery-ai for saved candidates');
  const providerSetting=get('DISCOVERY_AI_PROVIDER',get('AI_PROVIDER','gemini'));
  if(!['auto','gemini','openai','openrouter'].includes(providerSetting))throw new Error('DISCOVERY_AI_PROVIDER must be auto, gemini, openai or openrouter');
  const automatic=providerSetting==='auto';
  const aiProvider=automatic||providerSetting==='gemini'?'gemini':'openai';
  const aiRequested=!preview&&(aiProvider==='gemini'
    ? on('AI_ENABLED')||on('GEMINI_ENABLED')
    : on('AI_ENABLED'));
  const telegram=!preview&&on('TELEGRAM_ENABLED')&&allowDiscoveryNotifications;
  const safeEmailTest=!preview&&on('SAFE_OWNER_EMAIL_TEST')&&!requalificationRun;
  const aiApiKey=aiProvider==='gemini'?(get('GEMINI_API_KEY')||get('AI_API_KEY')):
    (get(providerSetting==='openrouter'?'OPENROUTER_API_KEY':'OPENAI_API_KEY')||get('AI_API_KEY'));
  const aiModel=aiProvider==='gemini'?(get('GEMINI_MODEL')||get('AI_MODEL')):
    (get(providerSetting==='openrouter'?'OPENROUTER_MODEL':'OPENAI_MODEL')||get('AI_MODEL'));
  const aiBaseUrl=providerSetting==='openrouter'?'https://openrouter.ai/api/v1':get('AI_API_BASE_URL','https://api.openai.com/v1');
  const geminiReady=Boolean(aiApiKey&&aiModel&&on('GEMINI_FREE_TIER_CONFIRMED')&&on('GEMINI_DATA_USE_APPROVED'));
  const compatibleReady=Boolean(aiApiKey&&aiModel&&on('AI_DATA_USE_APPROVED'));
  const providers:DiscoveryProvider[]=[];
  if(aiRequested&&(aiProvider==='gemini'?geminiReady:compatibleReady)){
    providers.push({
      id:providerSetting==='openrouter'?'openrouter':aiProvider,
      options:{enabled:true,provider:aiProvider,freeTierConfirmed:aiProvider==='gemini',
        dataUseApproved:true,apiKey:aiApiKey,model:aiModel,baseUrl:aiBaseUrl},
    });
  }
  if(automatic&&aiRequested&&on('AI_ENABLED')&&on('AI_DATA_USE_APPROVED')){
    process.env.DISCOVERY_AI_PROVIDER='auto';
    providers.push(...freeDiscoveryBackups(get));
  }
  const aiEnabled=providers.length>0;
  const aiSetupWarning=aiRequested&&!aiEnabled?'Approved classifier settings unavailable; no AI verdict':'';
  const discoveryAiLimit=Number(get('EXTERNAL_DISCOVERY_AI_MAX_REQUESTS','100'));
  if(!Number.isInteger(discoveryAiLimit)||discoveryAiLimit<0||discoveryAiLimit>500)throw new Error('EXTERNAL_DISCOVERY_AI_MAX_REQUESTS must be 0–500');
  if(aiEnabled&&aiProvider==='openai'){
    openAICompletionEndpoint(aiBaseUrl);
    // The private subprocess binds requests to this exact configured endpoint.
    process.env.AI_PROVIDER='openai';
    process.env.AI_API_BASE_URL=aiBaseUrl;
  }
  if(telegram&&(!/^\d+:[\w-]+$/.test(get('TELEGRAM_BOT_TOKEN'))||!/^\d+$/.test(get('TELEGRAM_OWNER_CHAT_ID'))||get('TELEGRAM_OWNER_CHAT_ID')!==get('TELEGRAM_OWNER_USER_ID')))throw new Error('Private Telegram owner settings missing or mismatched');
  const limit=Number(get('EXTERNAL_LEADS_BATCH_SIZE','5'));if(!Number.isInteger(limit)||limit<1||limit>5)throw new Error('Batch must be 1–5');
  const directory=stateDirectory(get('EXTERNAL_LOCAL_PROFILE'));
  const output=get('EXTERNAL_LOCAL_PROFILE')?`outputs/external/${get('EXTERNAL_LOCAL_PROFILE')}`:'outputs/external';
  const file=`${directory}/${preview?'external-preview.json':aiRequested?`external-${aiProvider}.json`:'external-pipeline.json'}`;
  await mkdir(directory,{recursive:true});await mkdir(output,{recursive:true});
  const lock=await open(file+'.lock','wx');
  try{
    const store=new MemoryStore();let cursor:ExternalCursor={after:0};let emailTest:EmailTestState={...emptyEmailTest};
    const freshSince=get('LEADFLOW_FRESH_SINCE');
    let checkpointKey=JSON.stringify(freshSince?[upstream,allowedSources,1,freshSince]:[upstream,allowedSources,1]);
    let sourceHealth:unknown=null;
    let cooldowns:Parameters<typeof discoveryAiChain>[3]={};
    let modelCache:DiscoveryCache={};
    let recentAi: {at:string;providers:DiscoveryAiHealth['providers']}|undefined;
    try{const old=JSON.parse(await readFile(file,'utf8'));Object.assign(store,old.store);if(replayStored&&old.checkpointKey)checkpointKey=old.checkpointKey;if(old.checkpointKey===checkpointKey&&old.cursor)cursor=old.cursor;if(old.emailTest)emailTest=old.emailTest as EmailTestState;sourceHealth=old.sourceHealth??null;cooldowns=old.cooldowns??{};modelCache=old.modelCache??{};recentAi=old.recentAi;}
    catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Unreadable local state; restore before retrying');}
    if((requalifyMissing&&!replayStored)||refreshAuthorizedImports)cursor={after:0};
    let httpCount=0;
    function requestJson(url:string,request?:Parameters<Http['json']>[1]){
      const result=spawnSync(process.execPath,['scripts/external-http.mjs'],{input:JSON.stringify({url,request}),encoding:'utf8',timeout:27000,maxBuffer:2000000});
      if(result.status!==0){
        // external-http.mjs writes only a safe, credential-free detail to stderr
        // (HTTP status or network error code). Bound and flatten it before use.
        const detail=(result.stderr||'').replace(/[\r\n]+/g,' ').trim().slice(0,200);
        const safeDetail=/^(?:HTTP \d{3}(?: retry-after=\d{1,5})?(?: (?:credits|quota) exhausted)?|(?:credits|quota) exhausted|[A-Z0-9_]{1,50}|request failed|host blocked|response too large|invalid JSON response)$/.test(detail)?detail:'timeout or transport failure';
        if(url.startsWith(upstream+'/'))throw new Error(`Upstream ${upstream} returned ${safeDetail}. Check Wrangler's listening port and local API token.`);
        throw new Error(`Provider request failed (${safeDetail})`);
      }
      return JSON.parse(result.stdout);
    }
    const network:Http={json(url,request){
      if(++httpCount>16)throw new Error('Local per-run source/notification HTTP budget reached');
      return requestJson(url,request);
    }};
    const origin='https://local-runner.example.com',transportToken='local-adapter-transport-placeholder-only';
    const http:Http={json(url,request){
      if(url.startsWith(origin+'/leads?'))return network.json(upstream+url.slice(origin.length),{headers:{Authorization:`Bearer ${token}`}});
      if(!url.startsWith('https://hacker-news.firebaseio.com/v0/item/'))throw new Error('Unexpected source URL');
      if(request?.headers)throw new Error('No token may be sent to HN');return network.json(url);
    }};
    const config=configSchema.parse({ownerUserId:get('TELEGRAM_OWNER_USER_ID','local-owner'),ownerChatId:get('TELEGRAM_OWNER_CHAT_ID','local-owner')});
    const recent = automatic && recentAi && Date.now()-Date.parse(recentAi.at)<12*3600_000 ? recentAi.providers : [];
    const chain=discoveryAiChain(providers,{json:requestJson},discoveryAiLimit,cooldowns,Date.now,modelCache,recent);
    const prioritySource=(source:string)=>["wordpress_jobs_rss","hackernews","freelancer_rss","authorized_projects","uk_tender","uk_contracts_finder"].includes(source);
    const preserveBuyerBudget=allowedSources.some(prioritySource)&&allowedSources.some(source=>!prioritySource(source));
    const diagnosticBudget=Math.floor(discoveryAiLimit*0.8);
    let diagnosticRequests=0;
    const finalizedBy={ai:0,rules:0,sourceGuard:0};
    const recordFinalization=(lead:ReturnType<typeof store.leads>[number])=>{
      const source=lead.qualification_audit?.decision_source;
      if(source==='MODEL')finalizedBy.ai++;
      else if(source==='RULES_FALLBACK')finalizedBy.rules++;
      else if(source==='SOURCE_GUARD')finalizedBy.sourceGuard++;
    };
    const save=async()=>{
      const aiHealth=chain.health(finalizedBy);
      if(chain.coverage.requests>0)recentAi={at:new Date().toISOString(),providers:aiHealth.providers};
      await writeFile(file+'.tmp',JSON.stringify({offset:0,checkpointKey,cursor,store,emailTest,sourceHealth,cooldowns,aiHealth,modelCache,recentAi},null,2));
      await rename(file+'.tmp',file);
    };
    const engine=new Engine(store,config,undefined,aiRequested?input=>{
      if (input.discovery_context) {
        const diagnostic=preserveBuyerBudget&&!prioritySource(input.discovery_context.provider);
        if(diagnostic&&diagnosticRequests>=diagnosticBudget)return {warning:'No AI verdict: diagnostic-board budget reached; buyer-source quota reserved'};
        const before=chain.coverage.requests;
        const outcome=chain.classify(input.discovery_context);
        if(diagnostic)diagnosticRequests+=chain.coverage.requests-before;
        return outcome;
      }
      if (!aiEnabled) return { warning: aiSetupWarning };
      if(aiProvider==='gemini'&&geminiReady)return classifyGemini(network,input,{enabled:true,freeTierConfirmed:true,dataUseApproved:true,apiKey:aiApiKey,model:aiModel});
      return {warning:'OpenAI-compatible extraction is limited to discovery; local rules used'};
    }:undefined);
    let requalified=0,requalificationSkipped=0;
    let result={imported:0,duplicates:0,invalid:0,nextOffset:0,fetched:0,sourceState:''};
    if(replayStored||!preview){
      for(const lead of store.leads().filter(isDiscoveryCandidate).sort((left,right)=>
        Number(prioritySource(right.discovery_context?.provider??""))-Number(prioritySource(left.discovery_context?.provider??"")))){
        if(recheckAccepted&&lead.qualification_audit?.operational_state!=="QUALIFIED"&&
          !(lead.qualification_audit?.operational_state==="RETRY_CLASSIFICATION"&&lead.qualification_audit.decision_source==="SOURCE_GUARD"))continue;
        if(!lead.discovery_context){requalificationSkipped++;continue;}
        if(reviewSourceGuards&&(lead.qualification_audit?.operational_state==='REJECTED'||prefilterDiscovery(
          lead.discovery_context,new Date().toISOString(),{...defaultQualificationPolicy,max_age_days:config.maxAgeDays}).pass))continue;
        if(reconsiderScoped){
          const state=lead.qualification_audit?.operational_state;
          const context=lead.discovery_context;
          if((state!=='REVIEW'&&state!=='AWAITING_ENRICHMENT')||context.truncated||!context.complete||
            lead.qualification_audit?.prompt_version===qualificationVersions.prompt_version||!chain.available()||chain.exhausted())continue;
          const rules=scoreFreelanceQualification(extractRuleEvidence(canonicalEvidence(context),context),context,new Date().toISOString());
          if(rules.audit.project_boundary!=='BOUNDED'||!rules.record.evidence_quotes.some(item=>item.field==='scope'))continue;
        }
        const decisionSource=lead.qualification_audit?.decision_source;
        const retryable=lead.qualification_audit?.operational_state==='RETRY_CLASSIFICATION';
        if(!replayStored&&decisionSource!=='NO_MODEL'&&!retryable&&lead.qualification?.operator_decision)continue;
        if(!requalifyAll&&!allowedSources.includes(lead.discovery_context.provider))continue;
        if(retryDiscoveryAi||(!recheckAccepted&&!requalifyAll&&retryable)){
          if(decisionSource==='MODEL'||decisionSource==='SOURCE_GUARD')continue;
          if(lead.qualification_audit?.operational_state&&!retryable)continue;
          if(decisionSource==='RULES_FALLBACK'&&(!chain.available()||chain.exhausted()))continue;
        }
        const qualified=engine.requalifyDiscovery(lead.lead_id,lead,true);
        if(qualified===lead)continue;
        recordFinalization(qualified);
        requalified++;
        await save();
      }
    }
    if(!replayStored){
      try {
        for(let page=0;page<(drain?100:1);page++){
          httpCount=0;
          const pulled=pullExternalLeads(http,{origin,token:transportToken,offset:0,cursor,limit,allowedSources,since:freshSince},lead=>{
            const ingested=engine.ingest(lead);
            if(!ingested.duplicate)recordFinalization(ingested.lead);
            if(refreshAuthorizedImports&&ingested.duplicate&&lead.discovery_context?.provider==='authorized_projects'&&
              ingested.lead.discovery_context?.provider==='authorized_projects'&&
              ingested.lead.discovery_context.source_hash!==lead.discovery_context.source_hash){
              recordFinalization(engine.requalifyDiscovery(ingested.lead.lead_id,lead,true));
              requalified++;
            }
            if(requalifyMissing&&ingested.duplicate&&lead.discovery_context){
              const stored=store.get(ingested.lead.lead_id);
              if(stored?.source==='hn'&&(!stored.qualification||stored.qualification_status==='NEEDS_REQUALIFICATION')){
                recordFinalization(engine.requalifyMissingDiscovery(stored.lead_id,lead));
                requalified++;
              }
            }
            return ingested;
          });
          result.imported+=pulled.imported;
          result.duplicates+=pulled.duplicates;
          result.invalid+=pulled.invalid;
          result.fetched+=pulled.fetched;
          result.nextOffset=pulled.nextOffset;
          result.sourceState=result.fetched?'OK':pulled.sourceState;
          cursor=pulled.nextCursor ?? cursor;
          if(!drain||cursor.until===undefined)break;
          await save();
        }
        let diagnostics: unknown=null;
        try { diagnostics=network.json(upstream+'/diagnostics',{headers:{Authorization:`Bearer ${token}`}}); } catch { /* Optional for older Workers. */ }
        sourceHealth={origin:upstream,state:result.sourceState,at:new Date().toISOString(),fetched:result.fetched,diagnostics};
      } catch(error) {
        sourceHealth={origin:upstream,state:'UPSTREAM_ERROR',at:new Date().toISOString(),error:error instanceof Error&&error.message.startsWith('Upstream ')?error.message:'Lead intake failed. Check the Worker version, response and provider health.'};
        await save();
        throw error;
      }
    }
    await save();
    const alerts=[];
    for(const lead of (allowDiscoveryNotifications?store.leads():[]).filter(l=>
      l.status==='PENDING_APPROVAL' &&
      !store.requests().some(r=>
        r.lead_id===l.lead_id&&
        !(requalifyMissing&&allowDiscoveryNotifications&&r.state==='FAILED')
      ) &&
      canRouteDiscoveryLead(l)
    ).slice(0,2)){
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
        const raw=network.json(`https://api.telegram.org/bot${get('TELEGRAM_BOT_TOKEN')}/sendMessage`,{method:'post',retrySafe:false,body:{chat_id:config.ownerChatId,text:executiveSummary(store,result,emailTest,chain.health(finalizedBy)),link_preview_options:{is_disabled:true}}}) as {ok?:boolean;result?:{chat:{id:number;type:string}}};
        if(!raw.ok||raw.result?.chat.type!=='private'||String(raw.result.chat.id)!==config.ownerChatId)throw new Error('Wrong recipient');
        summaryStatus='SENT';
      }catch{summaryStatus='FAILED';}
    }
    await save();await writeFile(`${output}/review-preview.json`,JSON.stringify(alerts,null,2));
    const discoveryRows=store.leads().filter(isDiscoveryCandidate);
    const accepted=discoveryRows.filter(canRouteDiscoveryLead).length;
    const qualificationStates={QUALIFIED:0,REJECTED:0,REVIEW:0,RETRY_CLASSIFICATION:0,AWAITING_ENRICHMENT:0};
    for(const lead of discoveryRows)qualificationStates[lead.qualification_audit?.operational_state??'AWAITING_ENRICHMENT']++;
    const blocked=discoveryRows.filter(lead=>lead.qualification_audit?.decision_source==='SOURCE_GUARD').length;
    const {requests,attempted,succeeded,failed}=chain.coverage;
    const aiHealth=chain.health(finalizedBy);
    console.log(JSON.stringify({mode:preview?'DRY RUN — real reads, local rules, preview only':requalificationRun?'LOCAL REQUALIFICATION — NOTIFICATIONS SUPPRESSED':`LOCAL ONE-SHOT — ${qualificationMode.toUpperCase()}`,...result,requalified,requalification_skipped_missing_context:requalificationSkipped,
      total:store.leads().length,pending:store.leads().filter(l=>l.status==='PENDING_APPROVAL').length,
      accepted,rejected:qualificationStates.REJECTED,qualificationStates,aiHealth,ai_health_banner:discoveryAiBanner(aiHealth),ai_provider_status:aiHealth.providers.map(providerHealthLine),
      blocked_by_source:blocked,ai_attempted:attempted,ai_succeeded:succeeded,ai_failed:failed,
      ai_skipped:Math.max(0,result.imported+requalified-succeeded-failed),
      ai_failure_reasons:chain.failures,ai_provider:providerSetting,gemini_attempted:Boolean(chain.callsByProvider.gemini),
      discovery_ai_requests:requests,discovery_ai_cache_hits:chain.coverage.cacheHits,ai_requests_by_provider:chain.callsByProvider,ai_verdicts_by_provider:chain.verdictsByProvider,
      discovery_ai_pause:!chain.available()?(aiSetupWarning||Object.values(cooldowns).map(item=>item.warning).join('; ')):'',
      methods:store.leads().map(l=>({id:l.lead_id,method:l.method,warning:l.extractionWarning})),
      telegram:requalificationRun?'suppressed during requalification':qualificationMode==='shadow'?'suppressed by shadow mode':telegram?'owner preview notifications + executive summary':'local payloads only',
      telegram_summary:summaryStatus,
      email_test:emailTest,
      gmail:'BLOCKED — no sender adapter; owner receipt only',state:file,alerts:alerts.length},null,2));
  }finally{await lock.close();await unlink(file+'.lock');}
}
main().catch((err:unknown)=>{
  // Runner error messages are written to be credential-free; still bound the length.
  const message=err instanceof Error?err.message:String(err);
  console.error(`External run failed: ${message.slice(0,300)}`);
  process.exitCode=1;
});
