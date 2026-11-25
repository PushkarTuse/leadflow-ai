export const agencyUrl = "https://leadflow-agency.pages.dev";
export const initialOutreachPolicy = "Initial outreach has no prices, rates, discounts, or package offers. Use we and our team. Invite a short call to explore requirements and discuss tailored solutions. The application supplies the final invitation, any configured local meeting and any booking link. Do not invent ratings, testimonials, or results. Use verified facts only.";

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
  meetingCity?: string;
  bookingUrl?: string;
}

export type BusinessCopy = { subject: string; proposal: string; question: string };

const line = (value: string, maximum: number) => value.replace(/[\u0000-\u001f\u007f—]+/g, " ").trim().slice(0, maximum);
const forbiddenOutreach = /[₹$€£]|\b(?:\d[\d,.]*\s*(?:inr|usd|eur|gbp|rupees?|dollars?)|(?:inr|usd|eur|gbp)\s*\d|\d{1,3}(?:,\d{3})+|pricing|price[ds]?|discounts?|package rates?|(?:starting|starts?|begins?)\s+(?:at|from)|if this (?:isn[’']t|is not) relevant|we(?:[’']ll| will) leave it there)\b/i;
const safeOutreachLine = (value: string | undefined, maximum: number) => value && !forbiddenOutreach.test(value) ? line(value, maximum) : "";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);

export function calendlyEventUrl(value?: string): string | undefined {
  const configured = value?.trim();
  if (!configured || configured.length > 2048 || !/^https:\/\//i.test(configured) || /\s/.test(configured)) return;
  try {
    const url = new URL(configured);
    if (url.protocol === "https:" && ["calendly.com", "www.calendly.com"].includes(url.hostname) &&
        !url.username && !url.password && !url.port && url.pathname !== "/") return url.href;
  } catch { /* Optional settings with invalid URLs use the normal invitation. */ }
}

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
  if (forbiddenOutreach.test(combined) || /\d/.test(combined) || /^(?:re|fwd):/i.test(subject) ||
    !/^(?:(?:Can|Could|Would|How|What|Where|Do|Does)\b.+\?|[^:?!]{3,48}:\s+(?:from|a|an|one|beyond)\b[^!?]{5,45})$/i.test(subject.trim()) ||
    !/^We (?:could|can sketch|can build|can put together)\b/i.test(proposal) ||
    /\b(?:noticed|found|currently|already|you have|you are losing|streamline|elevate|boost|online presence)\b/i.test(proposal) ||
    !/^(?:Would|Could|Can|Are|Do)\b.*\?$/i.test(question) ||
    !/\b(?:short|brief|quick|introductory|intro)\b.{0,28}\b(?:call|conversation|chat)\b/i.test(question) ||
    /\b(?:meet|meeting|in person)\b/i.test(question)) return;
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
  const category = facts.category ?? "";
  const proposal = safeOutreachLine(facts.serviceIdea,250);
  const selected = validateBusinessCopy(copy, facts) ?? {...fallback, proposal:proposal&&!useIndustryDetails?proposal:fallback.proposal};
  const website = safeOutreachLine(facts.opportunity,350) || (facts.website
    ? `We saw the website linked on your listing${city} and had a small idea for it.`
    : `We came across your listing${city} and didn’t see a website linked there.`);
  const subject = safeOutreachLine(facts.subjectIdea,84) || selected.subject;
  const meeting = facts.meetingCity ? ` If meeting in ${line(facts.meetingCity,45)} is easier, we can discuss a time that suits both teams.` : "";
  const call = `Let's set up a short call to explore your requirements and discuss how we can tailor our solutions to your business.${meeting}`;
  const bookingUrl = calendlyEventUrl(facts.bookingUrl);
  const bookingLabel = "Feel free to book a time that works best for you.";
  const paragraphs = [
    `Hi ${name} team,`,
    website + "\n\n" + selected.proposal,
    `We’re LeadFlow AI. We build custom websites and applications around how teams work, including enquiry and booking automation. You can see examples of our work at ${agencyUrl}.`,
    bookingUrl ? `${call} ${bookingLabel}\n${bookingUrl}` : call,
    `Best,\n${line(sender, 60)}\nLeadFlow AI`,
    "To opt out of future emails, reply ‘unsubscribe’.",
  ];
  const html = paragraphs.map(text => `<p>${escapeHtml(text).replaceAll("\n", "<br>").replace(agencyUrl, `<a href="${agencyUrl}">${agencyUrl}</a>`)}</p>`);
  if (bookingUrl) html[3] = `<p>${escapeHtml(call)} <a href="${escapeHtml(bookingUrl)}">${bookingLabel}</a></p>`;
  html.splice(5, 0, '<img src="cid:leadflow-signature" width="180" height="45" alt="LeadFlow AI" style="display:block">');
  const shortName = line(name, 34);
  const task = /dent|clinic|salon|physio|spa/i.test(category) ? "a booking"
    : /hotel|resort|lodging/i.test(category) ? "a stay"
    : /restaurant|cafe|pizza|bakery/i.test(category) ? "the menu"
    : /shop|boutique|retail/i.test(category) ? "the collection"
    : /gym|fitness|yoga|sport/i.test(category) ? "a first class" : "an enquiry";
  const extraSubjects = /hotel|resort|lodging/i.test(category) ? [
    `Could guests share their stay dates with ${shortName} online?`,
    `A stay enquiry that gives ${shortName} the details up front`,
    `A simpler way to ask about a stay at ${shortName}`,
  ] : /dent|healthcare|clinic|physio/i.test(category) ? [
    `Can patients request a callback from ${shortName}?`,
    `A short appointment form for ${shortName}`,
    `Helping ${shortName} collect appointment requests`,
  ] : /whatsapp/i.test(facts.opportunity??"") ? [
    `Fewer follow-up messages on ${shortName} enquiries`,
    `A better starting point for ${shortName} enquiries`,
    `Could ${shortName} collect preferences before WhatsApp?`,
  ] : [`${shortName}: one less step to ${task}`,`A mobile enquiry for ${shortName}`,`Could customers find ${task} faster at ${shortName}?`];
  const alternatives = [...new Set([industryCopy(facts, shortName).subject,
    ...extraSubjects])].filter(item => item !== subject).slice(0, 3);
  return { subject, alternatives, body: paragraphs.join("\n\n"), html: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#fff;color:#172320"><div style="max-width:560px;margin:0 auto;padding:20px;font:16px/1.55 Arial,sans-serif">${html.join("")}</div></body></html>` };
}
