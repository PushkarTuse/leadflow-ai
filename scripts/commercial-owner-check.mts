import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
import { verifiedOwnerTelegram } from "./commercial-telegram";

// This command sends one controlled test to the venture mailbox and its paired
// private Telegram owner chat. It never reads a prospect recipient.
if (!process.argv.includes("--confirm-owner-test")) throw new Error("Confirm the controlled owner test first.");
const env = parseEnv(await readFile(".env.external", "utf8"));
const owner = "leadsflowwai@gmail.com";
const chat = env.TELEGRAM_OWNER_CHAT_ID ?? "";
if (env.OWNER_TEST_EMAIL?.toLowerCase() !== owner || !/^\d+$/.test(chat) || chat !== env.TELEGRAM_OWNER_USER_ID) {
  throw new Error("The configured mailbox and Telegram chat must match the venture's owner destinations.");
}
const smtp = new URL(env.OWNER_TEST_SMTP_URL ?? "");
if (smtp.hostname !== "smtp.resend.com" || env.OWNER_TEST_EMAIL_FROM !== "onboarding@resend.dev") {
  throw new Error("Verify the configured owner-test SMTP route before using it.");
}
const telegram = await verifiedOwnerTelegram(env);
const directory = "data/commercial";
await mkdir(directory, { recursive: true });
const receipt = `${directory}/owner-check-20261126.json`;
const reservation = await open(receipt, "wx");
const at = new Date().toISOString();
await reservation.writeFile(JSON.stringify({ at, state: "STARTED" }));
await reservation.close();
const subject = "[LeadFlow owner test] Commercial pipeline · LF-20261126";
const portfolio = "https://leadflow-agency.pages.dev/";
const content = "Owner-only delivery check. This is a test of the LeadFlow pipeline and is unrelated to any prospect application.";
const mail = spawnSync(process.execPath, ["scripts/owner-email-test.mjs"], {
  input: JSON.stringify({
    smtpUrl: env.OWNER_TEST_SMTP_URL, from: env.OWNER_TEST_EMAIL_FROM, to: owner, replyTo: owner,
    displayName: "LeadFlow AI", subject, text: `${content}\n\nPortfolio: ${portfolio}`,
    html: `<p>${content}</p><p><a href="${portfolio}">LeadFlow AI portfolio</a></p>`,
  }), encoding: "utf8", timeout: 30000,
});
let email: { ok: boolean; messageId?: string; stage?: string; code?: number } = { ok: false, stage: "transport" };
try { email = JSON.parse(mail.stdout || "{}"); } catch { /* Keep the transport failure. */ }
const notification = await telegram(`LeadFlow owner test LF-20261126\nSMTP: ${email.ok ? "provider accepted" : "check local receipt"}\nNo prospect communication was attempted.`);
const result = {
  at,
  email: { state: email.ok ? "PROVIDER_ACCEPTED" : "FAILED_OR_UNCERTAIN", messageId: email.messageId, stage: email.stage, code: email.code },
  telegram: { state: notification.messageId ? "PROVIDER_ACCEPTED" : "FAILED_OR_UNCERTAIN", http: notification.http, messageId: notification.messageId },
};
await writeFile(receipt, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
