import { describe, expect, it } from "vitest";
import { hash } from "../packages/core/model";
import { externalToLead } from "../apps/automation/external-leads";
import {
  canonicalEvidence,
  discoveryContextSchema,
  locateEvidence,
  validateQualificationEvidence,
  prefilterDiscovery,
  extractRuleEvidence,
  scoreFreelanceQualification,
  type QualificationRecord,
  type DiscoveryContext,
} from "../packages/core/qualification";

const NOW = "2026-11-16T00:00:00.000Z";

const baseRow = {
  source: "hackernews",
  source_id: "12345",
  category: "freelance_request",
  name: "public-handle",
  title: "Truncated headline",
  url: "https://example.com/untrusted",
  found_at: NOW,
};

const baseItem = {
  id: 12345,
  type: "comment",
  time: Date.parse(NOW) / 1000,
  text: "SEEKING FREELANCER: We need a React website developer for a fixed scope project.",
};

describe("Stage B: HN discovery evidence preservation", () => {
  it("decodes HTML entities exactly once and keeps raw_text untouched", () => {
    const text =
      "SEEKING FREELANCER: Fish &amp; Chips &lt;b&gt;bold&lt;/b&gt; &#65;&#x42; &quot;quoted&quot; &apos;single&apos; &nbsp;end";
    const lead = externalToLead(baseRow, { ...baseItem, text });
    const context = lead.discovery_context!;
    expect(context.decoded_text).toContain(
      `Fish & Chips <b>bold</b> AB "quoted" 'single'`,
    );
    // Entities must not be double-decoded: &amp;lt; stays &lt; after one pass.
    expect(context.decoded_text).not.toContain("&amp;");
    expect(context.raw_text).toBe(text);
    expect(context.raw_text).toContain("&amp;");
    expect(context.raw_text).toContain("&lt;b&gt;");
  });

  it("preserves paragraph breaks from <p> and <br> markup", () => {
    const text =
      "SEEKING FREELANCER:<p>First para</p><p>Second para<br>line two</p>";
    const lead = externalToLead(baseRow, { ...baseItem, text });
    const context = lead.discovery_context!;
    expect(context.decoded_text).toContain(
      "First para\n\nSecond para\nline two",
    );
  });

  it("retains safe href targets (http/https, no credentials) before markup removal", () => {
    const text =
      'SEEKING FREELANCER: apply <a href="https://example.com/apply?a=1&amp;b=2">here</a> ' +
      "or <a href='http://example.com/form'>form</a> " +
      '<a href="https://user:pass@example.com/x">creds</a> ' +
      '<a href="javascript:alert(1)">js</a>';
    const lead = externalToLead(baseRow, { ...baseItem, text });
    const context = lead.discovery_context!;
    expect(context.contact_link_targets).toEqual([
      "https://example.com/apply?a=1&b=2",
      "http://example.com/form",
    ]);
  });

  it("rejects credential-bearing URLs in contact_link_targets at the schema boundary", () => {
    const lead = externalToLead(baseRow, baseItem);
    const context = lead.discovery_context!;
    expect(() =>
      discoveryContextSchema.parse({
        ...context,
        contact_link_targets: ["https://user:pass@example.com/x"],
      }),
    ).toThrow();
  });

  it("preserves parent and thread metadata when a thread is supplied", () => {
    const thread = {
      id: 999,
      title: "Ask HN: Freelancer?",
      time: Date.parse("2026-11-01T00:00:00.000Z") / 1000,
    };
    const lead = externalToLead(baseRow, { ...baseItem, parent: 999 }, thread);
    const context = lead.discovery_context!;
    expect(context.parent_id).toBe("999");
    expect(context.thread_id).toBe("999");
    expect(context.thread_title).toBe("Ask HN: Freelancer?");
    expect(context.thread_date).toBe("2026-11-01T00:00:00.000Z");
  });

  it("leaves thread fields empty/null when no thread is available", () => {
    const lead = externalToLead(baseRow, { ...baseItem, parent: 999 });
    const context = lead.discovery_context!;
    expect(context.parent_id).toBe("999");
    expect(context.thread_id).toBe("");
    expect(context.thread_title).toBe("");
    expect(context.thread_date).toBeNull();
  });

  it("preserves dead and deleted flags as booleans", () => {
    expect(
      externalToLead(baseRow, { ...baseItem, dead: true }).discovery_context
        ?.dead,
    ).toBe(true);
    expect(
      externalToLead(baseRow, { ...baseItem, deleted: true }).discovery_context
        ?.deleted,
    ).toBe(true);
    const clean = externalToLead(baseRow, baseItem).discovery_context!;
    expect(clean.dead).toBe(false);
    expect(clean.deleted).toBe(false);
  });

  it("flags decoded_text longer than 12,000 characters as truncated and incomplete", () => {
    const longText = "SEEKING FREELANCER: " + "x".repeat(13000);
    const lead = externalToLead(baseRow, { ...baseItem, text: longText });
    const context = lead.discovery_context!;
    expect(context.truncated).toBe(true);
    expect(context.complete).toBe(false);
    expect(context.decoded_text.length).toBe(12000);
    // Under the 20,000-char raw cap the original is preserved intact.
    expect(context.raw_text).toBe(longText);
  });

  it("caps raw_text at 20,000 characters without overwriting it", () => {
    const hugeText = "SEEKING FREELANCER: " + "y".repeat(21000);
    const lead = externalToLead(baseRow, { ...baseItem, text: hugeText });
    const context = lead.discovery_context!;
    expect(context.raw_text.length).toBe(20000);
    expect(context.raw_text).toBe(hugeText.slice(0, 20000));
    expect(context.truncated).toBe(true);
  });

  it("computes source_hash from the raw text", () => {
    const lead = externalToLead(baseRow, baseItem);
    const context = lead.discovery_context!;
    expect(context.source_hash).toBe(hash(baseItem.text));
  });

  it("derives published_at from item.time, or null when absent", () => {
    const withTime = externalToLead(baseRow, baseItem);
    expect(withTime.posted_at).toBe(NOW);
    expect(withTime.discovery_context?.published_at).toBe(NOW);

    const itemNoTime = {
      id: baseItem.id,
      type: baseItem.type,
      text: baseItem.text,
    };
    const withoutTime = externalToLead(baseRow, itemNoTime);
    expect(withoutTime.posted_at).toBeUndefined();
    expect(withoutTime.discovery_context?.published_at).toBeNull();
  });

  it("keeps the provider category as an untrusted tag hint", () => {
    const lead = externalToLead(baseRow, baseItem);
    expect(lead.discovery_context?.tags).toContain("freelance_request");
  });

  it("produces a discovery_context that round-trips through the schema", () => {
    const lead = externalToLead(baseRow, baseItem);
    expect(() =>
      discoveryContextSchema.parse(lead.discovery_context),
    ).not.toThrow();
  });

  it("does not attach discovery_context to non-HN sources", () => {
    const lead = externalToLead({
      ...baseRow,
      source: "arbeitnow",
      source_id: "company-job",
      category: "company_hiring",
      name: "Company",
      title: "React engineer",
    });
    expect(lead.discovery_context).toBeUndefined();
  });
});

describe("Stage B: evidence offset validation", () => {
  const lead = externalToLead(baseRow, baseItem);
  const context = lead.discovery_context!;
  const text = canonicalEvidence(context);

  it("builds the canonical evidence string as title + blank line + decoded body", () => {
    expect(text).toBe(`${context.original_title}\n\n${context.decoded_text}`);
  });

  it("locates a quote at exact UTF-16 offsets", () => {
    const quote = "SEEKING FREELANCER";
    const { start, end } = locateEvidence(text, quote);
    expect(text.slice(start, end)).toBe(quote);
  });

  it("disambiguates repeated spans with an occurrence index", () => {
    expect(locateEvidence("abc abc abc", "abc", 0)).toEqual({
      start: 0,
      end: 3,
    });
    expect(locateEvidence("abc abc abc", "abc", 2)).toEqual({
      start: 8,
      end: 11,
    });
    expect(() => locateEvidence("abc abc abc", "abc", 3)).toThrow();
  });

  it("accepts a record whose evidence matches the source exactly", () => {
    const quote = "SEEKING FREELANCER";
    const { start, end } = locateEvidence(text, quote);
    const record = {
      evidence_quotes: [{ field: "intent", quote, start, end }],
    } as QualificationRecord;
    expect(() => validateQualificationEvidence(record, context)).not.toThrow();
  });

  it("rejects evidence whose offsets do not match the quote", () => {
    const quote = "SEEKING FREELANCER";
    const { start, end } = locateEvidence(text, quote);
    const shifted = {
      evidence_quotes: [
        { field: "intent", quote, start: start + 1, end: end + 1 },
      ],
    } as QualificationRecord;
    expect(() => validateQualificationEvidence(shifted, context)).toThrow();
  });

  it("rejects evidence whose quote is absent from the source", () => {
    const { start, end } = locateEvidence(text, "SEEKING FREELANCER");
    const missing = {
      evidence_quotes: [
        { field: "intent", quote: "NOT PRESENT IN SOURCE", start, end },
      ],
    } as QualificationRecord;
    expect(() => validateQualificationEvidence(missing, context)).toThrow();
  });
});

/* ================================================================== */
/* Stage C helpers                                                      */
/* ================================================================== */

function makeCtx(
  title: string,
  body: string,
  overrides: Partial<DiscoveryContext> = {},
): DiscoveryContext {
  return discoveryContextSchema.parse({
    provider: "hackernews",
    provider_record_id: "test-" + hash(title + body),
    original_url: "https://news.ycombinator.com/item?id=99999",
    item_type: "comment",
    author_handle: "test-author",
    original_title: title,
    raw_text: body,
    decoded_text: body,
    published_at: NOW,
    collected_at: NOW,
    fetched_at: NOW,
    source_hash: hash(body || title || "empty"),
    ...overrides,
  });
}

function classify(
  title: string,
  body: string,
  overrides: Partial<DiscoveryContext> = {},
) {
  const ctx = makeCtx(title, body, overrides);
  const ev = extractRuleEvidence(canonicalEvidence(ctx), ctx);
  return scoreFreelanceQualification(ev, ctx, NOW);
}

/* ================================================================== */
/* Stage C — Section 9 concrete acceptance cases                        */
/* ================================================================== */

describe("Stage C: Section 9 acceptance cases", () => {
  it("Case 1: full React contractor fixed-price project is HIGH 100", () => {
    const { record, audit } = classify(
      "",
      "We need an independent React contractor to deliver our checkout with Stripe integration and tests. Fixed budget USD 4,000. Deadline in four weeks. Apply using this form: https://example.com/apply.",
    );
    expect(record.is_valid_freelance_lead).toBe(true);
    expect(record.eligibility_state).toBe("ELIGIBLE");
    expect(record.lead_type).toBe("CLIENT_PROJECT");
    expect(record.engagement_type).toBe("FIXED_PROJECT");
    expect(record.requester_type).not.toBe("FREELANCER_SELLER");
    expect(record.budget_signal.kind).toBe("AMOUNT_STATED");
    expect(record.priority).toBe("HIGH");
    expect(record.quality_score).toBe(100);
    expect(record.confidence_score).toBe(0.95);
    expect(record.rejection_reason).toBeNull();
    expect(audit.method).toBe("rules");
    // Verify exact breakdown: 20+15+20+15+5+10+10+5 = 100
    expect(audit.breakdown.buyer_demand).toBe(20);
    expect(audit.breakdown.engagement).toBe(15);
    expect(audit.breakdown.paid_intent).toBe(20);
    expect(audit.breakdown.scope).toBe(15);
    expect(audit.breakdown.service_fit).toBe(5);
    expect(audit.breakdown.timeline).toBe(10);
    expect(audit.breakdown.contact_path).toBe(10);
    expect(audit.breakdown.freshness).toBe(5);
  });

  it("Case 2: paid freelancer Python API rate negotiable is MEDIUM 80", () => {
    const { record, audit } = classify(
      "",
      "Seeking a paid freelancer to improve our Python API performance. Rates negotiable. Email engineering@example.com.",
    );
    expect(record.is_valid_freelance_lead).toBe(true);
    expect(record.eligibility_state).toBe("ELIGIBLE");
    expect(record.priority).toBe("MEDIUM");
    expect(record.quality_score).toBe(80);
    expect(record.rejection_reason).toBeNull();
    // 20+15+15+10+5+0+10+5 = 80
    expect(audit.breakdown.buyer_demand).toBe(20);
    expect(audit.breakdown.engagement).toBe(15);
    expect(audit.breakdown.paid_intent).toBe(15);
    expect(audit.breakdown.scope).toBe(10);
    expect(audit.breakdown.service_fit).toBe(5);
    expect(audit.breakdown.timeline).toBe(0);
    expect(audit.breakdown.contact_path).toBe(10);
    expect(audit.breakdown.freshness).toBe(5);
  });

  it("Case 3: bare independent React contractor hiring is LOW 60 COMMERCIAL_HIRING", () => {
    const { record, audit } = classify(
      "",
      "We are hiring an independent React contractor.",
    );
    expect(record.is_valid_freelance_lead).toBe(true);
    expect(record.eligibility_state).toBe("ELIGIBLE");
    expect(record.lead_type).toBe("CONTRACT_ROLE");
    expect(record.budget_signal.kind).toBe("COMMERCIAL_HIRING");
    expect(record.priority).toBe("LOW");
    expect(record.quality_score).toBe(60);
    expect(record.confidence_score).toBe(0.85);
    expect(record.rejection_reason).toBeNull();
    // 20+15+10+5+5+0+0+5 = 60
    expect(audit.breakdown.buyer_demand).toBe(20);
    expect(audit.breakdown.engagement).toBe(15);
    expect(audit.breakdown.paid_intent).toBe(10);
    expect(audit.breakdown.scope).toBe(5);
    expect(audit.breakdown.service_fit).toBe(5);
    expect(audit.breakdown.timeline).toBe(0);
    expect(audit.breakdown.contact_path).toBe(0);
    expect(audit.breakdown.freshness).toBe(5);
  });

  it("Case 4: agency subcontracting WordPress site with USD 2000 is HIGH 100", () => {
    const { record } = classify(
      "",
      "Our agency needs a paid subcontractor to migrate one WordPress site including redirect tests. USD 2,000 fixed fee; finish this month; reply by email to agency@example.com.",
    );
    expect(record.is_valid_freelance_lead).toBe(true);
    expect(record.eligibility_state).toBe("ELIGIBLE");
    expect(record.requester_type).toBe("AGENCY_BUYER");
    expect(record.engagement_type).toBe("FIXED_PROJECT");
    expect(record.priority).toBe("HIGH");
    expect(record.quality_score).toBe(100);
  });

  it("Case 5: startup fractional CTO flexible start DM is HIGH 85", () => {
    const { record, audit } = classify(
      "",
      "Our startup seeks a paid fractional CTO for architecture consulting. Flexible start, DM me here.",
    );
    expect(record.is_valid_freelance_lead).toBe(true);
    expect(record.eligibility_state).toBe("ELIGIBLE");
    expect(record.requester_type).toBe("FOUNDER");
    expect(record.priority).toBe("HIGH");
    expect(record.quality_score).toBe(85);
    // 20+15+15+10+5+5+10+5 = 85
    expect(audit.breakdown.buyer_demand).toBe(20);
    expect(audit.breakdown.engagement).toBe(15);
    expect(audit.breakdown.paid_intent).toBe(15);
    expect(audit.breakdown.scope).toBe(10);
    expect(audit.breakdown.service_fit).toBe(5);
    expect(audit.breakdown.timeline).toBe(5);
    expect(audit.breakdown.contact_path).toBe(10);
    expect(audit.breakdown.freshness).toBe(5);
  });

  it("Case 6: Sendery iOS full-time salary job posting is REJECTED FULL_TIME_ONLY", () => {
    const { record } = classify(
      "Sendery | iOS Engineer | Tokyo | Full-time, salary and benefits.",
      "Sendery | iOS Engineer | Tokyo | Full-time, salary and benefits.",
    );
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(record.eligibility_state).toBe("REJECTED");
    expect(record.rejection_reason).toBe("FULL_TIME_ONLY");
    expect(record.quality_score).toBe(0);
    expect(record.priority).toBe("REJECTED");
  });

  it("Case 7: Clad Software Engineer full-time employment only is REJECTED FULL_TIME_ONLY", () => {
    const { record } = classify(
      "Clad | Software Engineer | NYC.",
      "Clad | Software Engineer | NYC. Full-time employment only.",
    );
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(record.eligibility_state).toBe("REJECTED");
    expect(record.rejection_reason).toBe("FULL_TIME_ONLY");
    expect(record.quality_score).toBe(0);
  });

  it("Case 8: job title with no body is REVIEW_INCOMPLETE INSUFFICIENT_CONTEXT", () => {
    const { record } = classify(
      "Clad | Software Engineer | NYC.",
      "",
    );
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(record.eligibility_state).toBe("REVIEW_INCOMPLETE");
    expect(record.rejection_reason).toBe("INSUFFICIENT_CONTEXT");
    expect(record.quality_score).toBe(0);
  });

  it("Case 9: seller available for projects is REJECTED SELLER_SELF_PROMOTION", () => {
    const { record } = classify(
      "",
      "Location: Estonia. I am available for projects. Technologies: React.js.",
    );
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(record.eligibility_state).toBe("REJECTED");
    expect(record.requester_type).toBe("FREELANCER_SELLER");
    expect(record.rejection_reason).toBe("SELLER_SELF_PROMOTION");
    expect(record.quality_score).toBe(0);
  });

  it("Case 10: SEEKING FREELANCE seller with rate is REJECTED SELLER_SELF_PROMOTION", () => {
    const { record } = classify(
      "SEEKING FREELANCE",
      "SEEKING FREELANCE -- Egypt. React developer, USD 50/hour. Contact me.",
    );
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(record.eligibility_state).toBe("REJECTED");
    expect(record.rejection_reason).toBe("SELLER_SELF_PROMOTION");
    expect(record.quality_score).toBe(0);
  });

  it("Case 11: SEEKING FREELANCER unpaid volunteer is REJECTED UNPAID_OR_EQUITY_ONLY", () => {
    const { record } = classify(
      "",
      "SEEKING FREELANCER. Need a logo for a volunteer event; unpaid.",
    );
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(record.eligibility_state).toBe("REJECTED");
    expect(record.rejection_reason).toBe("UNPAID_OR_EQUITY_ONLY");
    expect(record.quality_score).toBe(0);
  });

  it("Case 12: cofounder equity-only is REJECTED UNPAID_OR_EQUITY_ONLY", () => {
    const { record } = classify(
      "",
      "We need a cofounder to build our app for equity only.",
    );
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(record.eligibility_state).toBe("REJECTED");
    expect(record.rejection_reason).toBe("UNPAID_OR_EQUITY_ONLY");
    expect(record.quality_score).toBe(0);
  });

  it("Case 13: product promotion newsletter is REJECTED NO_CLIENT_NEED", () => {
    const { record } = classify(
      "",
      "Our product makes SEO easy. Join our newsletter.",
    );
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(record.eligibility_state).toBe("REJECTED");
    expect(record.rejection_reason).toBe("NO_CLIENT_NEED");
    expect(record.quality_score).toBe(0);
  });

  it("Case 14: aggregator 50 jobs listing is REJECTED AGGREGATOR_ONLY", () => {
    const { record } = classify(
      "",
      "Here are 50 remote developer jobs.",
    );
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(record.eligibility_state).toBe("REJECTED");
    expect(record.rejection_reason).toBe("AGGREGATOR_ONLY");
    expect(record.quality_score).toBe(0);
  });

  it("Case 15: Need React help is REVIEW_INCOMPLETE ENGAGEMENT_UNCLEAR", () => {
    const { record } = classify(
      "",
      "Need React help.",
    );
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(record.eligibility_state).toBe("REVIEW_INCOMPLETE");
    expect(record.rejection_reason).toBe("ENGAGEMENT_UNCLEAR");
    expect(record.quality_score).toBe(0);
    expect(record.priority).toBe("REJECTED");
  });

  it("Case 16: six-month employee payroll contract is REJECTED EMPLOYMENT_CONTRACT_ONLY", () => {
    const { record } = classify(
      "",
      "We need a six-month developer on employee payroll; contract position.",
    );
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(record.eligibility_state).toBe("REJECTED");
    expect(record.rejection_reason).toBe("EMPLOYMENT_CONTRACT_ONLY");
    expect(record.quality_score).toBe(0);
  });

  it("Case 17: mixed post isolated contract unit is ELIGIBLE HIGH 85", () => {
    const { record, audit } = classify(
      "",
      "We hire full-time; alternatively an independent paid contractor can deliver only the React checkout with integration tests. Email us.",
    );
    expect(record.is_valid_freelance_lead).toBe(true);
    expect(record.eligibility_state).toBe("ELIGIBLE");
    expect(record.priority).toBe("HIGH");
    expect(record.quality_score).toBe(85);
    // 20+15+15+15+5+0+10+5 = 85
    expect(audit.breakdown.buyer_demand).toBe(20);
    expect(audit.breakdown.engagement).toBe(15);
    expect(audit.breakdown.paid_intent).toBe(15);
    expect(audit.breakdown.scope).toBe(15);
    expect(audit.breakdown.service_fit).toBe(5);
    expect(audit.breakdown.timeline).toBe(0);
    expect(audit.breakdown.contact_path).toBe(10);
    expect(audit.breakdown.freshness).toBe(5);
  });

  it("Case 18: negated unpaid paid independent Python contractor is ELIGIBLE MEDIUM 80", () => {
    const { record } = classify(
      "",
      "Not seeking unpaid collaboration. We need a paid independent Python contractor to optimize our API; reply here.",
    );
    expect(record.is_valid_freelance_lead).toBe(true);
    expect(record.eligibility_state).toBe("ELIGIBLE");
    expect(record.priority).toBe("MEDIUM");
    expect(record.quality_score).toBe(80);
  });

  it("Case 19: stale post 45 days old is REJECTED STALE_OR_CLOSED", () => {
    const staleDate = new Date(Date.parse(NOW) - 45 * 86400000).toISOString();
    const { record } = classify(
      "",
      "We need an independent React contractor to deliver our checkout with Stripe integration and tests. Fixed budget USD 4,000. Deadline in four weeks. Apply using this form: https://example.com/apply.",
      { published_at: staleDate },
    );
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(record.eligibility_state).toBe("REJECTED");
    expect(record.rejection_reason).toBe("STALE_OR_CLOSED");
    expect(record.quality_score).toBe(0);
  });

  it("Case 20: no publication date eligible LOW capped at 64", () => {
    const { record } = classify(
      "",
      "We need an independent React contractor to deliver our checkout with Stripe integration and tests. Fixed budget USD 4,000. Deadline in four weeks. Apply using this form: https://example.com/apply.",
      { published_at: null },
    );
    expect(record.is_valid_freelance_lead).toBe(true);
    expect(record.eligibility_state).toBe("ELIGIBLE");
    expect(record.priority).toBe("LOW");
    expect(record.quality_score).toBe(64);
  });
});

/* ================================================================== */
/* Stage C — Mandatory gate invariants                                  */
/* ================================================================== */

describe("Stage C: mandatory gate invariants", () => {
  it("adding technology keywords cannot promote a gate failure", () => {
    const { record } = classify(
      "",
      "SEEKING FREELANCE -- I am available. React, TypeScript, Node.js, Python, API, iOS, Swift, Java, WordPress, automation.",
    );
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(record.rejection_reason).toBe("SELLER_SELF_PROMOTION");
    expect(record.quality_score).toBe(0);
  });

  it("seller rate does not change direction", () => {
    const { record } = classify(
      "",
      "I am available for projects. USD 100/hour. React developer. Contact me.",
    );
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(record.rejection_reason).toBe("SELLER_SELF_PROMOTION");
  });

  it("non-eligible records always have score=0 and priority=REJECTED", () => {
    const cases = [
      "SEEKING FREELANCE -- developer available",
      "Full-time iOS engineer, salary and benefits",
      "Here are 50 remote developer jobs",
      "Build our app for equity only",
    ];
    for (const text of cases) {
      const { record } = classify("", text);
      expect(record.quality_score).toBe(0);
      expect(record.priority).toBe("REJECTED");
      expect(record.is_valid_freelance_lead).toBe(false);
    }
  });

  it("eligible records have evidence for mandatory intent and payment fields", () => {
    const { record } = classify(
      "",
      "We need an independent React contractor to deliver our checkout. Fixed budget USD 4,000. Deadline in four weeks.",
    );
    expect(record.is_valid_freelance_lead).toBe(true);
    const fields = new Set(record.evidence_quotes.map((q) => q.field));
    expect(fields.has("intent")).toBe(true);
    expect(fields.has("payment")).toBe(true);
  });

  it("prefilterDiscovery rejects non-allowed sources", () => {
    const ctx = makeCtx("test", "test body", { provider: "arbeitnow" });
    const result = prefilterDiscovery(ctx, NOW);
    expect(result.pass).toBe(false);
    expect(result.reason).toBe("SOURCE_NOT_ALLOWED");
  });

  it("prefilterDiscovery rejects dead posts", () => {
    const ctx = makeCtx("test", "test body", { dead: true });
    const result = prefilterDiscovery(ctx, NOW);
    expect(result.pass).toBe(false);
    expect(result.reason).toBe("SOURCE_UNAVAILABLE");
  });

  it("prefilterDiscovery passes fresh valid sources", () => {
    const ctx = makeCtx("test", "test body");
    const result = prefilterDiscovery(ctx, NOW);
    expect(result.pass).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("clause-level: No unpaid work seeking a paid contractor is eligible", () => {
    const { record } = classify(
      "",
      "No unpaid work; seeking a paid contractor for our React project. Reply here.",
    );
    expect(record.is_valid_freelance_lead).toBe(true);
    expect(record.rejection_reason).toBeNull();
    expect(record.eligibility_state).toBe("ELIGIBLE");
  });

  it("evidence quotes validate against canonical text with exact offsets", () => {
    const ctx = makeCtx("Title", "We need an independent React contractor.");
    const ev = extractRuleEvidence(canonicalEvidence(ctx), ctx);
    const { record } = scoreFreelanceQualification(ev, ctx, NOW);
    const canonical = canonicalEvidence(ctx);
    for (const eq of record.evidence_quotes) {
      expect(canonical.slice(eq.start, eq.end)).toBe(eq.quote);
    }
  });
});

/* ================================================================== */
/* Stage C — Job posting rejection                                      */
/* ================================================================== */

describe("Stage C: job posting rejection patterns", () => {
  it.each([
    {
      label: "Sendery iOS contract opening",
      title:
        "Sendery ( https://sendery.co ) | iOS Engineer | Tokyo, Japan | Contract",
      body:
        "We're currently looking for a capable iOS Engineer to join our team as we build out our mobile stack. Applicants should send a resume and GitHub to jobs@sendery.co.",
      reason: "EMPLOYMENT_CONTRACT_ONLY",
    },
    {
      label: "Clad Software Engineer opening",
      title: "Clad (YC W23) | Software Engineer | NYC | withclad.com",
      body:
        "Clad is an AI-native platform for utility construction. We are hiring a Software Engineer to join our team. Apply with your resume.",
      reason: "FULL_TIME_ONLY",
    },
    {
      label: "Estonia seller availability post",
      title: "Location: Estonia Remote: Yes Technologies: React.js, Vue.js",
      body:
        "Location: Estonia. Remote: Yes. Technologies: React.js, Vue.js. I am available for freelance work and projects.",
      reason: "SELLER_SELF_PROMOTION",
    },
    {
      label: "Collabify fixed-term contract role",
      title:
        "Collabify | Senior Full-Stack Engineer | Remote | Contract, 4–5 months | $3,000–4,000/month",
      body:
        "We're looking for a Senior Full-Stack Engineer to join our team on a 4–5 month contract. Apply by email.",
      reason: "EMPLOYMENT_CONTRACT_ONLY",
    },
    {
      label: "Egypt SEEKING FREELANCE seller post",
      title:
        "SEEKING FREELANCE - Egypt (UTC+2) - Remote Senior Full-Stack & Creative Frontend Engineer",
      body:
        "SEEKING FREELANCE - Egypt. Senior Full-Stack Engineer with React and TypeScript. I am available for projects.",
      reason: "SELLER_SELF_PROMOTION",
    },
  ] as const)(
    "rejects $label with $reason",
    ({ title, body, reason }) => {
      const { record } = classify(title, body);
      expect(record.is_valid_freelance_lead).toBe(false);
      expect(record.eligibility_state).toBe("REJECTED");
      expect(record.rejection_reason).toBe(reason);
    },
  );

  it("does not mistake a negated job opening for employment when an independent project is explicit", () => {
    const { record } = classify(
      "Acme | Software Engineer | Remote",
      "We are not hiring a full-time engineer. We need an independent React contractor to deliver a fixed-scope checkout. Fixed budget USD 2,000; reply by email.",
    );
    expect(record.is_valid_freelance_lead).toBe(true);
    expect(record.eligibility_state).toBe("ELIGIBLE");
  });

  it.each([
    "Acme | Senior Software Engineer | San Francisco | Full-time",
    "Startup | iOS Engineer | Remote | Competitive salary",
    "Corp | Full-Stack Engineer | NYC | Benefits included",
    "Company | Backend Engineer | Berlin | Visa sponsorship",
  ])("rejects classic job posting: %s", (title) => {
    const { record } = classify(title, title);
    expect(record.is_valid_freelance_lead).toBe(false);
    expect(["FULL_TIME_ONLY", "EMPLOYMENT_CONTRACT_ONLY"]).toContain(
      record.rejection_reason,
    );
    expect(record.quality_score).toBe(0);
  });
});
