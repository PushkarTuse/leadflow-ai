import { z } from 'zod';
import type { Lead, Config, Clock, Store } from './model';
import { Engine } from './workflow';

export interface EmailOutbox {
  outbox_id:string;lead_id:string;recipient:string;subject:string;body:string;content_hash:string;
  nonce:string;chat_id:string;message_id:string;expires_at:string;
  status:'DRAFT'|'NOTIFYING'|'REVIEW_PENDING'|'APPROVED'|'DEFERRED'|'REJECTED'|'SENDING'|'SENT'|'UNCERTAIN';
  created_at:string;updated_at:string;approved_by:string;approved_at:string;gmail_message_id:string;error_code:string;draft_method:string;
}
export interface OutboxStore {list():EmailOutbox[];save(row:EmailOutbox):void}
export const draftPlanSchema=z.object({summary_quote:z.string().min(10).max(240),focus:z.enum(['website','enquiry','automation','api','clarify']),question_codes:z.array(z.enum(['outcome','tools','content','budget','timing','approval'])).min(2).max(3)}).strict();
export type DraftPlan=z.infer<typeof draftPlanSchema>;
const questions={outcome:'What is the most important action a visitor or user should be able to complete?',tools:'Which existing tools or integrations would you like to keep?',content:'Do you already have the content, branding and account access needed?',budget:'What budget range would be comfortable for this scope?',timing:'What launch window are you considering, subject to the agreed scope?',approval:'Who should review enquiries and approve follow-up responses?'};
export function draftEmail(lead:Lead,plan?:DraftPlan){
  if(lead.source!=='inbound'||lead.contact_permission_state!=='EXPLICIT_OPT_IN'||!lead.contact_email||!lead.consent_at)throw new Error('Consented inbound email required');
  if(plan&&!lead.raw_description.includes(plan.summary_quote))throw new Error('Draft summary must quote the enquiry exactly');
  const focus=plan?.focus|| (lead.skills.includes('api')?'api':lead.skills.includes('automation')?'automation':'enquiry');
  const proposal={website:'start with the pages and the main action visitors need to take',enquiry:'map the enquiry journey, the information to capture and the owner’s next step',automation:'map one workflow and its existing tools before building the integration',api:'confirm the API contracts, access permissions and a single complete integration',clarify:'clarify the goal and define one useful first milestone'}[focus];
  const selected=Array.from(new Set<keyof typeof questions>(plan?.question_codes||['outcome','tools','timing']));
  const body=`Hello ${lead.client_name_if_public||'there'},\n\nThanks for your enquiry about ${lead.title.replace(/^Website enquiry: /,'')}. You mentioned: “${plan?.summary_quote||lead.raw_description.slice(0,240)}”\n\nA useful first step would be to ${proposal}. We can agree the deliverables and acceptance checks before starting work.\n\n${selected.map((key,i)=>`${i+1}. ${questions[key]}`).join('\n')}\n\nAfter clarifying those points, we can discuss a scoped proposal. Final pricing, external service costs and delivery dates will be agreed separately.\n\nRegards,\nLeadFlow AI\n\nYou requested contact about this enquiry. Reply if you would prefer no further follow-up.`;
  return {subject:'Your LeadFlow AI enquiry — next steps',body};
}
export function emailContent(row:Pick<EmailOutbox,'recipient'|'subject'|'body'>){return JSON.stringify({to:row.recipient,subject:row.subject,body:row.body});}
export class EmailWorkflow {
  constructor(private leads:Store,private outbox:OutboxStore,private config:Config,private clock:Clock,private digest:(value:string)=>string){}
  prepare(lead:Lead,nonce:string,plan?:DraftPlan):EmailOutbox {
    const existing=this.outbox.list().find(x=>x.lead_id===lead.lead_id);if(existing)return existing;
    if(lead.quarantined||lead.status==='REJECTED'||lead.status==='ARCHIVED')throw new Error('Lead requires manual review');
    const draft=draftEmail(lead,plan),now=this.clock.now();
    const row:EmailOutbox={outbox_id:'mail_'+lead.lead_id,lead_id:lead.lead_id,recipient:lead.contact_email,...draft,content_hash:'',nonce,chat_id:this.config.ownerChatId,message_id:'',expires_at:new Date(Date.parse(now)+this.config.approvalHours*3600000).toISOString(),status:'DRAFT',created_at:now,updated_at:now,approved_by:'',approved_at:'',gmail_message_id:'',error_code:'',draft_method:plan?'gemini-assisted':'rules'};
    row.content_hash=this.digest(emailContent(row));this.outbox.save(row);
    const updated:Lead={...lead,status:'DRAFT_READY',approval_status:'PENDING',draft_id:row.outbox_id,updated_at:now,last_activity_at:now};this.leads.save(updated);new Engine(this.leads,this.config,this.clock).log(updated,lead.status,'INBOUND_DRAFT_PREPARED');return row;
  }
  decide(data:{userId:string;chatId:string;chatType:string;messageId:string;callback:string}):EmailOutbox {
    if(data.userId!==this.config.ownerUserId||data.chatId!==this.config.ownerChatId||data.chatType!=='private')throw new Error('Unauthorized owner');
    const match=data.callback.match(/^(send|hold|deny):([a-zA-Z0-9_-]{12,32})$/);if(!match)throw new Error('Invalid email callback');
    const row=this.outbox.list().find(x=>x.nonce===match[2]);
    if(!row||row.status!=='REVIEW_PENDING'||row.chat_id!==data.chatId||row.message_id!==data.messageId||Date.parse(row.expires_at)<=Date.parse(this.clock.now()))throw new Error('Expired or replayed email approval');
    if(row.content_hash!==this.digest(emailContent(row)))throw new Error('Draft changed after review');
    this.assertConsent(row);
    const updated:EmailOutbox={...row,status:match[1]==='send'?'APPROVED':match[1]==='hold'?'DEFERRED':'REJECTED',approved_by:match[1]==='send'?data.userId:'',approved_at:match[1]==='send'?this.clock.now():'',updated_at:this.clock.now()};this.outbox.save(updated);
    const lead=this.leads.get(row.lead_id)!;
    this.leads.save({...lead,approval_status:updated.status==='APPROVED'?'APPROVED':updated.status==='DEFERRED'?'DEFERRED':'REJECTED',status:updated.status==='REJECTED'?'REJECTED':lead.status,next_followup_at:updated.status==='DEFERRED'?new Date(Date.parse(this.clock.now())+86400000).toISOString():'',updated_at:this.clock.now()});
    new Engine(this.leads,this.config,this.clock).log({...lead,updated_at:this.clock.now()},lead.status,'EMAIL_'+updated.status,'owner');return updated;
  }
  assertConsent(row:EmailOutbox){const lead=this.leads.get(row.lead_id);if(!lead||lead.source!=='inbound'||lead.contact_permission_state!=='EXPLICIT_OPT_IN'||lead.contact_email!==row.recipient||!lead.consent_at||lead.quarantined||['REJECTED','ARCHIVED'].includes(lead.status))throw new Error('Email consent or lead state is invalid');}
  sendApproved(send:(row:EmailOutbox)=>string,limit=2,preflight?:(row:EmailOutbox)=>void):void {
    for(const row of this.outbox.list().filter(x=>x.status==='APPROVED').slice(0,limit)){
      this.assertConsent(row);
      if(row.approved_by!==this.config.ownerUserId||!row.approved_at||this.digest(emailContent(row))!==row.content_hash)throw new Error('Exact draft is not approved');
      if(Date.parse(row.expires_at)<=Date.parse(this.clock.now()))throw new Error('Email approval expired before delivery');
      preflight?.(row);
      const sending={...row,status:'SENDING' as const,updated_at:this.clock.now()};this.outbox.save(sending);
      let id='';
      try{id=send(sending);if(!id)throw new Error('Missing Gmail message ID');}
      catch{this.outbox.save({...sending,status:'UNCERTAIN',error_code:'VERIFY_GMAIL_SENT_BEFORE_RETRY',updated_at:this.clock.now()});}
      if(id){this.outbox.save({...sending,status:'SENT',gmail_message_id:id,updated_at:this.clock.now()});const lead=this.leads.get(row.lead_id)!;new Engine(this.leads,this.config,this.clock).move({...lead,approval_status:'APPROVED'},'EMAIL_SENT','approved-email-service');}
    }
  }
  reconcile():void {
    for(const row of this.outbox.list()){
      const current=this.leads.get(row.lead_id);
      if(current&&!current.draft_id&&!current.quarantined&&!['ARCHIVED','REJECTED'].includes(current.status))this.leads.save({...current,draft_id:row.outbox_id,status:'DRAFT_READY',approval_status:'PENDING',updated_at:this.clock.now()});
      if(row.status==='SENDING')this.outbox.save({...row,status:'UNCERTAIN',error_code:'INTERRUPTED_SEND_VERIFY_GMAIL',updated_at:this.clock.now()});
      if(row.status==='SENT'){const lead=this.leads.get(row.lead_id);if(lead?.status==='DRAFT_READY')new Engine(this.leads,this.config,this.clock).move({...lead,approval_status:'APPROVED'},'EMAIL_SENT','approved-email-service');}
    }
  }
}
export function emailAlert(row:EmailOutbox,lead:Lead,at=Date.now()) {
  const reviewable=['DRAFT','NOTIFYING','REVIEW_PENDING'].includes(row.status);
  const expired=reviewable&&Date.parse(row.expires_at)<=at;
  const active=reviewable&&!expired;
  const labels:Partial<Record<EmailOutbox['status'],string>>={
    APPROVED:'APPROVED — queued for Gmail delivery',
    DEFERRED:'DEFERRED — no email sent; renew the review from the Sheet when ready',
    REJECTED:'REJECTED — this email will not be sent',
    SENT:'SENT — Gmail accepted this exact email',
    UNCERTAIN:'DELIVERY UNCERTAIN — check Gmail Sent before any retry',
  };
  const status=expired?'EXPIRED — renew the review from the Sheet':active?'AWAITING YOUR APPROVAL':labels[row.status]||row.status;
  return {
    text:`LeadFlow • ${status}\nEnquiry: ${lead.title}\nReference: ${lead.lead_id}\nTo: ${row.recipient}\nSubject: ${row.subject}\nScore: ${lead.score}/100 · ${lead.method}\nDraft: ${row.draft_method}\n\n${row.body}\n\n${active?'Approve & send authorizes exactly this email. Each enquiry is independent. Commands and decisions are checked about every 10 minutes.':status+'. This review has no active approval buttons.'}`,
    reply_markup:{inline_keyboard:active?[[{text:'Approve & send email',callback_data:'send:'+row.nonce}],[{text:'Defer',callback_data:'hold:'+row.nonce},{text:'Reject',callback_data:'deny:'+row.nonce}]]:[]},
  };
}
