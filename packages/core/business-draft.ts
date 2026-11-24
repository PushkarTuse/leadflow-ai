export const agencyUrl = "https://leadflow-agency.pages.dev";

export interface BusinessDraftFacts {
  name: string;
  category: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  rating_count?: number | null;
  opportunity?: string;
  serviceIdea?: string;
  subjectIdea?: string;
}

export type BusinessCopy = { subject: string; proposal: string; question: string };

const line = (value: string, maximum: number) => value.replace(/[\u0000-\u001f\u007f—]+/g, " ").trim().slice(0, maximum);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);

function industryCopy(facts: BusinessDraftFacts, name: string): BusinessCopy {
  const category = facts.category ?? "";
  const observed=facts.opportunity??"";
  if (/hotel|resort|lodging/i.test(category))
    return { subject:`${name}: check dates before guests call`,
      proposal:"We could give guests a mobile enquiry that collects travel dates, group size and room preferences before your team replies.",
      question:"Would a sketch of that stay enquiry page be useful?" };
  if (/dent|healthcare|clinic|physio/i.test(category))
    return { subject: /phone/i.test(observed)?`${name}: an appointment option alongside the phone`:
      `Could patients request an appointment at ${name}?`,
      proposal: /phone/i.test(observed)
        ? "We could add a short appointment request where patients choose a service and callback window, and your team confirms the appointment by phone."
        : "We could put treatments, clinic hours and a WhatsApp appointment request on one page patients can use from their phone.",
      question: "Would you like us to sketch that patient booking page for you?" };
  if (/restaurant|cafe|bakery|pizza|coffee|eatery/i.test(category))
    return { subject: `Could customers see ${name}’s menu from Maps?`,
      proposal: "We could build a mobile menu with a directions link and a simple way to ask about pickup or reservations.",
      question: "Would you like us to sketch a menu page using your branding?" };
  if (/hair|beauty|salon|barber|spa/i.test(category))
    return { subject: `${name}: services to booking in one tap`,
      proposal: "We could give visitors one mobile page to browse services, check opening hours and request a booking.",
      question: "Would you like us to sketch what that booking page could look like?" };
  if (/car|garage|repair|plumb|electric/i.test(category))
    return { subject: `A quicker quote request for ${name}`,
      proposal: "We could build a quote enquiry page with fields for the job, preferred timing and a photo.",
      question: "Would it help to see a sketch of that quote form?" };
  if (/fitness|gym|yoga|sport/i.test(category))
    return { subject: /whatsapp/i.test(observed)?`What could ${name} ask before WhatsApp?`:`Can new customers find a class at ${name}?`,
      proposal: "We could build a mobile page with class times and an enquiry that goes straight to your team.",
      question: "Would you like us to sketch the schedule and enquiry page?" };
  return { subject: `${name}: a clearer path to a customer enquiry`,
    proposal: facts.website
      ? "We could walk through the listed site on mobile and sketch a simpler way for customers to ask about a service."
      : "We could put your services and contact options on a mobile page with a short form that routes enquiries to your team.",
    question: "Would a quick mockup of that enquiry page be useful to your team?" };
}

export function validateBusinessCopy(input: unknown, facts: BusinessDraftFacts): BusinessCopy | undefined {
  if (!input || typeof input !== "object") return;
  const { subject, proposal, question } = input as Partial<BusinessCopy>;
  if (typeof subject !== "string" || typeof proposal !== "string" || typeof question !== "string") return;
  if (!subject.trim() || subject.length > 84 || proposal.length < 35 || proposal.length > 330 || question.length < 15 || question.length > 155) return;
  const combined = [subject, proposal, question].join(" ");
  if(/\b(?:sketch|mockup|quick chat|quick call)\b/i.test(subject)||subject.trim().toLowerCase()===question.trim().toLowerCase())return;
  // Model copy describes an idea. All factual claims, links, pricing and identity
  // come from the trusted listing or the controlled portions of the draft.
  if (/[\u0000-\u001f\u007f<>₹$€£%—]|\b(?:https?|www|guarantee|no website|no online presence|customers say|award-winning|best in|I|my|me)\b/i.test(combined)) return;
  if (/\d/.test(combined) || /^(?:re|fwd):/i.test(subject) ||
    !/^(?:(?:Can|Could|Would|How|What|Where|Do|Does)\b.+\?|[^:?!]{3,48}:\s+(?:from|a|an|one|beyond)\b[^!?]{5,45})$/i.test(subject.trim()) ||
    !/^We (?:could|can sketch|can build|can put together)\b/i.test(proposal) ||
    /\b(?:noticed|found|currently|already|you have|you are losing|streamline|elevate|boost|online presence)\b/i.test(proposal) ||
    !/^(?:Would you like (?:us to|to see)|Would it help|(?:Could|Can|May) we|Would a|Is this a|Want (?:us to|to see))\b.*\?$/i.test(question) ||
    !/\b(?:sketch|mockup|walkthrough|examples?|outline|priority|workflow|team|compare)\b/i.test(question)) return;
  const identity = [facts.name, facts.city ?? ""].filter(value => value.trim().length > 3);
  if (!identity.some(value => subject.toLowerCase().includes(value.trim().toLowerCase()))) return;
  if (/^(?:a website idea|quick question|grow your business|business proposal)\b/i.test(subject)) return;
  const sentence = proposal.trim();
  return { subject: subject.trim(), proposal: /[.!?]$/.test(sentence) ? sentence : sentence + ".", question: question.trim() };
}

export function businessDraft(facts: BusinessDraftFacts, sender: string, copy?: BusinessCopy) {
  const name = line(facts.name, 80);
  const city = facts.city ? ` in ${line(facts.city, 55)}` : "";
  const fallback = industryCopy(facts, line(name, 45));
  const genericPhoneIdea=facts.serviceIdea?.startsWith("We could add a small enquiry option alongside your phone line");
  const useIndustryDetails=genericPhoneIdea&&/hotel|resort|lodging|dent|healthcare|clinic|physio/i.test(facts.category??"");
  const alternativeCta=/menu/i.test(facts.serviceIdea??"")?"Would it help if we sent an example using one section of your menu?"
    : /appointment|reserv|callback|book/i.test(facts.serviceIdea??"")?"Could we share a short walkthrough with the team that handles enquiries?"
    : "Is this a workflow your team would like to explore?";
  const selected = validateBusinessCopy(copy, facts) ?? (facts.serviceIdea&&!useIndustryDetails
    ? {...fallback, proposal:line(facts.serviceIdea,250), question:alternativeCta}
    : fallback);
  const reviews = Number.isSafeInteger(facts.rating_count) && (facts.rating_count ?? 0) >= 100
    ? `Your listing shows ${facts.rating_count} ratings. ` : "";
  const website = facts.opportunity ? line(facts.opportunity, 350) : facts.website
    ? `We saw the website linked on your listing${city} and had a small idea for it.`
    : `We came across your listing${city} and didn’t see a website linked there.`;
  const price = facts.country === "IN" && !facts.website && !facts.opportunity && !facts.serviceIdea
    ? " Our starter websites begin at ₹5,999." : "";
  const subject = line(facts.subjectIdea??"",84) || (reviews && !facts.website
    ? `${facts.rating_count} ratings for ${line(name, 38)}. What’s the next click?` : selected.subject);
  const paragraphs = [
    `Hi ${name} team,`,
    reviews + website + "\n\n" + selected.proposal,
    `We’re LeadFlow AI. We build custom websites and apps, including booking and enquiry automation.${price}`,
    `${selected.question} Our work is at ${agencyUrl}.`,
    `Best,\n${line(sender, 60)}\nLeadFlow AI`,
    "If this isn’t relevant, reply and we’ll leave it there.",
  ];
  const html = paragraphs.map(text => `<p>${escapeHtml(text).replaceAll("\n", "<br>").replace(agencyUrl, `<a href="${agencyUrl}">${agencyUrl}</a>`)}</p>`);
  html.splice(5, 0, '<img src="cid:leadflow-signature" width="180" height="45" alt="LeadFlow AI" style="display:block">');
  const shortName = line(name, 34);
  const category = facts.category ?? "";
  const task = /dent|clinic|salon|physio|spa/i.test(category) ? "a booking"
    : /hotel|resort|lodging/i.test(category) ? "a stay"
    : /restaurant|cafe|pizza|bakery/i.test(category) ? "the menu"
    : /shop|boutique|retail/i.test(category) ? "the collection"
    : /gym|fitness|yoga|sport/i.test(category) ? "a first class" : "an enquiry";
  const alternatives = [...new Set([industryCopy(facts, shortName).subject,
    `${shortName}: one less step to ${task}`, `A first look at ${task} for ${shortName}`,
    `Could customers find ${task} faster at ${shortName}?`])].filter(item => item !== subject).slice(0, 3);
  return { subject, alternatives, body: paragraphs.join("\n\n"), html: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#fff;color:#172320"><div style="max-width:560px;margin:0 auto;padding:20px;font:16px/1.55 Arial,sans-serif">${html.join("")}</div></body></html>` };
}
