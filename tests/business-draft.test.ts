import { describe, expect, it } from "vitest";
import { businessDraft, validateBusinessCopy } from "../packages/core/business-draft";
import { businessOutreachGate, qualifyBusiness, type BusinessEvidence } from "../packages/core/business-qualification";

const facts = { name: "Kothrud Dental Care", category: "dentist", city: "Pune", country: "IN", website: null };

describe("local business drafts", () => {
  it("uses listed facts and invites a call without pricing", () => {
    const draft = businessDraft(facts, "Pushkar");
    expect(draft.subject).toBe("Could patients request an appointment at Kothrud Dental Care?");
    expect(draft.body).toContain("didn’t see a website linked there");
    expect(draft.body).not.toMatch(/₹|5,999|pricing|leave it there/i);
    expect(draft.body).toContain("custom websites and applications");
    expect(draft.body).toContain("short call");
    expect(draft.body).toContain("Let's set up a short call to explore your requirements and discuss how we can tailor our solutions to your business.");
    expect(draft.body).not.toContain("Feel free to book");
    expect(draft.body).toContain("unsubscribe");
    expect(draft.body).not.toMatch(/ratings|reviews|customer feedback/);
    expect(draft.html).toContain('src="cid:leadflow-signature"');
  });

  it("omits directory rating hooks and pricing abroad", () => {
    const draft = businessDraft({ ...facts, name: "Dental <Practice>", country: "GB", rating_count: 324 }, "Aditya");
    expect(draft.subject).not.toContain("324 ratings");
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
      question: "Would you be open to a short call about how your team handles bookings?",
    };
    expect(businessDraft(facts, "Pushkar", copy).subject).toBe(copy.subject);
    expect(businessDraft(facts, "Pushkar", copy).body).toContain(copy.proposal);
    expect(businessDraft(facts, "Pushkar", copy).body).toContain("a short call to explore your requirements");
    expect(businessDraft(facts, "Pushkar", copy).body).not.toContain(copy.question);
    expect(validateBusinessCopy({...copy, subject: "RE: Kothrud Dental Care"}, facts)).toBeUndefined();
    expect(validateBusinessCopy({...copy, subject: "A website idea for Kothrud Dental Care"}, facts)).toBeUndefined();
    expect(validateBusinessCopy({...copy, subject: "Kothrud Dental Care Pune appointments"}, facts)).toBeUndefined();
    expect(validateBusinessCopy({...copy, proposal: "We could streamline your operations to improve efficiency."}, facts)).toBeUndefined();
    expect(validateBusinessCopy({...copy, question: "Could you send a sketch of the page you need?"}, facts)).toBeUndefined();
    expect(validateBusinessCopy({...copy, proposal: "We could help now that you are losing 30 customers every week."}, facts)).toBeUndefined();
  });

  it("includes the configured Calendly booking link with friendly HTML text and a plain-text URL", () => {
    const bookingUrl = "https://calendly.com/leadflow/intro?utm_source=email&month=2026-11";
    const draft = businessDraft({ ...facts, bookingUrl, meetingCity: "Pune" }, "Pushkar");
    expect(draft.body).toContain(`Feel free to book a time that works best for you.\n${bookingUrl}`);
    expect(draft.body).toContain("meeting in Pune");
    expect(draft.html).toContain('<a href="https://calendly.com/leadflow/intro?utm_source=email&amp;month=2026-11">Feel free to book a time that works best for you.</a>');
    expect(draft.html).not.toMatch(/<iframe|<script/);
  });

  it.each(["http://calendly.com/leadflow/intro", "https://calendly.com.example.test/intro",
    "https://calendly.com@evil.example/intro", "https://user@calendly.com/leadflow/intro",
    "https://calendly.com:9000/team/intro", "https://calendly.com/"])("omits an invalid booking URL %s", bookingUrl => {
    const draft = businessDraft({ ...facts, bookingUrl }, "Pushkar");
    expect(draft.body).not.toContain("Feel free to book");
    expect(draft.html).not.toContain(bookingUrl);
  });
});

describe("business outreach qualification", () => {
  it("requires positive evidence, distinguishes contact and holds parent or expired evidence", () => {
    const now = Date.parse("2026-11-24T00:00:00Z");
    const listing = qualifyBusiness({name: "Local Studio", website: null});
    const evidence: BusinessEvidence = {
      ownership:"locally_controlled", websiteStatus:"official_site", ownershipUrl:"https://example.com/about",
      opportunityUrl:"https://example.com/services", opportunity:"The public class schedule is available on a PDF.",
      verifiedAt:new Date(now).toISOString(),
    };
    expect(businessOutreachGate(listing)).toMatchObject({status:"review",contactable:false});
    expect(businessOutreachGate(listing,evidence,now)).toMatchObject({status:"qualified",contactable:false});
    expect(businessOutreachGate(listing,{...evidence,contactUrl:"https://example.com/contact"},now)).toMatchObject({status:"qualified",contactable:true});
    expect(businessOutreachGate(listing,{...evidence,websiteStatus:"not_listed"},now).status).toBe("review");
    expect(businessOutreachGate(listing,{...evidence,websiteStatus:"parent_site"},now).status).toBe("review");
    expect(businessOutreachGate(listing,evidence,now+31*86400000).status).toBe("review");
    expect(businessOutreachGate(qualifyBusiness({name:"Domino’s",website:null}),evidence,now).status).toBe("excluded");
  });
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

it("keeps an existing-site improvement scoped and omits starter pricing",()=>{
  const draft=businessDraft({...facts,website:"https://example.com",opportunity:"The business already publishes a PDF menu.",
    serviceIdea:"We could turn the menu into a searchable page."},"LeadFlow AI");
  expect(draft.body).toContain("turn the menu into a searchable page");
  expect(draft.body).not.toContain("₹5,999");
  expect(draft.body).not.toContain("—");
});

it("removes an older stored pricing subject, offer and defensive closing",()=>{
  const draft=businessDraft({...facts,subjectIdea:"Packages start at ₹5,999",opportunity:"If this isn't relevant, we'll leave it there.",
    serviceIdea:"We could build your website, starting at 5999 INR.",meetingCity:"Pune"},"Pushkar");
  for(const copy of [draft.subject,draft.body,draft.html,...draft.alternatives])expect(copy).not.toMatch(/5,999|5999|₹|leave it there|package rates/);
  expect(draft.body).toContain("meeting in Pune");
});
