import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { normalizedBusinessName, type BusinessEvidence } from "../packages/core/business-qualification";
import { publicWebsite } from "./business-web";
import type { BusinessSearchHint } from "./business-search";

type Node = DefaultTreeAdapterTypes.Node;
type HtmlPage = { url:string;html:string };
export type BusinessObservation = {field:"identity"|"location"|"ownership"|"digital"|"contact"|"corporate";value:string;url:string;observedAt:string};
export type EvidenceInput = {name:string;city:string|null;title:string|null;website:string|null;email:string|null;phone:string|null;address?:string|null};
export type EvaluatedBusiness = {
  status:"qualified"|"excluded"|"review"|"retry"; reason:string; observations:BusinessObservation[];
  identityHost?:string; websiteObservation?:"not_listed"|"not_found_after_checks"|"social_only"|"official_site"|"parent_site"|"inaccessible"|"unverified";
  evidence?:BusinessEvidence;
  discoveryHints?:BusinessSearchHint[];
  discoveryCheckedAt?:string;
};
type Page = {url:URL;headings:string[];lines:string[];links:{label:string;href:string}[];entities:Record<string,unknown>[]};
const hidden = new Set(["script","style","noscript","template","svg","blockquote"]);
const block = new Set(["p","li","div","section","article","td","h1","h2","h3","title","br","footer"]);
const within = (value:string,size=450) => value.replace(/\s+/g," ").trim().slice(0,size);
const host = (domain:string) => domain.toLowerCase().replace(/^www\./,"");

function cleanError(error:unknown) {
  const code=(error as NodeJS.ErrnoException|null)?.code;
  if(code&&/^(?:ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE)$/.test(code))
    return "PUBLIC_NETWORK_"+code;
  return error instanceof Error && /^(?:UNSAFE|PUBLIC|ENOTFOUND|EAI_AGAIN|AbortError)[A-Z0-9_]*$/.test(error.message)
    ? error.message : "PUBLIC_PAGE_UNAVAILABLE";
}

function parsePage(input:HtmlPage):Page {
  const tree=parse(input.html);
  const headings:string[]=[], lines:string[]=[], links:Page["links"]=[];
  const entities:Page["entities"]=[];
  const queue:{node:Node;close?:boolean}[]=[{node:tree}];
  let current="", anchor:{node:Node;href:string;text:string}|undefined;
  let heading:{node:Node;text:string}|undefined;
  for(let steps=0;queue.length&&steps<25000;steps++){
    const {node,close}=queue.pop()!;
    const tag="tagName" in node?node.tagName:"";
    if(close){
      if(anchor?.node===node){links.push({href:anchor.href,label:within(anchor.text,120)});anchor=undefined;}
      if(heading?.node===node){headings.push(within(heading.text,180));heading=undefined;}
      if(block.has(tag)&&current){lines.push(within(current));current="";}
      continue;
    }
    if("value" in node && node.nodeName==="#text"){
      const value=" "+within(node.value,450);
      current=within(current+value);
      if(anchor)anchor.text+=value;
      if(heading)heading.text+=value;
    }
    if(tag==="script" && "attrs" in node && "childNodes" in node && node.attrs.some(a=>a.name==="type"&&a.value==="application/ld+json")){
      const first=node.childNodes[0];
      if(first&&"value" in first&&first.value.length<30_000&&entities.length<15){
        try{
          const data=JSON.parse(first.value);
          const roots=Array.isArray(data)?data:[data];
          const objects=roots.slice(0,15).flatMap(entry=>Array.isArray(entry?.["@graph"])?entry["@graph"].slice(0,15):[entry]);
          for(const object of objects.slice(0,15-entities.length)){
            if(object&&typeof object==="object"&&typeof object.name==="string"&&object.name.length<200)entities.push(object);
          }
        }catch{ /* Skip invalid structured markup. */ }
      }
    }
    if(hidden.has(tag) || !("childNodes" in node))continue;
    if("attrs" in node && node.attrs.some(attr=>attr.name==="hidden" || attr.name==="aria-hidden"&&attr.value==="true" ||
      (attr.name==="class"||attr.name==="id")&&/\b(?:testimonial|testimonials|customer-review|reviews-carousel|review-slider)\b/i.test(attr.value) ||
      attr.name==="style"&&/display\s*:\s*none|visibility\s*:\s*hidden/i.test(attr.value))) continue;
    if(block.has(tag)&&current){lines.push(within(current));current="";}
    if(tag==="meta"&&"attrs" in node&&headings.length<28&&node.attrs.some(attr=>["property","name"].includes(attr.name)&&["og:site_name","og:title"].includes(attr.value))){
      const content=node.attrs.find(attr=>attr.name==="content")?.value;
      if(content)headings.push(within(content,180));
    }
    if(tag==="a" && links.length<250 && "attrs" in node){
      const href=node.attrs.find(attr=>attr.name==="href")?.value;
      if(href)anchor={node,href:href.slice(0,1600),text:""};
    }
    if(tag==="img"&&links.length<250&&"attrs" in node){
      const meta=Object.fromEntries(node.attrs.map(attr=>[attr.name,attr.value]));
      if(meta.src&&/\bmenu\b/i.test(meta.alt??""))links.push({label:within(meta.alt,120),href:meta.src.slice(0,1600)});
    }
    if(["title","h1","h2"].includes(tag)&&headings.length<28)heading={node,text:""};
    queue.push({node,close:true});
    for(let index=node.childNodes.length-1;index>=0;index--)queue.push({node:node.childNodes[index]});
  }
  return {url:new URL(input.url),headings:headings.filter(Boolean),lines:lines.filter(Boolean).slice(0,1400),links,entities};
}

const directoryOrSocial = /(?:^|\.)(?:google\.[a-z.]+|goo\.gl|business\.site|facebook\.com|instagram\.com|linkedin\.com|linktr\.ee|youtube\.com|wa\.me|whatsapp\.com|zomato\.com|swiggy\.com|justdial\.com|practo\.com|tripadvisor\.[a-z.]+|wikipedia\.org|openstreetmap\.org|whatclinic\.com|healthfinder\.in|doczone\.in|lybrate\.com|magicpin\.in|dnb\.com|findglocal\.com|opendi\.in|medtrick\.com|yellowpages\.net|indiadentalclinic\.com|lyfskills\.com)$/i;
const personalMail = /^(?:gmail\.com|googlemail\.com|outlook\.com|hotmail\.[a-z.]+|live\.com|proton\.[a-z.]+|yahoo\.[a-z.]+|icloud\.com|rediffmail\.com|gmx\.[a-z.]+|aol\.com|yandex\.[a-z.]+|mail\.ru|zoho\.com)$/i;
const sharedHost = /(?:^|\.)(?:wixsite\.com|wordpress\.com|blogspot\.[a-z.]+|godaddysites\.com|myshopify\.com|square\.site|google\.com)$/i;

export function websiteGuesses(row:EvidenceInput, hints:BusinessSearchHint[]=[]):string[]{
  const candidates:string[]=[];
  for(const value of [row.website, row.email?.includes("@")&&!personalMail.test(row.email.split("@").at(-1)??"")?row.email.split("@").at(-1):null,...hints.map(item=>item.url)]){
    if(!value)continue;
    try{
      const u=publicWebsite(/^https?:\/\//i.test(value)?value:"https://"+value);
      if(directoryOrSocial.test(u.hostname)||sharedHost.test(u.hostname))continue;
      u.protocol="https:";
      u.search="";
      if(!candidates.some(item=>host(new URL(item).hostname)===host(u.hostname)))candidates.push(u.href);
    }catch { /* An untrusted source field supplies no candidate. */ }
  }
  return candidates;
}

const identityName = (name:string) => normalizedBusinessName(name.normalize("NFKD").replace(/\p{M}/gu, ""))
  .replace(/\b(?:dr|doctor|pvt|private|limited|ltd|llp|inc|and|the)\b/g," ").replace(/\s+/g," ").trim();
const matchesText=(value:string,term:string)=>(" "+normalizedBusinessName(value)+" ").includes(" "+term+" ");
const phoneDigits=(value:string|null)=>value?.replace(/[^0-9]/g,"").slice(-10);
const genericNameWords = new Set("clinic dental care dentist hospital health centre center studio salon spa services restaurant cafe store shop gym fitness india mumbai pune".split(" "));
function identityMatch(expected:string, displayed:string, phoneMatch:boolean) {
  const actual=identityName(displayed);
  if(expected.length>=5 && ` ${actual} `.includes(` ${expected} `))return true;
  const tokens=expected.split(" ").filter(token=>token.length>=3);
  const present=new Set(actual.split(" "));
  const distinctive=tokens.filter(token=>!genericNameWords.has(token));
  const common=tokens.filter(token=>present.has(token));
  if(!distinctive.length || !distinctive.every(token=>present.has(token)))return false;
  return common.length>=2 && common.length>=Math.ceil(tokens.length*0.75) || phoneMatch && distinctive.length>=2;
}
function schemaAddress(entity:Record<string,unknown>):string {
  if(typeof entity.address==="string")return entity.address;
  if(!entity.address || typeof entity.address!=="object")return "";
  const address=entity.address as Record<string,unknown>;
  return [address.streetAddress,address.addressLocality,address.postalCode].filter(value=>typeof value==="string").join(" ");
}
const namedOperator=/\b(?:owner|proprietor|practice principal|managing partner|chef-owner|founder(?: & director)?)\s*[:–-]\s*[^\W\d_][\p{L}.' ]{3,60}|\b(?:founded|established|started)\s+(?:(?:in|in the year) \d{4}\s+)?by\b/iu;
const localOperator=/\b(?:I (?:have been running|run|started|opened|founded)|we (?:opened|founded|started))\b.{0,90}\b(?:practice|classes|restaurant|clinic|business|studio|showroom|salon|boutique|gym|bakery)\b/i;
const owned = /\b(?:independently (?:owned|operated|run)|(?:family|owner|founder)[ -](?:owned|operated|run|led)|(?:founded|established|run|operated|owned|taken over) by|our (?:founder|owner)\b|founder (?:and|&) (?:owner|director))\b/i;
const corporate = /\b(?:become (?:our |a )?franchisee|franchise opportunities|franchise locations|franchise enquiry|nationwide chain|global chain|part of (?:the )?.{2,55} (?:group|holdings)|operated by .{2,55} franchis(?:ee|or))\b/i;
const actionPaths = /\b(?:about|contact|book(?:ing)?|appointments?|menu|visit|services|reservations?|enquir(?:e|ies)|our[- ](?:story|team)|know[- ]us|meet[- ](?:the[- ])?team|why[- ]we[- ]started|co[- ]?founders?)\b/i;
const signals=[
  {pattern:/\b(?:call|phone|telephone)\b.{0,65}\b(?:book|reserv|appointment|enquir)|\b(?:booking|reservations?|appointments?)\b.{0,55}\b(?:call|phone|telephone)\b/i,
    fact:"Your site gives customers a phone route for bookings or enquiries.",
    idea:"We could add a small enquiry option alongside your phone line so customers can request a callback with a preferred time.",type:/clinic|dent|salon|yoga|fitness|hotel|beauty|physio|restaurant/i},
  {pattern:/\b(?:for (?:a )?quote|request (?:a )?quote|quotation|pricing enquiries)\b/i,
    fact:"Your site invites customers to request a quote.",
    idea:"We could add a short quote brief that captures the service, timeline and main details for your team before replying.",type:/service|shop|design|photograph|repair|law|account|plumb|consult/i},
];

export async function evaluateBusiness(row:EvidenceInput, read:(url:string)=>Promise<HtmlPage>, now=new Date(), hints:BusinessSearchHint[]=[]):Promise<EvaluatedBusiness> {
  const urls=websiteGuesses(row,hints).slice(0,3), observations:BusinessObservation[]=[];
  if(!urls.length){
    const socialOnly=row.website && /(?:facebook\.com|instagram\.com|linkedin\.com)/i.test(row.website);
    return {status:"review",reason:"Permitted source has no corroborated first-party domain or independent operator evidence",observations,
      websiteObservation:socialOnly?"social_only":row.website?"unverified":"not_listed"};
  }
  const evidence=(field:BusinessObservation["field"],value:string,url:URL):BusinessObservation=>({field,value:within(value),url:url.href,observedAt:now.toISOString()});
  let unreachable="", mismatched=false;
  for(const candidate of urls){
    let home:Page;
    try { home=parsePage(await read(candidate)); }
    catch (error) { unreachable=cleanError(error);continue; }
    if(directoryOrSocial.test(home.url.hostname)||sharedHost.test(home.url.hostname)){mismatched=true;continue;}
    const pages=[home];
    const paths=new Map<string,number>();
    for(const link of home.links){
      try{
        const next=publicWebsite(link.href,home.url);
        if(next.origin!==home.url.origin||!actionPaths.test(next.pathname+" "+link.label)||
          /\.[a-z\d]{2,6}$/i.test(next.pathname)&&!/[.]html?$/i.test(next.pathname))continue;
        const text=next.pathname+" "+link.label;
        const weight=/\b(?:our[- ](?:story|team)|about[- ]us|about[- ]clinic|why[- ]we[- ]started|co[- ]?founders?)\b/i.test(text)?4:
          /\b(?:about|know[- ]us|meet[- ](?:the[- ])?team)\b/i.test(text)?3:/\bcontact\b/i.test(text)?2:1;
        next.search="";
        if(next.href!==home.url.href) paths.set(next.href, weight);
      }catch { /* Skip non-web navigation. */ }
    }
    for(const [url] of [...paths].sort((a,b)=>b[1]-a[1]).slice(0,3)){
      try { const result=parsePage(await read(url)); if(result.url.origin===home.url.origin)pages.push(result); }
      catch { /* Incomplete evidence remains in review. */ }
    }
    const name=identityName(row.name), city=normalizedBusinessName(row.city??"");
    const directoryPhone=phoneDigits(row.phone);
    const phonePage=pages.find(page=>
      directoryPhone?.length===10 && (page.links.some(link=>link.href.startsWith("tel:")&&phoneDigits(link.href)===directoryPhone)||
        page.entities.some(entity=>typeof entity.telephone==="string" && phoneDigits(entity.telephone)===directoryPhone)||
        page.lines.some(line=>(line.match(/(?:\+?\d[\s()-]*){10,15}/g)??[]).some(phone=>phoneDigits(phone)===directoryPhone))));
    const identityHeading=(page:Page)=>page.headings.find(value=>identityMatch(name,value,Boolean(phonePage))) ??
      page.entities.map(entity=>String(entity.name)).find(value=>identityMatch(name,value,Boolean(phonePage)));
    const namePage=pages.find(page=>name.length>=5 && identityHeading(page));
    const postalCode=row.address?.match(/\b\d{6}\b/)?.[0];
    const locationValues=(page:Page)=>[...page.headings,...page.lines,...page.entities.map(schemaAddress)];
    const postalMatch=postalCode?new RegExp(`\\b${postalCode}\\b`):null;
    const postalPage=postalMatch?pages.find(page=>locationValues(page).some(value=>postalMatch.test(value))):undefined;
    const addressPage=postalPage??pages.find(page=>city.length>=3&&locationValues(page).some(value=>matchesText(value,city)));
    const locationPage=phonePage??addressPage;
    if(!namePage||!locationPage){mismatched=true;continue;}
    observations.push(evidence("identity",identityHeading(namePage)!,namePage.url));
    observations.push(evidence("location",`Official site corroborates the listed ${phonePage?"business phone":postalPage?"postal code":"city"}`,locationPage.url));
    const parent=pages.find(page=>page.entities.some(entity=>identityMatch(name,String(entity.name),false)&&Boolean(entity.branchOf||entity.parentOrganization)));
    if(parent)return {status:"review",reason:"First-party markup shows a parent or branch; purchasing autonomy is unconfirmed",
      identityHost:host(home.url.hostname),websiteObservation:"parent_site",observations:[...observations,evidence("corporate","Matched organization declares a parent or branch relationship",parent.url)]};
    const corp=pages.flatMap(page=>page.lines.filter(line=>corporate.test(line)).map(line=>({line,page}))).at(0);
    if(corp)return {status:"excluded",reason:"Official site shows corporate or franchise control",
      identityHost:host(home.url.hostname), observations:[...observations,evidence("corporate",corp.line,corp.page.url)]};
    const owner=pages.flatMap(page=>page.lines.filter(line=>owned.test(line)||namedOperator.test(line)||
      localOperator.test(line)&&!(/(?:review|testimonial)/i.test(page.url.pathname))&&(!city||matchesText(line,city)||Boolean(phonePage)) ||
      /\b(?:co[\s‐‑-]*)?founder of |\bfounded\s|\b(?:co[\s‐‑-]*)?founder (?:and|&) (?:chief|principal)\b/i.test(line)&&
      (identityMatch(name,line,false)||/\/about-(?:dr|founder)/i.test(page.url.pathname)&&/\bfounder (?:and|&) (?:chief|principal)\b/i.test(line)))
      .map(line=>({line,page}))).at(0)
      ??pages.flatMap(page=>page.entities.filter(entity=>identityMatch(name,String(entity.name),false))
        .flatMap(entity=>[entity.founder].flat().flatMap(founder=>{
          const operator=typeof founder==="string"?founder:founder&&typeof founder==="object"&&"name" in founder?founder.name:null;
          return typeof operator==="string"&&/\p{L}.{2,85}/u.test(operator)?[{line:`First-party organization lists its founder: ${operator}`,page}]:[];
        }))).at(0);
    if(owner)observations.push(evidence("ownership",owner.line,owner.page.url));
    const permittedEmail=(email:string,roleOnly=false)=>{
      const normalized=email.toLowerCase();
      const mailbox=normalized.split("@")[0];
      const domain=normalized.split("@")[1];
      if(!domain||/^(?:example\.(?:com|net|org)|domain\.com)$/.test(domain)||/^(?:name|you|username|webmaster|developer|privacy|abuse|noreply)$/.test(mailbox))return false;
      return normalized===row.email?.toLowerCase()||host(domain)===host(home.url.hostname)&&(!roleOnly||
        /^(?:info|hello|contact|enquiry|enquiries|office|booking|appointments|reservations|sales|support)$/.test(mailbox));
    };
    const contacts=pages.flatMap(page=>page.links.flatMap(link=>{
      if(/^tel:[\d+() .-]{7,}$/i.test(link.href))return [{page,kind:"phone" as "phone"|"email"}];
      const email=link.href.match(/^mailto:([^\s?]+@[^\s?]+\.[a-z]{2,})(?:\?|$)/i)?.[1];
      return email&&permittedEmail(email)?[{page,kind:"email" as const}]:[];
    }));
    const listed=pages.find(page=>page.lines.some(line=>(line.match(/[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d.-]+\.[a-z]{2,}/gi)??[])
      .some(email=>permittedEmail(email,true))));
    const chat=pages.flatMap(page=>page.links.flatMap(link=>{
      try{
        const url=new URL(link.href);
        const phone=url.hostname==="wa.me"?url.pathname.slice(1):url.hostname==="api.whatsapp.com"?url.searchParams.get("phone"):null;
        return url.protocol==="https:"&&phone&&/^\+?\d{10,15}$/.test(phone)?[{page,kind:"phone" as const,label:link.label||"WhatsApp link"}]:[];
      }catch{return [];}
    })).at(0);
    const contact=contacts.find(route=>route.kind==="email")??(listed?{page:listed,kind:"email" as const}:undefined)??contacts[0]??chat;
    if(contact)observations.push(evidence("contact",`Official page publishes a business ${contact.kind} route`,contact.page.url));
    if(!owner)return {status:"review",reason:"Official domain matched; local ownership is not documented",
      identityHost:host(home.url.hostname),websiteObservation:"official_site",observations};
    const idea=pages.flatMap(page=>signals.filter(signal=>signal.type.test(row.title??""))
      .flatMap(signal=>page.lines.filter(line=>signal.pattern.test(line)).map(line=>({page,line,idea:signal.idea,fact:signal.fact})))).at(0);
    const phoneBooking=pages.flatMap(page=>page.links.filter(link=>/^tel:/i.test(link.href)&&/\b(?:book|reserv|appointment)/i.test(link.label))
      .map(link=>({page,line:link.label,idea:signals[0].idea,fact:signals[0].fact}))).at(0);
    const menu=pages.flatMap(page=>page.links.filter(link=>/\bmenu\b/i.test(link.label+" "+link.href)&&/\.(?:pdf|jpe?g|png|webp)(?:[?#]|$)/i.test(link.href))
      .map(link=>({page,line:link.label||"Menu linked as a PDF or image",fact:"Your site links to a document version of your menu.",
        idea:"We could make the document menu browsable and searchable on a phone, while keeping your existing menu design."}))).at(0);
    const emailBooking=pages.flatMap(page=>page.lines.filter(line=>/\b(?:e-?mail|write to)\b.{0,55}\b(?:book|appointment|reservation|quote|enquir)/i.test(line))
      .map(line=>({page,line,fact:"Your site gives customers an email route for enquiries or bookings.",
        idea:"We could add a short enquiry form that lets customers send the details your team needs in one step."}))).at(0);
    const hasBookingFlow=pages.some(page=>page.links.some(link=>/\b(?:book(?:ing)?|reserv(?:e|ation)|appointment)\b/i.test(link.label)&&
      /(?:calendly\.com|practo\.com|mydigitalclinic\.net|resy\.com|opentable\.|fresha\.com|mindbodyonline\.com)/i.test(link.href))||
      page.lines.some(line=>/\b(?:fill (?:out|in) (?:the |this )?form|choose (?:a|your) (?:date|time|slot))\b/i.test(line)));
    const chatOpportunity=chat&&/salon|fitness|gym|sport|studio|beauty|workshop|training|boutique|yoga/i.test(row.title??"")&&pages.some(page=>page.lines.some(line=>/\b(?:classes|memberships?|lessons|workshops?|private sessions|courses)\b/i.test(line)))
      ? {page:chat.page,line:chat.label,fact:"Your site sends customers to WhatsApp for enquiries.",
        idea:"We could build a short class enquiry that collects the class, location and preferred time before opening WhatsApp."}:undefined;
    const accommodationChat=chat&&/hotel|resort|lodging/i.test(row.title??"")&&pages.some(page=>page.lines.some(line=>/\b(?:rooms|cottages|stays|villa)\b/i.test(line)))
      ? {page:chat.page,line:chat.label,fact:"Your site links visitors to WhatsApp for enquiries.",
        idea:"We could give guests a short enquiry where they can share their dates, group size and preferred room before your team replies."}:undefined;
    const opportunity=menu??(hasBookingFlow?undefined:idea??phoneBooking??emailBooking??chatOpportunity??accommodationChat);
    if(!opportunity) return {status:"review",reason:"Local control documented; no supported digital opportunity was observed",
      identityHost:host(home.url.hostname),websiteObservation:"official_site",observations};
    observations.push(evidence("digital",opportunity.line,opportunity.page.url));
    return {status:"qualified",reason:contact?"Official evidence and public contact path verified":"Ownership and opportunity verified; no accepted contact path",
      identityHost:host(home.url.hostname),websiteObservation:"official_site",observations,evidence:{
        ownership:"independent",websiteStatus:"official_site",ownershipUrl:owner.page.url.href,opportunityUrl:opportunity.page.url.href,
        opportunity:opportunity.fact,serviceIdea:opportunity.idea,contactUrl:contact?.page.url.href,contactKind:contact?.kind,
        verifiedAt:now.toISOString(),
      }};
  }
  const restricted=/PUBLIC_ROBOTS_RESTRICTED|UNSAFE|HTTP_(?:400|401|403|404|410)|PUBLIC_CONTENT_REJECTED|PUBLIC_BODY_TOO_LARGE|PUBLIC_NETWORK_ENOTFOUND/.test(unreachable);
  return {status:mismatched||restricted?"review":"retry",reason:mismatched?"Candidate site did not match both business name and location/contact":unreachable,
    websiteObservation:mismatched?"unverified":"inaccessible",observations};
}
