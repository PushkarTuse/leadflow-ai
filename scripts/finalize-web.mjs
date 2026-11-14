import { readFile, writeFile } from "node:fs/promises";
try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const raw = process.env.VITE_SITE_URL || "";
let origin = "";
if (raw) {
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.username || u.password)
    throw new Error("VITE_SITE_URL must be a public HTTPS origin");
  origin = u.origin;
}
const file = "apps/web/dist/index.html";
let html = await readFile(file, "utf8");
html = html.replace(
  'content="/social.svg"',
  'content="' + origin + '/social.png"',
);
if (origin)
  html = html.replace(
    "</head>",
    '<link rel="canonical" href="' +
      origin +
      '/"/><meta property="og:url" content="' +
      origin +
      '/"/></head>',
  );
await writeFile(file, html);
console.log(
  origin
    ? "Production metadata uses configured site origin."
    : "No site origin configured; local metadata retained.",
);
