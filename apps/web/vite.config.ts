import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, rename, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import { stateDirectory } from "../../scripts/external-local-config.mjs";
import { makeBusinessDraft, readBusinessScan, recordBusinessEvidence, reviewBusinessScan, reviewLocalDraft, runBusinessScan } from "../../scripts/local-business";
import { FREELANCE_BUYER_SOURCES } from "../../packages/core/qualification";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const envFile = path.join(repoRoot, ".env.external");
const stateNames = ["external-pipeline.json", "external-gemini.json", "external-openai.json"];
const profile = process.env.LEADFLOW_LOCAL_PROFILE || "";
const emptyState = {
  offset: 0,
  store: { rows: [], events: [], draftRows: [], requestRows: [] },
  emailTest: null,
};

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

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 10000) data = data.slice(0, 10000);
    });
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
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
  const { offset = 0, store = emptyState.store, emailTest, sourceHealth, aiHealth } = JSON.parse(await readFile(latest.file, "utf8"));
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
        if (req.method === "POST" && (req.headers.origin !== `http://${req.headers.host}`
          || req.headers["x-leadflow-local"] !== "1")) {
          return json(403, { error: "Same-origin dashboard request required" });
        }

        void (async () => {
          try {
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
                return json(200, { scan: await runBusinessScan(data.location, undefined, data.budget ?? 250) });
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

            if ((pathname === "/api/local/pipeline/run" || pathname === "/api/local/pipeline/collect") &&
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

              const collecting = pathname.endsWith("/collect");
              const requested = collecting ? JSON.parse(await readBody(req) || "{}") : {};
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

              const args = collecting ? ["--collect", "--limit=100", `--max-candidates=${target}`] : [];
              const child = spawn(process.execPath, ["--import", "tsx", "scripts/external-pipeline.ts", ...args], {
                cwd: repoRoot,
                env: { ...process.env, EXTERNAL_LOCAL_PROFILE: profile,
                  ...(selected ? { EXTERNAL_LEADS_SOURCES: selected.join(",") } : {}) },
              });

              let output = "";
              let collectionOutput = "";
              const collect = (chunk: Buffer) => {
                output += chunk.toString("utf8");
                if (output.length > 20000) output = output.slice(-20000);
              };
              child.stdout?.on("data", (chunk: Buffer) => {
                collect(chunk);
                if (collecting) collectionOutput = (collectionOutput + chunk.toString("utf8")).slice(-20000);
              });
              child.stderr?.on("data", collect);

              // Five rows can each try four providers twice, with a 27-second transport deadline.
              const timer = setTimeout(() => child.kill(), 5 * 4 * 2 * 27000 + 60000);
              child.on("close", (code) => {
                clearTimeout(timer);
                if (code === 0 || collecting) {
                  const sources = collectionOutput.split(/\r?\n/).flatMap(line => {
                    try {
                      const item = JSON.parse(line);
                      if (typeof item?.source !== "string" || typeof item?.state !== "string") return [];
                      const { source, state, raw, fetched, inserted, duplicates } = item;
                      return [{ source, state, raw, fetched, inserted, duplicates }];
                    } catch { return []; }
                  });
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
