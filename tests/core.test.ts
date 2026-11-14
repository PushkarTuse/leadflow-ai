import { describe, expect, it } from "vitest";
import {
  defaults,
  inputSchema,
  canonicalUrl,
  canContact,
} from "../packages/core/model";
import { assess, validateExtraction } from "../packages/core/scoring";
import { Engine, commandReply } from "../packages/core/workflow";
import { MemoryStore } from "../packages/core/memory-store";
import { exportCsv, parseCsv, rowToInput } from "../packages/core/csv";
import { fixtures } from "../fixtures/leads";
import { qualifyEnquiry, contactSchema } from "../packages/core/enquiry";
const time = "2026-11-12T08:00:00.000Z";
const base = inputSchema.parse(fixtures(time)[0]);
function setup() {
  const store = new MemoryStore();
  const engine = new Engine(store, defaults, { now: () => time });
  const lead = engine.ingest(base).lead;
  return { store, engine, lead };
}
function requestSetup() {
  const x = setup();
  const request = x.engine.prepareApproval(x.lead, "secureNonce12345678");
  request.message_id = "123";
  request.state = "SENT";
  x.store.request(request);
  const callback = {
    userId: defaults.ownerUserId,
    chatId: defaults.ownerChatId,
    chatType: "private",
    messageId: "123",
    data: "approve:" + request.nonce,
  };
  return { ...x, request, callback };
}
describe("validation and scoring", () => {
  it("uses transparent bounded weighted scoring", () => {
    const a = assess(base, time);
    expect(a.score).toBe(97);
    expect(Object.values(a.breakdown).reduce((x, y) => x + y, 0)).toBe(a.score);
    expect(a.priority).toBe("HIGH");
  });
  it("missing information lowers confidence without inventing budgets", () => {
    const a = assess(
      {
        ...base,
        stated_budget_min: null,
        stated_budget_max: null,
        client_name_if_public: "",
        posted_at: undefined,
      },
      time,
    );
    expect(a.confidence).toBeLessThan(assess(base, time).confidence);
    expect(a.missing).toContain("Budget not stated");
    expect(a.breakdown.budget).toBe(5);
  });
  it("keeps zero distinct from absent budgets", () =>
    expect(
      assess({ ...base, stated_budget_min: 0, stated_budget_max: 0 }, time)
        .breakdown.budget,
    ).toBe(0));
  it("never equates a high score with contact permission", () => {
    const blocked = { ...base, contact_permission_state: "BLOCKED" as const };
    expect(assess(blocked, time).score).toBeGreaterThan(75);
    expect(canContact(blocked)).toBe(false);
  });
  it("archives stale, hostile and job-seeker inputs", () => {
    const { engine } = setup();
    for (const i of [5, 6, 10])
      expect(engine.ingest(fixtures(time)[i]).lead.status).toBe("ARCHIVED");
  });
  it("irrelevant content does not enter qualified queue", () => {
    const { engine } = setup();
    expect(engine.ingest(fixtures(time)[4]).lead.status).toBe("NEW");
  });
  it("rejects malformed, negative, reversed budgets and javascript URLs", () => {
    for (const input of [
      { ...base, stated_budget_min: -2 },
      { ...base, stated_budget_min: 50000, stated_budget_max: 5 },
      { ...base, source_url: "javascript:alert(1)" },
      { ...base, currency: "UNKNOWN" },
      { ...base, raw_description: "short" },
    ])
      expect(() => inputSchema.parse(input)).toThrow();
  });
  it("validates strict JSON and requires exact evidence", () => {
    expect(() => validateExtraction("not json", base)).toThrow();
    expect(() =>
      validateExtraction(
        JSON.stringify({
          hiring_evidence: "Made up facts",
          skill_evidence: [],
          timeline_evidence: null,
        }),
        base,
      ),
    ).toThrow();
    expect(() =>
      validateExtraction(
        JSON.stringify({
          hiring_evidence: null,
          skill_evidence: [],
          timeline_evidence: null,
          status: "APPROVED",
        }),
        base,
      ),
    ).toThrow();
  });
  it("handles custom priority thresholds", () =>
    expect(
      assess(base, time, { ...defaults, highThreshold: 99 }).priority,
    ).toBe("REVIEW"));
});
describe("CSV and identity", () => {
  it("handles multiline quoted fields and escaped quotes", () =>
    expect(parseCsv('title,description\r\n"A, B","one\n""two"""')[0]).toEqual({
      title: "A, B",
      description: 'one\n"two"',
    }));
  it("rejects malformed CSV and ambiguous headers", () => {
    for (const csv of ["a,a\n1,2", "a,b\n1", 'a\n"broken', 'a\n"x"junk'])
      expect(() => parseCsv(csv)).toThrow();
  });
  it("deduplicates canonical URLs and source IDs", () => {
    const { engine, store } = setup();
    expect(engine.ingest(fixtures(time)[1]).duplicate).toBe(true);
    expect(
      engine.ingest({ ...base, source_url: "https://example.com/alternate" })
        .duplicate,
    ).toBe(true);
    expect(store.leads()).toHaveLength(1);
    expect(
      canonicalUrl("https://EXAMPLE.com/path/?utm_source=x&id=2#part"),
    ).toBe("https://example.com/path?id=2");
  });
  it("exports formula-safe CSV while preserving ordinary numbers", () => {
    const { lead } = setup();
    const csv = exportCsv([
      { ...lead, title: '=HYPERLINK("https://evil.test")' },
    ]);
    expect(parseCsv(csv)[0].title.startsWith("'=")).toBe(true);
    expect(parseCsv(csv)[0].score).toBe("97");
  });
  it("maps legacy rows without trusting old approvals", () => {
    const value = rowToInput({
      "Lead ID": "L001",
      "Requested Work": "Need a React website with CRM intake",
      "Business / Client": "Sample",
      "Budget Min (₹)": "15,000",
      "Budget Max (₹)": "25,000",
      "Owner Approval": "YES",
      "Consent / Policy Check": "YES",
    });
    expect(value.currency).toBe("INR");
    expect(value.stated_budget_min).toBe(15000);
    expect(value.contact_permission_state).toBe("UNKNOWN");
  });
});
describe("approval and draft safety", () => {
  it('preserves creation/discovery dates when reprocessing an unapproved lead', () => {
    const store = new MemoryStore();
    const clock = { now: () => time };
    const engine = new Engine(store, defaults, clock);
    const lead = engine.ingest(fixtures(time)[4]).lead;
    clock.now = () => '2026-11-13T08:00:00.000Z';
    const next = engine.reprocess(lead.lead_id);
    expect(next.created_at).toBe(time);
    expect(next.discovered_at).toBe(time);
    expect(next.updated_at).toBe(clock.now());
    expect(store.leads()).toHaveLength(1);
    expect(() => setup().engine.reprocess(setup().lead.lead_id)).toThrow();
  });
  it('recovers an interrupted deferred decision once without moving its follow-up again', () => {
    const x = requestSetup(); x.request.state='CONSUMED'; x.request.decision='review'; x.store.request(x.request);
    x.engine.reconcile();
    const first=x.store.get(x.lead.lead_id)!.next_followup_at;
    x.engine.clock.now=()=> '2026-11-12T12:00:00.000Z';
    x.engine.reconcile();
    expect(x.store.get(x.lead.lead_id)?.next_followup_at).toBe(first);
  });
  it('keeps owner list replies within Telegram text limits even with long source URLs', () => {
    const {lead}=setup();
    const rows=Array.from({length:8},(_,i)=>({...lead,lead_id:lead.lead_id+i,title:'A'.repeat(200),source_url:'https://example.com/'+ 'b'.repeat(1900)}));
    expect(commandReply('/pending',rows,time).length).toBeLessThan(4096);
  });
  it.each([
    { userId: "intruder" },
    { chatId: "another-chat" },
    { chatType: "group" },
    { messageId: "456" },
    { data: "approve:unknownNonce12345" },
  ])("rejects unauthorized or mismatched callback %j", (patch) => {
    const x = requestSetup();
    expect(() => x.engine.decide({ ...x.callback, ...patch })).toThrow();
    expect(x.store.get(x.lead.lead_id)?.status).toBe("PENDING_APPROVAL");
    expect(x.store.drafts()).toHaveLength(0);
  });
  it("rejects expired callbacks", () => {
    const x = requestSetup();
    x.request.expires_at = "2026-11-11T00:00:00Z";
    x.store.request(x.request);
    expect(() => x.engine.decide(x.callback)).toThrow();
  });
  it("creates exactly one personalized draft and rejects replay", () => {
    const x = requestSetup();
    const l = x.engine.decide(x.callback);
    expect(l.status).toBe("DRAFT_READY");
    expect(x.store.drafts()[0].text).toContain(base.title);
    expect(x.store.drafts()[0].text).toContain("subject to agreement");
    expect(() => x.engine.decide(x.callback)).toThrow();
    x.engine.reconcile();
    expect(x.store.drafts()).toHaveLength(1);
    expect(
      x.store.activities().some((e) => e.new_state === "CONTACTED_MANUALLY"),
    ).toBe(false);
  });
  it("recovers a persisted decision after interrupted work", () => {
    const x = requestSetup();
    x.request.state = "CONSUMED";
    x.request.decision = "approve";
    x.store.request(x.request);
    x.engine.reconcile();
    expect(x.store.get(x.lead.lead_id)?.status).toBe("DRAFT_READY");
    x.engine.reconcile();
    expect(x.store.drafts()).toHaveLength(1);
  });
  it("defer and reject produce no proposal", () => {
    for (const action of ["review", "reject"]) {
      const x = requestSetup();
      const l = x.engine.decide({
        ...x.callback,
        data: action + ":" + x.request.nonce,
      });
      expect(x.store.drafts()).toHaveLength(0);
      expect(action === "review" ? l.next_followup_at : l.status).toBe(
        action === "review" ? "2026-11-13T08:00:00.000Z" : "REJECTED",
      );
    }
  });
  it("blocks premature contact and requires manual confirmation", () => {
    const x = requestSetup();
    expect(() =>
      x.engine.move(x.lead, "CONTACTED_MANUALLY", "owner", true),
    ).toThrow();
    const draft = x.engine.decide(x.callback);
    expect(() => x.engine.move(draft, "CONTACTED_MANUALLY")).toThrow();
    expect(
      x.engine.move(draft, "CONTACTED_MANUALLY", "owner", true).status,
    ).toBe("CONTACTED_MANUALLY");
  });
  it("blocked permission prevents manual-contact transition even after approval", () => {
    const x = requestSetup();
    const draft = x.engine.decide(x.callback);
    expect(() =>
      x.engine.move(
        { ...draft, contact_permission_state: "UNKNOWN" },
        "CONTACTED_MANUALLY",
        "owner",
        true,
      ),
    ).toThrow();
  });
  it("commands return empty states and actual counts", () => {
    expect(commandReply("/pending", [], time)).toBe("No matching leads yet.");
    expect(commandReply("/stats", [], time)).toContain("Won: 0");
  });
});
describe("public demo and contact validation", () => {
  const enquiry = {
    name: "Sample",
    service: "Buy a home",
    budget: "₹60–90 lakh",
    date: "Saturday afternoon",
    urgency: "This month",
    question: "I need a two-bedroom apartment in Pune.",
    consent: true,
  };
  it("changes score and permission when consent/budget change", () => {
    const a = qualifyEnquiry(enquiry),
      b = qualifyEnquiry({ ...enquiry, consent: false, budget: "Not decided" });
    expect(b.score).toBe(a.score - 20);
    expect(b.permission).toBe("Follow-up blocked");
    expect(a.suggestion).toContain("Saturday afternoon");
  });
  it("validates contact consent and email", () => {
    expect(
      contactSchema.safeParse({
        name: "Sample",
        email: "wrong",
        business: "Agency",
        goal: "Need a website and enquiry workflow",
        budget: "15000",
        consent: false,
      }).success,
    ).toBe(false);
  });
});
