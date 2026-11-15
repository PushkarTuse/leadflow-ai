import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, rename } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { IncomingMessage } from "node:http";
import path from "node:path";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const envFile = path.join(repoRoot, ".env.external");
const stateFile = path.join(repoRoot, "data", "external-gemini.json");
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

/**
 * Development-only middleware. `apply: "serve"` keeps it out of the production
 * build, so Cloudflare Pages behaviour is unchanged.
 */
function localPipeline(): Plugin {
  let running = false;
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

        void (async () => {
          try {
            if (
              pathname === "/api/local/pipeline/status" &&
              req.method === "GET"
            ) {
              try {
                return json(200, JSON.parse(await readFile(stateFile, "utf8")));
              } catch {
                return json(200, emptyState);
              }
            }

            if (pathname === "/api/local/pipeline/toggle") {
              if (req.method === "GET") {
                const enabled = await readEnabled();
                return json(200, {
                  enabled: enabled === true,
                  configured: enabled !== null,
                });
              }
              if (req.method === "POST") {
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

            if (
              pathname === "/api/local/pipeline/run" &&
              req.method === "POST"
            ) {
              if (running) {
                return json(409, {
                  status: "error",
                  error: "A pipeline run is already in progress",
                });
              }
              if ((await readEnabled()) !== true) {
                return json(409, {
                  status: "error",
                  error: "Pipeline is disabled. Enable it first.",
                });
              }

              running = true;
              let settled = false;
              const finish = (code: number, body: unknown) => {
                if (settled) return;
                settled = true;
                running = false;
                json(code, body);
              };

              const child = spawn("npm", ["run", "external:run"], {
                cwd: repoRoot,
                env: process.env,
                shell: true,
              });

              let output = "";
              const collect = (chunk: Buffer) => {
                output += chunk.toString("utf8");
                if (output.length > 20000) output = output.slice(-20000);
              };
              child.stdout?.on("data", collect);
              child.stderr?.on("data", collect);

              const timer = setTimeout(() => child.kill(), 180000);
              child.on("close", (code) => {
                clearTimeout(timer);
                finish(code === 0 ? 200 : 500, {
                  status: code === 0 ? "completed" : "error",
                  code,
                  output,
                });
              });
              child.on("error", () => {
                clearTimeout(timer);
                finish(500, {
                  status: "error",
                  error: "Could not start the external runner",
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
  server: { port: 5173, strictPort: true },
});
