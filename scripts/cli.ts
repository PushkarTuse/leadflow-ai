import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { MemoryStore } from "../packages/core/memory-store";
import { Engine, commandReply, notification } from "../packages/core/workflow";
import { exportCsv, parseCsv, rowToInput } from "../packages/core/csv";
import { defaults, permissions, type Lead } from "../packages/core/model";
import { fixtures } from "../fixtures/leads";

const [command = "help", arg, ...flags] = process.argv.slice(2);
const dataDir = path.resolve("data");
const stateFile = path.join(dataDir, "hunter.json");
const store = new MemoryStore();
async function readState() {
  try {
    Object.assign(store, JSON.parse(await readFile(stateFile, "utf8")));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error(
        "Local state is unreadable. Restore from a known backup; no data overwritten.",
      );
  }
}
async function save() {
  await mkdir(dataDir, { recursive: true });
  await writeFile(stateFile + ".tmp", JSON.stringify(store, null, 2));
  await rename(stateFile + ".tmp", stateFile);
}
const engine = new Engine(store);
function requireConfirmation() {
  if (!flags.includes("--owner-confirmed"))
    throw new Error(
      "Add --owner-confirmed after reviewing the lead. This local CLI trusts access to your computer.",
    );
}
function decide(lead: Lead, action: string) {
  const request = engine.prepareApproval(lead, randomBytes(12).toString("hex"));
  request.state = "SENT";
  request.message_id = "local-simulation";
  store.request(request);
  return engine.decide({
    userId: defaults.ownerUserId,
    chatId: defaults.ownerChatId,
    chatType: "private",
    messageId: request.message_id,
    data: action + ":" + request.nonce,
  });
}
try {
  if (command === "demo") {
    const counts = { input: 0, imported: 0, duplicates: 0, invalid: 0 };
    for (const input of fixtures()) {
      counts.input++;
      try {
        engine.ingest(input).duplicate
          ? counts.duplicates++
          : counts.imported++;
      } catch {
        counts.invalid++;
      }
    }
    const lead = store.leads().find((l) => l.status === "PENDING_APPROVAL")!;
    const preview = notification(
      lead,
      engine.prepareApproval(lead, "demoNonce12345678"),
    );
    decide(lead, "approve");
    const before = store.leads().length;
    for (const input of fixtures()) {
      try {
        engine.ingest(input);
      } catch {}
    }
    if (store.leads().length !== before)
      throw new Error("Idempotency check failed");
    await mkdir("outputs/dry-run", { recursive: true });
    await writeFile("outputs/dry-run/leads.csv", exportCsv(store.leads()));
    await writeFile(
      "outputs/dry-run/audit.json",
      JSON.stringify(store.activities(), null, 2),
    );
    await writeFile("outputs/dry-run/proposal.txt", store.drafts()[0].text);
    await writeFile(
      "outputs/dry-run/owner-alert.json",
      JSON.stringify(preview, null, 2),
    );
    console.log(
      JSON.stringify(
        {
          mode: "OFFLINE SIMULATION — no network calls",
          ...counts,
          archived: store.leads().filter((l) => l.status === "ARCHIVED").length,
          drafts: store.drafts().length,
          idempotency: "passed",
          output: path.resolve("outputs/dry-run"),
        },
        null,
        2,
      ),
    );
  } else if (command === "help")
    console.log(
      "Opportunity Hunter — private local CLI\n\nimport <file.csv>\nmanual <file.json>\nlist\napprove|review|reject <lead_id> --owner-confirmed\ncontacted <lead_id> --owner-confirmed\npermission <lead_id> PLATFORM_ONLY|EXPLICIT_OPT_IN|UNKNOWN|BLOCKED --owner-confirmed\nexport <file.csv>\ndelete <lead_id> --owner-confirmed\n\nState stays in ignored data/hunter.json. No network calls. An approval creates a draft only.",
    );
  else {
    await readState();
    if (command === "import" || command === "manual") {
      if (!arg) throw new Error("Provide a file path");
      const file = await readFile(path.resolve(arg), "utf8");
      const rows = command === "import" ? parseCsv(file) : [JSON.parse(file)];
      const counts = { imported: 0, duplicate: 0, invalid: [] as number[] };
      for (const [i, row] of rows.entries()) {
        try {
          engine.ingest(
            command === "import"
              ? rowToInput(row)
              : { ...row, source: "manual" },
          ).duplicate
            ? counts.duplicate++
            : counts.imported++;
        } catch {
          counts.invalid.push(i + 2);
        }
      }
      await save();
      console.log(JSON.stringify(counts, null, 2));
    } else if (command === "list")
      console.log(
        commandReply(
          "/stats",
          store.leads(),
          new Date().toISOString(),
          store.activities(),
        ) +
          "\n\n" +
          store
            .leads()
            .map((l) => `${l.lead_id}  ${l.score}/100  ${l.status}  ${l.title}`)
            .join("\n"),
      );
    else if (command === "export") {
      if (!arg) throw new Error("Provide an export file path");
      await writeFile(path.resolve(arg), exportCsv(store.leads()));
      console.log("Exported " + store.leads().length + " leads.");
    } else {
      requireConfirmation();
      const lead = store.get(arg);
      if (!lead) throw new Error("Lead ID not found");
      if (["approve", "review", "reject"].includes(command)) {
        const next = decide(lead, command);
        await save();
        console.log(next.status);
        if (next.draft_id)
          console.log(
            store.drafts().find((d) => d.draft_id === next.draft_id)?.text,
          );
      } else if (command === "contacted") {
        engine.move(lead, "CONTACTED_MANUALLY", "owner", true);
        await save();
        console.log(
          "Recorded your manual submission confirmation. No message was sent by this tool.",
        );
      } else if (command === "permission") {
        const permission = flags.find((f) =>
          permissions.includes(f as (typeof permissions)[number]),
        );
        if (!permission) throw new Error("Specify a valid verified permission");
        const updated = {
          ...lead,
          contact_permission_state:
            permission as Lead["contact_permission_state"],
          updated_at: new Date().toISOString(),
        };
        store.save(updated);
        engine.log(updated, lead.status, "PERMISSION_VERIFIED", "owner");
        await save();
        console.log(
          "Permission recorded. Verify the exact permitted channel before submitting.",
        );
      } else if (command === "delete") {
        store.rows = store.rows.filter((l) => l.lead_id !== arg);
        store.events = store.events.filter((e) => e.lead_id !== arg);
        store.draftRows = store.draftRows.filter((d) => d.lead_id !== arg);
        store.requestRows = store.requestRows.filter((r) => r.lead_id !== arg);
        await save();
        console.log(
          "Local lead, drafts, requests and audit data deleted. Remove source/export copies separately.",
        );
      } else throw new Error("Unknown command. Run npm run hunter -- help");
    }
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : "Operation failed");
  process.exitCode = 1;
}
