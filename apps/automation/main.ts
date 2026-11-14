import { z } from "zod";
import { configSchema, inputSchema, dedupKey, hash } from "../../packages/core/model";
import { assess } from "../../packages/core/scoring";
import { inboundToLead, verifyEnvelope } from "../../packages/core/intake";
import { EmailWorkflow, emailAlert, type EmailOutbox } from "../../packages/core/email";
import { rowToInput } from "../../packages/core/csv";
import {
  Engine,
  commandReply,
  notification,
} from "../../packages/core/workflow";
import {
  classifyGemini,
  planEmailGemini,
  gmailToLead,
  hnSources,
  telegramUpdateSchema,
  type Http,
  type HttpRequest,
} from "./adapters";
import { SheetStore, SheetOutbox, tableHeaders, type TablePort } from "./sheets";

const properties = () => PropertiesService.getScriptProperties();
const setting = (key: string, fallback = "") =>
  properties().getProperty(key) ?? fallback;
const enabled = (key: string) => setting(key) === "true";
function integer(key: string, fallback: number, min: number, max: number) {
  const n = Number(setting(key, String(fallback)));
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error("Invalid setting: " + key);
  return n;
}
const now = () => new Date().toISOString();
const dry = () => setting("DRY_RUN", "true") !== "false";
function spreadsheet() {
  const id = setting("SHEET_ID") || SpreadsheetApp.getActiveSpreadsheet()?.getId();
  if (!id) throw new Error("Set SHEET_ID in Script Properties");
  return SpreadsheetApp.openById(id);
}
function locked<T>(work: () => T): T {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000))
    throw new Error("Another run is active. Try again shortly.");
  try {
    return work();
  } finally {
    lock.releaseLock();
  }
}
class GasTables implements TablePort {
  constructor(private sheet: GoogleAppsScript.Spreadsheet.Spreadsheet) {}
  tab(name: string) {
    const tab = this.sheet.getSheetByName(name);
    if (!tab) throw new Error("Run setup first; missing " + name);
    return tab;
  }
  read(name: string) {
    const tab = this.tab(name);
    if (tab.getLastRow() > 5001)
      throw new Error(
        "Engine table exceeds 5,000 records; archive/export before continuing",
      );
    return tab.getDataRange().getValues();
  }
  writeRow(name: string, row: number, values: unknown[]) {
    this.tab(name).getRange(row, 1, 1, values.length).setValues([values]);
  }
  removeRow(name: string, row: number) {
    this.tab(name).deleteRow(row);
  }
}
let deadline = 0,
  retries = 0;
function guard() {
  if (deadline && Date.now() > deadline)
    throw new Error("Run time budget reached; remaining work deferred");
}
function spend(kind: string, limit: number) {
  guard();
  const day = Utilities.formatDate(
    new Date(),
    setting("TIMEZONE", "Asia/Kolkata"),
    "yyyy-MM-dd",
  );
  const key = "budget_" + kind;
  const p = properties();
  const old = JSON.parse(p.getProperty(key) || "{}") as {
    day?: string;
    count?: number;
  };
  const count = old.day === day ? old.count || 0 : 0;
  if (count >= limit) throw new Error(kind + " daily budget reached");
  p.setProperty(key, JSON.stringify({ day, count: count + 1 }));
}
const http: Http = {
  json(url: string, request: HttpRequest = {}) {
    if (dry()) throw new Error("Dry-run mode blocks external HTTP calls");
    if (
      !/^https:\/\/(api\.telegram\.org|generativelanguage\.googleapis\.com|hacker-news\.firebaseio\.com)\//.test(
        url,
      )
    )
      throw new Error("HTTP host not allowed");
    const attempts =
      request.retrySafe === false || request.method === "post" ? 1 : 3;
    for (let n = 0; n < attempts; n++) {
      spend("http", integer("DAILY_HTTP_LIMIT", 400, 1, 1000));
      const response = UrlFetchApp.fetch(url, {
        method: request.method || "get",
        headers: request.headers,
        contentType: "application/json",
        ...(request.body !== undefined
          ? { payload: JSON.stringify(request.body) }
          : {}),
        muteHttpExceptions: true,
        followRedirects: false,
      });
      const status = response.getResponseCode();
      if (status >= 200 && status < 300) {
        const text = response.getContentText();
        if (text.length > 1_000_000)
          throw new Error("Provider response too large");
        return JSON.parse(text) as unknown;
      }
      if ((status === 429 || status >= 500) && n + 1 < attempts) {
        retries++;
        Utilities.sleep(250 * 2 ** n);
        continue;
      }
      // Repeating the same message edit is safe after an interrupted audit write.
      if (status === 400 && /^https:\/\/api\.telegram\.org\/bot[^/]+\/editMessageText$/.test(url)) {
        try {
          const error=JSON.parse(response.getContentText());
          if (typeof error.description==='string' && error.description.includes('message is not modified'))
            return {ok:true,result:true};
        } catch { /* Other provider failures remain failures. */ }
      }
      // Never include provider response bodies, credential-bearing URL or personal data in errors.
      throw new Error("Provider request failed: HTTP " + status);
    }
    throw new Error("Provider retries exhausted");
  },
};
function runtime() {
  const store = new SheetStore(new GasTables(spreadsheet()));
  const config = configSchema.parse({
    ownerUserId: setting("TELEGRAM_OWNER_USER_ID", "unset"),
    ownerChatId: setting("TELEGRAM_OWNER_CHAT_ID", "unset"),
    highThreshold: integer("HIGH_THRESHOLD", 75, 2, 100),
    reviewThreshold: integer("REVIEW_THRESHOLD", 55, 1, 99),
    maxAgeDays: integer("MAX_AGE_DAYS", 30, 1, 365),
  });
  const engine = new Engine(store, config, { now }, (input) => {
    if (dry() || !enabled("GEMINI_ENABLED"))
      return { warning: "Gemini disabled; local rules used" };
    spend("gemini", integer("DAILY_GEMINI_LIMIT", 10, 1, 100));
    return classifyGemini(http, input, {
      enabled: true,
      freeTierConfirmed: enabled("GEMINI_FREE_TIER_CONFIRMED"),
      dataUseApproved: enabled("GEMINI_DATA_USE_APPROVED"),
      apiKey: setting("GEMINI_API_KEY"),
      model: setting("GEMINI_MODEL"),
    });
  });
  const outbox=new SheetOutbox(store);
  const email=new EmailWorkflow(store,outbox,config,{now},digest);
  return { store, engine, outbox, email };
}
function hex(bytes:number[]){return bytes.map(b=>(b&255).toString(16).padStart(2,'0')).join('');}
function digest(value:string){return hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8));}
function aiOptions(){return {enabled:enabled('GEMINI_ENABLED'),freeTierConfirmed:enabled('GEMINI_FREE_TIER_CONFIRMED'),dataUseApproved:enabled('GEMINI_DATA_USE_APPROVED'),apiKey:setting('GEMINI_API_KEY'),model:setting('GEMINI_MODEL')};}
export function doGet(){return ContentService.createTextOutput(JSON.stringify({ok:true,service:'LeadFlow intake',version:2})).setMimeType(ContentService.MimeType.JSON);}
export function connectTelegramOwner(){return locked(()=>{
  deadline=Date.now()+20000;const token=setting('TELEGRAM_BOT_TOKEN');if(dry()||!/^\d+:[\w-]+$/.test(token))throw new Error('Save a valid BotFather token and set DRY_RUN=false first');
  const result=z.object({ok:z.literal(true),result:z.array(telegramUpdateSchema)}).parse(http.json(`https://api.telegram.org/bot${token}/getUpdates`,{method:'post',body:{limit:100,timeout:0,allowed_updates:['message','callback_query']},retrySafe:false}));
  const candidates=result.result.map(u=>u.message).filter(m=>m&&m.chat.type==='private'&&m.from?.id===m.chat.id&&/^\/start(?:\s|$)/.test(m.text||'')&&Math.abs(Date.now()/1000-m.date)<86400);
  const owners=Array.from(new Set(candidates.map(m=>String(m!.from!.id))));if(owners.length!==1)throw new Error('Need exactly one recent private /start sender; verify owner IDs manually if ambiguous');
  const owner=owners[0];if(setting('TELEGRAM_OWNER_USER_ID')&&setting('TELEGRAM_OWNER_USER_ID')!==owner)throw new Error('Existing owner differs; refusing to replace');
  properties().setProperty('TELEGRAM_OWNER_USER_ID',owner);properties().setProperty('TELEGRAM_OWNER_CHAT_ID',owner);properties().setProperty('TELEGRAM_ENABLED','true');console.log(JSON.stringify({status:'OWNER_CONNECTED',owner_user_id:owner,owner_chat_id:owner}));return 'Owner connected. Verify the private Telegram alert during the smoke test.';
});}
export function doPost(event:GoogleAppsScript.Events.DoPost){
  const reply=(data:unknown)=>ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  try{return locked(()=>{
    deadline=Date.now()+20000;
    if(dry()||!enabled('INTAKE_ENABLED'))throw new Error('Intake disabled');
    const text=event.postData?.contents||'';if(text.length>16000)throw new Error('Oversized request');
    const enquiry=verifyEnvelope(JSON.parse(text),setting('INTAKE_HMAC_SECRET'),(value,key)=>hex(Utilities.computeHmacSha256Signature(value,key,Utilities.Charset.UTF_8)));
    const {store,engine}=runtime();const receipt=store.records('IntakeReceipts').find(r=>r.submission_id===enquiry.submission_id);
    const fingerprint=digest(JSON.stringify(enquiry));
    if(receipt){if(receipt.payload_hash!==fingerprint)throw new Error('Submission ID changed');return reply({ok:true,lead_id:receipt.lead_id});}
    spend('intake',integer('DAILY_INTAKE_LIMIT',20,1,100));
    const site=setting('PUBLIC_SITE_URL');if(!/^https:\/\/[^\s/]+\/?$/.test(site))throw new Error('Configure public site origin');
    const input=inboundToLead(enquiry,site,now());
    const existing=store.leads().find(l=>l.source==='inbound'&&l.source_external_id===enquiry.submission_id);
    if(existing&&['raw_description','title','contact_email','client_name_if_public','stated_budget_min','stated_budget_max','consent_version'].some(k=>existing[k as keyof typeof existing]!==input[k as keyof typeof input]))throw new Error('Submission ID changed');
    // Fast, durable intake. Gemini, Telegram and Gmail run in the bounded scheduler.
    const lead=new Engine(store,engine.config,{now}).ingest(input).lead;
    store.upsert('IntakeReceipts','submission_id',{submission_id:enquiry.submission_id,lead_id:'lf_'+hash(dedupKey(input)),payload_hash:fingerprint,received_at:lead.created_at,processed_at:'',status:'RECEIVED'});
    return reply({ok:true,lead_id:lead.lead_id});
  });}catch{return reply({ok:false,error:'Intake unavailable or request rejected'});}
}
function processInbound(store:SheetStore,engine:Engine,email:EmailWorkflow){
  for(const receipt of store.records('IntakeReceipts').filter(r=>r.status==='RECEIVED').slice(0,2)){
    guard();let lead=store.get(String(receipt.lead_id));if(!lead)continue;
    if(!lead.draft_id&&!lead.quarantined&&!['REJECTED','ARCHIVED'].includes(lead.status)){
      const input=inputSchema.strip().parse(lead);let extraction:{signals?:ReturnType<typeof classifyGemini>['signals'];warning?:string}={warning:'Gemini disabled; rules used'};
      if(enabled('GEMINI_ENABLED')){try{spend('gemini',integer('DAILY_GEMINI_LIMIT',10,1,100));extraction=classifyGemini(http,input,aiOptions());}catch{extraction={warning:'Gemini unavailable; rules used'};}}
      lead={...lead,...assess(input,now(),engine.config,extraction.signals,extraction.warning),updated_at:now()};store.save(lead);
      if(!lead.quarantined){let plan;try{if(enabled('GEMINI_ENABLED')){spend('gemini',integer('DAILY_GEMINI_LIMIT',10,1,100));plan=planEmailGemini(http,input.raw_description,aiOptions());}}catch{/* Validated rules fallback. */}
        email.prepare(lead,Utilities.getUuid().replace(/-/g,'').slice(0,24),plan);
      }
    }
    store.upsert('IntakeReceipts','submission_id',{...receipt,processed_at:now(),status:lead.quarantined?'QUARANTINED':'PROCESSED'});
  }
}
function notifyEmails(store:SheetStore,outbox:SheetOutbox,engine:Engine){
  for(const row of outbox.list().filter(r=>r.status==='DRAFT').slice(0,2)){
    guard();const lead=store.get(row.lead_id);if(!lead)continue;
    const sending={...row,status:'NOTIFYING' as const,updated_at:now(),expires_at:new Date(Date.now()+engine.config.approvalHours*3600000).toISOString()};outbox.save(sending);
    SpreadsheetApp.flush();
    const result=z.object({message_id:z.number(),chat:z.object({id:z.number(),type:z.string()})}).parse(telegram('sendMessage',{chat_id:engine.config.ownerChatId,...emailAlert(sending,lead),link_preview_options:{is_disabled:true}}));
    if(String(result.chat.id)!==engine.config.ownerChatId||result.chat.type!=='private')throw new Error('Unexpected chat');
    outbox.save({...sending,status:'REVIEW_PENDING',message_id:String(result.message_id),updated_at:now()});
  }
}
function deliverEmails(email:EmailWorkflow){
  if(!enabled('GMAIL_SEND_ENABLED')||dry())return;
  guard();const sender=setting('GMAIL_SENDER_EMAIL');
  if(!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(sender)||Gmail.Users!.getProfile('me').emailAddress?.toLowerCase()!==sender.toLowerCase())throw new Error('Gmail sender account mismatch');
  email.sendApproved((row:EmailOutbox)=>{
    // Commit SENDING before the external side effect; Sheets may buffer writes.
    SpreadsheetApp.flush();
    const b64=(text:string)=>Utilities.base64Encode(text,Utilities.Charset.UTF_8);
    const mime=[`From: LeadFlow AI <${sender}>`,`To: ${row.recipient}`,`Subject: =?UTF-8?B?${b64(row.subject)}?=`,`Message-ID: <${row.outbox_id}@${sender.split('@')[1]}>`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',b64(row.body).match(/.{1,76}/g)!.join('\r\n')].join('\r\n');
    return Gmail.Users!.Messages!.send({raw:Utilities.base64EncodeWebSafe(mime,Utilities.Charset.UTF_8)},'me').id||'';
  },2,(row)=>{guard();if(setting('EMAIL_TEST_MODE','true')!=='false'&&row.recipient.toLowerCase()!==setting('SMOKE_TEST_EMAIL').toLowerCase())throw new Error('Test mode recipient blocked');spend('email',integer('DAILY_EMAIL_LIMIT',10,1,50));});
}
function syncEmailReviewMessages(store:SheetStore,outbox:SheetOutbox) {
  const completed=new Set(store.activities().filter(e=>e.event_type==='EMAIL_REVIEW_DISPLAY_UPDATED').map(e=>e.event_id));
  let updates=0;
  for(const row of outbox.list()) {
    if(!row.message_id||row.status==='DRAFT'||row.status==='NOTIFYING'||row.status==='SENDING')continue;
    if(row.status==='REVIEW_PENDING'&&Date.parse(row.expires_at)>Date.now())continue;
    const eventId='mail_ui_'+hash([row.outbox_id,row.nonce,row.message_id,row.status,'v1'].join(':'));
    if(completed.has(eventId))continue;
    const lead=store.get(row.lead_id);if(!lead)continue;
    const view=emailAlert(row,lead);
    guard();
    telegram('editMessageText',{chat_id:row.chat_id,message_id:Number(row.message_id),...view,link_preview_options:{is_disabled:true}});
    store.activity({event_id:eventId,lead_id:row.lead_id,timestamp:now(),actor:'system',event_type:'EMAIL_REVIEW_DISPLAY_UPDATED',previous_state:lead.status,new_state:lead.status,details:row.status});
    if(++updates>=2)break;
  }
}
function telegram(method: string, body: unknown): unknown {
  if (!enabled("TELEGRAM_ENABLED") || dry())
    throw new Error("Telegram is disabled or dry-run enabled");
  const token = setting("TELEGRAM_BOT_TOKEN");
  if (
    !/^\d+:[\w-]+$/.test(token) ||
    !/^\d+$/.test(setting("TELEGRAM_OWNER_USER_ID")) ||
    !/^\d+$/.test(setting("TELEGRAM_OWNER_CHAT_ID"))
  )
    throw new Error("Set bot token and private numeric owner IDs");
  const reply = z
    .object({ ok: z.boolean(), result: z.unknown().optional() })
    .parse(
      http.json(`https://api.telegram.org/bot${token}/${method}`, {
        method: "post",
        body,
        retrySafe: false,
      }),
    );
  if (!reply.ok) throw new Error("Telegram rejected request");
  return reply.result;
}
function runSource(
  source: string,
  store: SheetStore,
  work: () => { imported: number; duplicates: number; invalid: number },
) {
  const start = now(),
    runId = "run_" + Utilities.getUuid();
  retries = 0;
  try {
    const counts = work();
    store.upsert("SourceRuns", "run_id", {
      run_id: runId,
      source,
      started_at: start,
      completed_at: now(),
      status: dry() ? "DRY_RUN" : "OK",
      ...counts,
      retry_count: retries,
      details: "",
    });
    properties().setProperty("last_success_" + source, now());
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const code = /daily budget|time budget/.test(message)
      ? "BUDGET_LIMIT"
      : /Schema mismatch|Run setup/.test(message)
        ? "SCHEMA_ERROR"
        : "PROVIDER_OR_INPUT_ERROR";
    store.upsert("SourceRuns", "run_id", {
      run_id: runId,
      source,
      started_at: start,
      completed_at: now(),
      status: "FAILED",
      imported: 0,
      duplicates: 0,
      invalid: 0,
      retry_count: retries,
      details:
        code +
        "; some rows may already be persisted. Rerun is deduplicated. See operations runbook.",
    });
    console.log(JSON.stringify({ source, status: "FAILED", code }));
  }
}
export function setup() {
  return locked(() => {
    const book = spreadsheet();
    if(!setting('SHEET_ID'))properties().setProperty('SHEET_ID',book.getId());
    for (const [name, headers] of Object.entries(tableHeaders)) {
      const tab = book.getSheetByName(name) || book.insertSheet(name);
      if (tab.getLastRow() > 0) {
        const old = tab.getRange(1, 1, 1, tab.getLastColumn()).getValues()[0];
        if (JSON.stringify(old) !== JSON.stringify(headers))
          throw new Error(
            "Existing " +
              name +
              " has different headers. Rename that tab before setup; no data was overwritten.",
          );
      } else {
        tab.getRange(1, 1, 1, headers.length).setValues([headers]);
        tab
          .getRange(1, 1, 1, headers.length)
          .setFontWeight("bold")
          .setBackground("#244e3f")
          .setFontColor("#ffffff");
        tab.setFrozenRows(1);
        tab.setColumnWidths(1, headers.length, 160);
      }
    }
    const store = new SheetStore(new GasTables(book));
    store.upsert("Settings", "key", {
      key: "schema_version",
      value: "2",
      notes:
        "Engine tables use immutable IDs. Use menu actions; record_json is authoritative.",
    });
    store.upsert("Settings", "key", {
      key: "configuration",
      value: "Script Properties",
      notes:
        "Source toggles, quotas and secrets live in Project Settings > Script Properties. Never add credentials to cells.",
    });
    book.getSheetByName("Leads")?.hideColumns(tableHeaders.Leads.length);
    updateDashboard(store);
    try{onOpen();}catch{/* The editor can run setup before a Sheet UI is open. Reload the Sheet to attach its menu. */}
    return "Schema v2 ready. Original workbook tabs preserved. No network calls or triggers installed.";
  });
}
export function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("LeadFlow")
    .addItem("Set up engine tabs", "setup")
    .addItem("Add a manual lead", "addManualLead")
    .addItem("Import ManualInbox", "importManualInbox")
    .addItem("Import legacy Leads CRM", "importLegacyCRM")
    .addSeparator()
    .addItem("Run one bounded cycle", "tick")
    .addItem("Update selected lead", "updateSelectedLead")
    .addItem("Reprocess selected lead", "reprocessSelectedLead")
    .addItem("Renew selected approval alert", "renewSelectedApproval")
    .addItem("Renew selected email review", "renewSelectedEmailApproval")
    .addItem("Delete selected lead data", "deleteSelectedLead")
    .addSeparator()
    .addItem("Send owner test notification", "sendTestNotification")
    .addItem("Install 10-minute trigger", "installTriggers")
    .addItem("Remove triggers", "removeTriggers")
    .addToUi();
}
export function installTriggers() {
  return locked(() => {
    runtime();
    if (dry())
      throw new Error(
        "Finish setup and explicitly set DRY_RUN=false before installing live triggers",
      );
    removeTriggers();
    ScriptApp.newTrigger("tick").timeBased().everyMinutes(10).create();
  });
}
export function removeTriggers() {
  for (const t of ScriptApp.getProjectTriggers())
    if (t.getHandlerFunction() === "tick") ScriptApp.deleteTrigger(t);
}
function rotateRunLog() {
  const book = spreadsheet();
  let tab = book.getSheetByName('SourceRuns');
  if (tab && tab.getLastRow() <= 4000) return;
  // Preserve every diagnostic row. Frequent idle polling must not exhaust the
  // operational table limit and stop the agency after its first week.
  if (tab) {
    const headers = tab.getRange(1, 1, 1, tab.getLastColumn()).getValues()[0];
    if (JSON.stringify(headers) !== JSON.stringify(tableHeaders.SourceRuns))
      throw new Error('Schema mismatch for SourceRuns; run setup before processing');
    tab.setName('SourceRuns_' + Date.now() + '_' + Utilities.getUuid().slice(0, 8));
  }
  // Also recover if a prior run stopped between renaming and creating the tab.
  tab = book.insertSheet('SourceRuns');
  tab.getRange(1, 1, 1, tableHeaders.SourceRuns.length)
    .setValues([tableHeaders.SourceRuns])
    .setFontWeight('bold').setBackground('#244e3f').setFontColor('#ffffff');
  tab.setFrozenRows(1);
}
export function tick() {
  return locked(() => {
    deadline = Date.now() + integer("MAX_RUN_SECONDS", 45, 10, 120) * 1000;
    spend("runs", integer("DAILY_RUN_LIMIT", 160, 1, 200));
    rotateRunLog();
    const { store, engine, outbox, email } = runtime();
    engine.reconcile();
    email.reconcile();
    if (dry()) {
      runSource("tick", store, () => ({
        imported: 0,
        duplicates: 0,
        invalid: 0,
      }));
      updateDashboard(store);
      return "Dry-run: no Gmail, Gemini, HN or Telegram calls. Use local npm run dry-run for fixture simulation.";
    }
    if (enabled("TELEGRAM_ENABLED"))
      runSource("telegram-poll", store, () => {
        pollTelegram(engine,email);
        return { imported: 0, duplicates: 0, invalid: 0 };
      });
    runSource('inbound',store,()=>{processInbound(store,engine,email);return {imported:0,duplicates:0,invalid:0};});
    if(enabled('TELEGRAM_ENABLED'))runSource('email-review',store,()=>{notifyEmails(store,outbox,engine);return {imported:0,duplicates:0,invalid:0};});
    if(enabled('GMAIL_SEND_ENABLED'))runSource('approved-email',store,()=>{deliverEmails(email);return {imported:0,duplicates:0,invalid:0};});
    if(enabled('TELEGRAM_ENABLED'))runSource('email-status',store,()=>{syncEmailReviewMessages(store,outbox);return {imported:0,duplicates:0,invalid:0};});
    const last = Date.parse(
      setting("last_source_cycle", "1970-01-01T00:00:00Z"),
    );
    if (
      Date.now() - last >=
      integer("SOURCE_INTERVAL_MINUTES", 60, 10, 1440) * 60000
    ) {
      if (enabled("GMAIL_ENABLED"))
        runSource("gmail", store, () => pollGmail(engine));
      if (enabled("HN_ENABLED"))
        runSource("hn", store, () => {
          const counts = { imported: 0, duplicates: 0, invalid: 0 };
          for (const lead of hnSources(http, integer("BATCH_SIZE", 5, 1, 10))) {
            guard();
            engine.ingest(lead).duplicate
              ? counts.duplicates++
              : counts.imported++;
          }
          return counts;
        });
      properties().setProperty("last_source_cycle", now());
    }
    if (enabled("TELEGRAM_ENABLED"))
      runSource("telegram-notify", store, () => {
        notifyPending(engine);
        return { imported: 0, duplicates: 0, invalid: 0 };
      });
    updateDashboard(store);
  });
}
function pollGmail(engine: Engine) {
  guard();
  const name = setting("GMAIL_LABEL");
  if (!name) throw new Error("GMAIL_LABEL must be explicitly selected");
  const label = Gmail.Users!.Labels!.list("me").labels?.find(
    (l) => l.name === name,
  );
  if (!label?.id) throw new Error("Configured Gmail label does not exist");
  const counts = { imported: 0, duplicates: 0, invalid: 0 };
  const token = setting("gmail_page");
  let page: GoogleAppsScript.Gmail.Schema.ListMessagesResponse;
  try {
    page = Gmail.Users!.Messages!.list("me", {
      labelIds: [label.id],
      maxResults: integer("BATCH_SIZE", 5, 1, 10),
      q: "newer_than:" + integer("MAX_AGE_DAYS", 30, 1, 365) + "d",
      ...(token ? { pageToken: token } : {}),
    });
  } catch {
    properties().deleteProperty("gmail_page");
    throw new Error(
      "Gmail page failed; pagination reset for next bounded cycle",
    );
  }
  for (const item of page.messages || []) {
    guard();
    if (!item.id) continue;
    if (
      engine.store
        .leads()
        .some((l) => l.source === "gmail" && l.source_external_id === item.id)
    ) {
      counts.duplicates++;
      continue;
    }
    const raw = Gmail.Users!.Messages!.get("me", item.id, { format: "full" });
    let lead;
    try {
      lead = gmailToLead(raw, label.id, (v) =>
        Utilities.newBlob(Utilities.base64DecodeWebSafe(v)).getDataAsString(),
      );
    } catch {
      counts.invalid++;
      continue;
    }
    if (!lead) {
      counts.invalid++;
      continue;
    }
    engine.ingest(lead).duplicate ? counts.duplicates++ : counts.imported++;
  }
  properties().setProperty("gmail_page", page.nextPageToken || "");
  return counts;
}
function pollTelegram(engine: Engine,email:EmailWorkflow) {
  const updates = z
    .array(telegramUpdateSchema)
    .parse(
      telegram("getUpdates", {
        offset: Number(setting("telegram_offset", "0")),
        limit: 10,
        timeout: 0,
        allowed_updates: ["message", "callback_query"],
      }),
    );
  for (const update of updates) {
    guard();
    if (update.update_id < Number(setting("telegram_offset", "0"))) continue;
    const cb = update.callback_query;
    if (cb) {
      let answer =
        "Action unavailable. Use the current alert or review the Sheet.";
      try {
        if(/^(send|hold|deny):/.test(cb.data||'')){
          const row=email.decide({userId:String(cb.from.id),chatId:String(cb.message?.chat.id),chatType:cb.message?.chat.type||'',messageId:String(cb.message?.message_id),callback:cb.data||''});
          answer=row.status==='APPROVED'?'Approved. Email queued for delivery; check EmailOutbox for confirmation.':row.status==='DEFERRED'?'Email deferred. Renew it from the Sheet when ready.':'Email rejected.';
        } else {
        const lead = engine.decide({
          userId: String(cb.from.id),
          chatId: String(cb.message?.chat.id),
          chatType: cb.message?.chat.type || "",
          messageId: String(cb.message?.message_id),
          data: cb.data || "",
        });
        answer =
          lead.status === "DRAFT_READY"
            ? "Draft ready in your Sheet. Nothing sent to the prospect."
            : lead.approval_status === "DEFERRED"
              ? "Deferred for one day."
              : "Lead rejected.";
        // Cursor advances before any notification; a delivery failure must not replay an action.
        properties().setProperty(
          "telegram_offset",
          String(update.update_id + 1),
        );
        if (lead.status === "DRAFT_READY") {
          const draft = engine.store
            .drafts()
            .find((d) => d.draft_id === lead.draft_id);
          if (draft)
            telegram("sendMessage", {
              chat_id: engine.config.ownerChatId,
              text:
                draft.text.slice(0, 3700) +
                "\n\nFull draft: https://docs.google.com/spreadsheets/d/" +
                setting("SHEET_ID"),
              link_preview_options: { is_disabled: true },
            });
        }
        }
      } catch {
        /* State remains authoritative; untrusted errors are never echoed. */
      }
      try {
        telegram("answerCallbackQuery", {
          callback_query_id: cb.id,
          text: answer,
        });
      } catch {
        /* Callback acknowledgement expires quickly; the Sheet remains authoritative. */
      }
    } else if (update.message) {
      const m = update.message;
      properties().setProperty("telegram_offset", String(update.update_id + 1));
      if (
        String(m.from?.id) === engine.config.ownerUserId &&
        String(m.chat.id) === engine.config.ownerChatId &&
        m.chat.type === "private" &&
        Math.abs(Date.now() / 1000 - m.date) < 86400
      ) {
        telegram("sendMessage", {
          chat_id: engine.config.ownerChatId,
          text: commandReply(
            m.text || "/help",
            engine.store.leads(),
            now(),
            engine.store.activities(),
          ),
          link_preview_options: { is_disabled: true },
        });
      }
    }
    properties().setProperty("telegram_offset", String(update.update_id + 1));
  }
}
function notifyPending(engine: Engine) {
  const candidates = engine.store
    .leads()
    .filter(
      (l) =>
        l.status === "PENDING_APPROVAL" &&
        l.source !== 'inbound' &&
        !engine.store.requests().some((r) => r.lead_id === l.lead_id),
    )
    .slice(0, 2);
  for (const lead of candidates) {
    guard();
    const request = engine.prepareApproval(
      lead,
      Utilities.getUuid().replace(/-/g, "").slice(0, 24),
    );
    request.state = "SENDING";
    engine.store.request(request);
    SpreadsheetApp.flush();
    try {
      const msg = z
        .object({
          message_id: z.number(),
          chat: z.object({ id: z.number(), type: z.string() }),
        })
        .parse(
          telegram("sendMessage", {
            chat_id: engine.config.ownerChatId,
            ...notification(lead, request),
            link_preview_options: { is_disabled: true },
          }),
        );
      if (
        String(msg.chat.id) !== engine.config.ownerChatId ||
        msg.chat.type !== "private"
      )
        throw new Error("Unexpected Telegram destination");
      request.message_id = String(msg.message_id);
      request.state = "SENT";
      engine.store.request(request);
    } catch {
      request.state = "FAILED";
      engine.store.request(request);
      throw new Error(
        "Delivery uncertain; manually renew after checking Telegram",
      );
    }
  }
}
function updateDashboard(store: SheetStore) {
  const leads = store.leads(),
    events = store.activities();
  const reached = (status: string) =>
    new Set(events.filter((e) => e.new_state === status).map((e) => e.lead_id))
      .size;
  const metrics = {
    "Total leads": leads.length,
    "Qualified ever": reached("QUALIFIED"),
    "Pending approval": leads.filter((l) => l.status === "PENDING_APPROVAL")
      .length,
    "Approved ever": reached("APPROVED_FOR_DRAFT"),
    "Proposals manually submitted": reached("CONTACTED_MANUALLY"),
    Replies: reached("REPLIED"),
    "Discovery calls recorded": reached("DISCOVERY"),
    Won: reached("WON"),
    "Drafts ready": leads.filter((l) => l.status === "DRAFT_READY").length,
    "Enquiry emails sent": leads.filter(l=>l.status==='EMAIL_SENT').length,
    "Email reviews pending": store.records('EmailOutbox').filter(r=>r.status==='REVIEW_PENDING').length,
    "Email delivery needs review": store.records('EmailOutbox').filter(r=>r.status==='UNCERTAIN'||r.status==='NOTIFYING').length,
  };
  for (const [metric, value] of Object.entries(metrics))
    store.upsert("EngineDashboard", "metric", {
      metric,
      value,
      updated_at: now(),
    });
}
export function importManualInbox() {
  return locked(() => {
    const { engine, store } = runtime();
    const port = new GasTables(spreadsheet());
    const rows = port.read("ManualInbox");
    let imported = 0,
      invalid = 0;
    for (let i = 1; i < rows.length && i <= 500; i++) {
      const row = rows[i];
      if (
        row.every((x) => x === "") ||
        String(row[row.length - 1]).startsWith("OK:")
      )
        continue;
      const data = Object.fromEntries(
        tableHeaders.ManualInbox.slice(0, -1).map((h, j) => [
          h,
          String(row[j] ?? ""),
        ]),
      );
      let result: string;
      try {
        const value = engine.ingest(rowToInput(data));
        result =
          "OK: " + value.lead.lead_id + (value.duplicate ? " (duplicate)" : "");
        imported++;
      } catch {
        result =
          "INVALID: check required title, description, budget, currency, URL and permission";
        invalid++;
      }
      port.writeRow("ManualInbox", i + 1, [
        ...row.slice(0, tableHeaders.ManualInbox.length - 1),
        result,
      ]);
    }
    updateDashboard(store);
    return { imported, invalid };
  });
}
export function importLegacyCRM() {
  return locked(() => {
    const { engine, store } = runtime();
    const tab = spreadsheet().getSheetByName("Leads CRM");
    if (!tab)
      throw new Error("Import the supplied workbook into this Sheet first");
    const rows = tab.getDataRange().getValues();
    const headers = rows[0].map(String);
    const results = { imported: 0, invalid: 0 };
    for (const row of rows.slice(1, 501)) {
      if (!row[0] && !row[7]) continue;
      try {
        engine.ingest(
          rowToInput(
            Object.fromEntries(
              headers.map((h, i) => [h, String(row[i] ?? "")]),
            ),
          ),
        );
        results.imported++;
      } catch {
        results.invalid++;
      }
    }
    updateDashboard(store);
    return results;
  });
}
function promptText(title: string, description: string) {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt(title, description, ui.ButtonSet.OK_CANCEL);
  return r.getSelectedButton() === ui.Button.OK ? r.getResponseText() : null;
}
export function addManualLead() {
  const raw = promptText(
    "Add a manual lead",
    "Paste a JSON object with title and raw_description (20+ characters). Optional: source_url, stated_budget_min/max, currency, contact_channel, contact_permission_state. See setup guide.",
  );
  if (raw === null) return;
  return locked(() => {
    const { engine, store } = runtime();
    const result = engine.ingest({ ...JSON.parse(raw), source: "manual" });
    updateDashboard(store);
    return result.lead.lead_id;
  });
}
function selectedId() {
  const book = spreadsheet();
  const active = book.getActiveSheet();
  const range = active.getActiveRange();
  if (active.getName() !== "Leads" || !range || range.getRow() < 2)
    throw new Error("Select a lead row in the Leads tab first");
  return String(active.getRange(range.getRow(), 1).getValue());
}
export function updateSelectedLead() {
  const id = selectedId();
  const raw = promptText(
    "Update selected lead",
    'JSON: {"status":"CONTACTED_MANUALLY","manual_confirmation":true} or {"contact_permission_state":"PLATFORM_ONLY","contact_channel":"Upwork","owner_notes":"Verified policy and current listing"}. Use only verified facts.',
  );
  if (raw === null) return;
  const change = z
    .object({
      status: z
        .enum([
          "CONTACTED_MANUALLY",
          "REPLIED",
          "DISCOVERY",
          "QUOTED",
          "WON",
          "LOST",
          "MAINTENANCE",
          "ARCHIVED",
          "REJECTED",
        ])
        .optional(),
      manual_confirmation: z.boolean().default(false),
      contact_permission_state: z
        .enum(["UNKNOWN", "PLATFORM_ONLY", "EXPLICIT_OPT_IN", "BLOCKED"])
        .optional(),
      contact_channel: z.string().max(100).optional(),
      owner_notes: z.string().max(2000).optional(),
      next_followup_at: z.string().datetime().optional(),
    })
    .strict()
    .parse(JSON.parse(raw));
  return locked(() => {
    const { engine, store } = runtime();
    let lead = store.get(id);
    if (!lead) throw new Error("Lead missing");
    const before = lead.status;
    lead = {
      ...lead,
      ...(change.contact_permission_state
        ? { contact_permission_state: change.contact_permission_state }
        : {}),
      ...(change.contact_channel
        ? { contact_channel: change.contact_channel }
        : {}),
      ...(change.owner_notes !== undefined
        ? { owner_notes: change.owner_notes }
        : {}),
      ...(change.next_followup_at
        ? { next_followup_at: change.next_followup_at }
        : {}),
      updated_at: now(),
    };
    if (change.status)
      lead = engine.move(
        lead,
        change.status,
        "owner",
        change.manual_confirmation,
      );
    else store.save(lead);
    engine.log(
      lead,
      before,
      "OWNER_UPDATED",
      "owner",
      "Owner changed permitted fields; private content omitted",
    );
    updateDashboard(store);
  });
}
export function reprocessSelectedLead() {
  const id = selectedId();
  return locked(() => {
    const { store, engine } = runtime();
    engine.reprocess(id);
    updateDashboard(store);
  });
}
export function renewSelectedApproval() {
  const id = selectedId();
  return locked(() => {
    const { engine, store } = runtime();
    const lead = store.get(id);
    if (!lead || lead.status !== "PENDING_APPROVAL")
      throw new Error("Select a pending lead");
    const port = store.port;
    const rows = port.read("ApprovalRequests");
    for (let i = rows.length - 1; i >= 1; i--)
      if (String(rows[i][1]) === id) port.removeRow("ApprovalRequests", i + 1);
    store.save({
      ...lead,
      approval_status: "PENDING",
      next_followup_at: "",
      updated_at: now(),
    });
    engine.log(lead, lead.status, "APPROVAL_RENEWED", "owner");
    return "Old buttons invalidated. Next live cycle sends a fresh alert.";
  });
}
export function renewSelectedEmailApproval(){
  const id=selectedId();return locked(()=>{const {store,outbox,engine}=runtime();const row=outbox.list().find(r=>r.lead_id===id);const lead=store.get(id);
    if(!row||!lead||lead.contact_permission_state!=='EXPLICIT_OPT_IN'||!['DRAFT','NOTIFYING','REVIEW_PENDING','DEFERRED'].includes(row.status))throw new Error('Select an unsent email review. Uncertain Gmail delivery requires manual reconciliation.');
    outbox.save({...row,status:'DRAFT',nonce:Utilities.getUuid().replace(/-/g,'').slice(0,24),message_id:'',approved_by:'',approved_at:'',updated_at:now()});store.save({...lead,approval_status:'PENDING',next_followup_at:'',updated_at:now()});engine.log(lead,lead.status,'EMAIL_REVIEW_RENEWED','owner');return 'Old buttons invalidated. Next cycle requests review again.';
  });
}
export function deleteSelectedLead() {
  const id = selectedId();
  const confirm = promptText(
    "Delete lead data",
    "Type " +
      id +
      " to delete its lead, draft, approval and activity records. Export first if retention requires it. Also remove any original email, CSV or ManualInbox data separately.",
  );
  if (confirm !== id) return;
  return locked(() => {
    const { store } = runtime();
    store.deleteLead(id);
    updateDashboard(store);
  });
}
export function sendTestNotification() {
  const confirm = promptText(
    "Send a real owner notification",
    "This sends one Telegram message to your configured private owner chat. Type SEND TEST to proceed.",
  );
  if (confirm !== "SEND TEST") return;
  return locked(() =>
    telegram("sendMessage", {
      chat_id: setting("TELEGRAM_OWNER_CHAT_ID"),
      text: "LeadFlow owner test. Integration is connected. No prospects have been contacted.",
    }),
  );
}
