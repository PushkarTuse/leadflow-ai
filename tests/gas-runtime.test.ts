import { buildSync } from "esbuild";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { fixtures } from "../fixtures/leads";
import {inputSchema} from '../packages/core/model';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { signatureMessage } from '../packages/core/intake';

// Execute the actual Apps Script bundle without Node/browser-only globals.
const bundle = buildSync({
  entryPoints: ["apps/automation/main.ts"],
  bundle: true,
  format: "iife",
  globalName: "LeadFlow",
  target: "es2020",
  write: false,
}).outputFiles[0].text;
class FakeSheet {
  rows: unknown[][] = [];
  constructor(public name: string, private onRename?: (oldName:string,newName:string)=>void) {}
  setName(name:string) { this.onRename?.(this.name,name); this.name=name; return this; }
  getLastRow() {
    return this.rows.length;
  }
  getLastColumn() {
    return this.rows[0]?.length || 0;
  }
  getName() {
    return this.name;
  }
  getDataRange() {
    return { getValues: () => this.rows.map((r) => [...r]) };
  }
  getRange(row: number, col: number, height = 1, width = 1) {
    const range = {
      getValues: () =>
        Array.from({ length: height }, (_, i) =>
          Array.from(
            { length: width },
            (_, j) => this.rows[row + i - 1]?.[col + j - 1] ?? "",
          ),
        ),
      getValue: () => this.rows[row - 1]?.[col - 1],
      setValues: (values: unknown[][]) => {
        values.forEach((r, i) => {
          this.rows[row + i - 1] ??= [];
          r.forEach((v, j) => {
            this.rows[row + i - 1][col + j - 1] = v;
          });
        });
        return range;
      },
      setFontWeight: () => range,
      setBackground: () => range,
      setFontColor: () => range,
    };
    return range;
  }
  setFrozenRows() {}
  setColumnWidths() {}
  hideColumns() {}
  deleteRow(row: number) {
    this.rows.splice(row - 1, 1);
  }
  getActiveRange() {
    return { getRow: () => 2 };
  }
}
function harness() {
  const props = new Map<string, string>([
    ["SHEET_ID", "test-sheet"],
    ["DRY_RUN", "true"],
  ]);
  const tabs = new Map<string, FakeSheet>();
  const calls: { method: string; body: Record<string, unknown> }[] = [];
  let updates: unknown[] = [];
  let sourceReply: ((url:string,method?:string)=>unknown)|undefined;
  let prompt = "";
  let uuid = 0;
  let locked = false;
  let activeSheet = "Leads";
  const sent:string[]=[];
  const externalCalls:{url:string;method:string}[]=[];
  let committedOutbox:unknown[][]=[];
  const menu = {
    addItem: () => menu,
    addSeparator: () => menu,
    addToUi: () => menu,
  };
  const book = {
    getId:()=> 'test-sheet',
    getSheetByName: (name: string) => tabs.get(name),
    insertSheet: (name: string) => {
      const tab = new FakeSheet(name,(oldName,newName)=>{const sheet=tabs.get(oldName)!;tabs.delete(oldName);tabs.set(newName,sheet);});
      tabs.set(name, tab);
      return tab;
    },
    getActiveSheet: () => tabs.get(activeSheet),
  };
  const context = vm.createContext({
    console: { log: () => {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => props.get(key) ?? null,
        setProperty: (key: string, value: string) => {
          props.set(key, value);
        },
        deleteProperty: (key: string) => props.delete(key),
      }),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => {
          if (locked) return false;
          locked = true;
          return true;
        },
        releaseLock: () => {
          locked = false;
        },
      }),
    },
    SpreadsheetApp: {
      flush:()=>{committedOutbox=tabs.get('EmailOutbox')?.rows.map(row=>[...row])||[];},
      openById: () => book,
      getUi: () => ({
        createMenu: () => menu,
        ButtonSet: { OK_CANCEL: 1 },
        Button: { OK: 1 },
        prompt: () => ({
          getSelectedButton: () => 1,
          getResponseText: () => prompt,
        }),
      }),
    },
    Utilities: {
      getUuid: () => String(++uuid).padStart(32, "a"),
      formatDate: () => new Date().toISOString().slice(0, 10),
      sleep: () => {},
      DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
      computeDigest:(_algorithm:string,value:string)=>Array.from(createHash('sha256').update(value).digest()),
      computeHmacSha256Signature:(value:string,key:string)=>Array.from(createHmac('sha256',key).update(value).digest()),
      base64Encode:(value:string)=>Buffer.from(value).toString('base64'),
      base64EncodeWebSafe:(value:string)=>Buffer.from(value).toString('base64url'),
    },
    ContentService:{MimeType:{JSON:'json'},createTextOutput:(text:string)=>({setMimeType:()=>JSON.parse(text)})},
    ScriptApp: { getProjectTriggers: () => [] },
    Gmail: {
      Users: {
        getProfile:()=>({emailAddress:'owner@example.com'}),
        Messages:{send:(message:{raw:string})=>{
          const statusColumn=committedOutbox[0]?.indexOf('status');
          if(statusColumn===undefined||!committedOutbox.slice(1).some(row=>row[statusColumn]==='SENDING'))throw new Error('Delivery attempted before SENDING was committed');
          sent.push(Buffer.from(message.raw,'base64url').toString());return {id:'gmail_'+sent.length};
        }},
        Labels: {
          list: () => {
            throw new Error("Gmail must remain disabled in this test");
          },
        },
      },
    },
    UrlFetchApp: {
      fetch: (url: string, request: { payload?: string; method?: string }) => {
        if(sourceReply && !url.startsWith('https://api.telegram.org/')) {
          externalCalls.push({url,method:request.method||'get'});
          const data=sourceReply(url,request.method);
          return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(data)};
        }
        const method = url.split("/").pop()!;
        const body = JSON.parse(request.payload ?? "{}") as Record<string, unknown>;
        calls.push({ method, body });
        let result: unknown;
        if (method === "getUpdates") {
          result = updates;
          updates = [];
        } else if (method === "sendMessage")
          result = {
            message_id:
              500 + calls.filter((c) => c.method === "sendMessage").length,
            chat: { id: 99, type: "private" },
          };
        else result = true;
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ ok: true, result }),
        };
      },
    },
  });
  vm.runInContext(bundle, context);
  const run = (name: string,arg?:unknown) =>{context.event=arg;return vm.runInContext("LeadFlow." + name + "(event)", context);};
  const records = () =>
    tabs
      .get("Leads")!
      .rows.slice(1)
      .map((r) => JSON.parse(String(r.at(-1))));
  return {
    props,
    tabs,
    calls,
    run,
    records,
    sent,
    setSourceReply:(reply:(url:string,method?:string)=>unknown)=>{sourceReply=reply;},
    setActiveSheet:(name:string)=>{activeSheet=name;},
    externalCalls,
    setUpdates: (x: unknown[]) => {
      updates = x;
    },
    setPrompt: (x: string) => {
      prompt = x;
    },
  };
}
describe("built Apps Script runtime with mocked Google/Telegram services", () => {
  it('pulls external HN into Sheets and owner review without creating an email outbox entry',()=>{
    const h=harness();h.run('setup');
    for(const [k,v] of Object.entries({DRY_RUN:'false',EXTERNAL_LEADS_ENABLED:'true',
      EXTERNAL_LEADS_API_ORIGIN:'https://scout.example.com',EXTERNAL_LEADS_API_TOKEN:'x'.repeat(40),
      FREELANCE_QUALIFICATION_MODE:'enforce',
      TELEGRAM_ENABLED:'true',TELEGRAM_BOT_TOKEN:'123:token',TELEGRAM_OWNER_CHAT_ID:'99',TELEGRAM_OWNER_USER_ID:'99'}))h.props.set(k,v);
    const fixture=inputSchema.parse(fixtures(new Date().toISOString())[0]);
    h.setSourceReply(url=>url.includes('/leads?')?{ok:true,total:1,count:1,offset:0,leads:[{
      source:'hackernews',source_id:'12345',category:'company_hiring',name:'Company',title:'React website developer',
      url:'https://news.ycombinator.com/item?id=12345',found_at:new Date().toISOString()}]}:
      {id:12345,type:'job',title:fixture.title,text:fixture.raw_description,time:Math.floor(Date.now()/1000)});
    h.run('tick');expect(h.records()).toHaveLength(1);
    expect(h.records()[0].status).toBe('PENDING_APPROVAL');
    expect(h.calls.some(c=>c.method==='sendMessage')).toBe(true);
    expect(h.tabs.get('EmailOutbox')!.rows).toHaveLength(1);expect(h.sent).toHaveLength(0);
    expect(h.props.get('EXTERNAL_LEADS_OFFSET')).toBe('0');
    h.props.delete('last_source_cycle');h.run('tick');expect(h.records()).toHaveLength(1);
  });
  it('defaults discovery notifications to shadow while still persisting qualification',()=>{
    const h=harness();h.run('setup');
    for(const [k,v] of Object.entries({DRY_RUN:'false',EXTERNAL_LEADS_ENABLED:'true',
      EXTERNAL_LEADS_API_ORIGIN:'https://scout.example.com',EXTERNAL_LEADS_API_TOKEN:'x'.repeat(40),
      TELEGRAM_ENABLED:'true',TELEGRAM_BOT_TOKEN:'123:token',TELEGRAM_OWNER_CHAT_ID:'99',TELEGRAM_OWNER_USER_ID:'99'}))h.props.set(k,v);
    const fixture=inputSchema.parse(fixtures(new Date().toISOString())[0]);
    h.setSourceReply(url=>url.includes('/leads?')?{ok:true,total:1,count:1,offset:0,leads:[{
      source:'hackernews',source_id:'12345',category:'company_hiring',name:'Company',title:'React website developer',
      url:'https://news.ycombinator.com/item?id=12345',found_at:new Date().toISOString()}]}:
      {id:12345,type:'job',title:fixture.title,text:fixture.raw_description,time:Math.floor(Date.now()/1000)});
    h.run('tick');
    expect(h.records()).toHaveLength(1);
    expect(h.records()[0].qualification).toBeDefined();
    expect(h.calls.some(c=>c.method==='sendMessage')).toBe(false);
  });
  it('uses the OpenAI-compatible provider for discovery only and keeps notifications shadowed',()=>{
    const h=harness();h.run('setup');
    for(const [k,v] of Object.entries({DRY_RUN:'false',EXTERNAL_LEADS_ENABLED:'true',
      EXTERNAL_LEADS_API_ORIGIN:'https://scout.example.com',EXTERNAL_LEADS_API_TOKEN:'x'.repeat(40),
      AI_ENABLED:'true',AI_PROVIDER:'openai',AI_API_KEY:'sk-test-key',AI_MODEL:'test-model',
      AI_DATA_USE_APPROVED:'true',FREELANCE_QUALIFICATION_MODE:'shadow',
      TELEGRAM_ENABLED:'true',TELEGRAM_BOT_TOKEN:'123:token',TELEGRAM_OWNER_CHAT_ID:'99',TELEGRAM_OWNER_USER_ID:'99'}))h.props.set(k,v);
    const foundAt=new Date().toISOString();
    const text='SEEKING FREELANCER: We need an independent contractor to build a React checkout. Budget: $3,000 fixed. Deadline next month.';
    const signals={
      intent:'BUYER',lead_type:'CONTRACT_ROLE',requester_type:'COMPANY',engagement_type:'INDEPENDENT_CONTRACT',
      budget_signal:{kind:'AMOUNT_STATED',minimum:3000,maximum:3000,currency:'USD',unit:'PROJECT'},
      timeline_signal:'Deadline next month',required_skills:['React'],seniority:'UNKNOWN',
      location_or_remote_policy:null,contact_method:{type:'UNKNOWN',value:null},rejection_reason:null,
      evidence_quotes:[
        {field:'intent',quote:'We need an independent contractor'},
        {field:'engagement',quote:'independent contractor'},
        {field:'payment',quote:'Budget: $3,000 fixed'},
        {field:'scope',quote:'build a React checkout'},
        {field:'skill',quote:'React checkout'},
      ],
    };
    h.setSourceReply(url=>{
      if(url.includes('/leads?'))return {ok:true,total:1,count:1,offset:0,leads:[{
        source:'hackernews',source_id:'12345',category:'freelance_request',name:'founder',
        title:'SEEKING FREELANCER',url:'https://news.ycombinator.com/item?id=12345',found_at:foundAt}]};
      if(url.endsWith('/item/12345.json'))return {id:12345,type:'comment',parent:100,time:Math.floor(Date.now()/1000),text};
      if(url.endsWith('/item/100.json'))return {id:100,type:'job',title:'Who is hiring? November',time:Math.floor(Date.now()/1000)};
      if(url.endsWith('/chat/completions'))return {choices:[{message:{content:JSON.stringify(signals)}}]};
      return {};
    });
    h.run('tick');
    expect(h.records()).toHaveLength(1);
    expect(h.externalCalls.map(call=>call.url)).toContain('https://api.openai.com/v1/chat/completions');
    expect(h.records()[0].qualification_audit.method).toBe('openai-compatible');
    expect(h.calls.some(call=>call.method==='sendMessage')).toBe(false);
  });
  it('keeps inbound Gemini extraction enabled when OpenAI is selected for discovery',()=>{
    const h=harness();h.run('setup');
    for(const [k,v] of Object.entries({DRY_RUN:'false',AI_ENABLED:'true',AI_PROVIDER:'openai',
      GEMINI_ENABLED:'true',GEMINI_API_KEY:'gemini-test-key',GEMINI_MODEL:'gemini-3.5-flash-lite',
      GEMINI_FREE_TIER_CONFIRMED:'true',GEMINI_DATA_USE_APPROVED:'true'}))h.props.set(k,v);
    h.setSourceReply(url=>{
      expect(url).toContain('generativelanguage.googleapis.com');
      return {candidates:[{content:{parts:[{text:JSON.stringify({
        hiring_evidence:'We need a React website developer',
        skill_evidence:[{skill:'react',quote:'React'}],timeline_evidence:null,
      })}]}}]};
    });
    h.setPrompt(JSON.stringify(fixtures(new Date().toISOString())[0]));
    h.run('addManualLead');
    h.run('tick');
    expect(h.externalCalls.some(call=>call.url.includes('generativelanguage.googleapis.com'))).toBe(true);
  });
  it('preserves full diagnostic logs while continuing beyond the operational row limit',()=>{
    const h=harness();h.run('setup');const log=h.tabs.get('SourceRuns')!;
    for(let i=0;i<5001;i++)log.rows.push(['run_'+i,'tick','','','OK',0,0,0,0,'']);
    h.run('tick');
    const archived=[...h.tabs.keys()].find(name=>name.startsWith('SourceRuns_'))!;
    expect(h.tabs.get(archived)?.rows).toHaveLength(5002);
    expect(h.tabs.get('SourceRuns')?.rows).toHaveLength(2);
    h.run('tick');expect([...h.tabs.keys()].filter(name=>name.startsWith('SourceRuns_'))).toHaveLength(1);
    expect(h.calls).toHaveLength(0);
  });
  it('recovers an interrupted diagnostic rollover without changing CRM records',()=>{
    const h=harness();h.run('setup');h.tabs.get('SourceRuns')!.setName('SourceRuns_saved');
    h.run('tick');expect(h.tabs.get('SourceRuns')?.rows).toHaveLength(2);expect(h.records()).toHaveLength(0);
    expect(h.tabs.has('SourceRuns_saved')).toBe(true);
  });
  it('runs signed intake to Sheet, draft, Telegram approval and Gmail exactly once',()=>{
    const h=harness();h.run('setup');for(const [key,value] of Object.entries({DRY_RUN:'false',INTAKE_ENABLED:'true',INTAKE_HMAC_SECRET:'test-only-secret-at-least-32-bytes',PUBLIC_SITE_URL:'https://example.com',TELEGRAM_ENABLED:'true',TELEGRAM_BOT_TOKEN:'123:test-only',TELEGRAM_OWNER_USER_ID:'7',TELEGRAM_OWNER_CHAT_ID:'99',GMAIL_SEND_ENABLED:'true',GMAIL_SENDER_EMAIL:'owner@example.com',SMOKE_TEST_EMAIL:'owner@example.com'}))h.props.set(key,value);
    const payload=JSON.stringify({submission_id:randomUUID(),name:'Test Owner',email:'owner@example.com',business:'Test Studio',goal:'We need a React website and enquiry form with Google Sheets integration. Flexible timeline.',budget:'₹30,000–₹60,000',consent:true,consent_version:'enquiry-email-v1'}),timestamp=Date.now(),nonce=randomUUID();const signature=createHmac('sha256',h.props.get('INTAKE_HMAC_SECRET')!).update(signatureMessage(timestamp,nonce,payload)).digest('hex');const event={postData:{contents:JSON.stringify({timestamp,nonce,payload,signature})}};
    const first=h.run('doPost',event);expect(first.ok).toBe(true);expect(h.run('doPost',event).lead_id).toBe(first.lead_id);expect(h.records()).toHaveLength(1);expect(h.calls).toHaveLength(0);expect(h.sent).toHaveLength(0);
    h.run('tick');expect(h.records()[0].status).toBe('DRAFT_READY');const alert=h.calls.find(c=>c.method==='sendMessage')!;expect(alert.body.text).toContain('owner@example.com');const rows=h.tabs.get('EmailOutbox')!.rows;const row=Object.fromEntries(rows[0].map((key,i)=>[String(key),rows[1][i]]));expect(row.status).toBe('REVIEW_PENDING');
    const callback={update_id:1,callback_query:{id:'cb',from:{id:7},message:{message_id:Number(row.message_id),chat:{id:99,type:'private'}},data:'send:'+row.nonce}};h.setUpdates([callback]);h.run('tick');expect(h.sent).toHaveLength(1);expect(h.sent[0]).toContain('To: owner@example.com');expect(h.records()[0].status).toBe('EMAIL_SENT');h.setUpdates([callback]);h.run('tick');expect(h.sent).toHaveLength(1);
    const edits=h.calls.filter(c=>c.method==='editMessageText');expect(edits).toHaveLength(1);expect(edits[0].body.text).toContain('SENT');expect(edits[0].body.reply_markup).toEqual({inline_keyboard:[]});
  });
  it.each([
    ['digital-marketing', 'Signal & Slate', '/#audit', 'Your Signal & Slate enquiry'],
    ['web-app-dev', 'LeadFlow AI', '/contact', 'Your LeadFlow AI enquiry'],
  ])('persists %s metadata through the compiled Apps Script, Sheet JSON and owner alert',(vertical,brand,path,subject)=>{
    const h=harness();h.run('setup');for(const [key,value] of Object.entries({DRY_RUN:'false',INTAKE_ENABLED:'true',INTAKE_HMAC_SECRET:'test-only-secret-at-least-32-bytes',PUBLIC_SITE_URL:'https://dev.example.com',TELEGRAM_ENABLED:'true',TELEGRAM_BOT_TOKEN:'123:test-only',TELEGRAM_OWNER_USER_ID:'7',TELEGRAM_OWNER_CHAT_ID:'99'}))h.props.set(key,value);
    const payload=JSON.stringify({submission_id:randomUUID(),name:'Synthetic Owner',email:'owner@example.com',business:'Synthetic Test Studio',goal:'We need a responsive website and structured enquiry form with Google Sheets.',budget:'I’d like guidance',consent:true,consent_version:'enquiry-email-v1',vertical,brand,site_url:'https://marketing.example.com'}),timestamp=Date.now(),nonce=randomUUID();const signature=createHmac('sha256',h.props.get('INTAKE_HMAC_SECRET')!).update(signatureMessage(timestamp,nonce,payload)).digest('hex');
    const response=h.run('doPost',{postData:{contents:JSON.stringify({timestamp,nonce,payload,signature})}});expect(response.ok).toBe(true);h.run('tick');const rows=h.tabs.get('Leads')!.rows;const record=JSON.parse(String(rows[1][rows[0].indexOf('record_json')]));expect(record).toMatchObject({vertical,brand,source_url:'https://marketing.example.com'+path});expect(h.calls.find(c=>c.method==='sendMessage')?.body.text).toContain(subject);expect(h.sent).toHaveLength(0);
  });
  it('rejects unsigned intake without creating a lead',()=>{const h=harness();h.run('setup');h.props.set('DRY_RUN','false');h.props.set('INTAKE_ENABLED','true');h.props.set('INTAKE_HMAC_SECRET','test-only-secret-at-least-32-bytes');expect(h.run('doPost',{postData:{contents:'{}'}}).ok).toBe(false);expect(h.records()).toHaveLength(0);});
  it("sets up idempotently, preserves original tabs and prevents HTTP in dry-run", () => {
    const h = harness();
    const legacy = new FakeSheet("Projects");
    legacy.rows = [["Original project data"]];
    h.tabs.set("Projects", legacy);
    h.run("setup");
    h.run("setup");
    h.run("tick");
    expect(h.calls).toHaveLength(0);
    expect(h.tabs.get("Projects")?.rows[0][0]).toBe("Original project data");
    expect(h.tabs.get("Settings")?.rows).toHaveLength(3);
    expect(h.tabs.get("SourceRuns")?.rows[1][4]).toBe("DRY_RUN");
  });
  it("syncs local businesses into their own manual queue without entering Leads or notifications", () => {
    const h = harness();
    h.run("setup");
    for (const [key, value] of Object.entries({
      DRY_RUN: "false",
      LOCAL_BUSINESS_SYNC_ENABLED: "true",
      EXTERNAL_LEADS_API_ORIGIN: "https://scout.example.com",
      EXTERNAL_LEADS_API_TOKEN: "x".repeat(40),
    })) h.props.set(key, value);
    const local = {
      id: 21, source: "osm", source_id: "node/21", category: "local_business",
      name: "Kothrud Dental", title: "dentist", city: "Pune", phone: "+91 98765 43210",
      website: null, pagespeed_mobile: null, rating: null, rating_count: null,
      score: 90, signal: "No website listed", url: "https://www.openstreetmap.org/node/21",
      status: "new", notes: null,
    };
    const google = { ...local, id: 22, source: "google_nearby", source_id: "place/22" };
    h.setSourceReply((url) => {
      expect(url).toContain("/leads?category=local_business");
      return { ok: true, total: 2, count: 2, offset: 0, leads: [local, google] };
    });

    expect(h.run("syncLocalBusinessProspects")).toContain("1 new");
    const queue = h.tabs.get("Local Businesses")!;
    expect(queue.rows).toHaveLength(2);
    expect(queue.rows[1][queue.rows[0].indexOf("name")]).toBe("Kothrud Dental");
    expect(h.records()).toHaveLength(0);
    expect(h.calls).toHaveLength(0);
    expect(h.sent).toHaveLength(0);

    queue.rows[1][queue.rows[0].indexOf("campaign_status")] = "contacted";
    queue.rows[1][queue.rows[0].indexOf("campaign_notes")] = "Call next week";
    expect(h.run("syncLocalBusinessProspects")).toContain("1 refreshed");
    expect(queue.rows[1][queue.rows[0].indexOf("campaign_status")]).toBe("contacted");
    expect(queue.rows[1][queue.rows[0].indexOf("campaign_notes")]).toBe("Call next week");
    h.setActiveSheet("Local Businesses");
    h.setSourceReply((url, method) => {
      expect(url).toContain("/leads/21");
      return method === "patch" ? { ok: true } : { ok: true, lead: { category: "local_business", source: "osm" } };
    });
    expect(h.run("saveSelectedLocalBusinessFollowup")).toContain("Saved local-business status contacted");
    expect(h.externalCalls.slice(-2).map((call) => call.method)).toEqual(["get", "patch"]);
    expect(h.records()).toHaveLength(0);
    expect(h.calls).toHaveLength(0);
    expect(h.sent).toHaveLength(0);
  });
  it("processes a full owner-only notification and approval through the real scheduler code", () => {
    const h = harness();
    h.run("setup");
    h.setPrompt(JSON.stringify(fixtures(new Date().toISOString())[0]));
    h.run("addManualLead");
    h.props.set("DRY_RUN", "false");
    h.props.set("TELEGRAM_ENABLED", "true");
    h.props.set("TELEGRAM_BOT_TOKEN", "123:test_token");
    h.props.set("TELEGRAM_OWNER_USER_ID", "99");
    h.props.set("TELEGRAM_OWNER_CHAT_ID", "99");
    h.run("tick");
    const request = h.tabs.get("ApprovalRequests")!.rows[1];
    const nonce = String(request[2]),
      messageId = Number(request[4]);
    expect(request[6]).toBe("SENT");
    const update = (id: number, user: number) => ({
      update_id: id,
      callback_query: {
        id: "cb" + id,
        from: { id: user },
        data: "approve:" + nonce,
        message: { message_id: messageId, chat: { id: 99, type: "private" } },
      },
    });
    h.setUpdates([update(1, 100)]);
    h.run("tick");
    expect(h.records()[0].status).toBe("PENDING_APPROVAL");
    expect(h.tabs.get("Drafts")!.rows).toHaveLength(1);
    h.setUpdates([update(2, 99)]);
    h.run("tick");
    expect(h.records()[0].status).toBe("DRAFT_READY");
    expect(h.tabs.get("Drafts")!.rows).toHaveLength(2);
    expect(h.props.get("telegram_offset")).toBe("3");
    h.setUpdates([update(3, 99)]);
    h.run("tick");
    expect(h.tabs.get("Drafts")!.rows).toHaveLength(2);
    expect(h.calls.filter((c) => c.method === "sendMessage")).toHaveLength(2);
    expect(
      h.calls
        .filter((c) => c.method === "sendMessage")
        .every((c) => c.body.chat_id === "99"),
    ).toBe(true);
  });
  it("requires typed owner confirmation before a test notification", () => {
    const h = harness();
    h.setPrompt("cancel");
    h.run("sendTestNotification");
    expect(h.calls).toHaveLength(0);
  });
});
