import {
  defaults,
  canContact,
  dedupKey,
  hash,
  inputSchema,
  isDuplicate,
  systemClock,
  type Activity,
  type ApprovalRequest,
  type Clock,
  type Config,
  type Draft,
  type Lead,
  type LeadInput,
  type Status,
  type Store,
} from "./model";
import { assess, injectionPattern, type Signals } from "./scoring";

const transitions: Record<Status, Status[]> = {
  NEW: ["QUALIFIED", "ARCHIVED", "REJECTED"],
  QUALIFIED: ["PENDING_APPROVAL", "ARCHIVED", "REJECTED"],
  PENDING_APPROVAL: ["APPROVED_FOR_DRAFT", "REJECTED", "ARCHIVED"],
  APPROVED_FOR_DRAFT: ["DRAFT_READY", "REJECTED"],
  DRAFT_READY: ["CONTACTED_MANUALLY", "EMAIL_SENT", "REJECTED", "ARCHIVED"],
  EMAIL_SENT: ["REPLIED", "LOST", "ARCHIVED"],
  CONTACTED_MANUALLY: ["REPLIED", "LOST", "ARCHIVED"],
  REPLIED: ["DISCOVERY", "LOST", "ARCHIVED"],
  DISCOVERY: ["QUOTED", "LOST"],
  QUOTED: ["WON", "LOST"],
  WON: ["MAINTENANCE"],
  LOST: ["ARCHIVED"],
  MAINTENANCE: ["ARCHIVED"],
  ARCHIVED: [],
  REJECTED: [],
};
export class Engine {
  constructor(
    public store: Store,
    public config: Config = defaults,
    public clock: Clock = systemClock,
    private extractor?: (input: LeadInput) => {
      signals?: Signals;
      warning?: string;
    },
  ) {}
  log(
    lead: Lead,
    from: string,
    type: string,
    actor = "system",
    details = "",
  ): void {
    const event: Activity = {
      event_id:
        "ev_" +
        hash(
          lead.lead_id +
            "|" +
            type +
            "|" +
            from +
            "|" +
            lead.status +
            "|" +
            lead.updated_at,
        ),
      lead_id: lead.lead_id,
      timestamp: lead.updated_at,
      actor,
      event_type: type,
      previous_state: from,
      new_state: lead.status,
      details,
    };
    this.store.activity(event);
  }
  ingest(raw: unknown): { lead: Lead; duplicate: boolean } {
    const input = inputSchema.parse(raw);
    const existing = isDuplicate(input, this.store.leads());
    if (existing) return { lead: existing, duplicate: true };
    const now = this.clock.now();
    const assessment = this.classify(input);
    const key = dedupKey(input);
    let lead: Lead = {
      ...input,
      ...assessment,
      lead_id: "lf_" + hash(key),
      dedup_key: key,
      status: "NEW",
      approval_status: "NONE",
      draft_id: "",
      discovered_at: input.discovered_at || now,
      created_at: now,
      updated_at: now,
      last_activity_at: now,
      next_followup_at: "",
    };
    this.store.save(lead);
    this.log(lead, "", "INGESTED");
    if (assessment.quarantined) lead = this.move(lead, "ARCHIVED");
    else if (
      assessment.score >= this.config.reviewThreshold &&
      assessment.breakdown.intent > 0 &&
      assessment.breakdown.fit > 0
    ) {
      lead = this.move(lead, "QUALIFIED");
      lead.approval_status = "PENDING";
      lead = this.move(lead, "PENDING_APPROVAL");
    }
    return { lead, duplicate: false };
  }
  private classify(input: LeadInput) {
    let extraction: { signals?: Signals; warning?: string } = {};
    if (this.extractor && !injectionPattern.test(input.title + ' ' + input.raw_description)) {
      try { extraction = this.extractor(input); }
      catch { extraction = { warning: 'Classifier unavailable; deterministic fallback used' }; }
    }
    return assess(input, this.clock.now(), this.config, extraction.signals, extraction.warning);
  }
  reprocess(id: string): Lead {
    const old = this.store.get(id);
    if (!old || !['NEW', 'ARCHIVED'].includes(old.status) || old.draft_id || old.approval_status === 'APPROVED' || this.store.requests().some(r => r.lead_id === id)) {
      throw new Error('Only unapproved NEW/ARCHIVED leads without approval history can be reprocessed');
    }
    const input = inputSchema.strip().parse(old);
    let lead: Lead = { ...old, ...this.classify(input), status: 'NEW', approval_status: 'NONE', updated_at: this.clock.now(), last_activity_at: this.clock.now() };
    this.store.save(lead);
    this.log(lead, old.status, 'REPROCESSED', 'owner');
    if (lead.quarantined) lead = this.move(lead, 'ARCHIVED');
    else if (lead.score >= this.config.reviewThreshold && lead.breakdown.intent > 0 && lead.breakdown.fit > 0) {
      lead = this.move(lead, 'QUALIFIED');
      lead = this.move({ ...lead, approval_status: 'PENDING' }, 'PENDING_APPROVAL');
    }
    return lead;
  }
  move(
    lead: Lead,
    next: Status,
    actor = "system",
    manualConfirmation = false,
  ): Lead {
    if (!transitions[lead.status].includes(next))
      throw new Error("Invalid status transition");
    if (next === 'EMAIL_SENT' && (actor !== 'approved-email-service' || lead.approval_status !== 'APPROVED' || lead.source !== 'inbound' || lead.contact_permission_state !== 'EXPLICIT_OPT_IN' || !lead.contact_email)) throw new Error('Approved inbound email service required');
    if (
      next === "CONTACTED_MANUALLY" &&
      (!manualConfirmation || actor === "system" || !canContact(lead))
    )
      throw new Error("Manual confirmation and permitted contact required");
    const updated = {
      ...lead,
      status: next,
      updated_at: this.clock.now(),
      last_activity_at: this.clock.now(),
    };
    this.store.save(updated);
    this.log(updated, lead.status, "STATUS_CHANGED", actor);
    return updated;
  }
  prepareApproval(lead: Lead, nonce: string): ApprovalRequest {
    if (lead.status !== "PENDING_APPROVAL")
      throw new Error("Lead is not pending approval");
    if (!/^[a-zA-Z0-9_-]{12,32}$/.test(nonce)) throw new Error("Invalid nonce");
    const request: ApprovalRequest = {
      request_id: "ar_" + hash(lead.lead_id + nonce),
      lead_id: lead.lead_id,
      nonce,
      chat_id: this.config.ownerChatId,
      message_id: "",
      expires_at: new Date(
        Date.parse(this.clock.now()) + this.config.approvalHours * 3600000,
      ).toISOString(),
      state: "PREPARED",
      decision: "",
    };
    this.store.request(request);
    return request;
  }
  decide(input: {
    userId: string;
    chatId: string;
    chatType: string;
    messageId: string;
    data: string;
  }): Lead {
    if (
      input.userId !== this.config.ownerUserId ||
      input.chatId !== this.config.ownerChatId ||
      input.chatType !== "private"
    )
      throw new Error("Unauthorized owner or chat");
    const match = input.data.match(
      /^(approve|review|reject):([a-zA-Z0-9_-]{12,32})$/,
    );
    if (!match) throw new Error("Invalid callback");
    const request = this.store.requests().find((r) => r.nonce === match[2]);
    if (
      !request ||
      request.state !== "SENT" ||
      request.chat_id !== input.chatId ||
      request.message_id !== input.messageId ||
      Date.parse(request.expires_at) <= Date.parse(this.clock.now())
    )
      throw new Error("Expired, replayed or mismatched approval");
    const lead = this.store.get(request.lead_id);
    if (!lead || lead.status !== "PENDING_APPROVAL")
      throw new Error("Lead is no longer pending");
    // Save the decision before applying it. A crash can be reconciled without accepting a replay.
    request.state = "CONSUMED";
    request.decision = match[1] as ApprovalRequest["decision"];
    this.store.request(request);
    return this.applyDecision(request);
  }
  applyDecision(request: ApprovalRequest): Lead {
    let lead = this.store.get(request.lead_id);
    if (!lead || request.state !== "CONSUMED" || !request.decision)
      throw new Error("No recorded decision");
    if (lead.status === "PENDING_APPROVAL") {
      if (request.decision === "review") {
        if (lead.approval_status === "DEFERRED") return lead;
        lead = {
          ...lead,
          approval_status: "DEFERRED",
          next_followup_at: new Date(
            Date.parse(this.clock.now()) + 86400000,
          ).toISOString(),
          updated_at: this.clock.now(),
        };
        this.store.save(lead);
        this.log(lead, lead.status, "DEFERRED", "owner");
        return lead;
      }
      lead = {
        ...lead,
        approval_status:
          request.decision === "approve" ? "APPROVED" : "REJECTED",
      };
      lead = this.move(
        lead,
        request.decision === "approve" ? "APPROVED_FOR_DRAFT" : "REJECTED",
        "owner",
      );
    }
    if (lead.status === "APPROVED_FOR_DRAFT") lead = this.createDraft(lead);
    return lead;
  }
  createDraft(lead: Lead): Lead {
    if (
      lead.status !== "APPROVED_FOR_DRAFT" ||
      lead.approval_status !== "APPROVED"
    )
      throw new Error("Owner approval required");
    const draft = proposal(lead, this.clock.now());
    this.store.draft(draft);
    return this.move({ ...lead, draft_id: draft.draft_id }, "DRAFT_READY");
  }
  reconcile(): void {
    // Resume a partially persisted ingestion as well as a partially applied decision.
    for (let lead of this.store.leads()) {
      if (lead.status === "NEW" && lead.quarantined)
        this.move(lead, "ARCHIVED");
      else if (
        lead.status === "NEW" &&
        lead.score >= this.config.reviewThreshold &&
        lead.breakdown.intent > 0 &&
        lead.breakdown.fit > 0
      )
        lead = this.move(lead, "QUALIFIED");
      if (lead.status === "QUALIFIED")
        this.move({ ...lead, approval_status: "PENDING" }, "PENDING_APPROVAL");
    }
    for (const request of this.store
      .requests()
      .filter((r) => r.state === "CONSUMED")) {
      const lead = this.store.get(request.lead_id);
      if (
        lead &&
        ["PENDING_APPROVAL", "APPROVED_FOR_DRAFT"].includes(lead.status)
      )
        this.applyDecision(request);
    }
  }
}
export function proposal(lead: Lead, now: string): Draft {
  if (lead.approval_status !== "APPROVED")
    throw new Error("Draft requires approval");
  const scope =
    lead.skills.includes("api") || lead.skills.includes("java")
      ? "map the API contracts, implement one complete integration, and add validation and handover documentation"
      : "map the enquiry journey, build a responsive interface, and connect the agreed intake and owner-notification workflow";
  const text = `DRAFT — owner review required. Nothing has been sent.\n${canContact(lead) ? "Use only the verified " + lead.contact_channel + " channel." : "HOLD: contact permission is unknown or blocked. Do not send until independently verified."}\n\nHello${lead.client_name_if_public ? " " + lead.client_name_if_public : ""},\n\nYour request, “${lead.title}”, stood out because the workflow can be scoped around one useful result. Based on your listing: ${lead.summary}\n\nI suggest we first ${scope}. We can agree the acceptance checks before implementation and review a working version together.\n\nTo scope this accurately:\n1. What is the most important action a user should be able to complete?\n2. Which existing tools, access permissions and content are available?\n3. What budget range and delivery window should we work within?\n\nPossible milestones (subject to agreement): discovery and scope; working workflow; testing and handover.\n\nAssumptions: you can authorize access to the required tools; third-party costs, final price and timeline will be agreed separately. I have not assumed any past work relationship or promised delivery dates.\n\nSource: ${lead.source_url || "Owner-provided brief"}\nUnverified: ${lead.missing.join("; ") || "Confirm current availability and source details before sending."}`;
  return {
    draft_id: "dr_" + lead.lead_id,
    lead_id: lead.lead_id,
    created_at: now,
    text,
    source_url: lead.source_url,
    review_required: true,
  };
}
export function notification(lead: Lead, request: ApprovalRequest) {
  return {
    text: `LeadFlow • owner review\n${lead.title}\nScore ${lead.score}/100 • ${lead.priority}\nBudget: ${lead.stated_budget_max ?? lead.stated_budget_min ?? "not stated"} ${lead.currency}\n${lead.reasoning.slice(0, 2).join("\n")}\nPermission: ${lead.contact_permission_state}\n${lead.source_url}\nApproval creates a draft only.`,
    reply_markup: {
      inline_keyboard: [
        [{ text: "Draft proposal", callback_data: "approve:" + request.nonce }],
        [
          { text: "Review later", callback_data: "review:" + request.nonce },
          { text: "Reject", callback_data: "reject:" + request.nonce },
        ],
      ],
    },
  };
}
export function commandReply(
  command: string,
  leads: Lead[],
  now: string,
  events?: Activity[],
): string {
  const cmd = command.split(/\s|@/)[0];
  const reached = (status: string, fallback: string[]) =>
    events
      ? new Set(
          events.filter((e) => e.new_state === status).map((e) => e.lead_id),
        ).size
      : leads.filter((l) => fallback.includes(l.status)).length;
  if (cmd === "/stats")
    return `Actual CRM counts\nTotal: ${leads.length}\nQualified ever: ${reached("QUALIFIED", ["QUALIFIED", "PENDING_APPROVAL", "APPROVED_FOR_DRAFT", "DRAFT_READY", "CONTACTED_MANUALLY", "REPLIED", "DISCOVERY", "QUOTED", "WON", "MAINTENANCE"])}\nApproved ever: ${reached("APPROVED_FOR_DRAFT", ["APPROVED_FOR_DRAFT", "DRAFT_READY", "CONTACTED_MANUALLY", "REPLIED", "DISCOVERY", "QUOTED", "WON", "MAINTENANCE"])}\nPending: ${leads.filter((l) => l.status === "PENDING_APPROVAL" || (l.source === "inbound" && l.status === "DRAFT_READY" && l.approval_status === "PENDING")).length}\nDrafts ready: ${leads.filter((l) => l.status === "DRAFT_READY").length}\nEnquiry emails sent: ${leads.filter((l) => l.status === "EMAIL_SENT").length}\nManually submitted: ${reached("CONTACTED_MANUALLY", ["CONTACTED_MANUALLY", "REPLIED", "DISCOVERY", "QUOTED", "WON", "LOST", "MAINTENANCE"])}\nReplies: ${reached("REPLIED", ["REPLIED", "DISCOVERY", "QUOTED", "WON", "MAINTENANCE"])}\nDiscovery calls: ${reached("DISCOVERY", ["DISCOVERY", "QUOTED", "WON", "MAINTENANCE"])}\nWon: ${reached("WON", ["WON", "MAINTENANCE"])}`;
  if (["/leads", "/pending", "/followups"].includes(cmd)) {
    const filtered = leads.filter((l) =>
      cmd === "/pending"
        ? l.status === "PENDING_APPROVAL" || (l.status === 'DRAFT_READY' && l.approval_status === 'PENDING')
        : cmd === "/followups"
          ? Boolean(l.next_followup_at && l.next_followup_at <= now)
          : !["NEW", "ARCHIVED", "REJECTED"].includes(l.status),
    );
    return (
      filtered
        .sort((a, b) => cmd === '/followups' ? a.next_followup_at.localeCompare(b.next_followup_at) : b.created_at.localeCompare(a.created_at))
        .slice(0, 8)
        .map(
          (l) =>
            `${l.lead_id}\n${l.title.slice(0, 120)} • ${l.score}/100 • ${l.status}\n${l.source_url.length <= 240 ? l.source_url : 'Full source link is in your CRM.'}`,
        )
        .join("\n\n") || "No matching leads yet."
    );
  }
  return "LeadFlow owner controls\n/leads — recent qualified leads\n/pending — approval queue\n/followups — due reviews\n/stats — actual funnel counts\n/help — this guide\nWebsite enquiries: Approve & send email authorizes the exact displayed reply. Discovered opportunities: approval prepares a draft for manual submission. Commands and approvals are checked about every 10 minutes. Check EmailOutbox for delivery status. Renew deferred/expired reviews from the Sheet menu.";
}
