import { createHash, randomUUID } from "node:crypto";
import { open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { calendlyEventUrl } from "../packages/core/business-draft";
import { draftLibrary, readSavedDraft } from "./local-draft-library";

const label = "Feel free to book a time that works best for you.";
const call = "Let's set up a short call to explore your requirements and discuss how we can tailor our solutions to your business.";
const callHtml = call.replace("'", "&#39;");

export function reviseBookingCta(text: string, format: "plain" | "html", url: string) {
  const booking = calendlyEventUrl(url);
  if (!booking) throw new Error("A valid public Calendly event is required.");
  const plain = format === "plain";
  const pattern = plain ? /(?:^|\n\n)(Let's set up a short call[^\r\n]*)(?:\r?\nhttps:\/\/(?:www\.)?calendly\.com\/[^\s]+)?(?=\r?\n\r?\n|$)/g
    : /<p>(Let&#39;s set up a short call[^<]*)(?:<a href="https:\/\/(?:www\.)?calendly\.com\/[^"]+">[^<]*<\/a>)?<\/p>/g;
  const candidates = [...text.matchAll(pattern)];
  if (candidates.length !== 1 || !candidates[0][1].startsWith(plain ? call : callHtml)) {
    throw new Error("Existing approved CTA did not match the draft format.");
  }
  return text.replace(pattern, (whole, previous: string) => {
    const unchanged = previous.trimEnd().endsWith(label)
      ? previous.trimEnd().slice(0, -label.length).trimEnd() : previous.trimEnd();
    return plain ? `${whole.startsWith("\n\n") ? "\n\n" : ""}${unchanged} ${label}\n${booking}`
      : `<p>${unchanged} <a href="${booking.replace(/&/g, "&amp;") }">${label}</a></p>`;
  });
}

function reviseMime(eml: string, booking: string) {
  let stamped = 0;
  const revised = eml.replace(/(Content-Type: text\/(plain|html); charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n)([\w+/=\r\n]+?)(?=\r\n--leadflow-copy)/gi,
    (_old, header: string, part: "plain" | "html", value: string) => {
      stamped++;
      const original = Buffer.from(value, "base64").toString("utf8");
      const next = reviseBookingCta(original, part, booking);
      return next === original ? header + value : header + Buffer.from(next).toString("base64").match(/.{1,76}/g)?.join("\r\n");
    });
  if (stamped !== 2) throw new Error("Expected two MIME alternatives.");
  return revised;
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function writeAtomic(path: string, value: string) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temp, value, { flag: "wx" }); await rename(temp, path); }
  finally { await unlink(temp).catch(() => undefined); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = parseEnv(await readFile(".env.external", "utf8"));
  const booking = calendlyEventUrl(env.LEADFLOW_CALENDLY_URL);
  if (!booking) throw new Error("Set LEADFLOW_CALENDLY_URL to the public event.");
  const root = fileURLToPath(new URL("../outputs/local-business/", import.meta.url));
  const lockPath = `${root}.booking-refresh.lock`;
  const lock = await open(lockPath, "wx");
  try {
    const { drafts } = await draftLibrary();
    const revisions = [];
    for (const { id } of drafts) {
      const saved = await readSavedDraft(id);
      if (!saved) throw new Error(`Unsent draft ${id} could not be verified.`);
      const eml = reviseMime(saved.eml, booking);
      const html = reviseBookingCta(saved.html, "html", booking);
      if (eml !== saved.eml || html !== saved.html) revisions.push({ id, saved, eml, html });
    }
    if (process.argv.includes("--apply")) for (const { id, saved, eml, html } of revisions) {
      const base = `${root}draft-${id}`;
      const original = hash(saved.eml);
      if (hash(await readFile(`${base}.eml`, "utf8")) !== original || await readFile(`${base}.html`, "utf8") !== saved.html)
        throw new Error(`Draft ${id} changed while preparing the CTA revision.`);
      for (const [file, content] of [[`${base}-${original.slice(0,16)}.eml`, saved.eml], [`${base}-${original.slice(0,16)}.html`, saved.html]]) {
        await writeFile(file, content, { flag: "wx" }).catch(async error => {
          if (error.code !== "EEXIST" || await readFile(file, "utf8") !== content) throw error;
        });
      }
      await writeAtomic(`${base}.html`, html);
      await writeAtomic(`${base}.json`, JSON.stringify({ fingerprint: hash(eml), alternatives: saved.alternatives }));
      await writeAtomic(`${base}.eml`, eml);
    }
    console.log(JSON.stringify({ checked: drafts.length, revised: revisions.length, applied: process.argv.includes("--apply") }));
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}
