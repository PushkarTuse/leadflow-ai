export type BusinessDisposition = "prospect" | "review" | "excluded";
export type BusinessQualification = { status: BusinessDisposition; reason: string; method: string };
export type BusinessIdentity = {
  name: string;
  website: string | null;
  title?: string | null;
  tags?: string[];
};

export const digitalStatuses = ["official_site", "parent_site", "social_only_observed", "listed_site_unavailable",
  "not_found_after_checks", "not_listed", "unknown"] as const;

export type BusinessEvidence = {
  ownership: "independent" | "locally_controlled" | "corporate";
  websiteStatus: typeof digitalStatuses[number];
  ownershipUrl: string;
  opportunityUrl: string;
  opportunity: string;
  serviceIdea?: string;
  subjectIdea?: string;
  contactUrl?: string;
  contactKind?: "email"|"phone";
  verifiedAt: string;
};

export function businessOutreachGate(listing: BusinessQualification, evidence?: BusinessEvidence, now = Date.now()) {
  if (listing.status === "excluded" || evidence?.ownership === "corporate")
    return { status: "excluded", reason: listing.status === "excluded" ? listing.reason : "Corporate control confirmed", score: 0, contactable: false, draftReady:false } as const;
  if (!evidence || !Number.isFinite(Date.parse(evidence.verifiedAt)) ||
    now - Date.parse(evidence.verifiedAt) > 30 * 86400000 || evidence.websiteStatus === "parent_site" ||
    evidence.websiteStatus === "unknown" || evidence.websiteStatus === "not_listed" || !evidence.opportunity.trim())
    return { status: "review", reason: listing.status === "review" ? listing.reason : "Verify local control and a specific digital opportunity", score: 0, contactable: false, draftReady:false } as const;
  return { status: "qualified", reason: "Evidence supports local ownership and a digital opportunity", score: evidence.contactUrl ? 90 : 70,
    contactable: Boolean(evidence.contactUrl),draftReady:Boolean(evidence.contactUrl) && evidence.contactKind!=="phone" } as const;
}

const chains: [RegExp, string][] = [
  [/\bdominos(?: pizza)?\b|\bdomino pizza\b/, "Domino's"],
  [/\bmc\s*donalds\b|\bmcdonald\s*s\b|\bmcdonald corporation\b/, "McDonald's"],
  [/\bkfc\b|\bkentucky fried chicken\b/, "KFC"],
  [/\bstarbucks\b/, "Starbucks"],
  [/\bburger king\b/, "Burger King"],
  [/\bsubway\b/, "Subway"],
  [/\bpizza hut\b/, "Pizza Hut"],
  [/\btaco bell\b|\bwendys\b|\bdunkin\b|\bbaskin robbins\b|\bpopeyes\b/, "National food chain"],
  [/\bbarista coffee\b|\bcafe coffee day\b|\bhaldirams\b|\bwow momo\b/, "National food or coffee chain"],
  [/\breliance (?:digital|smart|trends)\b|\bd\s*mart\b|\bdecathlon\b|\bikea\b|\bminiso\b/, "National or international retailer"],
  [/\b(?:lenskart|specsavers|vision express)\b/, "Optical chain"],
  [/\b(?:apollo (?:clinic|dental|hospital|pharmacy)|clove dental|dr lal pathlabs|metropolis healthcare|fortis hospital|vlcc|lakme salon)\b/, "Healthcare or beauty chain"],
  [/\b(?:hdfc|icici|axis bank|state bank of india|lic of india|tata motors|maruti suzuki|hyundai motor|toyota dealer)\b/, "Corporate brand"],
  [/\b(?:marriott|hilton|holiday inn|radisson|oyo rooms|novotel|ibis hotel)\b/, "Hotel chain"],
  [/\b(?:world gym|golds gym|anytime fitness)\b/, "Fitness franchise"],
];

const corporateDomains = [
  "dominos.com", "dominos.co.in", "dominos.co.uk", "mcdonalds.com", "mcdonaldsindia.com",
  "mcdindia.com", "kfc.com", "kfc.co.in", "starbucks.com", "starbucks.in", "burgerking.in", "bk.com",
  "subway.com", "pizzahut.com", "pizzahut.co.in", "lenskart.com", "clovedental.in", "apolloclinic.com",
  "apollopharmacy.in", "marriott.com", "hilton.com", "ihg.com", "decathlon.in", "ikea.com",
  "worldgym.com", "goldsgym.in", "goldsgym.com", "anytimefitness.com",
];

export function normalizedBusinessName(name: string): string {
  return name.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function businessHost(website: string | null): string {
  if (!website) return "";
  try { return new URL(/^https?:\/\//i.test(website) ? website : "https://" + website).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

export function qualifyBusiness(facts: BusinessIdentity, repeatedAcrossCities = false): BusinessQualification {
  const website = businessHost(facts.website);
  const brandTags = (facts.tags ?? []).filter(tag => /^(?:brand|operator)=/.test(tag));
  const identifiers = [facts.name, ...brandTags.map(tag => tag.slice(tag.indexOf("=") + 1))];
  for (const [pattern, name] of chains) {
    if (identifiers.some(value => pattern.test(normalizedBusinessName(value)))) {
      return { status: "excluded", reason: `Recognized chain or corporate brand (${name})`, method: "Rules" };
    }
  }
  if (corporateDomains.some(domain => website === domain || website.endsWith("." + domain)))
    return { status: "excluded", reason: `Listed site uses a corporate brand domain (${website})`, method: "Rules" };
  if (/\b(?:franchise|franchisee|authorized dealer|authorised dealer|branch office|corporate office)\b/i.test([facts.name, facts.title].join(" ")))
    return { status: "review", reason: "Listing indicates a branch, franchise, dealership, or corporate office", method: "Rules" };
  if ((facts.tags ?? []).some(tag => tag.startsWith("brand:wikidata=") || tag.startsWith("brand=")))
    return { status: "review", reason: "Source lists a brand; check who controls the business website", method: "Rules" };
  if ((facts.tags ?? []).includes("POSSIBLE_DUPLICATE"))
    return { status: "review", reason: "Source identity overlaps another listing; compare the address and contact route", method: "Rules" };
  if (repeatedAcrossCities)
    return { status: "review", reason: "The same name appears in at least three cities", method: "Rules" };
  return { status: "prospect", reason: "No chain signal found in the supplied listing", method: "Rules" };
}
