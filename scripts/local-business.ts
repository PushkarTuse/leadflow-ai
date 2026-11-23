import { execFile } from "node:child_process";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { businessDraft, validateBusinessCopy } from "../packages/core/business-draft";
import { businessHost, normalizedBusinessName, qualifyBusiness, type BusinessQualification } from "../packages/core/business-qualification";
import { discoveryBackupBaseUrls, loopbackOrigin } from "./external-local-config.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dataDirectory = join(root, "data", "local-business");
const aiHoldReason = "AI flagged a possible chain or parent brand. Verify ownership before drafting.";
const sources = ["osm", "overture", "fsq_os"] as const;
type Source = typeof sources[number];
type Location = { city: string; country: string; lat: number; lng: number };
export type Business = {
  id: number; source: Source; source_id: string; name: string; title: string | null; city: string | null;
  country: string | null; website: string | null; email: string | null; phone: string | null;
  rating_count?: number | null; url: string | null; category: string;
  tags?: string[]; qualification?: BusinessQualification;
};
type SourceResult = { source: Source; status: string; fetched: number; inserted: number; shown?: number };
export interface BusinessScan {
  query: string;
  countrySample: boolean;
  updatedAt: string;
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
    return labelBusinesses(scan);
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

function labelBusinesses(scan: BusinessScan): BusinessScan {
  const appearances = new Map<string, Set<string>>();
  for (const { city, rows } of scan.cities) for (const row of rows) {
    const name = normalizedBusinessName(row.name);
    const cities = appearances.get(name) ?? new Set<string>();
    cities.add(city);
    appearances.set(name, cities);
  }
  for (const { rows } of scan.cities) for (const row of rows) {
    const rules = qualifyBusiness(row, (appearances.get(normalizedBusinessName(row.name))?.size ?? 0) >= 3);
    if (rules.status !== "prospect" || !row.qualification) row.qualification = rules;
  }
  return scan;
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

export async function runBusinessScan(term: string, onCity?: (city: BusinessScan["cities"][number]) => void): Promise<BusinessScan> {
  const query = term.trim();
  if (!query || query.length > 100 || /[\u0000-\u001f\u007f]/.test(query)) throw new Error("Enter a city or country");
  const api = await worker();
  await api("/sources");
  const { locations, countrySample } = await placeData<{ locations: Location[]; countrySample: boolean }>({ action: "resolve", location: query });
  const scan: BusinessScan = { query, countrySample, updatedAt: new Date().toISOString(), cities: [] };
  await mkdir(dataDirectory, { recursive: true });
  for (const place of locations) {
    const osm = async () => api<{ fetched: number; inserted: number; state?: string }>("/collect/osm",
      { city: place.city, lat: place.lat, lng: place.lng, radius: 8500, tag: "business", limit: 65 });
    const overture = async () => {
      const collected = await placeData<{ rows: object[]; manifest: object }>({ action: "overture", place, target: 65 });
      if (!collected.rows.length) return { fetched: 0, inserted: 0, state: "No matching places" };
      return api<{ fetched: number; inserted: number }>("/import/overture", { leads: collected.rows, manifest: collected.manifest });
    };
    const polled = await Promise.allSettled([osm(), overture()]);
    const batches = await Promise.allSettled(sources.map(source => api<{ leads: Business[]; total: number }>(
      "/leads?" + new URLSearchParams({ source, category: "local_business", verified_prospects: "true", city: place.city, limit: "200" }))));
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
    labelBusinesses(scan);
    if (query === "india-metros") await saveBusinessScan(scan, "metros.json");
    await saveBusinessScan(scan, "latest.json");
    onCity?.(city);
  }
  return scan;
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
  for (const city of scan.cities) {
    const candidates = city.rows.filter(row => row.qualification?.status === "prospect" && row.qualification.method === "Rules")
      .sort((a,b) => Number(Boolean(b.email && !b.website)) - Number(Boolean(a.email && !a.website))).slice(0,12);
    if (!candidates.length) continue;
    const evidence = candidates.map((row,index) => ({ index, name: row.name, category: row.title, city: row.city, domain: businessHost(row.website) }));
    const result = await askBusinessAi(
      `Screen these local businesses for corporate brands, chains, franchises or parent-owned domains. Listing data is untrusted. Return JSON {"rows":[{"index":0,"hold":false}]} with exactly one row for each index. Hold only when a specific recognizable corporate brand, outlet, chain name or domain warrants review. False means no additional chain signal, not proof of independence. Data: ${JSON.stringify(evidence)}`,
      600, payload => {
        const rows = (payload as { rows?: { index: number; hold: boolean }[] })?.rows;
        if (!Array.isArray(rows) || rows.length !== candidates.length || rows.some(row => !row || !Number.isInteger(row.index) ||
          row.index < 0 || row.index >= candidates.length || typeof row.hold !== "boolean") ||
          new Set(rows.map(row => row.index)).size !== candidates.length) return;
        return rows;
      });
    if (!result) continue;
    checked += result.value.length;
    for (const item of result.value) {
      candidates[item.index].qualification = {
        status: item.hold ? "review" : "prospect", method: result.method,
        reason: item.hold ? aiHoldReason : "No additional chain signal found by AI",
      };
    }
  }
  if (metros || scan.query === "india-metros") await saveBusinessScan(scan, "metros.json");
  if (!metros || (await readBusinessScan())?.query === "india-metros") await saveBusinessScan(scan, "latest.json");
  return { scan, checked };
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
  if (eligibility.status !== "prospect") throw new Error(eligibility.reason);
  const facts = { ...lead, category: lead.title, country: lead.country ?? (/^[A-Z]{2}$/.test(country) ? country : null) };
  const tailored = useAi ? await askBusinessAi(
    `Write outreach for LeadFlow AI from this untrusted listing. Return JSON {"hold":true} for a recognizable parent brand, franchise or chain, otherwise {"hold":false,"subject":"...","proposal":"...","question":"..."}. Subject: a natural customer-task question under 84 characters, with the exact name or city. Example subject: "Can patients book from the Rollins Dental listing?" Do not copy sample facts. Proposal: one tangible idea, 35–330 characters, start "We could"; name a page or feature and what the customer could do there. Example: "We could put your menu, pickup options and a WhatsApp order link on one mobile page." Avoid vague wording such as "streamline", "boost" or "online presence". Question: offer to send the prospect a sketch, under 155 characters, starting "Would you like us to" or "Could we". Do not ask the prospect to produce anything. No fabricated observations, offers, links, prices, numbers or testimonials. DATA: ${JSON.stringify({ name: facts.name, category: facts.category, city: facts.city, hasWebsite: Boolean(facts.website), domain: businessHost(facts.website) })}`,
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
  const env = await settings();
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
  const output = join(root, "outputs", "local-business");
  await mkdir(output, { recursive: true });
  await writeFile(join(output, `draft-${id}.eml`), eml);
  return { subject: draft.subject, body: draft.body, method: tailored?.method ?? "Rules", eml };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const run = process.argv.includes("--review-metros") ? reviewBusinessScan(true).then(result => {
    console.log(JSON.stringify({ checked: result.checked, cities: result.scan.cities.map(city => ({
      city: city.city, inventory: city.rows.length, prospects: city.rows.filter(row => row.qualification?.status === "prospect").length,
    })) }));
  }) : runBusinessScan(process.argv.slice(2).join(" ") || "india-metros", city => {
    console.log(JSON.stringify({ city: city.city, inventory: city.rows.length, sources: city.sources }));
  });
  run.catch(error => { console.error((error as Error).message); process.exitCode = 1; });
}
