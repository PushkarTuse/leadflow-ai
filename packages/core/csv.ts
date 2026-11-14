import { inputSchema, type Lead, type LeadInput } from "./model";

export function parseCsv(text: string): Record<string, string>[] {
  if (text.length > 2_000_000) throw new Error("CSV exceeds 2 MB limit");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else field += c;
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (c === "," || c === "\n" || c === "\r") {
      row.push(field);
      field = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
      }
    } else {
      if (closed || c === '"') throw new Error("Malformed CSV quoting");
      field += c;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const headers = rows.shift()?.map((h) => h.trim());
  if (
    !headers?.length ||
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length
  )
    throw new Error("Missing or duplicate CSV headers");
  if (rows.length > 500) throw new Error("Import at most 500 rows per file");
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      throw new Error(`Row ${i + 2}: wrong column count`);
    return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
  });
}
export const legacyMapping: Record<string, string> = {
  Source: "source",
  "Source URL": "source_url",
  "Business / Client": "client_name_if_public",
  "Contact Channel": "contact_channel",
  "Requested Work": "raw_description",
  "Budget Min (₹)": "stated_budget_min",
  "Budget Max (₹)": "stated_budget_max",
  Notes: "owner_notes",
};
export function rowToInput(row: Record<string, string>): LeadInput {
  const legacy = "Requested Work" in row;
  const mapped = legacy
    ? Object.fromEntries(
        Object.entries(legacyMapping).map(([from, to]) => [
          to,
          row[from] || "",
        ]),
      )
    : row;
  const value = (key: string) => mapped[key] ?? "";
  const amount = (key: string) =>
    value(key).trim() === "" ? null : Number(value(key).replace(/,/g, ""));
  return inputSchema.parse({
    source: "csv",
    source_external_id: legacy
      ? row["Lead ID"] || ""
      : value("source_external_id"),
    source_url: value("source_url"),
    title: value("title") || value("raw_description").slice(0, 120),
    raw_description: value("raw_description"),
    client_name_if_public: value("client_name_if_public"),
    country_or_region: value("country_or_region"),
    stated_budget_min: amount("stated_budget_min"),
    stated_budget_max: amount("stated_budget_max"),
    currency: legacy ? "INR" : value("currency") || "UNKNOWN",
    contact_channel: value("contact_channel") || "Not verified",
    contact_permission_state: legacy
      ? "UNKNOWN"
      : value("contact_permission_state") || "UNKNOWN",
    owner_notes: value("owner_notes"),
    ...(value("posted_at") ? { posted_at: value("posted_at") } : {}),
    ...(value("discovered_at")
      ? { discovered_at: value("discovered_at") }
      : {}),
  });
}
export function safeCell(value: unknown): string | number | boolean {
  if (typeof value === "number" || typeof value === "boolean") return value;
  const s =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return /^[\s\u0000-\u001f]*[=+@-]/.test(s) ? "'" + s : s;
}
export const leadHeaders = [
  "lead_id",
  "source",
  "source_external_id",
  "source_url",
  "discovered_at",
  "posted_at",
  "title",
  "raw_description",
  "client_name_if_public",
  "country_or_region",
  "stated_budget_min",
  "stated_budget_max",
  "currency",
  "required_skills",
  "project_summary",
  "real_hiring_intent",
  "technical_fit",
  "budget_fit",
  "credibility",
  "timeline_fit",
  "contact_channel",
  "contact_permission_state",
  "score",
  "score_reasoning",
  "confidence",
  "missing_information",
  "status",
  "approval_status",
  "owner_notes",
  "draft_id",
  "last_activity_at",
  "next_followup_at",
  "dedup_key",
  "created_at",
  "updated_at",
  "priority",
  "classifier",
  "classification_warning",
] as const;
export function leadRecord(l: Lead): Record<string, unknown> {
  return {
    ...l,
    required_skills: l.skills,
    project_summary: l.summary,
    real_hiring_intent: l.breakdown.intent,
    technical_fit: l.breakdown.fit,
    budget_fit: l.breakdown.budget,
    credibility: l.breakdown.credibility,
    timeline_fit: l.breakdown.timeline,
    score_reasoning: l.reasoning,
    missing_information: l.missing,
    classifier: l.method,
    classification_warning: l.extractionWarning,
  };
}
export function exportCsv(leads: Lead[]): string {
  const escape = (value: unknown) =>
    '"' + String(safeCell(value)).replace(/"/g, '""') + '"';
  return [
    leadHeaders.map(escape).join(","),
    ...leads.map((l) =>
      leadHeaders.map((h) => escape(leadRecord(l)[h])).join(","),
    ),
  ].join("\r\n");
}
