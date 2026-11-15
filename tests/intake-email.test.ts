import {createHash,createHmac,randomUUID} from 'node:crypto';
import {describe,it,expect,vi} from 'vitest';
import {inboundSchema,inboundToLead,verifyEnvelope,signatureMessage} from '../packages/core/intake';
import {EmailWorkflow,type EmailOutbox,emailContent,draftEmail,emailAlert} from '../packages/core/email';
import {MemoryStore} from '../packages/core/memory-store';
import {Engine} from '../packages/core/workflow';
import {defaults} from '../packages/core/model';
import {handleContact,type ContactEnvironment} from '../functions/api/contact';

const now='2026-11-12T08:00:00.000Z';
const enquiry=()=>inboundSchema.parse({submission_id:randomUUID(),name:'Test Owner',email:'owner@example.com',business:'Sample Studio',goal:'We need a React website with an enquiry form and Google Sheets integration. Timeline is flexible.',budget:'₹30,000–₹60,000',consent:true,consent_version:'enquiry-email-v1'});
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
const sign=(v:string,k:string)=>createHmac('sha256',k).update(v).digest('hex');
function state(){const store=new MemoryStore();let rows:EmailOutbox[]=[];const outbox={list:()=>structuredClone(rows),save:(r:EmailOutbox)=>{rows=rows.filter(x=>x.outbox_id!==r.outbox_id).concat(structuredClone(r));}};const engine=new Engine(store,defaults,{now:()=>now});const lead=engine.ingest(inboundToLead(enquiry(),'https://example.com',now)).lead;const flow=new EmailWorkflow(store,outbox,defaults,{now:()=>now},digest);const row=flow.prepare(lead,'abcdefghijklmnopqrstuvwx');outbox.save({...row,status:'REVIEW_PENDING',message_id:'123'});const action={userId:defaults.ownerUserId,chatId:defaults.ownerChatId,chatType:'private',messageId:'123',callback:'send:'+row.nonce};return {store,outbox,engine,lead,flow,row,action};}
describe('consented inbound email lifecycle',()=>{
  it('processes a newer approved enquiry while an older enquiry remains unanswered',()=>{
    const h=state();const later=h.engine.ingest(inboundToLead(enquiry(),'https://example.com',now)).lead;
    const row=h.flow.prepare(later,'newerabcdefghijklmnopqrs');h.outbox.save({...row,status:'REVIEW_PENDING',message_id:'124'});
    h.flow.decide({...h.action,messageId:'124',callback:'send:'+row.nonce});const send=vi.fn((message:EmailOutbox)=> 'gmail-'+message.lead_id);h.flow.sendApproved(send);
    expect(send).toHaveBeenCalledTimes(1);expect(send.mock.calls[0][0].lead_id).toBe(later.lead_id);
    expect(h.outbox.list().find(r=>r.lead_id===h.lead.lead_id)?.status).toBe('REVIEW_PENDING');
  });
  it('replaces finished and expired review controls with an explicit status',()=>{
    const h=state();expect(emailAlert(h.outbox.list()[0],h.lead,Date.parse(now)).reply_markup.inline_keyboard.length).toBe(2);
    for(const status of ['SENT','REJECTED','DEFERRED','UNCERTAIN'] as const){const view=emailAlert({...h.row,status},h.lead,Date.parse(now));expect(view.reply_markup.inline_keyboard).toEqual([]);expect(view.text).toContain(status);}
    const expired=emailAlert({...h.row,status:'REVIEW_PENDING',expires_at:'2026-11-11T08:00:00.000Z'},h.lead,Date.parse(now));expect(expired.text).toContain('EXPIRED');expect(expired.reply_markup.inline_keyboard).toEqual([]);
  });
  it('keeps different submissions to the same contact URL separate and deduplicates retries',()=>{const s=new MemoryStore(),e=new Engine(s,defaults,{now:()=>now});const a=inboundToLead(enquiry(),'https://example.com',now);e.ingest(a);expect(e.ingest(a).duplicate).toBe(true);e.ingest(inboundToLead(enquiry(),'https://example.com',now));expect(s.leads()).toHaveLength(2);});
  it('sends exactly once only after the exact owner approval',()=>{const h=state(),send=vi.fn(()=> 'gmail-id');h.flow.sendApproved(send);expect(send).not.toHaveBeenCalled();h.flow.decide(h.action);h.flow.sendApproved(send);h.flow.sendApproved(send);expect(send).toHaveBeenCalledTimes(1);expect(h.outbox.list()[0].gmail_message_id).toBe('gmail-id');expect(h.store.get(h.lead.lead_id)?.status).toBe('EMAIL_SENT');expect(()=>h.flow.decide(h.action)).toThrow();});
  it.each([{userId:'attacker'},{chatId:'other'},{chatType:'group'},{messageId:'999'},{callback:'send:invalid'}])('rejects untrusted approval %j',override=>{const h=state();expect(()=>h.flow.decide({...h.action,...override})).toThrow();});
  it('rejects changed text and revoked consent',()=>{const h=state();h.outbox.save({...h.outbox.list()[0],body:'Changed after notification'});expect(()=>h.flow.decide(h.action)).toThrow('Draft changed');const g=state();g.flow.decide(g.action);g.store.save({...g.store.get(g.lead.lead_id)!,contact_permission_state:'BLOCKED'});expect(()=>g.flow.sendApproved(()=> 'no')).toThrow('consent');});
  it.each(['hold','deny'])('never sends when owner chooses %s',action=>{const h=state(),send=vi.fn();h.flow.decide({...h.action,callback:action+':'+h.row.nonce});h.flow.sendApproved(send);expect(send).not.toHaveBeenCalled();});
  it('requires a fresh approval before sending an expired draft',()=>{const h=state();h.outbox.save({...h.outbox.list()[0],expires_at:'2026-11-11T08:00:00.000Z'});expect(()=>h.flow.decide(h.action)).toThrow('Expired');});
  it('holds uncertain delivery without retrying',()=>{const h=state(),send=vi.fn(()=>{throw new Error('Connection lost after Gmail accepted');});h.flow.decide(h.action);h.flow.sendApproved(send);h.flow.reconcile();h.flow.sendApproved(send);expect(send).toHaveBeenCalledTimes(1);expect(h.outbox.list()[0].status).toBe('UNCERTAIN');});
  it('leaves approval queued when quota preflight blocks the attempt',()=>{const h=state(),send=vi.fn();h.flow.decide(h.action);expect(()=>h.flow.sendApproved(send,2,()=>{throw new Error('Quota');})).toThrow('Quota');expect(send).not.toHaveBeenCalled();expect(h.outbox.list()[0].status).toBe('APPROVED');});
  it('reconciles interrupted send and confirmed send without redispatch',()=>{const h=state();h.outbox.save({...h.outbox.list()[0],status:'SENDING'});h.flow.reconcile();expect(h.outbox.list()[0].status).toBe('UNCERTAIN');h.outbox.save({...h.outbox.list()[0],status:'SENT',gmail_message_id:'known-id'});h.flow.reconcile();expect(h.store.get(h.lead.lead_id)?.status).toBe('EMAIL_SENT');});
  it('rejects unsupported AI quotations and discovered lead email',()=>{const h=state();expect(()=>draftEmail(h.lead,{summary_quote:'Invented requirement',focus:'website',question_codes:['tools','budget']})).toThrow();expect(()=>draftEmail({...h.lead,source:'gmail'})).toThrow();expect(digest(emailContent(h.row))).toBe(h.row.content_hash);});
});
describe('signed website intake',()=>{
  const secret='test-only-secret-32-characters-long';
  it('verifies payload integrity and timestamp',()=>{const payload=JSON.stringify(enquiry()),timestamp=Date.parse(now),nonce=randomUUID();const envelope={payload,timestamp,nonce,signature:sign(signatureMessage(timestamp,nonce,payload),secret)};expect(verifyEnvelope(envelope,secret,sign,timestamp).email).toBe('owner@example.com');expect(()=>verifyEnvelope({...envelope,payload:payload.replace('Sample','Wrong')},secret,sign,timestamp)).toThrow();expect(()=>verifyEnvelope(envelope,secret,sign,timestamp+300001)).toThrow('Expired');});
  const env:ContactEnvironment={APPS_SCRIPT_URL:'https://script.google.com/macros/s/test-deployment/exec',INTAKE_HMAC_SECRET:secret,TURNSTILE_SECRET_KEY:'test-only',PUBLIC_SITE_URL:'https://example.com'};
  const request=(body:unknown,origin='https://example.com')=>new Request('https://example.com/api/contact',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
  it('validates Turnstile and forwards a signed payload without the token',async()=>{const calls:unknown[]=[];const fetcher=vi.fn(async(url:unknown,init?:RequestInit)=>{const body=JSON.parse(String(init?.body));calls.push(body);if(String(url).includes('siteverify'))return Response.json({success:true,hostname:'example.com',action:'contact'});expect(verifyEnvelope(body,secret,sign).email).toBe('owner@example.com');expect(body.payload).not.toContain('turnstile_token');return Response.json({ok:true,lead_id:'lf_0123456789abcdef'});}) as unknown as typeof fetch;const response=await handleContact(request({...enquiry(),turnstile_token:'token'}),env,fetcher);expect(response.status).toBe(200);expect((await response.json()).reference).toBe('lf_0123456789abcdef');expect(calls).toHaveLength(2);});
  it('rejects bad origin, missing consent, oversized body and unconfigured integrations without external calls',async()=>{const fetcher=vi.fn() as unknown as typeof fetch;expect((await handleContact(request({...enquiry(),turnstile_token:'x'},'https://evil.example'),env,fetcher)).status).toBe(403);expect((await handleContact(request({...enquiry(),consent:false,turnstile_token:'x'}),env,fetcher)).status).toBe(400);expect((await handleContact(request({goal:'x'.repeat(17000)}),env,fetcher)).status).toBe(400);expect((await handleContact(request({}),{...env,APPS_SCRIPT_URL:''},fetcher)).status).toBe(503);expect(fetcher).not.toHaveBeenCalled();});
  it.each([{success:false},{success:true,hostname:'evil.example',action:'contact'},{success:true,hostname:'example.com',action:'wrong'}])('rejects challenge mismatch %j',async challenge=>{const fetcher=vi.fn(async()=>Response.json(challenge)) as unknown as typeof fetch;expect((await handleContact(request({...enquiry(),turnstile_token:'x'}),env,fetcher)).status).toBe(403);expect(fetcher).toHaveBeenCalledTimes(1);});
  it('never reports received when Apps Script rejects the request',async()=>{const fetcher=vi.fn(async(url:unknown)=>Response.json(String(url).includes('siteverify')?{success:true,hostname:'example.com',action:'contact'}:{ok:false})) as unknown as typeof fetch;expect((await handleContact(request({...enquiry(),turnstile_token:'x'}),env,fetcher)).status).toBe(502);});
});


describe('Signal & Slate marketing intake',()=>{
 const secret='test-only-marketing-signing-secret-long';
 const env:ContactEnvironment={APPS_SCRIPT_URL:'https://script.google.com/macros/s/test-deployment/exec',INTAKE_HMAC_SECRET:secret,TURNSTILE_SECRET_KEY:'test-only',PUBLIC_SITE_URL:'https://marketing.example.com'};
 const marketing=()=>({...enquiry(),vertical:'digital-marketing' as const,brand:'Signal & Slate' as const});
 it.each([
  ['digital-marketing','Signal & Slate','/#audit'],
  ['web-app-dev','LeadFlow AI','/contact'],
 ] as const)('retains signed %s brand/vertical and stamps the verified origin before CRM ingestion',async(vertical,brand,path)=>{
  let leadInput:ReturnType<typeof inboundToLead>|undefined;
  const fetcher=vi.fn(async(url:unknown,init?:RequestInit)=>{
   if(String(url).includes('siteverify'))return Response.json({success:true,hostname:'marketing.example.com',action:'contact'});
   const payload=verifyEnvelope(JSON.parse(String(init?.body)),secret,sign);
   expect(payload).toMatchObject({vertical,brand,site_url:'https://marketing.example.com'});
   leadInput=inboundToLead(payload,'https://development.example.com',now);
   return Response.json({ok:true,lead_id:'lf_0123456789abcdef'});
  }) as unknown as typeof fetch;
  const request=new Request(env.PUBLIC_SITE_URL+'/api/contact',{method:'POST',headers:{origin:env.PUBLIC_SITE_URL,'content-type':'application/json'},body:JSON.stringify({...enquiry(),vertical,brand,site_url:'https://untrusted.example.com',turnstile_token:'test-token'})});
  expect((await handleContact(request,env,fetcher)).status).toBe(200);
  expect(leadInput).toMatchObject({vertical,brand,source_url:'https://marketing.example.com'+path,contact_permission_state:'EXPLICIT_OPT_IN'});
  expect(leadInput?.owner_notes).toContain('vertical: '+vertical);
 });
 it('rejects mismatched or unsupported branding without weakening ordinary website intake',()=>{
  expect(inboundSchema.safeParse(enquiry()).success).toBe(true);
  expect(inboundSchema.safeParse({...enquiry(),vertical:'digital-marketing'}).success).toBe(false);
  expect(inboundSchema.safeParse({...marketing(),brand:'Other brand'}).success).toBe(false);
  expect(inboundSchema.safeParse({...marketing(),brand:'LeadFlow AI'}).success).toBe(false);
  expect(inboundSchema.safeParse({...marketing(),vertical:'web-app-dev'}).success).toBe(false);
 });
 it('prepares a marketing-specific email but sends nothing until owner approval',()=>{
  const store=new MemoryStore();const engine=new Engine(store,defaults,{now:()=>now});const lead=engine.ingest(inboundToLead(marketing(),'https://marketing.example.com',now)).lead;
  const draft=draftEmail(lead);expect(draft.subject).toBe('Your Signal & Slate enquiry — next steps');expect(draft.body).toContain('monthly media budget');expect(draft.body).toContain('Regards,\nSignal & Slate');
  let rows:EmailOutbox[]=[];const outbox={list:()=>rows,save:(row:EmailOutbox)=>{rows=rows.filter(r=>r.outbox_id!==row.outbox_id).concat(row)}};const flow=new EmailWorkflow(store,outbox,defaults,{now:()=>now},digest);flow.prepare(lead,'abcdefghijklmnopqrstuvwx');const send=vi.fn();flow.sendApproved(send);expect(send).not.toHaveBeenCalled();
 });
});
