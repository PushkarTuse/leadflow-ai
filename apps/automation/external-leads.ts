import {z} from 'zod';
import {hash, inputSchema, type LeadInput} from '../../packages/core/model';
import {cleanText} from '../../packages/core/scoring';
import {discoveryContextSchema, type DiscoveryContext} from '../../packages/core/qualification';
import type {Http} from './adapters';

export const externalSources = ['hackernews','osm','remoteok','arbeitnow','jobicy'] as const;
const rowSchema = z.object({
  source:z.enum(externalSources), source_id:z.string().min(1).max(500),
  category:z.enum(['local_business','company_hiring','freelance_request']),
  name:z.string().max(500), title:z.string().max(2000).nullish(),
  url:z.string().max(2000), city:z.string().max(500).nullish(), country:z.string().max(500).nullish(),
  found_at:z.string().datetime(),
});
const pageSchema = z.object({ok:z.literal(true),total:z.number().int().nonnegative(),
  count:z.number().int().min(0).max(5), offset:z.number().int().nonnegative(),
  leads:z.array(z.unknown()).max(5)});

/** Only a configured HTTPS origin can receive the bearer token. No paths/credentials/ports. */
export function externalOrigin(value:string):string {
  if (!/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i.test(value) || /\.(?:local|localhost|internal)$/i.test(value))
    throw new Error('Invalid external API origin');
  return value;
}

/** One official HN parent read. Missing or failed parents do not fail the candidate. */
const HN_THREAD_FETCH_BUDGET = 1;
const SAFE_LINK = /^https?:\/\/[^\s/@]+(?:[/:?#][^\s]*)?$/i;

function decodeEntities(value:string):string {
  return value
    .replace(/&#x([0-9a-f]+);/gi,(_,h:string)=>String.fromCodePoint(parseInt(h,16)))
    .replace(/&#(\d+);/g,(_,d:string)=>String.fromCodePoint(Number(d)))
    .replace(/&quot;/gi,'"')
    .replace(/&apos;/gi,"'")
    .replace(/&nbsp;/gi,' ')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&amp;/gi,'&');
}

/** Decode HN HTML into paragraph-preserving plain text without touching the raw original. */
function hnDecodedText(html:string):string {
  return decodeEntities(html
    .replace(/<\s*p\b[^>]*>/gi,'\n\n')
    .replace(/<\s*br\s*\/?\s*>/gi,'\n')
    .replace(/<[^>]*>/g,''))
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

function hnLinkTargets(html:string):string[] {
  const found:string[]=[];
  const seen=new Set<string>();
  const hrefRe=/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  let match:RegExpExecArray|null;
  while((match=hrefRe.exec(html))){
    const target=decodeEntities(match[1] ?? match[2] ?? match[3] ?? '').trim();
    if(!SAFE_LINK.test(target) || target.length>2000 || seen.has(target)) continue;
    seen.add(target);
    found.push(target);
    if(found.length>=10) break;
  }
  return found;
}

function fetchHnThread(http:Http, parentId:number):unknown|undefined {
  if(HN_THREAD_FETCH_BUDGET<1) return undefined;
  try{return http.json(`https://hacker-news.firebaseio.com/v0/item/${parentId}.json`);}
  catch{return undefined;}
}

export function externalToLead(raw:unknown, hnItem?:unknown, hnThread?:unknown):LeadInput {
  const row=rowSchema.parse(raw);
  const hn=row.source==='hackernews';
  let title=cleanText(row.title || row.name), description='', posted_at:string|undefined;
  let discovery_context:DiscoveryContext|undefined;
  if(hn){
    if(!/^[1-9]\d{0,14}$/.test(row.source_id))throw new Error('Invalid HN id');
    const item=z.object({id:z.number().int().positive(),type:z.enum(['comment','job']),
      text:z.string().optional(),title:z.string().optional(),time:z.number().int().positive().optional(),
      by:z.string().optional(),parent:z.number().int().positive().optional(),
      dead:z.boolean().optional(),deleted:z.boolean().optional()}).parse(hnItem);
    if(String(item.id)!==row.source_id)throw new Error('Unavailable HN item');
    const unavailable=Boolean(item.dead||item.deleted);
    description=cleanText(item.text || item.title || '');
    title=cleanText(item.title || description).slice(0,200);
    if(!unavailable && row.category==='freelance_request' && !/^seeking freelancer\b/i.test(description))
      throw new Error('HN hiring intent mismatch');
    if(item.time) posted_at=new Date(item.time*1000).toISOString();
    const rawText=item.text || '';
    const decodedBody=hnDecodedText(rawText || item.title || '');
    const truncated=decodedBody.length>12000;
    const thread=z.object({id:z.number().int().positive(),title:z.string().optional(),
      time:z.number().int().positive().optional()}).safeParse(hnThread);
    discovery_context=discoveryContextSchema.parse({
      provider:'hackernews',
      provider_record_id:String(item.id),
      original_url:`https://news.ycombinator.com/item?id=${item.id}`,
      item_type:item.type,
      author_handle:(item.by || '').slice(0,120),
      parent_id:item.parent?String(item.parent):'',
      thread_id:thread.success?String(thread.data.id):'',
      thread_title:thread.success?(thread.data.title || '').slice(0,300):'',
      thread_date:thread.success&&thread.data.time?new Date(thread.data.time*1000).toISOString():null,
      original_title:(item.title || '').slice(0,300),
      raw_text:rawText.length>20000?rawText.slice(0,20000):rawText,
      decoded_text:truncated?decodedBody.slice(0,12000):decodedBody,
      published_at:item.time?new Date(item.time*1000).toISOString():null,
      collected_at:row.found_at,
      fetched_at:row.found_at,
      tags:[row.category],
      location:'',
      contact_link_targets:hnLinkTargets(rawText),
      deleted:Boolean(item.deleted),
      dead:Boolean(item.dead),
      source_hash:hash(rawText || item.title || ''),
      truncated,
      complete:!truncated,
    });
  }else{
    // These are observed fields, not a fabricated project brief or a claimed original body.
    description=cleanText(`Listing title: ${title}\nListed business: ${row.name}\nListed location: ${[row.city,row.country].filter(Boolean).join(', ')}`);
  }
  const externalId=hn?row.source_id:`${row.source}:${row.source_id}`;
  return inputSchema.parse({source:hn?'hn':'csv',
    source_external_id:externalId.length<=160?externalId:`${row.source}:hash:${hash(row.source_id)}`,
    source_url:hn?`https://news.ycombinator.com/item?id=${row.source_id}`:row.url,
    title:title.slice(0,200),raw_description:description,discovered_at:row.found_at,
    ...(posted_at?{posted_at}:{}),client_name_if_public:hn?'':cleanText(row.name).slice(0,120),
    country_or_region:cleanText([row.city,row.country].filter(Boolean).join(', ')).slice(0,100),
    contact_permission_state:'UNKNOWN',contact_email:'',
    contact_channel:'Review original listing instructions manually',
    owner_notes:`External leadflow-leads; provider=${row.source}; category=${row.category}. ${hn?'Original HN text/time verified via official API.':'Incomplete listing summary; original description/date unavailable; verify fit and source terms manually. OSM attribution: © OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright).'} Producer score/status/contact fields ignored. No opt-in or sending authority.`,
    ...(discovery_context?{discovery_context}:{}),
  });
}

export function pullExternalLeads(http:Http, options:{origin:string;token:string;offset:number;limit:number;allowedSources:readonly string[]},
  ingest:(lead:LeadInput)=>{duplicate:boolean}, guard:()=>void=()=>{}) {
  const origin=externalOrigin(options.origin);
  if(options.token.length<32 || /[\r\n]/.test(options.token))throw new Error('External API token must be at least 32 characters');
  if(!Number.isInteger(options.limit)||options.limit<1||options.limit>5||!Number.isInteger(options.offset)||options.offset<0)
    throw new Error('Invalid external page bounds');
  if(!options.allowedSources.length||options.allowedSources.some(s=>!externalSources.includes(s as typeof externalSources[number])))
    throw new Error('Invalid external source allowlist');
  guard();
  const page=pageSchema.parse(http.json(`${origin}/leads?sort=found_at&order=asc&limit=${options.limit}&offset=${options.offset}`,
    {headers:{Authorization:`Bearer ${options.token}`}}));
  if(page.offset!==options.offset || page.count!==page.leads.length || page.count>options.limit)throw new Error('External page mismatch');
  const counts={imported:0,duplicates:0,invalid:0};
  for(const raw of page.leads){
    guard();
    const parsed=rowSchema.safeParse(raw);
    if(!parsed.success||!options.allowedSources.includes(parsed.data.source)){counts.invalid++;continue;}
    const row=parsed.data;
    if(row.source==='hackernews'&&!/^[1-9]\d{0,14}$/.test(row.source_id)){counts.invalid++;continue;}
    // Provider failures abort this page; cursor is not committed and retries deduplicate prior writes.
    const item=row.source==='hackernews'?http.json(`https://hacker-news.firebaseio.com/v0/item/${row.source_id}.json`):undefined;
    const record=item && typeof item==='object'?item as {parent?:unknown}:undefined;
    const parent=typeof record?.parent==='number'&&record.parent>0?record.parent:0;
    const thread=parent>0?fetchHnThread(http,parent):undefined;
    let lead:LeadInput;
    try{lead=externalToLead(raw,item,thread);}catch{counts.invalid++;continue;}
    if(lead.discovery_context?.dead||lead.discovery_context?.deleted){counts.invalid++;continue;}
    ingest(lead).duplicate?counts.duplicates++:counts.imported++;
  }
  return {...counts,nextOffset:page.count===0||options.offset+page.count>=page.total?0:options.offset+page.count};
}
