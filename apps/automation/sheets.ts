import { leadHeaders, leadRecord, safeCell } from "../../packages/core/csv";
import type { EmailOutbox, OutboxStore } from "../../packages/core/email";
import type {
  Activity,
  ApprovalRequest,
  Draft,
  Lead,
  Store,
} from "../../packages/core/model";

export const tableHeaders: Record<string, string[]> = {
  Leads: [...leadHeaders, "record_json"],
  ActivityLog: [
    "event_id",
    "lead_id",
    "timestamp",
    "actor",
    "event_type",
    "previous_state",
    "new_state",
    "details",
  ],
  Drafts: [
    "draft_id",
    "lead_id",
    "created_at",
    "text",
    "source_url",
    "review_required",
  ],
  ApprovalRequests: [
    "request_id",
    "lead_id",
    "nonce",
    "chat_id",
    "message_id",
    "expires_at",
    "state",
    "decision",
  ],
  SourceRuns: [
    "run_id",
    "source",
    "started_at",
    "completed_at",
    "status",
    "imported",
    "duplicates",
    "invalid",
    "retry_count",
    "details",
  ],
  Settings: ["key", "value", "notes"],
  ManualInbox: [
    "source_external_id",
    "source_url",
    "title",
    "raw_description",
    "client_name_if_public",
    "stated_budget_min",
    "stated_budget_max",
    "currency",
    "contact_channel",
    "contact_permission_state",
    "posted_at",
    "owner_notes",
    "import_result",
  ],
  EngineDashboard: ["metric", "value", "updated_at"],
  IntakeReceipts: ["submission_id", "lead_id", "payload_hash", "received_at", "processed_at", "status"],
  EmailOutbox: ["outbox_id", "lead_id", "recipient", "subject", "body", "content_hash", "nonce", "chat_id", "message_id", "expires_at", "status", "created_at", "updated_at", "approved_by", "approved_at", "gmail_message_id", "error_code", "draft_method"],
  "Local Businesses": [
    "business_key",
    "api_id",
    "source",
    "source_id",
    "name",
    "category",
    "title",
    "city",
    "country",
    "address",
    "phone",
    "email",
    "website",
    "website_status",
    "pagespeed_mobile",
    "rating",
    "rating_count",
    "score",
    "signal",
    "source_url",
    "campaign_status",
    "last_contacted_at",
    "campaign_notes",
    "synced_at",
  ],
};
export interface TablePort {
  read(name: string): unknown[][];
  writeRow(name: string, row: number, values: unknown[]): void;
  removeRow(name: string, row: number): void;
}
function fromCell(x: unknown): unknown {
  return typeof x === "string" &&
    x.startsWith("'") &&
    /^[\s\u0000-\u001f]*[=+@-]/.test(x.slice(1))
    ? x.slice(1)
    : x;
}
export class SheetStore implements Store {
  constructor(public port: TablePort) {}
  records(name: string): Record<string, unknown>[] {
    const rows = this.port.read(name);
    const header = rows[0];
    if (
      !header ||
      JSON.stringify(header) !== JSON.stringify(tableHeaders[name])
    )
      throw new Error(
        "Schema mismatch for " + name + "; run setup before processing",
      );
    return rows
      .slice(1)
      .filter((row) => row[0] !== "" && row[0] !== undefined)
      .map((row) =>
        Object.fromEntries(header.map((h, i) => [String(h), fromCell(row[i])])),
      );
  }
  upsert(name: string, key: string, data: Record<string, unknown>) {
    const records = this.records(name);
    const at = records.findIndex((r) => String(r[key]) === String(data[key]));
    // Record identity is looked up each time, including after a user sorts the sheet.
    const all = this.port.read(name);
    const row =
      at < 0
        ? all.length + 1
        : all.findIndex(
            (r, i) => i > 0 && String(fromCell(r[0])) === String(data[key]),
          ) + 1;
    this.port.writeRow(
      name,
      row,
      tableHeaders[name].map((h) => safeCell(data[h])),
    );
  }
  leads() {
    return this.records("Leads").map(
      (r) => JSON.parse(String(r.record_json)) as Lead,
    );
  }
  get(id: string) {
    return this.leads().find((l) => l.lead_id === id);
  }
  save(l: Lead) {
    this.upsert("Leads", "lead_id", {
      ...leadRecord(l),
      record_json: JSON.stringify(l),
    });
  }
  upsertLocalBusiness(data: Record<string, unknown>) {
    const current = this.records("Local Businesses").find((record) => record.business_key === data.business_key);
    this.upsert("Local Businesses", "business_key", {
      ...data,
      campaign_status: current?.campaign_status || data.campaign_status || "new",
      last_contacted_at: current?.last_contacted_at || data.last_contacted_at || "",
      campaign_notes: current?.campaign_notes ?? data.campaign_notes ?? "",
    });
    return Boolean(current);
  }
  activity(e: Activity) {
    if (!this.records("ActivityLog").some((r) => r.event_id === e.event_id))
      this.upsert("ActivityLog", "event_id", { ...e });
  }
  activities() {
    return this.records("ActivityLog") as unknown as Activity[];
  }
  draft(d: Draft) {
    if (!this.records("Drafts").some((r) => r.draft_id === d.draft_id))
      this.upsert("Drafts", "draft_id", { ...d });
  }
  drafts() {
    return this.records("Drafts") as unknown as Draft[];
  }
  request(r: ApprovalRequest) {
    this.upsert("ApprovalRequests", "request_id", { ...r });
  }
  requests() {
    return this.records("ApprovalRequests").map((r) => ({
      ...r,
      chat_id: String(r.chat_id),
      message_id: String(r.message_id),
    })) as unknown as ApprovalRequest[];
  }
  deleteLead(id: string) {
    for (const name of ["Leads", "Drafts", "ApprovalRequests", "ActivityLog", "EmailOutbox", "IntakeReceipts"]) {
      const header = tableHeaders[name];
      const index = header.indexOf("lead_id");
      const rows = this.port.read(name);
      for (let i = rows.length - 1; i >= 1; i--)
        if (String(rows[i][index]) === id) this.port.removeRow(name, i + 1);
    }
  }
}
export class SheetOutbox implements OutboxStore {
  constructor(private store:SheetStore){}
  list(){return this.store.records('EmailOutbox').map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,String(v??'')])) as unknown as EmailOutbox);}
  save(row:EmailOutbox){this.store.upsert('EmailOutbox','outbox_id',{...row});}
}
