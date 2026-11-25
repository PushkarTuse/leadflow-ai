import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readBusinessScan } from "./local-business";

const root = fileURLToPath(new URL("../outputs/", import.meta.url));
const archive = join(root, "cofounder-review");
const drafts = join(root, "local-business");
const idFromSlug = /-([1-9]\d{0,9})$/;

type SavedCopy = { slug: string; fingerprint: string; alternatives: string[] };

async function readReviewPackage() {
  const entries = await readdir(archive, { withFileTypes: true }).catch(() => []);
  const dates = entries.filter(entry => entry.isDirectory() && /^\d{14}$/.test(entry.name))
    .map(entry => entry.name).sort().reverse();
  for (const directory of dates) {
    const folder = join(archive, directory);
    try {
      const manifest: { drafts: SavedCopy[] } = JSON.parse(await readFile(join(folder, "review.json"), "utf8"));
      if (Array.isArray(manifest.drafts) && manifest.drafts.length) return { folder, manifest };
    } catch {
      // An incomplete export should not hide the last completed package.
    }
  }
  return null;
}

async function savedBusinesses() {
  const [metros, latest] = await Promise.all([readBusinessScan(true), readBusinessScan()]);
  const rows = new Map((metros?.cities ?? []).flatMap(city => city.rows).map(row => [row.id, row]));
  for (const row of latest?.cities.flatMap(city => city.rows) ?? []) {
    if (!rows.has(row.id) || latest?.query !== metros?.query) rows.set(row.id, row);
  }
  return rows;
}

export async function draftLibrary() {
  const [rows, files, review] = await Promise.all([
    savedBusinesses(), readdir(drafts, { withFileTypes: true }).catch(() => []), readReviewPackage(),
  ]);
  const names = new Set(files.filter(file => file.isFile()).map(file => file.name));
  const entries = [...rows.values()];
  const eligible = entries.filter(row => row.outreach?.draftReady);
  const reviewRows = entries.filter(row => row.outreach?.status === "review" && (row.enrichment || row.evidence));
  const retryRows = reviewRows.filter(row => row.enrichment?.status === "retry");
  const nextRetryAt = retryRows.flatMap(row => row.enrichment?.nextAt ?? []).sort().at(0);
  const evidenceReasons = new Map<string, number>();
  for (const row of reviewRows) {
    if (row.enrichment?.status === "retry" || !row.outreach?.reason) continue;
    const reason = row.outreach.reason;
    evidenceReasons.set(reason, (evidenceReasons.get(reason) ?? 0) + 1);
  }
  return {
    inventory: entries.length,
    qualified: entries.filter(row => row.outreach?.status === "qualified").length,
    contactable: entries.filter(row => row.outreach?.contactable).length,
    awaiting: entries.filter(row => row.outreach?.status === "review" && !row.enrichment && !row.evidence).length,
    review: reviewRows.length - retryRows.length,
    retry: retryRows.length,
    nextRetryAt,
    evidenceHolds: [...evidenceReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    draftReady: eligible.length,
    reviewPackage: Boolean(review),
    drafts: eligible.filter(row => names.has(`draft-${row.id}.eml`) && names.has(`draft-${row.id}.html`))
      .map(({ id, name, city }) => ({ id, name, city }))
      .sort((a, b) => (a.city ?? "").localeCompare(b.city ?? "") || a.name.localeCompare(b.name)),
  };
}

export async function readSavedDraft(id: number) {
  if (!(await savedBusinesses()).get(id)?.outreach?.draftReady) return null;
  const base = join(drafts, `draft-${id}`);
  try {
    const [eml, html, review] = await Promise.all([
      readFile(`${base}.eml`, "utf8"), readFile(`${base}.html`, "utf8"), readReviewPackage(),
    ]);
    const subject = eml.match(/^Subject: =\?UTF-8\?B\?([\w+/=]+)\?=\r?$/mi)?.[1];
    const body = eml.match(/Content-Type: text\/plain; charset=UTF-8\r?\nContent-Transfer-Encoding: base64\r?\n\r?\n([\w+/=\r\n]+)\r?\n--leadflow-copy/i)?.[1];
    if (!subject || !body || !/^X-Unsent: 1\r?$/mi.test(eml) || /^(?:to|cc|bcc):\s*\S+/mi.test(eml)) return null;
    const fingerprint = createHash("sha256").update(eml).digest("hex");
    const sidecar = await readFile(`${base}.json`, "utf8").then(raw => JSON.parse(raw) as SavedCopy).catch(() => null);
    const saved = sidecar?.fingerprint === fingerprint ? sidecar : review?.manifest.drafts.find(
      entry => Number(entry.slug.match(idFromSlug)?.[1]) === id && entry.fingerprint === fingerprint,
    );
    return {
      subject: Buffer.from(subject, "base64").toString("utf8"),
      body: Buffer.from(body, "base64").toString("utf8"),
      alternatives: saved?.alternatives ?? [],
      eml, html,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function readReviewArchive(format: "pdf" | "zip") {
  const review = await readReviewPackage();
  if (!review) return null;
  const file = format === "pdf" ? "cofounder-email-review.pdf" : "cofounder-review.zip";
  return readFile(join(review.folder, file)).then(bytes => ({ file, bytes })).catch(() => null);
}
