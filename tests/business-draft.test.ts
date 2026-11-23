import { describe, expect, it } from "vitest";
import { businessDraft, validateBusinessCopy } from "../packages/core/business-draft";
import { qualifyBusiness } from "../packages/core/business-qualification";

const facts = { name: "Kothrud Dental Care", category: "dentist", city: "Pune", country: "IN", website: null };

describe("local business drafts", () => {
  it("uses listed facts, booking language and local pricing", () => {
    const draft = businessDraft(facts, "Pushkar");
    expect(draft.subject).toBe("Kothrud Dental Care: from Maps to an appointment");
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
    expect(draft.body).toContain("walk through the listed site on mobile");
    expect(draft.body).not.toContain("didn’t see a website linked");
  });

  it("renders a grounded AI subject and proposal, and drops unsupported claims", () => {
    const copy = {
      subject: "Can patients book from Kothrud Dental Care’s listing?",
      proposal: "We could put treatment details, hours and a WhatsApp booking request on a single mobile page.",
      question: "Would you like us to sketch that page?",
    };
    expect(businessDraft(facts, "Pushkar", copy).subject).toBe(copy.subject);
    expect(businessDraft(facts, "Pushkar", copy).body).toContain(copy.proposal);
    expect(validateBusinessCopy({...copy, subject: "RE: Kothrud Dental Care"}, facts)).toBeUndefined();
    expect(validateBusinessCopy({...copy, subject: "A website idea for Kothrud Dental Care"}, facts)).toBeUndefined();
    expect(validateBusinessCopy({...copy, subject: "Kothrud Dental Care Pune appointments"}, facts)).toBeUndefined();
    expect(validateBusinessCopy({...copy, proposal: "We could streamline your operations to improve efficiency."}, facts)).toBeUndefined();
    expect(validateBusinessCopy({...copy, question: "Could you send a sketch of the page you need?"}, facts)).toBeUndefined();
    expect(validateBusinessCopy({...copy, proposal: "We could help now that you are losing 30 customers every week."}, facts)).toBeUndefined();
  });
});

describe("business outreach qualification", () => {
  it.each(["Domino's Pizza Pune", "McDonald’s", "Starbucks Coffee"])("excludes the branch %s even with no website", name => {
    expect(qualifyBusiness({name, website: null}).status).toBe("excluded");
  });

  it("checks domain boundaries, OSM brand metadata and repeated names", () => {
    expect(qualifyBusiness({name: "Local Pizza Bar", website: "https://order.dominos.co.in/branch"}).status).toBe("excluded");
    expect(qualifyBusiness({name: "Lakeview Clinic", website: null, tags: ["brand=Clove Dental"]}).status).toBe("excluded");
    expect(qualifyBusiness({name: "Lakeview Clinic", website: null, tags: ["brand:wikidata=Q123"]}).status).toBe("review");
    expect(qualifyBusiness({name: "Lakeview Clinic", website: null}, true).status).toBe("review");
    expect(qualifyBusiness({name: "Lakeview Clinic", website: "https://dominos.com.example.test/"}).status).toBe("prospect");
  });
});
