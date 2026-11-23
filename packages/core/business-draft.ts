export const agencyUrl = "https://leadflow-agency.pages.dev";

export interface BusinessDraftFacts {
  name: string;
  category: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  rating_count?: number | null;
}

export const draftAngles = ["appointments", "website", "website-review", "enquiries"] as const;
export type DraftAngle = typeof draftAngles[number];

const angles = {
  appointments: {
    subject: (name: string) => `A simpler way to book with ${name}`,
    offer: "We could put your services, hours and appointment enquiry on one mobile-friendly page.",
  },
  website: {
    subject: (name: string) => `A website idea for ${name}`,
    offer: "We could give customers one mobile-friendly place to find your services, hours and contact details.",
  },
  "website-review": {
    subject: (name: string) => `A website idea for ${name}`,
    offer: "We could review your mobile enquiry flow and sketch a simpler path from your services page to a booking or quote request.",
  },
  enquiries: {
    subject: (name: string) => `A simpler enquiry form for ${name}`,
    offer: "We could make it easier for customers to send a clear enquiry, with fewer steps for your team to follow up.",
  },
};

export function businessDraftOptions(facts: BusinessDraftFacts): DraftAngle[] {
  const appointments = /\b(?:dent|dental|clinic|salon|barber|physio|spa|veterinar)\w*/i.test(facts.category ?? "");
  const website: DraftAngle = facts.website ? "website-review" : "website";
  return appointments ? ["appointments", website, "enquiries"] : [website, "enquiries"];
}

const line = (value: string, maximum: number) => value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, maximum);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);

export function businessDraft(facts: BusinessDraftFacts, sender: string, angle = businessDraftOptions(facts)[0]) {
  const selected = angles[businessDraftOptions(facts).includes(angle) ? angle : businessDraftOptions(facts)[0]];
  const name = line(facts.name, 80);
  const city = facts.city ? ` in ${line(facts.city, 55)}` : "";
  const reviews = Number.isSafeInteger(facts.rating_count) && (facts.rating_count ?? 0) >= 100
    ? `Your listing shows ${facts.rating_count} ratings. ` : "";
  const website = facts.website
    ? `We found your business listing${city} and had an idea for your website.`
    : `We came across your business listing${city} and didn’t see a website linked there.`;
  const price = facts.country === "IN" ? " Our starter websites begin at ₹5,999." : "";
  const subject = reviews && !facts.website ? `${facts.rating_count} ratings · A website idea for ${name}` : selected.subject(name);
  const paragraphs = [
    `Hi ${name} team,`,
    reviews + website + " " + selected.offer,
    "We’re LeadFlow AI. We build custom websites and apps and can add booking or follow-up automation where it makes sense." + price,
    `Would you like us to send a rough example of what that could look like for ${name}? You can see our work at ${agencyUrl}.`,
    `Best,\n${line(sender, 60)}\nLeadFlow AI`,
    "If this isn’t relevant, reply and we’ll leave it there.",
  ];
  const html = paragraphs.map(text => `<p>${escapeHtml(text).replaceAll("\n", "<br>").replace(agencyUrl, `<a href="${agencyUrl}">${agencyUrl}</a>`)}</p>`);
  html.splice(5, 0, '<img src="cid:leadflow-signature" width="180" height="45" alt="LeadFlow AI" style="display:block">');
  return { subject, body: paragraphs.join("\n\n"), html: `<html><body style="font:15px Arial,sans-serif;color:#172320">${html.join("")}</body></html>` };
}
