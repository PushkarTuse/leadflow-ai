import { describe, expect, it } from "vitest";
import { businessDraft } from "../packages/core/business-draft";

const facts = { name: "Kothrud Dental Care", category: "dentist", city: "Pune", country: "IN", website: null };

describe("local business drafts", () => {
  it("uses listed facts, booking language and local pricing", () => {
    const draft = businessDraft(facts, "Pushkar");
    expect(draft.subject).toBe("A simpler way to book with Kothrud Dental Care");
    expect(draft.body).toContain("didn’t see a website linked there");
    expect(draft.body).toContain("₹5,999");
    expect(draft.body).toContain("custom websites and apps");
    expect(draft.body).not.toMatch(/ratings|reviews|customer feedback/);
    expect(draft.html).toContain('src="cid:leadflow-signature"');
  });

  it("uses a verified rating count when present and omits Indian pricing abroad", () => {
    const draft = businessDraft({ ...facts, name: "Dental <Practice>", country: "GB", rating_count: 324 }, "Aditya");
    expect(draft.subject).toContain("324 ratings");
    expect(draft.body).not.toContain("₹");
    expect(draft.html).toContain("Dental &lt;Practice&gt;");
    expect(draft.body).toContain("Aditya");
  });

  it("avoids claiming a site is missing when one is listed", () => {
    const draft = businessDraft({ ...facts, category: "accountant", website: "https://example.com" }, "LeadFlow AI");
    expect(draft.body).toContain("review your mobile enquiry flow");
    expect(draft.body).not.toContain("didn’t see a website linked");
  });
});
