import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { normalizedBusinessName, type BusinessEvidence } from "../packages/core/business-qualification";
import { publicWebsite } from "./business-web";

type Node = DefaultTreeAdapterTypes.Node;
type HtmlPage = { url:string;html:string };
export type BusinessObservation = {field:"identity"|"ownership"|"digital"|"contact"|"corporate";value:string;url:string;observedAt:string};
export type EvidenceInput = {name:string;city:string|null;title:string|null;website:string|null;email:string|null;phone:string|null};
export type EvaluatedBusiness = {
  status:"qualified"|"excluded"|"review"|"retry"; reason:string; observations:BusinessObservation[];
  identityHost?:string; evidence?:BusinessEvidence;
};
type Page = {url:URL;headings:string[];lines:string[];links:{label:string;href:string}[]};
const hidden = new Set(["script","style","noscript","template","svg"]);
const block = new Set(["p","li","div","section","article","td","h1","h2","h3","title","br","footer"]);
const within = (value:string,size=450) => value.replace(/\s+/g," ").trim().slice(0,size);
const host = (domain:string) => domain.toLowerCase().replace(/^www\./,"");

function cleanError(error:unknown) {
  return error instanceof Error && /^(?:UNSAFE|PUBLIC|ENOTFOUND|EAI_AGAIN|AbortError)[A-Z0-9_]*$/.test(error.message)
    ? error.message : "PUBLIC_PAGE_UNAVAILABLE";
}

function parsePage(input:HtmlPage):Page {
  const tree=parse(input.html);
  const headings:string[]=[], lines:string[]=[], links:Page["links"]=[];
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
    if(hidden.has(tag) || !("childNodes" in node))continue;
    if("attrs" in node && node.attrs.some(attr=>attr.name==="hidden" || attr.name==="aria-hidden"&&attr.value==="true" ||
      attr.name==="style"&&/display\s*:\s*none|visibility\s*:\s*hidden/i.test(attr.value))) continue;
    if(block.has(tag)&&current){lines.push(within(current));current="";}
    if(tag==="a" && links.length<250 && "attrs" in node){
      const href=node.attrs.find(attr=>attr.name==="href")?.value;
      if(href)anchor={node,href:href.slice(0,1600),text:""};
    }
    if(["title","h1","h2"].includes(tag)&&headings.length<28)heading={node,text:""};
    queue.push({node,close:true});
    for(let index=node.childNodes.length-1;index>=0;index--)queue.push({node:node.childNodes[index]});
  }
  return {url:new URL(input.url),headings:headings.filter(Boolean),lines:lines.filter(Boolean).slice(0,1400),links};
}

const directoryOrSocial = /(?:^|\.)(?:google\.[a-z.]+|goo\.gl|business\.site|facebook\.com|instagram\.com|linkedin\.com|linktr\.ee|youtube\.com|wa\.me|whatsapp\.com|zomato\.com|swiggy\.com|justdial\.com|practo\.com|tripadvisor\.[a-z.]+|wikipedia\.org|openstreetmap\.org)$/i;
const personalMail = /^(?:gmail\.com|googlemail\.com|outlook\.com|hotmail\.[a-z.]+|live\.com|proton\.[a-z.]+|yahoo\.[a-z.]+|icloud\.com|rediffmail\.com|gmx\.[a-z.]+|aol\.com|yandex\.[a-z.]+|mail\.ru|zoho\.com)$/i;
const sharedHost = /(?:^|\.)(?:wixsite\.com|wordpress\.com|blogspot\.[a-z.]+|godaddysites\.com|myshopify\.com|square\.site|google\.com)$/i;

export function websiteGuesses(row:EvidenceInput):string[]{
  const candidates:string[]=[];
  for(const value of [row.website, row.email?.includes("@")&&!personalMail.test(row.email.split("@").at(-1)??"")?row.email.split("@").at(-1):null]){
    if(!value)continue;
    try{
      const u=publicWebsite(/^https?:\/\//i.test(value)?value:"https://"+value);
      if(directoryOrSocial.test(u.hostname)||sharedHost.test(u.hostname))continue;
      u.search="";
      if(!candidates.some(item=>host(new URL(item).hostname)===host(u.hostname)))candidates.push(u.href);
    }catch { /* An untrusted source field supplies no candidate. */ }
  }
  return candidates;
}

const identityName = (name:string) => normalizedBusinessName(name).replace(/\b(?:pvt|private|limited|ltd|llp|inc)\b/g," ").replace(/\s+/g," ").trim();
const matchesText=(value:string,term:string)=>(" "+normalizedBusinessName(value)+" ").includes(" "+term+" ");
const phoneDigits=(value:string|null)=>value?.replace(/[^0-9]/g,"").slice(-10);
const owned = /\b(?:independently (?:owned|operated|run)|(?:family|owner|founder)[ -](?:owned|operated|run|led)|(?:founded|established|run|operated|owned) by|our (?:founder|owner)\b|founder (?:and|&) (?:owner|director))\b/i;
const corporate = /\b(?:become (?:our |a )?franchisee|franchise opportunities|franchise locations|franchise enquiry|nationwide chain|global chain|part of (?:the )?.{2,55} (?:group|holdings)|operated by .{2,55} franchis(?:ee|or))\b/i;
const actionPaths = /\b(?:about|contact|book(?:ing)?|appointments?|menu|visit|services|reservations?|enquir(?:e|ies))\b/i;
const signals=[
  {pattern:/\b(?:call|phone|telephone)\b.{0,65}\b(?:book|reserv|appointment|enquir)|\b(?:booking|reservations?|appointments?)\b.{0,55}\b(?:call|phone|telephone)\b/i,
    fact:"Your site gives customers a phone route for bookings or enquiries.",
    idea:"We could add a small enquiry option alongside your phone line so customers can request a callback with a preferred time.",type:/clinic|dent|salon|yoga|fitness|hotel|beauty|physio|restaurant/i},
  {pattern:/\b(?:for (?:a )?quote|request (?:a )?quote|quotation|pricing enquiries)\b/i,
    fact:"Your site invites customers to request a quote.",
    idea:"We could add a short quote brief that captures the service, timeline and main details for your team before replying.",type:/service|shop|design|photograph|repair|law|account|plumb|consult/i},
];

export async function evaluateBusiness(row:EvidenceInput, read:(url:string)=>Promise<HtmlPage>, now=new Date()):Promise<EvaluatedBusiness> {
  const urls=websiteGuesses(row), observations:BusinessObservation[]=[];
  if(!urls.length)return {status:"review",reason:"No first-party domain candidate in permitted listing data",observations};
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
        const weight=/\b(?:about|contact)\b/i.test(next.pathname+" "+link.label)?2:1;
        next.search="";
        if(next.href!==home.url.href) paths.set(next.href, weight);
      }catch { /* Skip non-web navigation. */ }
    }
    for(const [url] of [...paths].sort((a,b)=>b[1]-a[1]).slice(0,2)){
      try { const result=parsePage(await read(url)); if(result.url.origin===home.url.origin)pages.push(result); }
      catch { /* Incomplete evidence remains in review. */ }
    }
    const name=identityName(row.name), city=normalizedBusinessName(row.city??"");
    const namePage=pages.find(page=>name.length>=5 && page.headings.some(value=>matchesText(value,name)));
    const directoryPhone=phoneDigits(row.phone);
    const locationPage=pages.find(page=>page.lines.some(value=>city.length>=3 && matchesText(value,city)) ||
      directoryPhone?.length===10 && page.links.some(link=>link.href.startsWith("tel:")&&phoneDigits(link.href)===directoryPhone));
    if(!namePage||!locationPage){mismatched=true;continue;}
    observations.push(evidence("identity",namePage.headings.find(value=>matchesText(value,name))!,namePage.url));
    const corp=pages.flatMap(page=>page.lines.filter(line=>corporate.test(line)).map(line=>({line,page}))).at(0);
    if(corp)return {status:"excluded",reason:"Official site shows corporate or franchise control",
      identityHost:host(home.url.hostname), observations:[...observations,evidence("corporate",corp.line,corp.page.url)]};
    const owner=pages.flatMap(page=>page.lines.filter(line=>owned.test(line)).map(line=>({line,page}))).at(0);
    if(!owner)return {status:"review",reason:"Official domain matched; local ownership is not documented",
      identityHost:host(home.url.hostname),observations};
    observations.push(evidence("ownership",owner.line,owner.page.url));
    const contacts=pages.flatMap(page=>page.links.filter(link=>/^(?:mailto:[^\s?]+@[^\s?]+\.[a-z]{2,}(?:\?|$)|tel:[\d+() .-]{7,}$)/i.test(link.href))
      .map(link=>({page,kind:link.href.toLowerCase().startsWith("mailto:")?"email" as const:"phone" as const})));
    const contact=contacts.find(route=>route.kind==="email")??contacts[0];
    if(contact)observations.push(evidence("contact",`Official page publishes a business ${contact.kind} link`,contact.page.url));
    const idea=pages.flatMap(page=>signals.filter(signal=>signal.type.test(row.title??""))
      .flatMap(signal=>page.lines.filter(line=>signal.pattern.test(line)).map(line=>({page,line,idea:signal.idea,fact:signal.fact})))).at(0);
    const menu=pages.flatMap(page=>page.links.filter(link=>/menu/i.test(link.label+" "+link.href)&&/\.(?:pdf|jpe?g|png)(?:[?#]|$)/i.test(link.href))
      .map(link=>({page,line:link.label||"Menu linked as a PDF or image",fact:"Your site links to a document version of your menu.",
        idea:"We could make the document menu browsable and searchable on a phone, while keeping your existing menu design."}))).at(0);
    const opportunity=idea??menu;
    if(!opportunity) return {status:"review",reason:"Local control documented; no supported digital opportunity was observed",
      identityHost:host(home.url.hostname),observations};
    observations.push(evidence("digital",opportunity.line,opportunity.page.url));
    return {status:"qualified",reason:contact?"Official evidence and public contact path verified":"Ownership and opportunity verified; no accepted contact path",
      identityHost:host(home.url.hostname),observations,evidence:{
        ownership:"independent",websiteStatus:"official_site",ownershipUrl:owner.page.url.href,opportunityUrl:opportunity.page.url.href,
        opportunity:opportunity.fact,serviceIdea:opportunity.idea,contactUrl:contact?.page.url.href,contactKind:contact?.kind,
        verifiedAt:now.toISOString(),
      }};
  }
  return {status:mismatched?"review":"retry",reason:mismatched?"Candidate site did not match both business name and location/contact":unreachable,observations};
}
