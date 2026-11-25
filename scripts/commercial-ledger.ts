import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { z } from "zod";
import { verifiedOwnerTelegram } from "./commercial-telegram";

const directory = fileURLToPath(new URL("../data/commercial/", import.meta.url));
const ledger = join(directory, "applications.json");
const stages = [
  "DISCOVERED", "QUALIFIED", "ROUTE_VERIFIED", "DRAFT_PREPARED", "AWAITING_APPROVAL", "APPROVED",
  "SENT", "PROVIDER_ACCEPTED", "REPLIED", "INTERESTED", "MEETING_SCHEDULED", "NEGOTIATION",
  "PROPOSAL_PREPARED", "WON", "LOST", "OPTED_OUT", "FOLLOW_UP_DUE", "CLOSED", "BOUNCED",
] as const;
const message = z.object({
  from: z.string().email(), to: z.string().email(), subject: z.string().trim().min(1).max(200).regex(/^[^\r\n]+$/),
  body: z.string().min(1).max(16000), bookingUrl: z.string().url().nullable(), attachments: z.array(z.string()).max(5),
  html: z.string().min(1).max(24000).optional(),
}).strict();
const receipt = z.object({
  provider: z.string().min(1).max(80), messageId: z.string().min(1).max(300),
  threadId: z.string().min(1).max(160), acceptedAt: z.string().datetime(),
});
const ownerNotification = z.object({
  state: z.enum(["SENDING", "SENT", "FAILED", "UNCERTAIN"]), at: z.string().datetime(),
  messageId: z.number().int().positive().optional(), http: z.number().int().optional(),
});
const application = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,100}$/), title: z.string().min(1).max(250), source: z.string().url(),
  channel: z.enum(["DIRECT_EMAIL", "DIRECT_FORM", "MARKETPLACE_NATIVE", "PROCUREMENT", "BUSINESS_EMAIL"]),
  assignedTo: z.string().max(100), state: z.enum(stages), activityAt: z.string().datetime(),
  nextAction: z.string().max(500), deadline: z.string().datetime().nullable(),
  draft: message.optional(), approvedHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), receipt: receipt.optional(),
  ownerNotification: ownerNotification.optional(),
  milestone: z.object({ state: z.enum(stages), evidence: z.string().trim().min(8).max(500) }).optional(),
  replyIds: z.array(z.string()).default([]),
  lastReplyAssessment: z.enum(["POSITIVE", "NEGATIVE", "CLARIFICATION", "OTHER", "BOUNCED", "OPTED_OUT"]).optional(),
});
type Application = z.infer<typeof application>;
const fingerprint = (draft: NonNullable<Application["draft"]>) =>
  createHash("sha256").update(JSON.stringify(message.parse(draft))).digest("hex");
export function approvedCommercialContent(row: Application) {
  return !!row.draft && row.approvedHash === fingerprint(row.draft);
}
const stageAfterReply = /^(REPLIED|INTERESTED|MEETING_SCHEDULED|NEGOTIATION|PROPOSAL_PREPARED|WON|LOST|OPTED_OUT|CLOSED|BOUNCED)$/;

export async function readCommercialLedger(now = new Date()) {
  const parsed = await readFile(ledger, "utf8").then(raw => z.array(application).parse(JSON.parse(raw))).catch(error => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  return parsed.map(row => ({
    ...row, draftHash: row.draft ? fingerprint(row.draft) : undefined,
    followUpDue: Boolean(row.receipt && !stageAfterReply.test(row.state)
      && now.getTime() - Date.parse(row.receipt.acceptedAt) >= 7 * 86400000
      && (!row.deadline || Date.parse(row.deadline) > now.getTime())),
  }));
}

async function update(id: string, transform: (previous?: Application) => Application) {
  await mkdir(directory, { recursive: true });
  const lockPath = `${ledger}.lock`;
  const lock = await open(lockPath, "wx");
  const temporary = `${ledger}.${randomUUID()}.tmp`;
  try {
    const rows = await readCommercialLedger();
    const updated = application.parse(transform(rows.find(row => row.id === id)));
    const next = rows.filter(row => row.id !== id).map(row => application.parse(row));
    next.push(updated);
    await writeFile(temporary, JSON.stringify(next, null, 2));
    await rename(temporary, ledger);
    return updated;
  } finally {
    await unlink(temporary).catch(() => undefined);
    await lock.close();
    await unlink(lockPath);
  }
}

export function prepareCommercialDraft(raw: unknown) {
  const input = application.parse(raw);
  if (!input.draft || !["DRAFT_PREPARED", "AWAITING_APPROVAL"].includes(input.state)) {
    throw new Error("A complete draft and review state are required.");
  }
  return update(input.id, previous => {
    if (previous?.receipt || (previous && stageAfterReply.test(previous.state))) throw new Error("An existing application has a recorded outcome.");
    const { approvedHash: _approval, receipt: _receipt, ownerNotification: _notification,
      replyIds: _replies, milestone: _milestone, lastReplyAssessment: _assessment, ...draft } = input;
    return { ...draft, replyIds: [] };
  });
}

export function approveCommercialDraft(id: string, exactHash: string) {
  return update(id, row => {
    if (!row?.draft || row.state !== "AWAITING_APPROVAL" || fingerprint(row.draft) !== exactHash ||
      (row.deadline && Date.parse(row.deadline) <= Date.now())) throw new Error("The active draft or exact approval fingerprint does not match.");
    return { ...row, approvedHash: exactHash, activityAt: new Date().toISOString(), state: "APPROVED",
      nextAction: "Send the approved content once through the verified venture account; record its receipt." };
  });
}

export function recordCommercialReceipt(id: string, unverified: unknown) {
  const accepted = receipt.parse(unverified);
  return update(id, row => {
    if (row?.receipt?.messageId === accepted.messageId && row.receipt.threadId === accepted.threadId) return row;
    if (!row || row.receipt || row.state !== "APPROVED" || !approvedCommercialContent(row)) {
      throw new Error("A current exact-content approval is required and a receipt can be recorded only once.");
    }
    return { ...row, receipt: accepted, state: "PROVIDER_ACCEPTED", activityAt: accepted.acceptedAt,
      nextAction: "Review the verified conversation for a reply. Provider acceptance does not establish inbox delivery." };
  });
}

export function canNotifyCommercialReceipt(row?: Application) {
  return !!row?.receipt && row.channel === "DIRECT_EMAIL" && row.draft?.from.toLowerCase() === "leadsflowwai@gmail.com"
    && approvedCommercialContent(row) && (!row.ownerNotification || row.ownerNotification.state === "FAILED");
}

async function notifyOwnerOfReceipt(id: string, env: Record<string, string | undefined>) {
  const current = (await readCommercialLedger()).find(row => row.id === id);
  if (!current?.receipt || !approvedCommercialContent(current)) throw new Error("A verified, approved application receipt is required.");
  if (!canNotifyCommercialReceipt(current)) return current.ownerNotification;
  const send = await verifiedOwnerTelegram(env);
  let reserved = false;
  const row = await update(id, previous => {
    if (!previous?.receipt) throw new Error("The application receipt is unavailable.");
    if (!canNotifyCommercialReceipt(previous)) return previous;
    reserved = true;
    return { ...previous, ownerNotification: { state: "SENDING", at: new Date().toISOString() } };
  });
  if (!reserved) return row.ownerNotification;

  const localTime = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  }).format(new Date(row.receipt!.acceptedAt));
  const result = await send(`LeadFlow AI · Application sent\n${row.title.replace(/[\r\n]/g, " ")}\nGmail accepted the email at ${localTime} IST.\nOpen Sales activity in LeadFlow for the receipt and reply status.`);
  const state = result.messageId ? "SENT"
    : result.http >= 400 && result.http < 500 && result.http !== 408 ? "FAILED" : "UNCERTAIN";
  const saved = await update(id, previous => {
    if (!previous?.receipt || previous.ownerNotification?.state !== "SENDING") throw new Error("Owner notification reservation was lost.");
    return { ...previous, ownerNotification: { state, at: new Date().toISOString(), http: result.http, messageId: result.messageId } };
  });
  return saved.ownerNotification;
}

const reply = z.object({
  messageId: z.string().min(1).max(300), threadId: z.string().min(1).max(160), from: z.string().email(),
  references: z.array(z.string()).max(100), autoSubmitted: z.string().max(100).optional(),
  deliveryFailure: z.boolean().optional(), body: z.string().max(20000),
});
const ended = new Set(["WON", "LOST", "CLOSED", "OPTED_OUT", "BOUNCED"]);
const authoredText = (body: string) => body.split(/(?:^|\n)(?:On .+wrote:|From:|>)/i)[0];
export function trackedReplyOutcome(row: Application, raw: unknown) {
  const incoming = reply.parse(raw);
  if (!row.receipt || incoming.threadId !== row.receipt.threadId || !incoming.references.includes(row.receipt.messageId)
    || row.replyIds.includes(incoming.messageId) || incoming.messageId === row.receipt.messageId || ended.has(row.state)) return null;
  if (incoming.deliveryFailure && /^(?:mailer-daemon|postmaster)@/i.test(incoming.from)) return "BOUNCED";
  if (incoming.from.toLowerCase() !== row.draft?.to.toLowerCase() || (incoming.autoSubmitted && incoming.autoSubmitted.toLowerCase() !== "no")) return null;
  const authored = authoredText(incoming.body);
  if (/\b(?:unsubscribe|remove me|stop (?:emailing|contacting)|do not contact)\b/i.test(authored)) return "OPTED_OUT";
  return "REPLIED";
}

function assessReply(body: string) {
  const authored = authoredText(body);
  if (/\b(?:not interested|no longer hiring|already filled|went with another)\b/i.test(authored)) return "NEGATIVE";
  if (/\b(?:let['’]s (?:talk|meet|schedule)|interested in (?:talking|a call)|happy to discuss)\b/i.test(authored)) return "POSITIVE";
  if (authored.includes("?")) return "CLARIFICATION";
  return "OTHER";
}

const milestoneFrom: Partial<Record<Application["state"], Application["state"][]>> = {
  INTERESTED: ["REPLIED"],
  MEETING_SCHEDULED: ["REPLIED", "INTERESTED", "NEGOTIATION"],
  NEGOTIATION: ["REPLIED", "INTERESTED", "MEETING_SCHEDULED", "PROPOSAL_PREPARED"],
  PROPOSAL_PREPARED: ["INTERESTED", "MEETING_SCHEDULED", "NEGOTIATION"],
  WON: ["NEGOTIATION", "PROPOSAL_PREPARED"],
  LOST: ["REPLIED", "INTERESTED", "MEETING_SCHEDULED", "NEGOTIATION", "PROPOSAL_PREPARED"],
};

function recordMilestone(id: string, raw: unknown) {
  const milestone = application.shape.milestone.unwrap().parse(raw);
  return update(id, row => {
    if (!row || ended.has(row.state) || (milestone.state !== "CLOSED" && !milestoneFrom[milestone.state]?.includes(row.state))) {
      throw new Error("The current lifecycle does not allow that milestone.");
    }
    return { ...row, milestone, state: milestone.state, activityAt: new Date().toISOString(),
      nextAction: ended.has(milestone.state) ? "No follow-up is scheduled." : "Review the recorded evidence and agree the next action with the owner." };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [action, input, extra] = process.argv.slice(2);
  if (action === "prepare") {
    const row = await prepareCommercialDraft(JSON.parse(await readFile(input, "utf8")));
    console.log(JSON.stringify({ id: row.id, state: row.state, draftHash: fingerprint(row.draft!) }));
  } else if (action === "approve") {
    const row = await approveCommercialDraft(input, extra);
    console.log(JSON.stringify({ id: row.id, state: row.state }));
  } else if (action === "receipt") {
    const row = await recordCommercialReceipt(input, JSON.parse(await readFile(extra, "utf8")));
    console.log(JSON.stringify({ id: row.id, state: row.state }));
    const env = await readFile(join(directory, "..", "..", ".env.external"), "utf8").then(parseEnv).catch(error => {
      if (error.code === "ENOENT") return {};
      throw error;
    });
    if ("COMMERCIAL_TELEGRAM_RECEIPTS" in env && env.COMMERCIAL_TELEGRAM_RECEIPTS === "true") {
      try { console.log(JSON.stringify({ ownerNotification: await notifyOwnerOfReceipt(input, env) })); }
      catch (error) { console.error(`Email receipt recorded. Owner Telegram check failed: ${(error as Error).message}`); }
    }
  } else if (action === "notify-owner") {
    const env = parseEnv(await readFile(join(directory, "..", "..", ".env.external"), "utf8"));
    if (env.COMMERCIAL_TELEGRAM_RECEIPTS !== "true") throw new Error("Set COMMERCIAL_TELEGRAM_RECEIPTS=true to enable owner application receipts.");
    const notification = await notifyOwnerOfReceipt(input, env);
    console.log(JSON.stringify({ ownerNotification: notification ?? null }));
    if (notification?.state !== "SENT") process.exitCode = 1;
  } else if (action === "reply") {
    const incoming = reply.parse(JSON.parse(await readFile(extra, "utf8")));
    const row = await update(input, previous => {
      if (!previous) throw new Error("Unknown application.");
      const outcome = trackedReplyOutcome(previous, incoming);
      return outcome ? { ...previous, state: outcome === "REPLIED" && stageAfterReply.test(previous.state) ? previous.state : outcome, activityAt: new Date().toISOString(),
        lastReplyAssessment: outcome === "REPLIED" ? assessReply(incoming.body) : outcome,
        replyIds: [...previous.replyIds, incoming.messageId],
        nextAction: outcome === "REPLIED" ? "Review the reply and draft a response for exact-content approval." : "Suppress further outreach." } : previous;
    });
    console.log(JSON.stringify({ id: row.id, state: row.state }));
  } else if (action === "milestone") {
    const row = await recordMilestone(input, JSON.parse(await readFile(extra, "utf8")));
    console.log(JSON.stringify({ id: row.id, state: row.state }));
  } else throw new Error("Use prepare, approve, receipt, notify-owner, reply or milestone.");
}
