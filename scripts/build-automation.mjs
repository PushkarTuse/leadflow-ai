import { build } from "esbuild";
import { mkdir, copyFile, appendFile } from "node:fs/promises";
const out = "apps/automation/dist";
await mkdir(out, { recursive: true });
await build({
  entryPoints: ["apps/automation/main.ts"],
  bundle: true,
  format: "iife",
  globalName: "LeadFlow",
  target: "es2020",
  outfile: out + "/Code.gs",
  minify: false,
  legalComments: "none",
});
const functions = [
  "onOpen",
  "setup",
  "tick",
  "installTriggers",
  "removeTriggers",
  "importManualInbox",
  "importLegacyCRM",
  "addManualLead",
  "updateSelectedLead",
  "renewSelectedApproval",
  "deleteSelectedLead",
  "sendTestNotification",
  "reprocessSelectedLead",
  "renewSelectedEmailApproval",
  "connectTelegramOwner",
];
await appendFile(
  out + "/Code.gs",
  "\n" +
    functions
      .map((n) => `function ${n}() { return LeadFlow.${n}(); }`)
      .join("\n") +
    "\nfunction doPost(e) { return LeadFlow.doPost(e); }\nfunction doGet(e) { return LeadFlow.doGet(e); }\n",
);
await copyFile("apps/automation/appsscript.json", out + "/appsscript.json");
console.log(
  "Built Apps Script: " + out + "/Code.gs (local only; not deployed)",
);
