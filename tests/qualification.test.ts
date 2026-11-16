import { describe, expect, it } from "vitest";
import { hash } from "../packages/core/model";
import { externalToLead } from "../apps/automation/external-leads";
import {
  canonicalEvidence,
  discoveryContextSchema,
  locateEvidence,
  validateQualificationEvidence,
  type QualificationRecord,
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
