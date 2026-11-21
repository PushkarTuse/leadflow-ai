/**
 * Preview owner-review email drafts for the Local Businesses queue. Never sends anything.
 *
 *   npm run local:drafts                 # built-in sample rows, one per angle
 *   npm run local:drafts -- --from-api   # top non-Google local_business rows from the local leadflow-leads API
 *
 * --from-api reads EXTERNAL_LEADS_API_ORIGIN (loopback only) and EXTERNAL_LEADS_API_TOKEN.
 * Output: outputs/local-business-drafts.md (git-ignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { draftLocalBusinessEmail, LocalBusinessDraftSkipped, type LocalBusinessRow } from "../packages/core/local-business-email";
import { loopbackOrigin } from "./external-local-config.mjs";

const sender = {
  brand: "LeadFlow AI",
  ownerName: process.env.OUTREACH_SENDER_NAME || "[Your name]",
  siteUrl: "https://leadflow-agency.pages.dev",
  startingPrice: "₹5,999",
  phone: process.env.OUTREACH_SENDER_PHONE || undefined,
};

const samples: LocalBusinessRow[] = [
  { source: "osm", name: "Kothrud Dental Care", title: "dentist", city: "Pune", phone: "+91 98xxx xxxxx", email: "contact@example.com", website: null, signal: "No website listed", score: 90 },
  { source: "osm", name: "Baner Physio Studio", title: "physiotherapist", city: "Pune", phone: "+91 98xxx xxxxx", email: null, website: "https://www.instagram.com/banerphysio", signal: "Only a social or directory page, no own website", score: 83 },
  { source: "osm", name: "Aundh Smile Clinic", title: "dentist", city: "Pune", phone: null, email: "info@example.com", website: "https://aundhsmile.example.in", pagespeed_mobile: 31, signal: "Slow website: mobile performance 31/100", score: 80 },
  { source: "osm", name: "Shivaji Nagar Opticals", title: "optician", city: "Pune", phone: "+91 20xxxx xxxx", email: "hello@example.com", website: "http://shivajinagaropticals.example.in", signal: "Website is not on HTTPS", score: 70 },
];

async function fromApi(): Promise<LocalBusinessRow[]> {
  const origin = loopbackOrigin(process.env.EXTERNAL_LEADS_API_ORIGIN);
  const token = process.env.EXTERNAL_LEADS_API_TOKEN ?? "";
  if (!token) throw new Error("Set EXTERNAL_LEADS_API_TOKEN");
  const url = `${origin}/leads?category=local_business&exclude_source=google_places,google_nearby&sort=score&order=desc&limit=20&offset=0`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  const page = (await res.json()) as { leads?: LocalBusinessRow[] };
  return page.leads ?? [];
}

const rows = process.argv.includes("--from-api") ? await fromApi() : samples;
const sections: string[] = [`# Local business email drafts (${new Date().toISOString().slice(0, 10)})`, "", "Drafts only. Review each one; nothing has been sent.", ""];
let drafted = 0;
for (const row of rows) {
  try {
    const d = draftLocalBusinessEmail(row, sender);
    drafted++;
    sections.push(
      `## ${row.name} (${row.source}, score ${row.score}, ${d.angle})`,
      "",
      `**To:** ${d.recipient || "_no public email; use phone/WhatsApp_"}  `,
      `**Subject:** ${d.subject}`,
      "",
      "```text",
      d.body,
      "```",
      "",
      "Before sending:",
      ...d.review_checklist.map((c) => `- [ ] ${c}`),
      "",
    );
  } catch (e) {
    if (!(e instanceof LocalBusinessDraftSkipped)) throw e;
    sections.push(`## ${row.name}: skipped`, "", e.message, "");
  }
}
mkdirSync("outputs", { recursive: true });
writeFileSync("outputs/local-business-drafts.md", sections.join("\n"));
console.log(`${drafted}/${rows.length} drafts written to outputs/local-business-drafts.md`);
