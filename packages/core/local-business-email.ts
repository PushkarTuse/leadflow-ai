/**
 * Owner-reviewed first-contact email drafts for the manual Local Businesses queue
 * (OSM and other non-Google local_business rows from leadflow-leads).
 *
 * Boundaries:
 * - Produces a DRAFT only. Nothing here sends mail, creates an EmailOutbox row or notifies Telegram.
 * - Google Places/Nearby rows are refused, matching the CSV/Sheet export exclusion.
 * - Every factual claim in the body comes from the row's own signal/website fields; no invented
 *   audits, results, testimonials or deadlines.
 * - Each draft identifies the sender. The HTML version links straight to the studio site and can
 *   carry the animated logo (an <img> src such as "cid:att0" for an inline attachment, or a hosted URL).
 */

export interface LocalBusinessRow {
  source: string;
  name: string;
  title?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  pagespeed_mobile?: number | null;
  signal: string;
  score: number;
  status?: string | null;
}

export interface LocalBusinessSender {
  brand: string;
  ownerName: string;
  siteUrl: string;
  /** Lowest published starting offer, e.g. "₹5,999". Omit to leave pricing out of the email. */
  startingPrice?: string;
  phone?: string;
  /** <img> src for the signature logo, e.g. "cid:att0" (inline attachment) or a hosted https URL. */
  logoSrc?: string;
}

export type LocalBusinessAngle = "no_website" | "social_only" | "site_down" | "slow_site" | "no_https" | "average_site" | "unchecked_site";

export interface LocalBusinessDraft {
  angle: LocalBusinessAngle;
  /** Public email from the source row, or "" when the owner must find a permitted channel (often phone). */
  recipient: string;
  subject: string;
  /** Plain-text version (also the multipart alternative). */
  body: string;
  /** HTML version: same wording, clickable site link, signature with optional logo. */
  html: string;
  /** Things the owner must check before sending. Always non-empty. */
  review_checklist: string[];
}

const GOOGLE_SOURCES = new Set(["google_places", "google_nearby"]);
const CLOSED_STATUSES = new Set(["contacted", "replied", "won", "lost", "ignored"]);

export class LocalBusinessDraftSkipped extends Error {}

export function localBusinessAngle(row: Pick<LocalBusinessRow, "signal" | "website" | "pagespeed_mobile">): LocalBusinessAngle | null {
  const s = row.signal.toLowerCase();
  if (s.startsWith("no website") || !row.website) return "no_website";
  if (s.includes("social or directory")) return "social_only";
  if (s.includes("failed to load")) return "site_down";
  if (s.startsWith("slow website")) return "slow_site";
  if (s.includes("not on https")) return "no_https";
  if (s.startsWith("average website")) return "average_site";
  if (s.startsWith("good website")) return null; // nothing honest to pitch
  return "unchecked_site";
}

function businessType(title?: string | null) {
  const t = (title ?? "").trim().toLowerCase();
  return t && t !== "local business" ? t : "business";
}

function hostOf(url: string) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function speedScore(row: LocalBusinessRow) {
  if (typeof row.pagespeed_mobile === "number" && row.pagespeed_mobile >= 0) return row.pagespeed_mobile;
  const m = row.signal.match(/(\d{1,3})\/100/);
  return m ? Number(m[1]) : null;
}

export function draftLocalBusinessEmail(row: LocalBusinessRow, sender: LocalBusinessSender): LocalBusinessDraft {
  if (GOOGLE_SOURCES.has(row.source)) throw new LocalBusinessDraftSkipped("Google Places rows are excluded from outreach");
  if (row.status && CLOSED_STATUSES.has(row.status)) throw new LocalBusinessDraftSkipped(`Campaign status is already '${row.status}'`);
  const angle = localBusinessAngle(row);
  if (!angle) throw new LocalBusinessDraftSkipped("Website already performs well; no honest improvement to pitch");

  const name = row.name.trim();
  const type = businessType(row.title);
  const where = row.city ? ` in ${row.city}` : "";
  const host = row.website ? hostOf(row.website) : "";
  const speed = speedScore(row);

  const observation: Record<LocalBusinessAngle, string> = {
    no_website: `While looking at ${type}s${where}${row.source === "osm" ? " on OpenStreetMap" : ""}, I noticed ${name} doesn't have a website listed.`,
    social_only: `While looking at ${type}s${where}, I noticed ${name}'s listed web link is a social or directory page (${host}) rather than your own website.`,
    site_down: `While looking at ${type}s${where}, I tried ${host} and it didn't load in Google's mobile PageSpeed test.`,
    slow_site: `While looking at ${type}s${where}, I ran ${host} through Google's free PageSpeed test and it scored ${speed ?? "low"}/100 for mobile performance.`,
    no_https: `While looking at ${type}s${where}, I noticed ${host} is served without HTTPS, so most browsers show visitors a "Not secure" warning.`,
    average_site: `While looking at ${type}s${where}, I ran ${host} through Google's free PageSpeed test; it scored ${speed ?? "around average"}/100 for mobile performance.`,
    unchecked_site: `While looking at ${type}s${where}, I came across ${name} and ${host}.`,
  };

  const why: Record<LocalBusinessAngle, string> = {
    no_website: "Most people now search on their phone before they call or visit, and a simple site with your timings, location and a click-to-call / WhatsApp button helps them choose you.",
    social_only: "A social page is useful, but a small site you own is easier to find on Google, works for people without that app, and can collect enquiries directly.",
    site_down: "If a visitor's phone can't open the site, they usually move on to the next result.",
    slow_site: "On mobile, visitors often leave if a page takes more than a few seconds to appear.",
    no_https: "That warning can put people off before they read anything, and it also affects how Google ranks the site.",
    average_site: "There is usually room to make it load faster on phones and make the call or enquiry button easier to reach.",
    unchecked_site: "I build fast, mobile-first websites and enquiry forms for local businesses, and wanted to ask whether an update would be useful.",
  };

  const offer: Record<LocalBusinessAngle, string> = {
    no_website: "I could build a clean one-page site for you",
    social_only: "I could set up a simple website that links to your existing page",
    site_down: "I could take a look at what is breaking and suggest a fix or a rebuild",
    slow_site: "I could suggest what is slowing it down, or rebuild it as a faster mobile-first page",
    no_https: "I could move the site to HTTPS and check the basics while I'm there",
    average_site: "I could share two or three specific improvements I'd make",
    unchecked_site: "I could share a few specific ideas for the site",
  };

  const price = sender.startingPrice && ["no_website", "social_only", "site_down", "slow_site"].includes(angle)
    ? ` Packages start at ${sender.startingPrice}, including a contact form, WhatsApp button and mobile layout, with the exact scope agreed before any work starts.`
    : "";

  const subject: Record<LocalBusinessAngle, string> = {
    no_website: `A website for ${name}?`,
    social_only: `A website of your own for ${name}?`,
    site_down: `${host} isn't loading on mobile`,
    slow_site: `${host} on mobile: quick note`,
    no_https: `${host} shows "Not secure"`,
    average_site: `A few ideas for ${host}`,
    unchecked_site: `Quick question about ${name}'s website`,
  };

  const signature = [sender.ownerName, sender.brand, sender.siteUrl, sender.phone].filter(Boolean).join("\n");
  const closing = "Would it be worth a short call this week? If you already have this covered, no problem at all.";
  const body = [
    `Hello ${name} team,`,
    "",
    `${observation[angle]} ${why[angle]}`,
    "",
    `${offer[angle]}.${price} You can see examples of our work at ${sender.siteUrl}.`,
    "",
    closing,
    "",
    "Regards,",
    signature,
  ].join("\n");

  // Same markup Gmail's own composer produces: no fonts, widths or colours, so it reads like a
  // personally typed message rather than a newsletter template.
  const site = escapeHtml(sender.siteUrl);
  const link = (label: string) => `<a href="${site}">${label}</a>`;
  const logo = sender.logoSrc
    ? `<div><br></div><div><a href="${site}"><img src="${escapeHtml(sender.logoSrc)}" width="200" height="48" alt="${escapeHtml(sender.brand)}"></a></div>`
    : "";
  const lines = [
    `Hello ${escapeHtml(name)} team,`,
    "",
    `${escapeHtml(observation[angle])} ${escapeHtml(why[angle])}`,
    "",
    `${escapeHtml(offer[angle])}.${escapeHtml(price)} You can see examples of our work on ${link(`the ${escapeHtml(sender.brand)} website`)}.`,
    "",
    escapeHtml(closing),
    "",
    "Regards,",
    escapeHtml(sender.ownerName),
    escapeHtml(sender.brand),
    ...(sender.phone ? [escapeHtml(sender.phone)] : []),
    link(escapeHtml(hostOf(sender.siteUrl))),
  ];
  const html = `<div dir="ltr">${lines.map((line) => `<div>${line || "<br>"}</div>`).join("")}${logo}</div>`;

  const review_checklist = [
    `Open the source listing and confirm ${name} is still operating${where}.`,
    angle === "no_website" ? "Search Google for the business name to confirm there really is no website." : `Open ${row.website} yourself to confirm the issue described is still true.`,
    "Personalise the first line if you know the owner's name.",
  ];
  if (!row.email) review_checklist.unshift("No public email on the listing: call or WhatsApp instead, or find a published contact address first.");

  return { angle, recipient: row.email?.trim() ?? "", subject: subject[angle], body, html, review_checklist };
}
