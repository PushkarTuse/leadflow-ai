import { discoveryState } from "./discovery-state";
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
  type Assessment,
  type Clock,
  type Config,
  type Draft,
  type Lead,
  type LeadInput,
  type Status,
  type Store,
} from "./model";
import {
  assess,
  injectionPattern,
  type DiscoverySignals,
  type Signals,
} from "./scoring";
import {
  extractRuleEvidence,
  prefilterDiscovery,
  scoreFreelanceQualification,
  canonicalEvidence,
  defaultQualificationPolicy,
  discoverySemanticsSchema,
  type RuleEvidence,
} from "./qualification";

export function isDiscoveryCandidate(
  lead: {
    source: string;
    discovery_context?: Lead["discovery_context"];
    qualification?: Lead["qualification"];
  },
): boolean {
  return Boolean(lead.discovery_context || lead.qualification || lead.source === "hn");
}

export function canRouteDiscoveryLead(
  lead: Pick<Lead, "source" | "discovery_context" | "qualification" | "qualification_audit">,
): boolean {
  if (!isDiscoveryCandidate(lead)) return true;
  if (lead.qualification?.operator_decision !== "ACCEPTED") return false;
  const audit = lead.qualification_audit;
  if (audit?.operational_state && audit.operational_state !== "QUALIFIED") return false;
  return (audit?.decision_source === "MODEL" && audit.discovery_semantics?.decision === "ACCEPT") ||
    (audit?.decision_source === "RULES_FALLBACK" && lead.qualification.is_valid_freelance_lead &&
      lead.qualification.eligibility_state === "ELIGIBLE");
}

function mergeDiscoverySignals(
  rules: RuleEvidence,
  extracted: DiscoverySignals,
  canonical: string,
): { evidence: RuleEvidence; used: boolean } {
  const quotes = extracted.evidence_quotes.filter((item) =>
    canonical.includes(item.quote),
  );
  const hasQuote = (field: string) => quotes.some((item) => item.field === field);
  const quoteFor = (field: string) =>
    quotes.find((item) => item.field === field)?.quote ?? "";
  const next: RuleEvidence = {
    ...rules,
    budget_signal: { ...rules.budget_signal },
    contact_method: { ...rules.contact_method },
    required_skills: [...rules.required_skills],
    evidence_quotes: [...rules.evidence_quotes],
    all_reasons: [...rules.all_reasons],
    missing_fields: [...rules.missing_fields],
  };
  let used = false;
  const {
    decision, decision_reason,
    lead_kind, buyer_or_seller, engagement_boundary, term_hint,
    engagement_evidence, paid_evidence, scope_evidence,
  } = extracted;
  const semantics = discoverySemanticsSchema.safeParse({
    decision, decision_reason,
    lead_kind, buyer_or_seller, engagement_boundary, term_hint,
    engagement_evidence, paid_evidence, scope_evidence,
  });
  if (semantics.success && (decision === "REJECT" || Boolean(engagement_evidence?.trim() && scope_evidence?.trim())) &&
      [engagement_evidence, paid_evidence, scope_evidence].every(quote => quote === null || canonical.includes(quote))) {
    next.discovery_semantics = semantics.data;
    used = true;
    if (paid_evidence) quotes.push({ field: "payment", quote: paid_evidence });
    if (scope_evidence) quotes.push({ field: "scope", quote: scope_evidence });
  }

  if (next.intent === "UNKNOWN" && hasQuote("intent")) {
    const intentQuote = quoteFor("intent");
    const sellerCue =
      /\b(?:seeking freelance|looking for work|available for (?:work|projects)|my services|i(?:'m| am) available)\b/i;
    const buyerCue =
      /\b(?:we need|our (?:team|company) needs|need (?:a|an|someone|help)|looking for (?:a|an|someone|freelancer|contractor)|seeking (?:a|an|someone|freelancer|contractor)|hire|hiring|commission|requesting)\b/i;
    const employmentCue =
      /\b(?:full[- ]time|employee|permanent position|salary and benefits|on our payroll)\b/i;
    if (extracted.intent === "BUYER" && buyerCue.test(intentQuote) && !sellerCue.test(intentQuote)) {
      next.intent = "BUYER";
      next.all_reasons = next.all_reasons.filter((reason) => reason !== "AMBIGUOUS_DIRECTION");
      next.missing_fields = next.missing_fields.filter((field) => field !== "buyer_demand");
      used = true;
    } else if (extracted.intent === "SELLER" && sellerCue.test(intentQuote)) {
      next.intent = "SELLER";
      next.lead_type = "SELLER_PROMOTION";
      next.requester_type = "FREELANCER_SELLER";
      next.all_reasons.push("SELLER_SELF_PROMOTION");
      used = true;
    } else if (extracted.intent === "EMPLOYMENT" && employmentCue.test(intentQuote)) {
      next.intent = "EMPLOYMENT";
      next.lead_type = "EMPLOYMENT";
      next.requester_type = "EMPLOYER";
      next.engagement_type = /\bfixed[- ]?term\b/i.test(intentQuote)
        ? "EMPLOYEE_FIXED_TERM"
        : "EMPLOYEE_FULL_TIME";
      next.all_reasons.push(
        next.engagement_type === "EMPLOYEE_FIXED_TERM"
          ? "EMPLOYMENT_CONTRACT_ONLY"
          : "FULL_TIME_ONLY",
      );
      used = true;
    }
  }

  if (next.intent === "BUYER") {
    const eligibleEngagements = new Set([
      "FIXED_PROJECT",
      "INDEPENDENT_CONTRACT",
      "RETAINER",
      "FRACTIONAL",
      "CONSULTING",
    ]);
    if (
      next.engagement_type === "UNKNOWN" &&
      eligibleEngagements.has(extracted.engagement_type) &&
      hasQuote("engagement")
    ) {
      next.engagement_type = extracted.engagement_type;
      next.all_reasons = next.all_reasons.filter((reason) => reason !== "ENGAGEMENT_UNCLEAR");
      next.missing_fields = next.missing_fields.filter((field) => field !== "engagement_type");
      used = true;
    }
    if (
      next.lead_type === "UNKNOWN" &&
      ["CLIENT_PROJECT", "CONTRACT_ROLE", "RETAINER", "CONSULTING"].includes(extracted.lead_type) &&
      hasQuote("engagement")
    ) {
      next.lead_type = extracted.lead_type;
      used = true;
    }
    if (next.requester_type === "UNKNOWN" && extracted.requester_type !== "UNKNOWN" && hasQuote("requester")) {
      next.requester_type = extracted.requester_type;
      used = true;
    }
    if (
      next.budget_signal.kind === "UNKNOWN" &&
      extracted.budget_signal.kind !== "UNKNOWN" &&
      hasQuote("payment")
    ) {
      const paymentQuote = quoteFor("payment");
      const supportedPayment =
        extracted.budget_signal.kind === "AMOUNT_STATED"
          ? /(?:[$€£₹]|\b(?:USD|EUR|GBP|INR)\b)\s*[\d,.]+/i.test(paymentQuote)
          : extracted.budget_signal.kind === "EXPLICIT_PAID"
            ? /\b(?:paid|pay|payment|compensation|rate)\b/i.test(paymentQuote)
            : extracted.budget_signal.kind === "COMMERCIAL_HIRING" &&
              /\b(?:hire|hiring|client|commercial)\b/i.test(paymentQuote);
      if (supportedPayment) {
        next.budget_signal = { ...extracted.budget_signal };
        next.all_reasons = next.all_reasons.filter((reason) => reason !== "PAYMENT_UNCLEAR");
        next.missing_fields = next.missing_fields.filter((field) => field !== "payment_signal");
        used = true;
      }
    }
    const skillQuotes = quotes.filter((item) => item.field === "skill");
    for (const skill of extracted.required_skills) {
      const normalizedSkill = skill.toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (
        normalizedSkill &&
        skillQuotes.some((item) =>
          item.quote.toLowerCase().replace(/[^a-z0-9]+/g, "").includes(normalizedSkill),
        ) &&
        !next.required_skills.some((existing) => existing.toLowerCase() === skill.toLowerCase())
      ) {
        next.required_skills.push(skill);
        used = true;
      }
    }
    if (next.required_skills.length > 0) {
      next.all_reasons = next.all_reasons.filter((reason) => reason !== "SCOPE_MISSING");
      next.missing_fields = next.missing_fields.filter((field) => field !== "scope");
    }
  }

  if (next.timeline_signal === null && extracted.timeline_signal && hasQuote("timeline")) {
    next.timeline_signal = extracted.timeline_signal;
    used = true;
  }
  if (next.seniority === "UNKNOWN" && extracted.seniority !== "UNKNOWN" && hasQuote("seniority")) {
    next.seniority = extracted.seniority;
    used = true;
  }
  if (
    next.location_or_remote_policy === null &&
    extracted.location_or_remote_policy &&
    hasQuote("location")
  ) {
    next.location_or_remote_policy = extracted.location_or_remote_policy;
    used = true;
  }
  if (
    next.contact_method.type === "UNKNOWN" &&
    extracted.contact_method.type !== "UNKNOWN" &&
    extracted.contact_method.value &&
    hasQuote("contact") &&
    quoteFor("contact").toLowerCase().includes(extracted.contact_method.value.toLowerCase())
  ) {
    next.contact_method = { ...extracted.contact_method };
    used = true;
  }

  for (const quote of quotes) {
    if (!next.evidence_quotes.some((item) => item.field === quote.field && item.quote === quote.quote)) {
      next.evidence_quotes.push(quote);
      used = true;
    }
  }

  return { evidence: next, used };
}

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
      discoverySignals?: DiscoverySignals;
      warning?: string;
      method?: "gemini" | "openai-compatible";
      discoveryProvider?: NonNullable<Lead["qualification_audit"]>["discovery_provider"];
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
      ...(isDiscoveryCandidate(input) && !assessment.qualification
        ? { qualification_status: "NEEDS_REQUALIFICATION" as const }
        : {}),
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

    if (isDiscoveryCandidate(lead)) {
      lead = this.routeNewDiscovery(lead);
    } else {
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
    }
    return { lead, duplicate: false };
  }

  private routeNewDiscovery(lead: Lead, actor = "system"): Lead {
    if (!canRouteDiscoveryLead(lead)) return this.move(lead, "REJECTED", actor);
    const qualified = this.move(lead, "QUALIFIED", actor);
    return this.move({ ...qualified, approval_status: "PENDING" }, "PENDING_APPROVAL", actor);
  }

  private classify(
    input: LeadInput,
  ): Assessment & Partial<Pick<Lead, "qualification" | "qualification_audit">> {
    if (input.discovery_context) {
      return this.classifyDiscovery(input);
    }
    if (input.source === "hn") {
      return this.unqualifiedDiscoveryAssessment();
    }
    let extraction: { signals?: Signals; warning?: string } = {};
    if (this.extractor && !injectionPattern.test(input.title + ' ' + input.raw_description)) {
      try { extraction = this.extractor(input); }
      catch { extraction = { warning: 'Classifier unavailable; deterministic fallback used' }; }
    }
    return assess(input, this.clock.now(), this.config, extraction.signals, extraction.warning);
  }

  private unqualifiedDiscoveryAssessment(): Assessment {
    return {
      score: 0,
      breakdown: {
        intent: 0,
        fit: 0,
        budget: 0,
        timeline: 0,
        credibility: 0,
        permission: 0,
      },
      reasoning: ["Original discovery evidence is unavailable; requalification is required"],
      confidence: 0,
      missing: ["original discovery evidence"],
      skills: [],
      summary: "",
      priority: "LOW",
      quarantined: false,
      method: "rules",
      extractionWarning: "NEEDS_REQUALIFICATION",
    };
  }

  private classifyDiscovery(input: LeadInput) {
    const context = input.discovery_context!;
    const now = this.clock.now();
    const canonical = canonicalEvidence(context);
    const policy = {
      ...defaultQualificationPolicy,
      max_age_days: this.config.maxAgeDays,
    };
    const prefilterResult = prefilterDiscovery(context, now, policy);

    let ruleEvidence = extractRuleEvidence(canonical, context);
    const initial = scoreFreelanceQualification(ruleEvidence, context, now, policy);
    const obviousExclusion = initial.record.evidence_quotes.some(item => item.field === "exclusion") &&
      ["FULL_TIME_ONLY", "INTERNSHIP", "SELLER_SELF_PROMOTION", "UNPAID_OR_EQUITY_ONLY"].includes(initial.record.rejection_reason ?? "");

    let extractorWarning = "";
    let extractionMethod: "gemini" | "openai-compatible" = "gemini";
    let discoveryProvider: NonNullable<Lead["qualification_audit"]>["discovery_provider"];
    if (prefilterResult.pass && !obviousExclusion && this.extractor && !injectionPattern.test(canonical)) {
      try {
        const extResult = this.extractor(input);
        if (extResult?.discoverySignals) {
          const merged = mergeDiscoverySignals(
            ruleEvidence,
            extResult.discoverySignals,
            canonical,
          );
          ruleEvidence = merged.evidence;
          extractionMethod = extResult.method ?? "gemini";
          discoveryProvider = extResult.discoveryProvider;
        }
        if (extResult?.warning) extractorWarning = extResult.warning;
      } catch {
        extractorWarning = "Classifier unavailable; no AI verdict";
      }
    }

    const { record, audit } = obviousExclusion ? initial : scoreFreelanceQualification(
      ruleEvidence,
      context,
      now,
      policy,
    );
    const modelVerdict = audit.discovery_semantics?.decision;
    const guarded = !prefilterResult.pass || injectionPattern.test(canonical);
    const proposed = !guarded && (modelVerdict ? modelVerdict === "ACCEPT" : record.eligibility_state === "ELIGIBLE");
    audit.advisory_state = record.eligibility_state;
    audit.decision_source = guarded ? "SOURCE_GUARD" : modelVerdict ? "MODEL" : "RULES_FALLBACK";
    audit.operational_state=discoveryState({provider:context.provider,decision:proposed?"ACCEPTED":"REJECTED",
      reason:record.rejection_reason,source:audit.decision_source,boundary:audit.project_boundary,
      incomplete:context.truncated||!context.complete,
      warning:extractorWarning||(!modelVerdict?"No validated AI verdict":"")});
    const accepted = proposed && audit.operational_state === "QUALIFIED";
    if (modelVerdict && !guarded) {
      audit.method = extractionMethod;
      if (discoveryProvider) audit.discovery_provider = discoveryProvider;
    }
    record.operator_decision = accepted ? "ACCEPTED" : "REJECTED";
    record.eligibility_state = accepted ? "ELIGIBLE" : "REJECTED";
    record.is_valid_freelance_lead = accepted;
    if (accepted) {
      record.rejection_reason = null;
      if (record.priority === "REJECTED") record.priority = "LOW";
    } else {
      record.rejection_reason ??= "INSUFFICIENT_CONTEXT";
      record.priority = "REJECTED";
      record.quality_score = 0;
    }
    if (extractorWarning) {
      audit.warnings.push(extractorWarning.slice(0, 240));
    } else if (!prefilterResult.pass && prefilterResult.reason) {
      audit.warnings.push(`Prefilter: ${prefilterResult.reason}`);
    } else if (!guarded && !modelVerdict) {
      audit.warnings.push("No validated AI verdict. Qualification rules finalized this decision.");
    }

    let legacyPriority: "HIGH" | "REVIEW" | "LOW" = "LOW";
    if (record.priority === "HIGH") legacyPriority = "HIGH";
    else if (record.priority === "MEDIUM") legacyPriority = "REVIEW";
    else legacyPriority = "LOW";

    return {
      score: record.quality_score,
      breakdown: {
        intent: audit.breakdown.buyer_demand ?? 0,
        fit: audit.breakdown.service_fit ?? 0,
        budget: audit.breakdown.paid_intent ?? 0,
        timeline: audit.breakdown.timeline ?? 0,
        credibility: audit.breakdown.engagement ?? 0,
        permission: audit.breakdown.contact_path ?? 0,
      },
      reasoning: audit.reasons,
      confidence: record.confidence_score,
      missing: audit.missing_fields,
      skills: record.required_skills,
      summary:
        [record.lead_type, record.engagement_type, record.budget_signal.kind]
          .filter(Boolean)
          .join(" • ") || input.title,
      priority: legacyPriority,
      quarantined: audit.advisory_state === "QUARANTINED",
      method: audit.method,
      extractionWarning: audit.warnings.join("; "),
      qualification: record,
      qualification_audit: audit,
    };
  }

  requalifyMissingDiscovery(id: string, raw: unknown): Lead {
    return this.requalifyDiscovery(id, raw, false);
  }

  requalifyDiscovery(id: string, raw: unknown, overwrite = false): Lead {
    const old = this.store.get(id);
    const input = inputSchema.strip().parse(raw);
    if (
      !old ||
      !isDiscoveryCandidate(old) ||
      (!overwrite &&
        old.qualification &&
        old.qualification_status !== "NEEDS_REQUALIFICATION") ||
      !input.discovery_context
    ) {
      throw new Error(
        "Only discovery records with source context can be requalified",
      );
    }

    const assessment = this.classifyDiscovery(input);
    if (!assessment.qualification || !assessment.qualification_audit)
      throw new Error("Discovery qualification did not produce an audit record");
    if (assessment.qualification_audit.decision_source === "RULES_FALLBACK" && old.qualification_audit?.decision_source === "MODEL" &&
        old.discovery_context?.source_hash === input.discovery_context.source_hash) return old;

    const now = this.clock.now();
    let lead: Lead = {
      ...old,
      title: input.title,
      raw_description: input.raw_description,
      source_url: input.source_url,
      posted_at: input.posted_at,
      discovery_context: input.discovery_context,
      ...assessment,
      status: old.status,
      approval_status: old.approval_status,
      draft_id: old.draft_id,
      qualification_status: undefined,
      updated_at: now,
      last_activity_at: now,
    };
    const qualification = lead.qualification;
    if (!qualification) {
      throw new Error(`Requalification for ${id} did not produce a qualification`);
    }
    this.store.save(lead);
    this.log(lead, old.status, "REQUALIFIED", "system");

    const requests = this.store
      .requests()
      .filter((request) => request.lead_id === id);
    const hasOwnerDecision = Boolean(old.draft_id) || old.approval_status === "REJECTED" ||
      this.store.activities().some(event => event.lead_id === id && event.actor === "owner") || requests.some(
      (request) => request.state === "CONSUMED" || Boolean(request.decision),
    );
    if (!hasOwnerDecision) {
      const route = canRouteDiscoveryLead(lead);
      if (!route) {
        for (const request of requests) {
          if (["PREPARED", "SENDING", "SENT"].includes(request.state)) {
            request.state = "FAILED";
            this.store.request(request);
          }
        }
        if (["NEW", "QUALIFIED", "PENDING_APPROVAL"].includes(lead.status))
          lead = this.move({ ...lead, approval_status: "NONE" }, "REJECTED");
      } else if (lead.status === "REJECTED") {
        // Only a system rejection with no owner history can be reopened by a new verdict.
        this.log({ ...lead, status: "NEW" }, lead.status, "REOPENED_BY_CLASSIFIER", "system");
        lead = this.routeNewDiscovery({ ...lead, status: "NEW", approval_status: "NONE" });
      } else if (lead.status === "NEW") {
        lead = this.routeNewDiscovery(lead);
      } else if (lead.status === "QUALIFIED" && lead.approval_status === "NONE") {
        lead = this.move({ ...lead, approval_status: "PENDING" }, "PENDING_APPROVAL");
      }
    }
    return lead;
  }

  reprocess(id: string): Lead {
    const old = this.store.get(id);
    const discovery = old ? isDiscoveryCandidate(old) : false;
    const discoveryHistory =
      old &&
      (this.store.requests().some((r) => r.lead_id === id) ||
        this.store.drafts().some((d) => d.lead_id === id) ||
        this.store.activities().some(
          (event) => event.lead_id === id && event.actor === "owner",
        ));
    if (
      !old ||
      !["NEW", "ARCHIVED", "REJECTED"].includes(old.status) ||
      old.draft_id ||
      old.approval_status === "APPROVED" ||
      (discovery &&
        (!old.discovery_context ||
          old.approval_status !== "NONE" ||
          discoveryHistory))
    ) {
      throw new Error(
        "Only untouched, unapproved records with available evidence can be reprocessed",
      );
    }
    const input = inputSchema.strip().parse(old);
    const assessment = this.classify(input);
    let lead: Lead = {
      ...old,
      ...assessment,
      status: "NEW",
      approval_status: "NONE",
      qualification_status: undefined,
      updated_at: this.clock.now(),
      last_activity_at: this.clock.now(),
    };
    this.store.save(lead);
    this.log(lead, old.status, "REPROCESSED", "owner");

    if (discovery) {
      lead = this.routeNewDiscovery(lead, "owner");
    } else {
      if (lead.quarantined) lead = this.move(lead, "ARCHIVED", "owner");
      else if (
        lead.score >= this.config.reviewThreshold &&
        lead.breakdown.intent > 0 &&
        lead.breakdown.fit > 0
      ) {
        lead = this.move(lead, "QUALIFIED", "owner");
        lead = this.move(
          { ...lead, approval_status: "PENDING" },
          "PENDING_APPROVAL",
          "owner",
        );
      }
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

    if (!canRouteDiscoveryLead(lead)) throw new Error("Discovery lead requires an ACCEPT verdict");
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
    if (!canRouteDiscoveryLead(lead)) throw new Error("Discovery lead requires an ACCEPT verdict");
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
      if (isDiscoveryCandidate(lead)) {
        if (!lead.qualification) {
          if (lead.qualification_status !== "NEEDS_REQUALIFICATION") {
            lead.qualification_status = "NEEDS_REQUALIFICATION";
            this.store.save(lead);
          }
          if (lead.status === "NEW") {
            this.routeNewDiscovery(lead);
            continue;
          }
          const requests = this.store.requests().filter((r) => r.lead_id === lead.lead_id);
          const hasOwnerDecision = requests.some(
            (request) => request.state === "CONSUMED" || Boolean(request.decision),
          );
          if (
            lead.status === "PENDING_APPROVAL" &&
            !lead.draft_id &&
            lead.approval_status === "PENDING" &&
            !hasOwnerDecision
          ) {
            for (const request of requests) {
              if (["PREPARED", "SENDING", "SENT"].includes(request.state)) {
                request.state = "FAILED";
                this.store.request(request);
              }
            }
            this.move({ ...lead, approval_status: "NONE" }, "REJECTED", "system");
          }
        } else {
          if (lead.status === "NEW") {
            this.routeNewDiscovery(lead);
          } else if (lead.status === "QUALIFIED" && canRouteDiscoveryLead(lead)) {
            this.move({ ...lead, approval_status: "PENDING" }, "PENDING_APPROVAL");
          } else if (lead.status === "PENDING_APPROVAL") {
            if (!canRouteDiscoveryLead(lead)) {
              if (!lead.draft_id && lead.approval_status === "PENDING") {
                const requests = this.store.requests().filter((r) => r.lead_id === lead.lead_id);
                const hasOwnerDecision = requests.some(
                  (request) => request.state === "CONSUMED" || Boolean(request.decision),
                );
                if (!hasOwnerDecision) {
                  for (const request of requests) {
                    if (["PREPARED", "SENDING", "SENT"].includes(request.state)) {
                      request.state = "FAILED";
                      this.store.request(request);
                    }
                  }
                  this.move({ ...lead, approval_status: "NONE" }, "REJECTED", "system");
                }
              }
            }
          }
        }
      } else {
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
    }
    for (const request of this.store
      .requests()
      .filter((r) => r.state === "CONSUMED")) {
      const lead = this.store.get(request.lead_id);
      if (
        lead &&
        !(isDiscoveryCandidate(lead) && !lead.qualification) &&
        ["PENDING_APPROVAL", "APPROVED_FOR_DRAFT"].includes(lead.status)
      )
        this.applyDecision(request);
    }
  }
}
export function proposal(lead: Lead, now: string): Draft {
  if (lead.approval_status !== "APPROVED")
    throw new Error("Draft requires approval");
  if (isDiscoveryCandidate(lead)) {
    if (
      !lead.qualification ||
      !lead.qualification.is_valid_freelance_lead ||
      lead.qualification.eligibility_state !== "ELIGIBLE" ||
      !canRouteDiscoveryLead(lead)
    ) {
      throw new Error("Draft requires an eligible freelance lead");
    }
  }
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
  if (isDiscoveryCandidate(lead)) {
    if (!lead.qualification || !canRouteDiscoveryLead(lead)) {
      throw new Error("Discovery lead requires an ACCEPT verdict");
    }

    return {
      text: `LeadFlow • freelance opportunity\n${lead.title}\nScore ${lead.qualification.quality_score}/100 • ${lead.qualification.priority}\nBudget: ${lead.qualification.budget_signal.minimum ?? lead.qualification.budget_signal.maximum ?? "not stated"} ${lead.qualification.budget_signal.currency}\nLead Type: ${lead.qualification.lead_type} • ${lead.qualification.engagement_type}\n${lead.reasoning.slice(0, 2).join("\n")}\nPermission: ${lead.qualification.contact_method.permission_state}\n${lead.source_url}\nApproval creates a draft only.`,
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
  if (cmd === "/stats") {
    const discovery = leads.filter(isDiscoveryCandidate);
    const acceptedDiscovery = discovery.filter(canRouteDiscoveryLead).length;
    const rejectedDiscovery = discovery.length - acceptedDiscovery;
    const guardedDiscovery = discovery.filter(lead => lead.qualification_audit?.decision_source === "SOURCE_GUARD").length;
    const rulesDiscovery = discovery.filter(lead => lead.qualification_audit?.decision_source === "RULES_FALLBACK").length;

    return (
      `Actual CRM counts\nTotal: ${leads.length}\n` +
      (discovery.length > 0
        ? `Discovery candidates: ${discovery.length} (Accepted: ${acceptedDiscovery}, Rejected: ${rejectedDiscovery}, Rules fallback: ${rulesDiscovery}, Blocked by source check: ${guardedDiscovery})\n`
        : "") +
      `Qualified ever: ${reached("QUALIFIED", ["QUALIFIED", "PENDING_APPROVAL", "APPROVED_FOR_DRAFT", "DRAFT_READY", "CONTACTED_MANUALLY", "REPLIED", "DISCOVERY", "QUOTED", "WON", "MAINTENANCE"])}\n` +
      `Approved ever: ${reached("APPROVED_FOR_DRAFT", ["APPROVED_FOR_DRAFT", "DRAFT_READY", "CONTACTED_MANUALLY", "REPLIED", "DISCOVERY", "QUOTED", "WON", "MAINTENANCE"])}\n` +
      `Pending: ${leads.filter((l) => l.status === "PENDING_APPROVAL" || (l.source === "inbound" && l.status === "DRAFT_READY" && l.approval_status === "PENDING")).length}\n` +
      `Drafts ready: ${leads.filter((l) => l.status === "DRAFT_READY").length}\n` +
      `Enquiry emails sent: ${leads.filter((l) => l.status === "EMAIL_SENT").length}\n` +
      `Manually submitted: ${reached("CONTACTED_MANUALLY", ["CONTACTED_MANUALLY", "REPLIED", "DISCOVERY", "QUOTED", "WON", "LOST", "MAINTENANCE"])}\n` +
      `Replies: ${reached("REPLIED", ["REPLIED", "DISCOVERY", "QUOTED", "WON", "MAINTENANCE"])}\n` +
      `Discovery calls: ${reached("DISCOVERY", ["DISCOVERY", "QUOTED", "WON", "MAINTENANCE"])}\n` +
      `Won: ${reached("WON", ["WON", "MAINTENANCE"])}`
    );
  }
  if (["/leads", "/pending", "/followups"].includes(cmd)) {
    const filtered = leads.filter((l) => {
      // Exclude non-eligible discovery records from being presented as leads
      if (isDiscoveryCandidate(l) && !canRouteDiscoveryLead(l)) {
        return false;
      }
      return cmd === "/pending"
        ? l.status === "PENDING_APPROVAL" || (l.status === 'DRAFT_READY' && l.approval_status === 'PENDING')
        : cmd === "/followups"
          ? Boolean(l.next_followup_at && l.next_followup_at <= now)
          : !["NEW", "ARCHIVED", "REJECTED"].includes(l.status);
    });
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
