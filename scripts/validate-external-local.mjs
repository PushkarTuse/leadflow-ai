// Read-only real-data check. No Sheet, Telegram, Gemini or Gmail credentials are loaded.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import assert from 'node:assert/strict';

const repo=resolve(process.argv[2] || '../leadflow-leads');
const vars=await readFile(resolve(repo,'.dev.vars'),'utf8');
const token=vars.split(/\r?\n/).find(line=>line.startsWith('API_TOKEN='))?.slice(10).trim();
assert(token,'Set API_TOKEN in the local API .dev.vars');
// This script authenticates to loopback using the owner's chosen local token.
// Production adapter validation still requires a strong token; its snapshot transport uses a dummy.
const transportToken='local-snapshot-transport-placeholder-only';
async function json(url, headers={}) {
  const response=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(20000)});
  assert(response.ok,`Read request failed: HTTP ${response.status}`);
  return response.json();
}
const query='/leads?sort=found_at&order=asc&limit=5&offset=0';
const page=await json('http://127.0.0.1:8787'+query,{Authorization:`Bearer ${token}`});
assert.equal(page.count,5,'Collect at least five HN leads into an otherwise empty local DB first');
assert(page.leads.every(row=>row.source==='hackernews'),'First local page must contain HN rows');
const originals=new Map();
for(const row of page.leads){
  assert(/^[1-9]\d{0,14}$/.test(row.source_id),'Invalid HN ID');
  const url=`https://hacker-news.firebaseio.com/v0/item/${row.source_id}.json`;
  originals.set(url,await json(url));
}
const compiled=await build({stdin:{contents:`export {pullExternalLeads} from './apps/automation/external-leads';
export {Engine,notification} from './packages/core/workflow';export {MemoryStore} from './packages/core/memory-store';`,
  resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const {pullExternalLeads,Engine,MemoryStore,notification}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
// Adapter Http is synchronous for Apps Script. Replay just-fetched real responses through it.
// The virtual origin is only a local transport key; no request is sent to this hostname.
const origin='https://local-validation.example.com';
const http={json(url,request){
  if(url===origin+query){assert.equal(request?.headers?.Authorization,`Bearer ${transportToken}`);return page;}
  assert.equal(request?.headers,undefined,'Bearer token must not be forwarded to HN');
  assert(originals.has(url),'Unexpected adapter URL');return originals.get(url);
}};
const store=new MemoryStore(),engine=new Engine(store);
const options={origin,token:transportToken,offset:0,limit:5,allowedSources:['hackernews']};
const first=pullExternalLeads(http,options,lead=>engine.ingest(lead));
const replay=pullExternalLeads(http,options,lead=>engine.ingest(lead));
assert.equal(first.imported,5);assert.equal(first.invalid,0);assert.equal(replay.duplicates,5);
assert.equal(store.leads().length,5);
for(const lead of store.leads()){
  assert.equal(lead.source,'hn');assert.equal(lead.contact_email,'');
  assert.equal(lead.contact_permission_state,'UNKNOWN');assert(!lead.consent_at);
  assert.equal(lead.source_url,`https://news.ycombinator.com/item?id=${lead.source_external_id}`);
  assert(lead.raw_description.length>=20);assert(lead.posted_at);
}
const leads=store.leads().map(l=>({id:l.source_external_id,source:l.source,source_url:l.source_url,
  posted_at:l.posted_at,description_length:l.raw_description.length,score:l.score,status:l.status}));
const pending=store.leads().filter(l=>l.status==='PENDING_APPROVAL');
assert(pending.length>0,'No real leads reached review; inspect scoring before claiming pipeline success');
const reviewResults=[];
for(const [i,lead] of pending.entries()){
  const request=engine.prepareApproval(lead,`localdryrun${String(i).padStart(8,'0')}`);
  const message=notification(lead,request);
  assert(message.text.includes('Approval creates a draft only.'));
  assert.equal(message.reply_markup.inline_keyboard.flat().length,3);
  // Simulate the Telegram transport receipt; no Telegram HTTP request is made.
  const messageId=String(1000+i);
  store.request({...request,state:'SENT',message_id:messageId});
  const action=['approve','review','reject'][i%3];
  const callback={userId:engine.config.ownerUserId,chatId:engine.config.ownerChatId,
    chatType:'private',messageId,data:`${action}:${request.nonce}`};
  assert.throws(()=>engine.decide({...callback,userId:'not-the-owner'}));
  const result=engine.decide(callback);
  if(action==='approve')assert.equal(result.status,'DRAFT_READY');
  if(action==='review')assert.equal(result.approval_status,'DEFERRED');
  if(action==='reject')assert.equal(result.status,'REJECTED');
  assert.throws(()=>engine.decide(callback));
  reviewResults.push({id:lead.source_external_id,action,status:result.status,approval_status:result.approval_status});
}
console.log(JSON.stringify({local_api:'http://127.0.0.1:8787',first,replay,
  validation:'Real API and official HN responses; in-memory engine; rules scoring; no outbound effects',
  leads,review_stage:{pending:pending.length,transport:'simulated, no Telegram delivery',results:reviewResults}},null,2));
