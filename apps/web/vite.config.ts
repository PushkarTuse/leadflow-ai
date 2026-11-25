import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, rename, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import { stateDirectory } from "../../scripts/external-local-config.mjs";
import { enrichBusinessScan, localLeadWorker, makeBusinessDraft, pauseBusinessEnrichment, readBusinessScan, recordBusinessEvidence, reviewBusinessScan, reviewLocalDraft, runBusinessScan } from "../../scripts/local-business";
import { draftLibrary, readReviewArchive, readSavedDraft } from "../../scripts/local-draft-library";
import { FREELANCE_BUYER_SOURCES } from "../../packages/core/qualification";
import { parseCsv } from "../../packages/core/csv";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const envFile = path.join(repoRoot, ".env.external");
const stateNames = ["external-pipeline.json", "external-gemini.json", "external-openai.json"];
const profile = process.env.LEADFLOW_LOCAL_PROFILE ?? process.env.EXTERNAL_LOCAL_PROFILE ?? (()=>{
  try {
    return readFileSync(envFile,"utf8").match(/^\s*EXTERNAL_LOCAL_PROFILE\s*=([^\r\n]*)/m)?.[1].trim().replace(/^(["'])(.*)\1$/,"$2")??"";
  }catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return "";throw error;}
})();
const emptyState = {
  offset: 0,
  store: { rows: [], events: [], draftRows: [], requestRows: [] },
  emailTest: null,
};

function parseBusinessTarget(value:unknown) {
  if(value===undefined)return;
  if(typeof value!=="number" || !Number.isInteger(value) || value<1 || value>400)
    throw new Error("Qualified target must be a whole number from 1 to 400");
  return value;
}

/**
 * Reads only the EXTERNAL_LEADS_ENABLED line. The rest of .env.external is
 * never parsed, logged or returned to the browser. Returns null when the file
 * does not exist, so the UI can tell "missing" apart from "off".
 */
async function readEnabled(): Promise<boolean | null> {
  if (process.env.EXTERNAL_LEADS_ENABLED !== undefined) {
    return process.env.EXTERNAL_LEADS_ENABLED === "true";
  }
  try {
    const text = await readFile(envFile, "utf8");
    const line = text
      .split(/\r?\n/)
      .find((l) => l.startsWith("EXTERNAL_LEADS_ENABLED="));
    return line
      ? line.slice("EXTERNAL_LEADS_ENABLED=".length).trim() === "true"
      : false;
  } catch {
    return null;
  }
}

/** Rewrites only the EXTERNAL_LEADS_ENABLED line; every other line is preserved verbatim. */
async function writeEnabled(value: boolean): Promise<void> {
  const text = await readFile(envFile, "utf8");
  const lines = text.split(/\r?\n/);
  const entry = `EXTERNAL_LEADS_ENABLED=${value}`;
  const index = lines.findIndex((l) =>
    l.startsWith("EXTERNAL_LEADS_ENABLED="),
  );
  if (index >= 0) lines[index] = entry;
  else lines.unshift(entry);
  const tmp = `${envFile}.tmp`;
  await writeFile(tmp, lines.join("\n"), { mode: 0o600 });
  await rename(tmp, envFile);
}

async function readBody(req: IncomingMessage, maxBytes=10_000): Promise<string> {
  const chunks:Buffer[]=[];
  let bytes=0;
  for await(const chunk of req){
    bytes+=chunk.length;
    if(bytes<=maxBytes)chunks.push(chunk);
  }
  if(bytes>maxBytes)throw new Error("Request body exceeds the limit");
  return Buffer.concat(chunks).toString("utf8");
}

async function readLatestState() {
  const directory = stateDirectory(profile);
  const candidates = await Promise.all(
    stateNames.map(async (name) => {
      const file = path.join(repoRoot, directory, name);
      try {
        return { file, modified: (await stat(file)).mtimeMs };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    }),
  );
  const latest = candidates
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((a, b) => b.modified - a.modified)[0];
  if (!latest) return { ...emptyState, stateFile: null, directory };
  const { offset = 0, store = emptyState.store, emailTest, sourceHealth, aiHealth, recentAi } = JSON.parse(await readFile(latest.file, "utf8"));
  const visibleRows = store.rows.filter((row: {discovery_context?: {expires_at?: string}}) => {
    const expires = row.discovery_context?.expires_at;
    return !expires || Date.parse(expires) > Date.now();
  });
  return {
    offset,
    store: { rows: visibleRows, requestRows: store.requestRows },
    emailTest,
    sourceHealth,
    aiHealth,
    recentAi,
    freshSince: process.env.LEADFLOW_FRESH_SINCE || null,
    directory,
    stateFile: path.basename(latest.file),
  };
}

/**
 * Development-only middleware. `apply: "serve"` keeps it out of the production
 * build, so Cloudflare Pages behaviour is unchanged.
 */
function localPipeline(): Plugin {
  let running = false;
  let businessScanning = false;
  return {
    name: "leadflow-local-pipeline",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || "").split("?")[0];
        if (!pathname.startsWith("/api/local/pipeline/")) return next();

        const json = (code: number, body: unknown) => {
          if (res.writableEnded) return;
          res.statusCode = code;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(body));
        };

        const address = req.socket.remoteAddress || "";
        if (!/^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(address)) {
          return json(403, { error: "Local development only" });
        }
        if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d{1,5}$/.test(req.headers.host || "")) {
          return json(403, { error: "Loopback host required" });
        }
        if (pathname.startsWith("/api/local/pipeline/outreach") && (
          (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) ||
          ["cross-site", "same-site"].includes(String(req.headers["sec-fetch-site"]))
        )) {
          return json(403, { error: "Same-origin dashboard request required" });
        }
        if (req.method === "POST" && (req.headers.origin !== `http://${req.headers.host}`
          || req.headers["x-leadflow-local"] !== "1")) {
          return json(403, { error: "Same-origin dashboard request required" });
        }

        void (async () => {
          try {
            if (req.method === "GET" && pathname === "/api/local/pipeline/outreach") {
              return json(200, await draftLibrary());
            }
            const draft = pathname.match(/^\/api\/local\/pipeline\/outreach\/([1-9]\d{0,9})$/);
            if (req.method === "GET" && draft) {
              const saved = await readSavedDraft(Number(draft[1]));
              return saved ? json(200, saved) : json(404, { error: "No eligible unsent draft was found." });
            }
            if (req.method === "GET" && ["/api/local/pipeline/outreach/package.pdf", "/api/local/pipeline/outreach/package.zip"].includes(pathname)) {
              const pdf = pathname.endsWith(".pdf");
              const archive = await readReviewArchive(pdf ? "pdf" : "zip");
              if (!archive) return json(404, { error: "The saved review package is unavailable." });
              res.setHeader("Content-Type", pdf ? "application/pdf" : "application/zip");
              res.setHeader("Content-Disposition", `${pdf ? "inline" : "attachment"}; filename="${archive.file}"`);
              res.setHeader("X-Content-Type-Options", "nosniff");
              res.setHeader("Cache-Control", "no-store");
              return res.end(archive.bytes);
            }
            if(pathname === "/api/local/pipeline/sources" && req.method === "GET") {
              const api=await localLeadWorker();
              const [sources,diagnostics]=await Promise.all([api("/sources"),api("/diagnostics")]);
              return json(200,{sources,diagnostics});
            }
            if(pathname === "/api/local/pipeline/import" && req.method === "POST") {
              try{
                const body=JSON.parse(await readBody(req,500_000));
                if(typeof body.text!=="string" || body.permissionConfirmed!==true || !["csv","json"].includes(body.format))
                  return json(400,{error:"Provide CSV or JSON and confirm authorization to import it."});
                const projects=body.format==="csv"?parseCsv(body.text):JSON.parse(body.text.replace(/^\uFEFF/,""));
                if(!Array.isArray(projects) || projects.length<1 || projects.length>100)
                  return json(400,{error:"Provide 1–100 projects as CSV rows or a JSON array."});
                const api=await localLeadWorker();
                return json(200,await api("/import/authorized-projects",{permission_confirmed:true,preview:body.preview===true,projects}));
              }catch(error){return json(400,{error:(error as Error).message.slice(0,170)});}
            }
            if (pathname === "/api/local/pipeline/business" && req.method === "GET") {
              const metros = new URL(req.url ?? "", "http://localhost").searchParams.get("metros") === "1";
              return json(200, { scan: await readBusinessScan(metros), scanning: businessScanning });
            }
            if (pathname === "/api/local/pipeline/business/scan" && req.method === "POST") {
              if (businessScanning) return json(409, { error: "A business scan is already running" });
              businessScanning = true;
              try {
                const data = JSON.parse(await readBody(req));
                if (typeof data.location !== "string") return json(400, { error: "Enter a city or country" });
                const target=parseBusinessTarget(data.target);
                const scan=await runBusinessScan(data.location, undefined, data.budget ?? 250);
                if(data.complete!==true)return json(200,{scan});
                return json(200,await enrichBusinessScan(scan.query==="india-metros",5000,false,{backlog:true,target}));
              } catch (error) {
                return json(400, { error: (error as Error).message.slice(0, 170) });
              } finally { businessScanning = false; }
            }
            if (pathname === "/api/local/pipeline/business/evidence" && req.method === "POST") {
              if (businessScanning) return json(409, { error: "A business operation is already running" });
              businessScanning = true;
              try {
                return json(200, { result: await recordBusinessEvidence(JSON.parse(await readBody(req))) });
              } catch {
                return json(400, { error: "Check the listing identity and provide valid HTTPS evidence and an opportunity." });
              } finally { businessScanning = false; }
            }
            if (pathname === "/api/local/pipeline/business/draft" && req.method === "POST") {
              if (businessScanning) return json(409, { error: "A business operation is already running" });
              businessScanning = true;
              try {
                const data = JSON.parse(await readBody(req));
                return json(200, await makeBusinessDraft(data.id, data.source, data.sourceId, data.country, data.useAi === true));
              } catch (error) {
                return json(400, { error: (error as Error).message.slice(0, 170) });
              } finally { businessScanning = false; }
            }
            if (pathname === "/api/local/pipeline/business/draft-review" && req.method === "POST") {
              if (businessScanning) return json(409, { error: "A business operation is already running" });
              businessScanning = true;
              try { return json(200, await reviewLocalDraft(JSON.parse(await readBody(req)))); }
              catch { return json(400, { error: "Could not record the review. Reload the current draft." }); }
              finally { businessScanning = false; }
            }
            if (pathname === "/api/local/pipeline/business/enrich" && req.method === "POST") {
              if (businessScanning) return json(409, { error: "A business operation is already running" });
              businessScanning = true;
              try {
                const body=JSON.parse(await readBody(req));
                const backlog=body.mode==="backlog";
                return json(200,await enrichBusinessScan(body.metros===true,backlog?5000:300,false,{backlog:true,
                  cities:typeof body.city==="string"?[body.city]:undefined,
                  updatedRules:body.mode==="updated-rules",retriesOnly:body.mode==="retries",discover:body.mode==="discover",target:parseBusinessTarget(body.target)}));
              }catch(error){
                return json(400,{error:(error as Error).message.slice(0,170)});
              }finally{businessScanning=false;}
            }
            if(pathname === "/api/local/pipeline/business/pause" && req.method === "POST") {
              await pauseBusinessEnrichment();
              return json(200,{status:"pausing"});
            }
            if (pathname === "/api/local/pipeline/business/review" && req.method === "POST") {
              if (businessScanning) return json(409, { error: "A business scan or review is already running" });
              businessScanning = true;
              try {
                const data = JSON.parse(await readBody(req));
                return json(200, await reviewBusinessScan(data.metros === true));
              } catch (error) {
                return json(400, { error: (error as Error).message.slice(0, 170) });
              } finally { businessScanning = false; }
            }
            if (
              pathname === "/api/local/pipeline/status" &&
              req.method === "GET"
            ) {
              try {
                return json(200, await readLatestState());
              } catch {
                return json(500, { error: "Local pipeline state could not be read" });
              }
            }

            if (pathname === "/api/local/pipeline/toggle") {
              if (req.method === "GET") {
                const enabled = await readEnabled();
                return json(200, {
                  enabled: enabled === true,
                  configured: enabled !== null,
                  locked: process.env.EXTERNAL_LEADS_ENABLED !== undefined,
                });
              }
              if (req.method === "POST") {
                if (process.env.EXTERNAL_LEADS_ENABLED !== undefined) {
                  return json(409, { error: "The launch environment sets the switch for this session." });
                }
                const current = await readEnabled();
                if (current === null) {
                  return json(409, {
                    enabled: false,
                    configured: false,
                    error:
                      "Create .env.external from .env.external.example first.",
                  });
                }
                const body = await readBody(req);
                let requested: boolean | null = null;
                try {
                  const parsed = JSON.parse(body || "{}") as {
                    enabled?: unknown;
                  };
                  if (typeof parsed.enabled === "boolean")
                    requested = parsed.enabled;
                } catch {
                  requested = null;
                }
                const enabled = requested === null ? !current : requested;
                await writeEnabled(enabled);
                return json(200, { enabled, configured: true });
              }
              return json(405, { error: "Method not allowed" });
            }

            if ((pathname === "/api/local/pipeline/run" || pathname === "/api/local/pipeline/collect" || pathname === "/api/local/pipeline/complete" || pathname === "/api/local/pipeline/retry") &&
              req.method === "POST") {
              if ((await readEnabled()) !== true) {
                return json(409, {
                  status: "error",
                  error: "Pipeline is disabled. Enable it first.",
                });
              }
              if (running) {
                return json(409, {
                  status: "error",
                  error: "A pipeline run is already in progress",
                });
              }

              const complete=pathname.endsWith("/complete");
              const collecting = complete || pathname.endsWith("/collect");
              const reclassify=pathname.endsWith("/retry");
              const requested = JSON.parse(await readBody(req) || "{}");
              const selected = requested.sources;
              if (selected !== undefined && (!Array.isArray(selected) || !selected.length ||
                selected.some(source => !FREELANCE_BUYER_SOURCES.includes(source)))) {
                return json(400,{status:"error",error:"Select at least one supported source."});
              }
              const target = requested.target ?? 500;
              if (!Number.isInteger(target) || target < 1 || target > 500) {
                return json(400,{status:"error",error:"Candidate limit must be 1–500."});
              }
              running = true;
              let settled = false;
              const finish = (code: number, body: unknown) => {
                if (settled) return;
                settled = true;
                running = false;
                json(code, body);
              };

              const args = collecting ? [complete?"--complete":"--collect", "--limit=100", `--max-candidates=${target}`] : [];
              if(reclassify)args.push("--retry-discovery-ai");
              if(pathname.endsWith('/run')&&requested.drain===true&&selected?.length===1&&selected[0]==='authorized_projects')args.push('--refresh-authorized-imports');
              if(complete || requested.drain===true)args.push("--drain");
              const child = spawn(process.execPath, ["--import", "tsx", "scripts/external-pipeline.ts", ...args], {
                cwd: repoRoot,
                env: { ...process.env, TELEGRAM_ENABLED:"false", SAFE_OWNER_EMAIL_TEST:"false", EXTERNAL_LOCAL_PROFILE: profile,
                  ...(selected ? { EXTERNAL_LEADS_SOURCES: selected.join(",") } : {}) },
              });

              let output = "";
              const sources:unknown[]=[];
              const collect = (chunk: Buffer) => {
                output += chunk.toString("utf8");
                if (output.length > 20000) output = output.slice(-20000);
              };
              child.stdout?.on("data", collect);
              if(collecting&&child.stdout)createInterface({input:child.stdout}).on("line",line=>{
                if(line.length>4096||sources.length>=30)return;
                try{
                  const item=JSON.parse(line);
                  if(typeof item?.source!=="string"||typeof item?.state!=="string")return;
                  const {source,state,raw,filtered,fetched,inserted,duplicates,filterReasons,problem}=item;
                  sources.push({source,state,raw,filtered,fetched,inserted,duplicates,filterReasons,problem});
                }catch{ /* Detailed runner output is separate from acquisition lines. */ }
              });
              child.stderr?.on("data", collect);

              // Five rows can each try four providers twice, with a 27-second transport deadline.
              const timer = setTimeout(() => child.kill(), complete ? 20*60_000 : 5 * 4 * 2 * 27000 + 60000);
              child.on("close", (code) => {
                clearTimeout(timer);
                if (code === 0 || collecting) {
                  if (code === 0 || sources.length) {
                    finish(200, { status: code === 0 ? "completed" : "partial", code, ...(collecting ? { sources } : {}) });
                    return;
                  }
                }
                const detail = output.split(/\r?\n/).find(line =>
                  /^External run failed: Upstream http:\/\/127\.0\.0\.1:\d{1,5} returned /.test(line));
                finish(500, {
                  status: "error",
                  code,
                  error: detail || "Pipeline failed. Check upstream health, local configuration and the runner lock.",
                });
              });
              child.on("error", (err) => {
                clearTimeout(timer);
                console.error("[external-pipeline] could not start:", err);
                finish(500, {
                  status: "error",
                  error: `Could not start the external runner: ${err.message}`,
                });
              });
              return;
            }

            return json(404, { error: "Not found" });
          } catch {
            return json(500, { error: "Local pipeline request failed" });
          }
        })();
      });
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  envDir: fileURLToPath(new URL("../..", import.meta.url)),
  plugins: [react(), tailwindcss(), localPipeline()],
  build: { outDir: "dist", emptyOutDir: true },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
