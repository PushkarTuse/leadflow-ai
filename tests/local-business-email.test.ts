import { describe, expect, it } from "vitest";
import { draftLocalBusinessEmail, localBusinessAngle, LocalBusinessDraftSkipped } from "../packages/core/local-business-email";

const sender = { brand: "LeadFlow AI", ownerName: "Aditya", siteUrl: "https://leadflow-agency.pages.dev", startingPrice: "₹5,999" };
const base = {
  source: "osm",
  name: "Kothrud Dental",
  title: "dentist",
  city: "Pune",
  phone: "+91 98765 43210",
  email: "hello@kothrud-dental.example",
  website: null,
  pagespeed_mobile: null,
  signal: "No website listed",
  score: 90,
  status: "new",
};

describe("local business email draft", () => {
  it("drafts a no-website email grounded in the OSM row", () => {
    const d = draftLocalBusinessEmail(base, sender);
    expect(d.angle).toBe("no_website");
    expect(d.recipient).toBe("hello@kothrud-dental.example");
    expect(d.subject).toBe("A website for Kothrud Dental?");
    expect(d.body).toContain("dentists in Pune on OpenStreetMap");
    expect(d.body).toContain("₹5,999");
    expect(d.body).toContain("https://leadflow-agency.pages.dev");
    expect(d.body).not.toMatch(/no thanks/);
  });

  it("builds an HTML version with a direct site link, logo and escaped row data", () => {
    const d = draftLocalBusinessEmail({ ...base, name: "Smile & <Co>" }, { ...sender, logoSrc: "cid:att0" });
    expect(d.html).toContain('<a href="https://leadflow-agency.pages.dev">');
    expect(d.html).not.toMatch(/style=|max-width|<strong>/);
    expect(d.html).toContain('<img src="cid:att0"');
    expect(d.html).toContain("Smile &amp; &lt;Co&gt;");
    expect(d.html).not.toContain("<Co>");
    expect(d.html).not.toMatch(/no thanks/);
    expect(draftLocalBusinessEmail(base, sender).html).not.toContain("<img");
  });

  it("uses the measured PageSpeed score for slow sites", () => {
    const d = draftLocalBusinessEmail({ ...base, website: "https://www.example-clinic.in/", pagespeed_mobile: 32, signal: "Slow website: mobile performance 32/100" }, sender);
    expect(d.angle).toBe("slow_site");
    expect(d.subject).toBe("example-clinic.in on mobile: quick note");
    expect(d.body).toContain("scored 32/100");
  });

  it("maps every upstream signal to an angle and skips good sites", () => {
    expect(localBusinessAngle({ signal: "Only a social or directory page, no own website", website: "https://instagram.com/x" })).toBe("social_only");
    expect(localBusinessAngle({ signal: "Website failed to load in Google's mobile test", website: "https://x.in" })).toBe("site_down");
    expect(localBusinessAngle({ signal: "Website is not on HTTPS", website: "http://x.in" })).toBe("no_https");
    expect(localBusinessAngle({ signal: "Average website: mobile performance 70/100", website: "https://x.in" })).toBe("average_site");
    expect(localBusinessAngle({ signal: "Has a website (speed not checked yet)", website: "https://x.in" })).toBe("unchecked_site");
    expect(localBusinessAngle({ signal: "Good website: mobile performance 92/100", website: "https://x.in" })).toBeNull();
  });

  it("flags a missing public email instead of guessing a recipient", () => {
    const d = draftLocalBusinessEmail({ ...base, email: null }, sender);
    expect(d.recipient).toBe("");
    expect(d.review_checklist[0]).toMatch(/No public email/);
  });

  it("refuses Google Places rows, closed campaigns and good websites", () => {
    expect(() => draftLocalBusinessEmail({ ...base, source: "google_places" }, sender)).toThrow(LocalBusinessDraftSkipped);
    expect(() => draftLocalBusinessEmail({ ...base, status: "contacted" }, sender)).toThrow(LocalBusinessDraftSkipped);
    expect(() => draftLocalBusinessEmail({ ...base, website: "https://x.in", signal: "Good website: mobile performance 95/100" }, sender)).toThrow(LocalBusinessDraftSkipped);
  });
});
