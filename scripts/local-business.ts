import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { businessDraft, validateBusinessCopy } from "../packages/core/business-draft";
import { businessHost, businessOutreachGate, digitalStatuses, normalizedBusinessName, qualifyBusiness, type BusinessEvidence, type BusinessQualification } from "../packages/core/business-qualification";
import { localDraftCopy, localOwnershipScreen } from "./ollama-local";
import { evaluateBusiness, websiteGuesses, type EvaluatedBusiness } from "./business-evidence";
import { publicPageReader } from "./business-web";
import { z } from "zod";
import { discoveryBackupBaseUrls, loopbackOrigin } from "./external-local-config.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dataDirectory = join(root, "data", "local-business");
const aiHoldReason = "AI flagged a possible chain or parent brand. Verify ownership before drafting.";
const draftDirectory = join(root, "outputs", "local-business");
const draftReviewPath = join(dataDirectory,"draft-review.json");
const sources = ["osm", "overture", "fsq_os"] as const;
type Source = typeof sources[number];
type Location = { city: string; country: string; lat: number; lng: number };
export type Business = {
  id: number; source: Source; source_id: string; name: string; title: string | null; city: string | null;
  country: string | null; website: string | null; email: string | null; phone: string | null;
  address?:string|null;
  rating_count?: number | null; url: string | null; category: string;
  tags?: string[]; qualification?: BusinessQualification;
  status?: string; found_at?: string;
  evidence?: BusinessEvidence; outreach?: ReturnType<typeof businessOutreachGate>;
  enrichment?: EvaluatedBusiness & {nextAt:string; fingerprint:string; hintHost?:string; evaluatedAt?:string; rulesVersion?:number};
  processing?:boolean;
};
type SourceResult = { source: Source; status: string; fetched: number; inserted: number; shown?: number };
export interface BusinessScan {
  query: string;
  countrySample: boolean;
  updatedAt: string;
  freshSince?:string;
  enrichmentUpdatedAt?:string;
  cities: { city: string; country: string; sources: SourceResult[]; rows: Business[] }[];
}

async function settings() {
  const local = await readFile(join(root, ".env.external"), "utf8").then(parseEnv, () => ({}));
  return { ...local, ...process.env };
}

async function worker() {
  const env = await settings();
  const origin = loopbackOrigin(env.EXTERNAL_LEADS_API_ORIGIN);
  const token = env.EXTERNAL_LEADS_API_TOKEN || parseEnv(await readFile(join(root, "../leadflow-leads/.dev.vars"), "utf8")).API_TOKEN;
  if (!token) throw new Error("Local lead API token missing");
  return async <T>(path: string, body?: object): Promise<T> => {
    const response = await fetch(origin + path, { method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: "error", signal: AbortSignal.timeout(65000) });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { state?: string; error?: string } | null;
      const detail = result?.error?.match(/responded \d{3}|^[A-Z0-9_]{3,45}$/)?.[0];
      throw new Error([`HTTP ${response.status}`, detail].filter(Boolean).join(" · "));
    }
    return await response.json() as T;
  };
}

export { worker as localLeadWorker };

async function placeData<T>(input: object): Promise<T> {
  const env = await settings();
  const virtualEnv = join(root, ".venv/local-business", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const python = env.LOCAL_BUSINESS_PYTHON || await access(virtualEnv).then(() => virtualEnv, () => "python");
  return new Promise((resolve, reject) => {
    const child = execFile(python, [join(root, "scripts/local-business-data.py")],
      { cwd: root, timeout: 110000, maxBuffer: 3_000_000, windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
          const reason = stderr.includes("No module named 'overturemaps'") ? "Overture Python reader is missing"
            : error.killed ? "Open data request timed out" : stderr.trim().split("\n").at(-1)?.slice(0, 155) || "Open data request failed";
          reject(new Error(reason));
          return;
        }
        try { resolve(JSON.parse(stdout) as T); } catch { reject(new Error("Invalid open data response")); }
      });
    child.stdin?.on("error", () => {});
    child.stdin?.end(JSON.stringify(input));
  });
}

export async function readBusinessScan(metros = false): Promise<BusinessScan | null> {
  const name = metros ? "metros.json" : "latest.json";
  try {
    const scan = JSON.parse(await readFile(join(dataDirectory, name), "utf8")) as BusinessScan;
    const records=await enrichmentRecords();
    const current=await readFile(batchPath,"utf8").then(value=>JSON.parse(value) as {pid:number;keys:string[]},()=>null);
    if(current && Number.isSafeInteger(current.pid) && current.pid>0){
      try { process.kill(current.pid,0);
        const keys=new Set(current.keys);
        for(const city of scan.cities)for(const row of city.rows)row.processing=keys.has(recordKey(row));
      }catch { /* A stopped process leaves its completed checkpoints available. */ }
    }
    scan.enrichmentUpdatedAt=Object.values(records).flatMap(record=>record.evaluatedAt??record.observations[0]?.observedAt??[]).sort().at(-1);
    return labelBusinesses(scan, await evidenceRecords(),records);
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

const evidencePath = join(dataDirectory, "evidence.json");
const enrichmentPath = join(dataDirectory,"enrichment-v1.json");
const batchPath=join(dataDirectory,"enrichment-batch.json");
const pausePath=join(dataDirectory,"enrichment.pause");
const recordKey = (row: Pick<Business,"source"|"source_id">) => JSON.stringify([row.source, row.source_id]);
const fingerprintBusiness=(row:Business)=>createHash("sha256").update(JSON.stringify([
  row.name,row.title,row.city,row.country,row.website,row.email,row.phone,row.tags,
])).digest("hex");
type EnrichmentRecords=Record<string,NonNullable<Business["enrichment"]>>;
async function enrichmentRecords():Promise<EnrichmentRecords>{
  try {return JSON.parse(await readFile(enrichmentPath,"utf8"));}
  catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return {};throw error;}
}
async function evidenceRecords(): Promise<Record<string, BusinessEvidence>> {
  try { return JSON.parse(await readFile(evidencePath, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw error; }
}
const publicSource = z.url().max(1200).refine(value => {
  const u = new URL(value);
  return u.protocol === "https:" && !u.username && !u.password && !u.port &&
    /\.[a-z]{2,}$/i.test(u.hostname) && !/\.(?:local|localhost|internal)$/i.test(u.hostname);
});
const evidenceInput = z.object({ id: z.number().int().positive(), source: z.enum(sources), sourceId: z.string().min(1),
  ownership: z.enum(["independent","locally_controlled","corporate"]),
  websiteStatus: z.enum(digitalStatuses), ownershipUrl: publicSource, opportunityUrl: publicSource,
  opportunity: z.string().trim().min(12).max(350), contactUrl: z.union([z.literal(""),publicSource]).optional(),
  serviceIdea: z.union([z.literal(""),z.string().trim().min(20).max(250).regex(/^We could\b/i)]).optional(),
  subjectIdea: z.string().trim().max(84).regex(/^[^\u0000-\u001f\u007f]*$/).optional(),
}).strict();

export async function reviewLocalDraft(raw: unknown) {
  const { id, fingerprint, decision } = z.object({ id:z.number().int().positive(),
    fingerprint:z.string().regex(/^[0-9a-f]{64}$/),decision:z.enum(["approved","rejected"]) }).strict().parse(raw);
  const current = await readFile(join(draftDirectory,`draft-${id}.eml`));
  if (createHash("sha256").update(current).digest("hex") !== fingerprint)
    throw new Error("Draft changed. Reload and review it again.");
  const history: Record<string, {decision:string;at:string}> = await readFile(draftReviewPath,"utf8")
    .then(value=>JSON.parse(value),error=>{ if(error.code==="ENOENT") return {}; throw error; });
  history[fingerprint] = {decision,at:new Date().toISOString()};
  const temporary = draftReviewPath + ".tmp";
  await writeFile(temporary,JSON.stringify(history));
  await rename(temporary,draftReviewPath);
  return history[fingerprint];
}

export async function recordBusinessEvidence(input: unknown) {
  const { id, source, sourceId, ...facts } = evidenceInput.parse(input);
  const api = await worker();
  const { lead } = await api<{ lead: Business }>(`/leads/${id}`);
  if (!lead || !isBusiness(lead) || lead.source !== source || lead.source_id !== sourceId)
    throw new Error("Business identity changed");
  const records = await evidenceRecords();
  records[recordKey(lead)] = { ...facts, contactUrl: facts.contactUrl || undefined, verifiedAt: new Date().toISOString() };
  await mkdir(dataDirectory, { recursive: true });
  const tmp = evidencePath + ".tmp";
  await writeFile(tmp, JSON.stringify(records));
  await rename(tmp, evidencePath);
  return businessOutreachGate(qualifyBusiness(lead), records[recordKey(lead)]);
}

function labelBusinesses(scan: BusinessScan, evidence: Record<string, BusinessEvidence>, enrichment:EnrichmentRecords = {}): BusinessScan {
  const appearances = new Map<string, Set<string>>();
  for (const { city, rows } of scan.cities) for (const row of rows) {
    const name = normalizedBusinessName(row.name);
    const cities = appearances.get(name) ?? new Set<string>();
    cities.add(city);
    appearances.set(name, cities);
  }
  const represented = new Set<string>();
  const sorted=scan.cities.flatMap(city=>city.rows).sort((a,b)=>a.id-b.id);
  for (const row of sorted) {
    const rules = qualifyBusiness(row, (appearances.get(normalizedBusinessName(row.name))?.size ?? 0) >= 3);
    if (rules.status !== "prospect" || !row.qualification) row.qualification = rules;
    const automated=enrichment[recordKey(row)];
    row.enrichment=automated?.fingerprint===fingerprintBusiness(row)?automated:undefined;
    const savedEvidence=evidence[recordKey(row)];
    const humanEvidence=savedEvidence && (!scan.freshSince || savedEvidence.verifiedAt>=scan.freshSince) ? savedEvidence:undefined;
    row.evidence = humanEvidence ?? row.enrichment?.evidence;
    row.outreach = businessOutreachGate(row.qualification, row.evidence);
    if(!humanEvidence && row.enrichment && row.outreach.status!=="excluded"){
      if(row.enrichment.status==="excluded")row.outreach={status:"excluded",reason:row.enrichment.reason,score:0,contactable:false,draftReady:false};
      if(row.enrichment.status==="retry"||row.enrichment.status==="review")
        row.outreach={status:"review",reason:row.enrichment.reason,score:0,contactable:false,draftReady:false};
    }
    if(row.outreach.status==="qualified" && row.enrichment?.identityHost){
      const identity=[row.enrichment.identityHost,normalizedBusinessName(row.name),row.country].join("|");
      if(represented.has(identity))row.outreach={status:"review",reason:"Same verified business name and official host already represented",score:0,contactable:false,draftReady:false};
      else represented.add(identity);
    }
  }
  return scan;
}

const evidenceRulesVersion=2;
type EnrichmentOptions = {backlog?:boolean; cities?:string[]; updatedRules?:boolean; retriesOnly?:boolean; target?:number};
export async function pauseBusinessEnrichment(){ await writeFile(pausePath,"Pause after the current three records.\n"); }

export async function enrichBusinessScan(metros = true, maximum = 18, recheck = false, options:EnrichmentOptions = {}) {
  if(!Number.isInteger(maximum)||maximum<1||maximum>(options.backlog?5000:300))throw new Error("Invalid enrichment limit");
  await mkdir(dataDirectory,{recursive:true});
  const lock=enrichmentPath+".lock";
  const lease=await open(lock,"wx").catch(async error=>{
    if(error.code!=="EEXIST")throw error;
    const reclaimPath=lock+".reclaim";
    const reclaim=await open(reclaimPath,"wx");
    try{
      const pid=Number(await readFile(lock,"utf8"));
      if(!Number.isSafeInteger(pid)||pid<=0)throw error;
      try {process.kill(pid,0);}
      catch(check){
        if((check as NodeJS.ErrnoException).code!=="ESRCH")throw error;
        await unlink(lock);
        return await open(lock,"wx");
      }
      throw error;
    }finally{
      try{await reclaim.close();}finally{await unlink(reclaimPath);}
    }
  });
  try {
    await lease.writeFile(String(process.pid));
    await unlink(pausePath).catch(error=>{if(error.code!=="ENOENT")throw error;});
    const scan=await readBusinessScan(metros);
    if(!scan)throw new Error("Run a business scan first");
    const records=await enrichmentRecords();
    const human=await evidenceRecords();
    const start=Date.now(), deadline=options.backlog?Number.POSITIVE_INFINITY:start+9*60_000;
    const counts={qualified:0,excluded:0,review:0,retry:0}, reasons:Record<string,number>={};
    const hint=(row:Business)=>{
      if(!recheck || !scan.freshSince)return;
      const prior=human[recordKey(row)];
      if(!prior || prior.verifiedAt>=scan.freshSince || prior.websiteStatus!=="official_site")return;
      if(row.enrichment?.hintHost===businessHost(prior.ownershipUrl) && Date.parse(row.enrichment.nextAt)>start)return;
      if(!row.enrichment || !websiteGuesses(row).some(url=>businessHost(url)===businessHost(prior.ownershipUrl)))
        return prior.ownershipUrl;
    };
    const selectedCities=new Set(options.cities?.map(city=>city.trim().toLowerCase()));
    const qualifiedByCity=new Map(scan.cities.map(city=>[city.city,city.rows.filter(row=>row.outreach?.status==="qualified").length]));
    const due=(row:Business)=>{
      const previous=row.enrichment;
      if(options.retriesOnly)return previous?.status==="retry"&&Date.parse(previous.nextAt)<=start;
      if(!previous)return !options.updatedRules;
      if(options.updatedRules)return previous.status==="review" && (previous.rulesVersion??0)<evidenceRulesVersion &&
        !/robots|http_40[134]|parent|corporate/i.test(previous.reason) && websiteGuesses(row).length>0;
      return previous.status!=="excluded"&&Date.parse(previous.nextAt)<=start;
    };
    const prospects=scan.cities.filter(city=>!selectedCities.size||selectedCities.has(city.city.toLowerCase())).map(city=>city.rows
      .filter(row=>row.outreach?.status!=="excluded"&&(!human[recordKey(row)]||scan.freshSince&&human[recordKey(row)].verifiedAt<scan.freshSince) &&
        (recheck ? Boolean(hint(row)) : due(row)))
      .sort((a,b)=>priority(b)-priority(a)));
    function priority(row:Business){
      return Number(websiteGuesses(row).length>0)*20+Number(Boolean(row.email))*5+
        Number(/clinic|dent|salon|restaurant|bakery|fitness|studio|services|photo/i.test(row.title??""))*4+
        Number(Boolean(row.phone));
    }
    const picks:Business[]=[];
    let index=0;
    while(picks.length<maximum && prospects.some(rows=>index<rows.length)){
      for(const rows of prospects)if(rows[index]&&picks.length<maximum)picks.push(rows[index]);
      index++;
    }
    const read=publicPageReader();
    for(let offset=0;offset<picks.length&&Date.now()<deadline;offset+=3){
      if(await access(pausePath).then(()=>true,()=>false))break;
      const batch=picks.slice(offset,offset+3).filter(row=>!options.target||(qualifiedByCity.get(row.city??"")??0)<options.target);
      if(!batch.length)continue;
      const batchTemporary=batchPath+".tmp";
      await writeFile(batchTemporary,JSON.stringify({pid:process.pid,keys:batch.map(recordKey)}));
      await rename(batchTemporary,batchPath);
      const results=await Promise.all(batch.map(row=>evaluateBusiness({...row,website:hint(row)||row.website},read)));
      for(const [i,result] of results.entries()){
        const row=batch[i];
        counts[result.status]++;
        if(result.status==="qualified"&&row.outreach?.status!=="qualified"&&row.city){
          qualifiedByCity.set(row.city,(qualifiedByCity.get(row.city)??0)+1);
        }
        reasons[result.reason]=(reasons[result.reason]??0)+1;
        const retryHours=/TIMEOUT|ECONNRESET|HTTP_(?:502|503|504)/.test(result.reason)?2:24;
        records[recordKey(row)]={...result,fingerprint:fingerprintBusiness(row),evaluatedAt:new Date().toISOString(),rulesVersion:evidenceRulesVersion,
          ...(recheck?{hintHost:businessHost(hint(row)??null)}:{}),
          nextAt:new Date(Date.now()+(result.status==="retry"?retryHours:result.status==="review"?7*24:30*24)*3600000).toISOString()};
      }
      const temporary=enrichmentPath+".tmp";
      await writeFile(temporary,JSON.stringify(records));
      await rename(temporary,enrichmentPath);
    }
    return {counts,reasons,evaluated:Object.values(counts).reduce((a,b)=>a+b,0),selected:picks.length,
      paused:await access(pausePath).then(()=>true,()=>false),elapsedMs:Date.now()-start,
      scan:labelBusinesses(scan,human,records)};
  }finally{
    try {await unlink(batchPath).catch(error=>{if(error.code!=="ENOENT")throw error;});}
    finally{try {await lease.close();}finally{await unlink(lock);}}
  }
}

async function saveBusinessScan(scan: BusinessScan, name: string) {
  const destination = join(dataDirectory, name);
  const tmp = destination + `.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(scan));
  await rename(tmp, destination);
}

function isBusiness(row: Business): boolean {
  return row.category === "local_business" && sources.includes(row.source) && Boolean(row.name?.trim());
}

export async function runBusinessScan(term: string, onCity?: (city: BusinessScan["cities"][number]) => void, budget = 250): Promise<BusinessScan> {
  const query = term.trim();
  if (!Number.isInteger(budget) || budget < 20 || budget > 400) throw new Error("Business budget must be 20–400 per city");
  const perSource = Math.floor(budget / 2);
  if (!query || query.length > 100 || /[\u0000-\u001f\u007f]/.test(query)) throw new Error("Enter a city or country");
  const api = await worker();
  await api("/sources");
  const { locations, countrySample } = await placeData<{ locations: Location[]; countrySample: boolean }>({ action: "resolve", location: query });
  const scan: BusinessScan = { query, countrySample, updatedAt: new Date().toISOString(), cities: [] };
  const startedAt = scan.updatedAt;
  if(process.env.LEADFLOW_FRESH_ONLY==="true")scan.freshSince=startedAt;
  let osmEnabled = (await settings()).LOCAL_BUSINESS_OSM_ENABLED !== "false";
  const evidence = await evidenceRecords();
  await mkdir(dataDirectory, { recursive: true });
  for (const place of locations) {
    const osm = async () => !osmEnabled ? {fetched:0,inserted:0,state:"OSM paused for this run"} : api<{ fetched: number; inserted: number; state?: string }>("/collect/osm",
      { city: place.city, lat: place.lat, lng: place.lng, radius: 8500, tag: "business", limit: perSource });
    const [osmResult, prepared] = await Promise.allSettled([osm(),placeData<{rows:object[];manifest:object}>({action:"overture",place,target:budget})]);
    if(osmResult.status==="rejected" && /HTTP 429|HTTP 50[234]|timed out/i.test(String(osmResult.reason)))osmEnabled=false;
    const osmCount=osmResult.status==="fulfilled"?osmResult.value.fetched:0;
    const overtureBudget=Math.max(1,budget-osmCount);
    const overture = async () => {
      if(prepared.status==="rejected")throw prepared.reason;
      const collected=prepared.value;
      if (!collected.rows.length) return { fetched: 0, inserted: 0, state: "No matching places" };
      return api<{ fetched: number; inserted: number }>("/import/overture", { leads: collected.rows.slice(0,overtureBudget), manifest: collected.manifest });
    };
    const polled = [osmResult,...await Promise.allSettled([overture()])];
    const batches = await Promise.allSettled(sources.map(async source=>{
      const cap=source==="overture"?overtureBudget:perSource;
      const query=new URLSearchParams({source,category:"local_business",status:"new",verified_prospects:"true",city:place.city,
        limit:String(Math.min(cap,200)),...(process.env.LEADFLOW_FRESH_ONLY==="true"?{since:startedAt}:{})});
      const first=await api<{leads:Business[];total:number}>("/leads?"+query);
      if(cap>200&&first.total>200){
        query.set("offset","200");query.set("limit",String(cap-200));
        const second=await api<{leads:Business[]}>("/leads?"+query);
        return {...first,leads:[...first.leads,...second.leads]};
      }
      return first;
    }));
    const rows: Business[] = [];
    const reports = sources.map((source, index): SourceResult => {
      const result = polled[index];
      const batch = batches[index];
      const matching = batch.status === "fulfilled" ? batch.value.leads.filter(row =>
        isBusiness(row) && (row.country === place.country || (row.source === "osm" && !row.country)) &&
        row.city?.toLowerCase() === place.city.toLowerCase()) : [];
      rows.push(...matching);
      const status = result?.status === "rejected" ? (result.reason as Error).message.slice(0, 170)
        : result?.status === "fulfilled" ? ("state" in result.value && result.value.state) || "OK"
        : matching.length ? "Imported inventory" : "No open-data import for this city";
      return { source, status: batch.status === "rejected" ? status + " · inventory unavailable" : status,
        fetched: result?.status === "fulfilled" ? result.value.fetched : 0,
        inserted: result?.status === "fulfilled" ? result.value.inserted : 0, shown: matching.length };
    });
    // The Worker merges verified observations where identity matches.
    const identities = new Map<number, Business>();
    for (const row of rows) identities.set(row.id, { ...row, country: place.country });
    const city = { city: place.city, country: place.country, sources: reports, rows: [...identities.values()] };
    scan.cities.push(city);
    scan.updatedAt = new Date().toISOString();
    labelBusinesses(scan, evidence);
    if (query === "india-metros") await saveBusinessScan(scan, "metros.json");
    await saveBusinessScan(scan, "latest.json");
    onCity?.(city);
  }
  return scan;
}

async function rebuildMetroSnapshot() {
  const scan = await readBusinessScan(true);
  if (!scan) throw new Error("No metro snapshot to rebuild");
  const api = await worker();
  for (const city of scan.cities) {
    const times = city.rows.flatMap(row=>row.found_at?[row.found_at]:[]).sort();
    if (!times.length) continue;
    const saved = new Map(city.rows.map(row=>[row.id,row]));
    for (const report of city.sources.filter(source=>source.fetched > 0)) {
      const query = new URLSearchParams({source:report.source, category:"local_business", status:"new",
        verified_prospects:"true", city:city.city, since:times[0], limit:"200"});
      const { leads } = await api<{leads:Business[]}>("/leads?"+query);
      const matching = leads.filter(row=>row.city?.toLowerCase()===city.city.toLowerCase() &&
        (row.country===city.country || row.source==="osm" && !row.country));
      report.shown = matching.length;
      for (const row of matching) if (!saved.has(row.id)) saved.set(row.id,{...row,country:city.country});
    }
    city.rows = [...saved.values()];
  }
  labelBusinesses(scan,await evidenceRecords());
  scan.updatedAt = new Date().toISOString();
  await saveBusinessScan(scan,"metros.json");
  if ((await readBusinessScan())?.query === "india-metros") await saveBusinessScan(scan,"latest.json");
  console.log(JSON.stringify(scan.cities.map(city=>({city:city.city,shown:city.rows.length}))));
}

const draftCooldown = new Map<string, number>();
async function askBusinessAi<T>(instruction: string, outputLimit: number, validate: (payload: unknown) => T | undefined) {
  const env = await settings();
  const urls = discoveryBackupBaseUrls(env.CLOUDFLARE_ACCOUNT_ID);
  const geminiModel = env.GEMINI_MODEL || "";
  const providers = [
    { id: "Gemini", key: env.GEMINI_API_KEY, model: geminiModel,
      url: env.GEMINI_ENABLED === "true" && env.GEMINI_DATA_USE_APPROVED === "true" &&
        env.GEMINI_FREE_TIER_CONFIRMED === "true" && /^[\w.-]+$/.test(geminiModel)
        ? `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent` : "" },
    { id: "Groq", key: env.GROQ_API_KEY, model: "openai/gpt-oss-120b", url: urls.groq },
    { id: "Cloudflare", key: env.CLOUDFLARE_AI_API_TOKEN, model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", url: urls.cloudflare },
    { id: "OpenRouter", key: env.OPENROUTER_API_KEY, model: "openrouter/free", url: urls.openrouter },
  ];
  for (const provider of providers) {
    const gemini = provider.id === "Gemini";
    if (!provider.key || !provider.url || (draftCooldown.get(provider.id) ?? 0) > Date.now() ||
      (!gemini && !(env.AI_DATA_USE_APPROVED === "true" && env.AI_ENABLED === "true"))) continue;
    try {
      const response = await fetch(gemini ? provider.url : provider.url + "/chat/completions", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json", ...(gemini ? { "x-goog-api-key": provider.key }
          : { Authorization: `Bearer ${provider.key}` }) },
        body: JSON.stringify(gemini ? { contents: [{ parts: [{ text: instruction }] }],
          generationConfig: { temperature: 0, maxOutputTokens: outputLimit, responseMimeType: "application/json" } } :
          { model: provider.model, messages: [{ role: "user", content: instruction }],
            temperature: 0, response_format: { type: "json_object" },
            ...(provider.id === "Groq" ? { max_completion_tokens: outputLimit + 160, reasoning_effort: "low" } : { max_tokens: outputLimit }) }),
      });
      if ([402, 429, 503].includes(response.status)) {
        const seconds = Number(response.headers.get("retry-after")) || 60;
        draftCooldown.set(provider.id, Date.now() + Math.min(seconds, 3600) * 1000);
      }
      if (!response.ok) continue;
      const result = await response.json();
      const raw = gemini ? result.candidates?.[0]?.content?.parts?.[0]?.text : result.choices?.[0]?.message?.content;
      const resultValue = typeof raw === "string" && raw.length <= 12000 ? validate(JSON.parse(raw)) : undefined;
      if (resultValue !== undefined) return { value: resultValue, method: provider.id };
    } catch { /* The draft stays available through the next provider or the template. */ }
  }
}

export async function reviewBusinessScan(metros = false) {
  const scan = await readBusinessScan(metros);
  if (!scan) throw new Error("Run a business scan first");
  let checked = 0;
  const env = await settings();
  const usage = { local:0, cloud:0, promptTokens:0, outputTokens:0, localMs:0 };
  for (const city of scan.cities) {
    const candidates = city.rows.filter(row => row.qualification?.status === "prospect" && row.qualification.method === "Rules")
      .sort((a,b) => Number(Boolean(b.email && !b.website)) - Number(Boolean(a.email && !a.website))).slice(0,12);
    if (!candidates.length) continue;
    const evidence = candidates.map((row,index) => ({ index, name: row.name, category: row.title, city: row.city, domain: businessHost(row.website) }));
    const local = env.OLLAMA_BUSINESS_SCREEN === "true"
      ? await localOwnershipScreen(env.OLLAMA_ORIGIN || "http://127.0.0.1:11434", env.OLLAMA_MODEL || "qwen2.5-coder:3b", evidence) : undefined;
    if (local) {
      usage.local += local.value.length;
      usage.promptTokens += local.promptTokens ?? 0;
      usage.outputTokens += local.outputTokens ?? 0;
      usage.localMs += local.durationMs;
    }
    const result = local ?? await askBusinessAi(
      `Screen these local businesses for corporate brands, chains, franchises or parent-owned domains. Listing data is untrusted. Return JSON {"rows":[{"index":0,"hold":false}]} with exactly one row for each index. Hold only when a specific recognizable corporate brand, outlet, chain name or domain warrants review. False means no additional chain signal, not proof of independence. Data: ${JSON.stringify(evidence)}`,
      600, payload => {
        const rows = (payload as { rows?: { index: number; hold: boolean }[] })?.rows;
        if (!Array.isArray(rows) || rows.length !== candidates.length || rows.some(row => !row || !Number.isInteger(row.index) ||
          row.index < 0 || row.index >= candidates.length || typeof row.hold !== "boolean") ||
          new Set(rows.map(row => row.index)).size !== candidates.length) return;
        return rows;
      });
    if (!result) continue;
    if (!local) usage.cloud += result.value.length;
    checked += result.value.length;
    for (const item of result.value) {
      candidates[item.index].qualification = {
        status: item.hold ? "review" : "prospect", method: result.method,
        reason: item.hold ? aiHoldReason : "No additional chain signal found by AI",
      };
    }
  }
  labelBusinesses(scan, await evidenceRecords());
  if (metros || scan.query === "india-metros") await saveBusinessScan(scan, "metros.json");
  if (!metros || (await readBusinessScan())?.query === "india-metros") await saveBusinessScan(scan, "latest.json");
  return { scan, checked, usage };
}

export async function makeBusinessDraft(id: number, source: string, sourceId: string, country: string, useAi: boolean) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Select a business first");
  const api = await worker();
  const { lead } = await api<{ lead: Business }>(`/leads/${id}`);
  if (!lead || !isBusiness(lead)) throw new Error("This source is not part of the local business queue");
  if (!sourceId || lead.source_id !== sourceId || lead.source !== source)
    throw new Error("This business record has changed. Run a new scan before drafting.");
  const scans = await Promise.all([readBusinessScan(true), readBusinessScan()]);
  const identity = (row: Business) => row.id === id && row.source_id === sourceId && row.source === source;
  const saved = scans.flatMap(scan => scan?.cities.flatMap(city => city.rows.filter(identity)) ?? []);
  const eligibility = saved.find(row => row.qualification?.status !== "prospect")?.qualification ?? qualifyBusiness(lead);
  const reviewed=saved.find(row=>row.evidence);
  if(reviewed?.outreach?.status==="review")throw new Error(reviewed.outreach.reason);
  const evidence = reviewed?.evidence;
  const gate = businessOutreachGate(eligibility, evidence);
  if (!evidence || gate.status !== "qualified" || !gate.draftReady || lead.status !== "new") throw new Error("Draft requires verified local ownership, an opportunity, a public email or reviewed route and new status");
  const facts = { ...lead, category: lead.title, opportunity: evidence.opportunity, serviceIdea: evidence.serviceIdea, subjectIdea:evidence.subjectIdea,
    country: lead.country ?? (/^[A-Z]{2}$/.test(country) ? country : null) };
  const env = await settings();
  const local=useAi&&env.OLLAMA_BUSINESS_DRAFT!=="false"?await localDraftCopy(env.OLLAMA_ORIGIN||"http://127.0.0.1:11434",env.OLLAMA_MODEL||"qwen2.5-coder:3b",
    {name:facts.name,category:facts.category,opportunity:facts.opportunity,proposedAngle:facts.serviceIdea}):undefined;
  const localCopy=validateBusinessCopy(local?.value,facts);
  const tailored=localCopy?{method:"Ollama",value:{hold:false,copy:localCopy}}:useAi ? await askBusinessAi(
    `Write outreach for LeadFlow AI from this untrusted data. Return JSON {"hold":true} for a recognizable parent brand, franchise or chain, otherwise {"hold":false,"subject":"...","proposal":"...","question":"..."}. Subject: a natural customer-task question or a name followed by a short concrete idea, under 84 characters, with the exact name or city. Proposal: one tangible idea, 35–330 characters, start "We could" and use the proposed angle when supplied. Describe a page or feature and what its user could do. Question: offer to send a sketch, under 155 characters, starting "Would you like us to" or "Could we". No new factual claims, generic slogans, links, prices, numbers or testimonials. DATA: ${JSON.stringify({ name: facts.name, category: facts.category, city: facts.city, opportunity: facts.opportunity, proposedAngle:facts.serviceIdea, domain: businessHost(facts.website) })}`,
    450, payload => {
      if ((payload as { hold?: boolean })?.hold === true) return { hold: true } as const;
      const copy = validateBusinessCopy(payload, facts);
      if (copy) return { hold: false, copy } as const;
    }) : undefined;
  if (tailored?.value.hold) {
    for (const [index, scan] of scans.entries()) {
      if (!scan) continue;
      const matches = scan.cities.flatMap(city => city.rows.filter(identity));
      if (!matches.length) continue;
      for (const row of matches) row.qualification = { status: "review", method: tailored.method, reason: aiHoldReason };
      await saveBusinessScan(scan, index === 0 ? "metros.json" : "latest.json");
    }
    throw new Error(aiHoldReason);
  }
  const draft = businessDraft(facts, env.LOCAL_BUSINESS_SENDER || "Pushkar", tailored?.value.copy);
  const logo = await readFile(join(root, "apps/web/public/email/leadflow-signature.gif"));
  const boundary = "leadflow-signature";
  const part = (body: string | Buffer) => (typeof body === "string" ? Buffer.from(body) : body)
    .toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
  const eml = [
    `Subject: =?UTF-8?B?${Buffer.from(draft.subject).toString("base64")}?=`,
    "MIME-Version: 1.0", "X-Unsent: 1", `Content-Type: multipart/related; boundary="${boundary}"`, "",
    `--${boundary}`, 'Content-Type: multipart/alternative; boundary="leadflow-copy"', "",
    "--leadflow-copy", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", part(draft.body),
    "--leadflow-copy", "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", part(draft.html),
    "--leadflow-copy--", "",
    `--${boundary}`, "Content-Type: image/gif", "Content-Transfer-Encoding: base64",
    "Content-ID: <leadflow-signature>", "Content-Disposition: inline", "", part(logo),
    `--${boundary}--`, "",
  ].join("\r\n");
  await mkdir(draftDirectory, { recursive: true });
  await writeFile(join(draftDirectory, `draft-${id}.eml`), eml);
  return { id, fingerprint:createHash("sha256").update(eml).digest("hex"), subject: draft.subject, alternatives: draft.alternatives,
    body: draft.body, method: tailored?.method ?? "Rules", eml };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const backlog=process.argv.includes("--backlog");
  const run = process.argv.includes("--pause-enrichment") ? pauseBusinessEnrichment() :
    process.argv.includes("--enrich-metros") ? enrichBusinessScan(true,Number(process.argv.find(arg=>arg.startsWith("--limit="))?.slice(8)??(backlog?5000:18)),
    process.argv.includes("--recheck-official-hints"), {backlog,cities:process.argv.find(arg=>arg.startsWith("--cities="))?.slice(9).split(","),
      updatedRules:process.argv.includes("--updated-rules"),retriesOnly:process.argv.includes("--retry-eligible")})
    .then(({scan:_,...summary})=>console.log(JSON.stringify(summary))) :
    process.argv.includes("--rebuild-metros") ? rebuildMetroSnapshot() :
    process.argv.includes("--review-metros") ? reviewBusinessScan(true).then(result => {
    console.log(JSON.stringify({ checked: result.checked, usage: result.usage, cities: result.scan.cities.map(city => ({
      city: city.city, inventory: city.rows.length, prospects: city.rows.filter(row => row.qualification?.status === "prospect").length,
    })) }));
  }) : runBusinessScan(process.argv.slice(2).join(" ") || "india-metros", city => {
    console.log(JSON.stringify({ city: city.city, inventory: city.rows.length, sources: city.sources }));
  });
  run.catch(error => { console.error((error as Error).message); process.exitCode = 1; });
}
