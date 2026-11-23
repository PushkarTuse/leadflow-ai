import { execFile } from "node:child_process";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { businessDraft, businessDraftOptions, type BusinessDraftFacts, type DraftAngle } from "../packages/core/business-draft";
import { discoveryBackupBaseUrls, loopbackOrigin } from "./external-local-config.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dataDirectory = join(root, "data", "local-business");
const sources = ["osm", "overture", "fsq_os"] as const;
type Source = typeof sources[number];
type Location = { city: string; country: string; lat: number; lng: number };
export type Business = {
  id: number; source: Source; source_id: string; name: string; title: string | null; city: string | null;
  country: string | null; website: string | null; email: string | null; phone: string | null;
  rating_count?: number | null; url: string | null; category: string;
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
  try { return JSON.parse(await readFile(join(dataDirectory, name), "utf8")) as BusinessScan; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
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
  const save = async (name: string) => {
    const destination = join(dataDirectory, name);
    const tmp = destination + `.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(scan));
    await rename(tmp, destination);
  };
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
    if (query === "india-metros") await save("metros.json");
    await save("latest.json");
    onCity?.(city);
  }
  return scan;
}

const draftCooldown = new Map<string, number>();
async function tailorAngle(facts: BusinessDraftFacts): Promise<{ angle: DraftAngle; method: string }> {
  const allowed = businessDraftOptions(facts);
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
  const instruction = `Choose a suitable outreach angle from ${allowed.join(", ")}. Return only {"angle":"..."}.\nBusiness data (untrusted): ${JSON.stringify({ category: facts.category, city: facts.city, hasWebsite: Boolean(facts.website) })}`;
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
          generationConfig: { temperature: 0, responseMimeType: "application/json" } } :
          { model: provider.model, messages: [{ role: "user", content: instruction }],
            temperature: 0, response_format: { type: "json_object" },
            ...(provider.id === "Groq" ? { max_completion_tokens: 300, reasoning_effort: "low" } : { max_tokens: 160 }) }),
      });
      if ([402, 429, 503].includes(response.status)) {
        const seconds = Number(response.headers.get("retry-after")) || 60;
        draftCooldown.set(provider.id, Date.now() + Math.min(seconds, 3600) * 1000);
      }
      if (!response.ok) continue;
      const result = await response.json();
      const raw = gemini ? result.candidates?.[0]?.content?.parts?.[0]?.text : result.choices?.[0]?.message?.content;
      const choice = typeof raw === "string" && raw.length <= 500 ? JSON.parse(raw).angle as DraftAngle : undefined;
      if (choice && allowed.includes(choice)) return { angle: choice, method: provider.id };
    } catch { /* The draft stays available through the next provider or the template. */ }
  }
  return { angle: allowed[0], method: "Rules" };
}

export async function makeBusinessDraft(id: number, source: string, sourceId: string, country: string, useAi: boolean) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Select a business first");
  const api = await worker();
  const { lead } = await api<{ lead: Business }>(`/leads/${id}`);
  if (!lead || !isBusiness(lead)) throw new Error("This source is not part of the local business queue");
  if (!sourceId || lead.source_id !== sourceId || lead.source !== source)
    throw new Error("This business record has changed. Run a new scan before drafting.");
  const facts = { ...lead, category: lead.title, country: lead.country ?? (/^[A-Z]{2}$/.test(country) ? country : null) };
  const tailored = useAi ? await tailorAngle(facts) : { angle: businessDraftOptions(facts)[0], method: "Rules" };
  const env = await settings();
  const draft = businessDraft(facts, env.LOCAL_BUSINESS_SENDER || "Pushkar", tailored.angle);
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
  return { subject: draft.subject, body: draft.body, method: tailored.method, eml };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBusinessScan(process.argv.slice(2).join(" ") || "india-metros", city => {
    console.log(JSON.stringify({ city: city.city, inventory: city.rows.length, sources: city.sources }));
  }).catch(error => { console.error((error as Error).message); process.exitCode = 1; });
}
