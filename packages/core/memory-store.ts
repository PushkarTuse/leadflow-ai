import type { Activity, ApprovalRequest, Draft, Lead, Store } from "./model";
export class MemoryStore implements Store {
  rows: Lead[] = [];
  events: Activity[] = [];
  draftRows: Draft[] = [];
  requestRows: ApprovalRequest[] = [];
  leads() {
    return this.rows.map((x) => structuredClone(x));
  }
  get(id: string) {
    const x = this.rows.find((l) => l.lead_id === id);
    return x ? structuredClone(x) : undefined;
  }
  save(x: Lead) {
    this.rows = this.rows
      .filter((l) => l.lead_id !== x.lead_id)
      .concat(structuredClone(x));
  }
  activity(x: Activity) {
    if (!this.events.some((e) => e.event_id === x.event_id))
      this.events.push(structuredClone(x));
  }
  activities() {
    return this.events;
  }
  draft(x: Draft) {
    if (!this.draftRows.some((d) => d.draft_id === x.draft_id))
      this.draftRows.push(structuredClone(x));
  }
  drafts() {
    return this.draftRows;
  }
  request(x: ApprovalRequest) {
    this.requestRows = this.requestRows
      .filter((r) => r.request_id !== x.request_id)
      .concat(structuredClone(x));
  }
  requests() {
    return this.requestRows.map((x) => structuredClone(x));
  }
}
