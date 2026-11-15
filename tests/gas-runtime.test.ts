import { buildSync } from "esbuild";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { fixtures } from "../fixtures/leads";
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
  let prompt = "";
  let uuid = 0;
  let locked = false;
  const sent:string[]=[];
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
    getActiveSheet: () => tabs.get("Leads"),
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
      fetch: (url: string, request: { payload: string }) => {
        const method = url.split("/").pop()!;
        const body = JSON.parse(request.payload) as Record<string, unknown>;
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
    setUpdates: (x: unknown[]) => {
      updates = x;
    },
    setPrompt: (x: string) => {
      prompt = x;
    },
  };
}
describe("built Apps Script runtime with mocked Google/Telegram services", () => {
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
