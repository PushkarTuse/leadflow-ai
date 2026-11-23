import { z } from "zod";

/**
 * Shared qualification schemas, versioning and cross-field validation.
 * Discovery scoring and routing are orchestrated by the core workflow.
 */

export const QUALIFICATION_SCHEMA_VERSION = "freelance.v2";
export const QUALIFICATION_RULES_VERSION = "rules.v5";
export const QUALIFICATION_PROMPT_VERSION = "prompt.v3";
export const CAPABILITY_LIST_VERSION = "capabilities.v1";
export const QUALIFICATION_POLICY_VERSION = "policy.v4";

export const qualificationVersions = {
  schema_version: QUALIFICATION_SCHEMA_VERSION,
  rules_version: QUALIFICATION_RULES_VERSION,
  prompt_version: QUALIFICATION_PROMPT_VERSION,
  capability_list_version: CAPABILITY_LIST_VERSION,
  policy_version: QUALIFICATION_POLICY_VERSION,
} as const;

export const qualificationVersionSchema = z
  .object({
    schema_version: z.string().min(1).max(40),
    rules_version: z.string().min(1).max(40),
    prompt_version: z.string().min(1).max(40),
    capability_list_version: z.string().min(1).max(40),
    policy_version: z.string().min(1).max(40),
  })
  .strict();

const httpsUrl = z
  .string()
  .max(2000)
  .refine(
    (value) => /^https:\/\/[^\s/@]+(?:[/:?#][^\s@]*)?$/i.test(value),
    "Use a credential-free HTTPS URL",
  );

const safeHttpUrl = z
  .string()
  .max(2000)
  .refine(
    (value) => /^https?:\/\/[^\s/@]+(?:[/:?#][^\s@]*)?$/i.test(value),
    "Use a credential-free HTTP(S) URL",
  );

/* ------------------------------------------------------------------ */
/* 1. Discovery context (preserved source evidence)                    */
/* ------------------------------------------------------------------ */

export const itemTypes = [
  "comment",
  "story",
  "job",
  "post",
  "listing",
  "record",
  "unknown",
] as const;

export const providerVerifiedEngagementSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("employmentType"), value: z.literal("Contractor") }).strict(),
  z.object({ field: z.literal("job_type"), value: z.enum(["contract", "freelance"]) }).strict(),
]);

export function matchProviderEngagement(
  provider: string,
  signal?: z.infer<typeof providerVerifiedEngagementSchema> | null,
) {
  if (provider === "himalayas" && signal?.field === "employmentType") return signal;
  if (provider === "jobicy_rss" && signal?.field === "job_type") return signal;
  return undefined;
}

export const discoveryContextSchema = z
  .object({
    provider: z.string().min(1).max(60),
    provider_record_id: z.string().min(1).max(160),
    original_url: httpsUrl,
    item_type: z.enum(itemTypes),
    author_handle: z.string().max(120).default(""),
    parent_id: z.string().max(160).default(""),
    thread_id: z.string().max(160).default(""),
    thread_title: z.string().max(300).default(""),
    thread_date: z.string().datetime().nullable().default(null),
    original_title: z.string().max(300).default(""),
    raw_text: z.string().max(20000).default(""),
    decoded_text: z.string().max(12000).default(""),
    published_at: z.string().datetime().nullable().default(null),
    expires_at: z.string().datetime().optional(),
    source_updated_at: z.string().datetime().optional(),
    application_url: httpsUrl.optional(),
    provider_verified_engagement: providerVerifiedEngagementSchema.nullish(),
    collected_at: z.string().datetime(),
    fetched_at: z.string().datetime(),
    tags: z.array(z.string().min(1).max(60)).max(20).default([]),
    location: z.string().max(240).default(""),
    contact_link_targets: z.array(safeHttpUrl).max(10).default([]),
    deleted: z.boolean().default(false),
    dead: z.boolean().default(false),
    source_hash: z.string().min(8).max(64),
    truncated: z.boolean().default(false),
    complete: z.boolean().default(true),
  })
  .strict();

export type DiscoveryContext = z.infer<typeof discoveryContextSchema>;

/* ------------------------------------------------------------------ */
/* 2. Shared enums                                                     */
/* ------------------------------------------------------------------ */

export const extractionIntents = [
  "BUYER",
  "SELLER",
  "EMPLOYMENT",
  "PROMOTION",
  "MIXED",
  "UNKNOWN",
] as const;

export const leadTypes = [
  "CLIENT_PROJECT",
  "CONTRACT_ROLE",
  "RETAINER",
  "CONSULTING",
  "SELLER_PROMOTION",
  "EMPLOYMENT",
  "INTERNSHIP",
  "UNPAID",
  "AGGREGATOR",
  "PROMOTION",
  "UNKNOWN",
] as const;

export const requesterTypes = [
  "FOUNDER",
  "COMPANY",
  "AGENCY_BUYER",
  "INDIVIDUAL_CLIENT",
  "AUTHORIZED_RECRUITER",
  "FREELANCER_SELLER",
  "EMPLOYER",
  "UNKNOWN",
] as const;

export const engagementTypes = [
  "FIXED_PROJECT",
  "INDEPENDENT_CONTRACT",
  "RETAINER",
  "FRACTIONAL",
  "CONSULTING",
  "EMPLOYEE_FULL_TIME",
  "EMPLOYEE_FIXED_TERM",
  "INTERNSHIP",
  "UNPAID",
  "UNKNOWN",
] as const;

export const budgetKinds = [
  "AMOUNT_STATED",
  "EXPLICIT_PAID",
  "COMMERCIAL_HIRING",
  "BOARD_PAID_INTENT_INFERRED",
  "UNPAID_OR_EQUITY_ONLY",
  "UNKNOWN",
] as const;

export const budgetCurrencies = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "OTHER",
  "UNKNOWN",
] as const;

export const budgetUnits = [
  "PROJECT",
  "HOUR",
  "DAY",
  "WEEK",
  "MONTH",
  "OTHER",
  "UNKNOWN",
] as const;

export const seniorities = [
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
  "ANY",
  "UNKNOWN",
] as const;

export const contactTypes = [
  "EMAIL",
  "APPLICATION_URL",
  "FORM_URL",
  "PLATFORM_DM",
  "REPLY_INSTRUCTIONS",
  "UNKNOWN",
] as const;

export const permissionStates = [
  "UNKNOWN",
  "PLATFORM_ONLY",
  "EXPLICIT_OPT_IN",
  "BLOCKED",
] as const;

export const rejectionReasons = [
  "SOURCE_NOT_ALLOWED",
  "SOURCE_UNAVAILABLE",
  "UNSAFE_CONTENT",
  "STALE_OR_CLOSED",
  "SELLER_SELF_PROMOTION",
  "FULL_TIME_ONLY",
  "EMPLOYMENT_CONTRACT_ONLY",
  "INTERNSHIP",
  "UNPAID_OR_EQUITY_ONLY",
  "AGGREGATOR_ONLY",
  "NO_CLIENT_NEED",
  "AMBIGUOUS_DIRECTION",
  "ENGAGEMENT_UNCLEAR",
  "PAYMENT_UNCLEAR",
  "SCOPE_MISSING",
  "INSUFFICIENT_CONTEXT",
  "OUT_OF_SERVICE_SCOPE",
  "LOCATION_INCOMPATIBLE",
] as const;

export const evidenceFields = [
  "intent",
  "requester",
  "engagement",
  "payment",
  "scope",
  "skill",
  "timeline",
  "seniority",
  "location",
  "contact",
  "exclusion",
] as const;

export const priorities = ["HIGH", "MEDIUM", "LOW", "REJECTED"] as const;

export const eligibilityStates = [
  "ELIGIBLE",
  "REVIEW_INCOMPLETE",
  "REJECTED",
  "QUARANTINED",
] as const;

export type EvidenceField = (typeof evidenceFields)[number];
export type RejectionReason = (typeof rejectionReasons)[number];
export type Priority = (typeof priorities)[number];
export type EligibilityState = (typeof eligibilityStates)[number];

/* ------------------------------------------------------------------ */
/* 3. Shared sub-objects                                               */
/* ------------------------------------------------------------------ */

export const budgetSignalSchema = z
  .object({
    kind: z.enum(budgetKinds),
    minimum: z.number().finite().min(0).max(1_000_000_000).nullable(),
    maximum: z.number().finite().min(0).max(1_000_000_000).nullable(),
    currency: z.enum(budgetCurrencies),
    unit: z.enum(budgetUnits),
  })
  .strict();

export type BudgetSignal = z.infer<typeof budgetSignalSchema>;

const uniqueSkills = z
  .array(z.string().min(1).max(60))
  .max(12)
  .refine(
    (values) => new Set(values).size === values.length,
    "Required skills must be unique",
  );

/* ------------------------------------------------------------------ */
/* 4. Gemini extraction schema (semantic fields only)                  */
/* ------------------------------------------------------------------ */

export const extractionContactMethodSchema = z
  .object({
    type: z.enum(contactTypes),
    value: z.string().max(2000).nullable(),
  })
  .strict();

export const extractionEvidenceSchema = z
  .object({
    field: z.enum(evidenceFields),
    quote: z.string().min(1).max(320),
  })
  .strict();

export type ExtractionEvidence = z.infer<typeof extractionEvidenceSchema>;

export const semanticLeadKinds = ["FREELANCE_PROJECT", "LONG_TERM_CONTRACT_SEAT", "FULL_TIME_JOB", "SELLER_PROMO", "UNKNOWN"] as const;
export const semanticDirections = ["BUYER", "SELLER", "UNKNOWN"] as const;
export const semanticBoundaries = ["FIXED_SCOPE_PROJECT", "ONGOING_SEAT", "EMPLOYMENT", "UNKNOWN"] as const;
export const semanticTerms = ["SHORT", "MEDIUM", "LONG", "UNKNOWN"] as const;
const semanticQuote = z.string().min(1).max(320).nullable();
export const discoverySemanticsSchema = z.object({
  decision: z.enum(["ACCEPT", "REJECT"]),
  decision_reason: z.string().trim().min(1).max(240),
  lead_kind: z.enum(semanticLeadKinds),
  buyer_or_seller: z.enum(semanticDirections),
  engagement_boundary: z.enum(semanticBoundaries),
  term_hint: z.enum(semanticTerms),
  engagement_evidence: semanticQuote,
  paid_evidence: semanticQuote,
  scope_evidence: semanticQuote,
}).strict();
export type DiscoverySemantics = z.infer<typeof discoverySemanticsSchema>;

export const extractionSchema = z
  .object({
    ...discoverySemanticsSchema.shape,
    intent: z.enum(extractionIntents),
    lead_type: z.enum(leadTypes),
    requester_type: z.enum(requesterTypes),
    engagement_type: z.enum(engagementTypes),
    budget_signal: budgetSignalSchema,
    timeline_signal: z.string().max(240).nullable(),
    required_skills: uniqueSkills,
    seniority: z.enum(seniorities),
    location_or_remote_policy: z.string().max(240).nullable(),
    contact_method: extractionContactMethodSchema,
    rejection_reason: z.enum(rejectionReasons).nullable(),
    evidence_quotes: z.array(extractionEvidenceSchema).max(16),
  })
  .strict()
  .refine(value => value.decision === "REJECT" ||
    Boolean(value.engagement_evidence?.trim() && value.scope_evidence?.trim()),
    "An ACCEPT verdict requires source quotes for the engagement and scope");

export type Extraction = z.infer<typeof extractionSchema>;

/* ------------------------------------------------------------------ */
/* 5. Final qualification schema (Section 5 of the specification)      */
/* ------------------------------------------------------------------ */

export const contactMethodSchema = z
  .object({
    type: z.enum(contactTypes),
    value: z.string().max(2000).nullable(),
    permission_state: z.enum(permissionStates),
  })
  .strict();

export const evidenceQuoteSchema = z
  .object({
    field: z.enum(evidenceFields),
    quote: z.string().min(1).max(320),
    start: z.number().int().min(0),
    end: z.number().int().min(1),
  })
  .strict();

export type EvidenceQuote = z.infer<typeof evidenceQuoteSchema>;

const providerSignalSchema = z.object({
  provider: z.enum(["himalayas", "jobicy_rss", "remotive"]),
  engagement: providerVerifiedEngagementSchema.optional(),
  application: z.object({
    field: z.enum(["application_url", "contact_link_targets", "original_url"]),
    value: httpsUrl,
  }).strict().optional(),
  used_for: z.array(z.enum(["intent", "engagement", "contact"])).min(1).max(3)
    .refine(fields => new Set(fields).size === fields.length),
}).strict().refine(signal =>
  Boolean(signal.application) === signal.used_for.includes("contact") &&
  Boolean(signal.engagement) === signal.used_for.some(field => field !== "contact") &&
  (!signal.engagement || Boolean(matchProviderEngagement(signal.provider, signal.engagement)))
);

const qualificationObject = z
  .object({
    is_valid_freelance_lead: z.boolean(),
    lead_type: z.enum(leadTypes),
    requester_type: z.enum(requesterTypes),
    engagement_type: z.enum(engagementTypes),
    budget_signal: budgetSignalSchema,
    timeline_signal: z.string().max(240).nullable(),
    required_skills: uniqueSkills,
    seniority: z.enum(seniorities),
    location_or_remote_policy: z.string().max(240).nullable(),
    contact_method: contactMethodSchema,
    confidence_score: z.number().min(0).max(1),
    rejection_reason: z.enum(rejectionReasons).nullable(),
    evidence_quotes: z.array(evidenceQuoteSchema).max(16),
    provider_signal: providerSignalSchema.optional(),
    quality_score: z.number().int().min(0).max(100),
    priority: z.enum(priorities),
    eligibility_state: z.enum(eligibilityStates),
    operator_decision: z.enum(["ACCEPTED", "REJECTED"]).optional(),
  })
  .strict();

export type QualificationRecord = z.infer<typeof qualificationObject>;

/* ------------------------------------------------------------------ */
/* 6. Cross-field invariants                                           */
/* ------------------------------------------------------------------ */

const PAID_BUDGET_KINDS = new Set<string>([
  "AMOUNT_STATED",
  "EXPLICIT_PAID",
  "COMMERCIAL_HIRING",
  "BOARD_PAID_INTENT_INFERRED",
]);

const ELIGIBLE_LEAD_TYPES = new Set<string>([
  "CLIENT_PROJECT",
  "CONTRACT_ROLE",
  "RETAINER",
  "CONSULTING",
]);

const ELIGIBLE_REQUESTERS = new Set<string>([
  "FOUNDER",
  "COMPANY",
  "AGENCY_BUYER",
  "INDIVIDUAL_CLIENT",
  "AUTHORIZED_RECRUITER",
]);

const ELIGIBLE_ENGAGEMENTS = new Set<string>([
  "FIXED_PROJECT",
  "INDEPENDENT_CONTRACT",
  "RETAINER",
  "FRACTIONAL",
  "CONSULTING",
]);

/**
 * Reasons that are established from context rather than from a quotable
 * exclusion clause, so they do not require `exclusion` evidence.
 */
const CONTEXT_ONLY_REASONS = new Set<string>([
  "AMBIGUOUS_DIRECTION",
  "ENGAGEMENT_UNCLEAR",
  "PAYMENT_UNCLEAR",
  "SCOPE_MISSING",
  "INSUFFICIENT_CONTEXT",
  "SOURCE_NOT_ALLOWED",
  "SOURCE_UNAVAILABLE",
  "STALE_OR_CLOSED",
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https:\/\/[^\s/@]+(?:[/:?#][^\s@]*)?$/i;

function priorityBand(score: number): Priority {
  if (score >= 85) return "HIGH";
  if (score >= 65) return "MEDIUM";
  if (score >= 50) return "LOW";
  return "REJECTED";
}

function refineQualification(
  record: QualificationRecord,
  ctx: z.RefinementCtx,
): void {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });

  const eligible = record.eligibility_state === "ELIGIBLE";
  if (record.operator_decision) {
    const accepted = record.operator_decision === "ACCEPTED";
    if (record.eligibility_state !== (accepted ? "ELIGIBLE" : "REJECTED") ||
        record.is_valid_freelance_lead !== accepted ||
        (record.rejection_reason === null) !== accepted)
      issue(["operator_decision"], "Binary decision, validity, and outcome must agree");
    for (const quote of record.evidence_quotes) {
      if (quote.end - quote.start !== quote.quote.length)
        issue(["evidence_quotes"], "Evidence offsets must span exactly the quote length");
    }
    return;
  }
  const fields = new Set(record.evidence_quotes.map((q) => q.field));
  const providerIntent = record.provider_signal?.used_for.includes("intent") ?? false;
  const providerEngagement = record.provider_signal?.used_for.includes("engagement") ?? false;
  const boardRequester = record.requester_type === "UNKNOWN" && (providerIntent ||
    (record.provider_signal?.used_for.includes("contact") && fields.has("intent")));
  if (providerEngagement && record.engagement_type !== "INDEPENDENT_CONTRACT")
    issue(["provider_signal"], "Publisher engagement evidence only supports an independent contract");

  /* --- validity / state / reason / score / priority coupling --- */
  if (record.is_valid_freelance_lead !== eligible)
    issue(
      ["is_valid_freelance_lead"],
      "is_valid_freelance_lead must be true exactly when eligibility_state is ELIGIBLE",
    );

  if (eligible) {
    if (record.rejection_reason !== null)
      issue(["rejection_reason"], "Eligible records must not carry a rejection reason");
    if (record.priority === "REJECTED")
      issue(["priority"], "Eligible records cannot have REJECTED priority");
    if (record.quality_score < 50)
      issue(["quality_score"], "Eligible records require a quality score of at least 50");
  } else {
    if (record.rejection_reason === null)
      issue(["rejection_reason"], "Non-eligible records require a rejection reason");
    if (record.quality_score !== 0)
      issue(["quality_score"], "Non-eligible records must have a quality score of 0");
    if (record.priority !== "REJECTED")
      issue(["priority"], "Non-eligible records must have REJECTED priority");
  }

  const band = priorityBand(record.quality_score);
  if (record.priority !== band)
    issue(
      ["priority"],
      `Priority ${record.priority} does not match the quality score band ${band}`,
    );

  if (record.eligibility_state === "QUARANTINED" && record.rejection_reason !== "UNSAFE_CONTENT")
    issue(["rejection_reason"], "Quarantined records must be rejected as UNSAFE_CONTENT");

  /* --- budget signal --- */
  const budget = record.budget_signal;
  if (budget.kind === "AMOUNT_STATED") {
    if (budget.minimum === null && budget.maximum === null)
      issue(
        ["budget_signal", "minimum"],
        "AMOUNT_STATED requires at least one stated amount",
      );
  } else if (budget.minimum !== null || budget.maximum !== null) {
    issue(
      ["budget_signal", "minimum"],
      "Only AMOUNT_STATED may carry numeric amounts",
    );
  }

  if (
    budget.minimum !== null &&
    budget.maximum !== null &&
    budget.minimum > budget.maximum
  )
    issue(["budget_signal", "maximum"], "Budget minimum exceeds maximum");

  if (eligible && budget.kind === "AMOUNT_STATED") {
    const amount = budget.maximum ?? budget.minimum ?? 0;
    if (amount <= 0)
      issue(
        ["budget_signal", "minimum"],
        "Eligible paid records require a positive stated amount",
      );
  }

  if (eligible && !PAID_BUDGET_KINDS.has(budget.kind))
    issue(["budget_signal", "kind"], "Eligible records require a paid budget signal");

  if (
    budget.kind === "UNPAID_OR_EQUITY_ONLY" &&
    record.rejection_reason !== "UNPAID_OR_EQUITY_ONLY"
  )
    issue(
      ["rejection_reason"],
      "Unpaid or equity-only budget signals must be rejected as UNPAID_OR_EQUITY_ONLY",
    );

  /* --- contact path --- */
  const contact = record.contact_method;
  const sourceApplication = record.provider_signal?.application;
  const hasProviderContact = sourceApplication && contact.type === "APPLICATION_URL" &&
    contact.value === sourceApplication.value;
  if (sourceApplication && !hasProviderContact)
    issue(["provider_signal", "application"], "Publisher application evidence must match the contact path");
  if (contact.type === "UNKNOWN") {
    if (contact.value !== null)
      issue(["contact_method", "value"], "Unknown contact type must have a null value");
  } else {
    if (contact.value === null || contact.value.trim() === "")
      issue(
        ["contact_method", "value"],
        "Known contact type requires a source-stated value",
      );
    else if (contact.type === "EMAIL" && !EMAIL_PATTERN.test(contact.value))
      issue(["contact_method", "value"], "Contact email is not a valid address");
    else if (
      (contact.type === "APPLICATION_URL" || contact.type === "FORM_URL") &&
      !URL_PATTERN.test(contact.value)
    )
      issue(
        ["contact_method", "value"],
        "Contact URL must be a credential-free HTTPS URL",
      );

    if (!fields.has("contact") && !hasProviderContact)
      issue(
        ["evidence_quotes"],
        "A known contact path requires contact evidence",
      );
  }

  if (contact.permission_state !== "UNKNOWN" && !fields.has("contact"))
    issue(
      ["contact_method", "permission_state"],
      "Contact permission cannot be elevated without source-stated contact evidence",
    );

  /* --- evidence integrity (context-free part) --- */
  for (const quote of record.evidence_quotes) {
    if (quote.end <= quote.start)
      issue(["evidence_quotes"], "Evidence end must be greater than start");
    if (quote.end - quote.start !== quote.quote.length)
      issue(
        ["evidence_quotes"],
        "Evidence offsets must span exactly the quote length",
      );
  }

  if (eligible) {
    for (const required of ["intent", "requester", "engagement", "payment", "scope"] as const) {
      if (required === "payment" && budget.kind === "BOARD_PAID_INTENT_INFERRED") continue;
      const supportedByProvider = (required === "intent" && providerIntent) ||
        (required === "requester" && boardRequester) || (required === "engagement" && providerEngagement);
      if (!fields.has(required) && !supportedByProvider)
        issue(["evidence_quotes"], `Eligible records require ${required} evidence`);
    }
    if (record.required_skills.length > 0 && !fields.has("skill"))
      issue(["evidence_quotes"], "Stated skills require skill evidence");
  }

  if (budget.kind === "COMMERCIAL_HIRING" && !fields.has("payment"))
    issue(
      ["evidence_quotes"],
      "COMMERCIAL_HIRING requires the exact buyer hiring clause as payment evidence",
    );

  if (
    record.rejection_reason !== null &&
    !CONTEXT_ONLY_REASONS.has(record.rejection_reason) &&
    !fields.has("exclusion")
  )
    issue(["evidence_quotes"], "Confirmed exclusions require exclusion evidence");

  /* --- eligible classification gates --- */
  if (eligible) {
    if (!ELIGIBLE_LEAD_TYPES.has(record.lead_type))
      issue(["lead_type"], `Lead type ${record.lead_type} cannot be eligible`);
    if (!ELIGIBLE_REQUESTERS.has(record.requester_type) && !boardRequester)
      issue(["requester_type"], `Requester type ${record.requester_type} cannot be eligible`);
    if (!ELIGIBLE_ENGAGEMENTS.has(record.engagement_type))
      issue(
        ["engagement_type"],
        `Engagement type ${record.engagement_type} cannot be eligible`,
      );
  }
}

export const qualificationSchema = qualificationObject.superRefine(
  refineQualification,
);

/* ------------------------------------------------------------------ */
/* 7. Evidence location and validation                                 */
/* ------------------------------------------------------------------ */

/** Canonical evidence string: `title + "\n\n" + decoded_body`. */
export function canonicalEvidence(context: DiscoveryContext): string {
  return `${context.original_title}\n\n${context.decoded_text}`;
}

/**
 * Locate a quote inside the canonical evidence string. Repeated spans are
 * disambiguated with an internal occurrence index; offsets are always computed
 * by code, never invented by the model.
 */
export function locateEvidence(
  text: string,
  quote: string,
  occurrence = 0,
): { start: number; end: number } {
  if (!quote) throw new Error("Evidence quote must not be empty");
  let index = -1;
  for (let i = 0; i <= occurrence; i++) {
    index = text.indexOf(quote, index + 1);
    if (index < 0)
      throw new Error(
        `Evidence quote not found in source text: ${quote.slice(0, 60)}`,
      );
  }
  return { start: index, end: index + quote.length };
}

/**
 * Verify every evidence quote against the preserved source text using
 * JavaScript UTF-16 offsets. Throws on the first mismatch.
 */
export function validateQualificationEvidence(
  record: QualificationRecord,
  context: DiscoveryContext,
): void {
  if (record.budget_signal?.kind === "BOARD_PAID_INTENT_INFERRED" &&
      (context.item_type !== "listing" || !isFormalJobBoard(context.provider)))
    throw new Error("Inferred board payment requires a supported listing");
  const signal = record.provider_signal;
  if (signal) {
    if (context.item_type !== "listing" || signal.provider !== context.provider)
      throw new Error("Publisher evidence does not match discovery context");
    if (signal.engagement) {
      const preserved = matchProviderEngagement(context.provider, context.provider_verified_engagement);
      if (preserved?.field !== signal.engagement.field || preserved.value !== signal.engagement.value)
        throw new Error("Publisher engagement evidence does not match discovery context");
    }
    if (signal.application) {
      const application = boardApplication(context);
      if (application?.value !== signal.application.value || application.field !== signal.application.field ||
          record.contact_method.type !== "APPLICATION_URL" || record.contact_method.value !== signal.application.value)
        throw new Error("Publisher application evidence does not match discovery context");
    }
  }
  const text = canonicalEvidence(context);
  for (const quote of record.evidence_quotes) {
    if (quote.end > text.length)
      throw new Error(
        `Evidence offsets exceed source text length for field ${quote.field}`,
      );
    if (text.slice(quote.start, quote.end) !== quote.quote)
      throw new Error(
        `Evidence quote does not match source text at ${quote.start}-${quote.end} for field ${quote.field}`,
      );
  }
}

/* ------------------------------------------------------------------ */
/* 8. Versioned policy and audit envelope                              */
/* ------------------------------------------------------------------ */

export const qualificationPolicySchema = z
  .object({
    policy_version: z.string().min(1).max(40),
    schema_version: z.string().min(1).max(40),
    rules_version: z.string().min(1).max(40),
    prompt_version: z.string().min(1).max(40),
    capability_list_version: z.string().min(1).max(40),
    high_threshold: z.number().int().min(0).max(100),
    medium_threshold: z.number().int().min(0).max(100),
    low_threshold: z.number().int().min(0).max(100),
    max_age_days: z.number().int().min(1).max(365),
    max_input_tokens: z.number().int().min(1).max(100_000),
    max_output_tokens: z.number().int().min(1).max(100_000),
  })
  .strict()
  .refine(
    (policy) =>
      policy.low_threshold < policy.medium_threshold &&
      policy.medium_threshold < policy.high_threshold,
    "Discovery thresholds must increase from low to medium to high",
  );

export type QualificationPolicy = z.infer<typeof qualificationPolicySchema>;

export const defaultQualificationPolicy: QualificationPolicy = {
  policy_version: QUALIFICATION_POLICY_VERSION,
  schema_version: QUALIFICATION_SCHEMA_VERSION,
  rules_version: QUALIFICATION_RULES_VERSION,
  prompt_version: QUALIFICATION_PROMPT_VERSION,
  capability_list_version: CAPABILITY_LIST_VERSION,
  high_threshold: 85,
  medium_threshold: 65,
  low_threshold: 50,
  max_age_days: 30,
  max_input_tokens: 2500,
  max_output_tokens: 800,
};

export const qualificationAuditSchema = z
  .object({
    schema_version: z.string().min(1).max(40),
    rules_version: z.string().min(1).max(40),
    prompt_version: z.string().min(1).max(40),
    capability_list_version: z.string().min(1).max(40),
    policy_version: z.string().min(1).max(40),
    source_hash: z.string().min(8).max(64),
    classified_at: z.string().datetime(),
    method: z.enum(["rules", "gemini", "openai-compatible"]),
    discovery_provider: z.enum(["gemini", "groq", "cloudflare", "openrouter", "openai"]).optional(),
    reasons: z.array(z.enum(rejectionReasons)).max(20),
    missing_fields: z.array(z.string().min(1).max(60)).max(20),
    breakdown: z.record(z.string().min(1).max(40), z.number().int().min(0).max(100)),
    warnings: z.array(z.string().min(1).max(240)).max(20),
    provider_signal: providerSignalSchema.optional(),
    freshness_basis: z.literal("HIMALAYAS_LAST_UPDATE").optional(),
    // Older records predate the model's explicit decision fields.
    discovery_semantics: discoverySemanticsSchema.partial({decision:true,decision_reason:true}).optional(),
    decision_source: z.enum(["MODEL", "RULES_FALLBACK", "NO_MODEL", "SOURCE_GUARD"]).optional(),
    advisory_state: z.enum(eligibilityStates).optional(),
    project_boundary: z.enum(["BOUNDED", "ONGOING_SEAT", "UNVERIFIED"]).optional(),
  })
  .strict();

export type QualificationAudit = z.infer<typeof qualificationAuditSchema>;

/* ------------------------------------------------------------------ */
/* 9. Stage C — Deterministic freelance qualification gates & scoring  */
/* ------------------------------------------------------------------ */

/**
 * Sources that supply original listing evidence for discovery classification.
 */
export const FREELANCE_BUYER_SOURCES = [
  "hackernews", "wordpress_jobs_rss", "freelancer_rss", "himalayas", "jobicy_rss", "remotive",
] as const;
const ALLOWED_SOURCES = new Set<string>(FREELANCE_BUYER_SOURCES);

/**
 * Service capabilities the agency can deliver. Used for scope dimension scoring.
 */
const SERVICE_CAPABILITIES = new Set([
  "react", "typescript", "javascript", "next.js", "node", "node.js",
  "api", "rest", "graphql", "website", "web", "frontend", "front-end",
  "python", "automation", "google sheets", "crm", "ios", "swift",
  "java", "spring boot", "wordpress", "checkout", "stripe",
  "integration", "migration", "consulting", "architecture",
  "performance", "optimization",
]);

/* ---------- Pattern banks ----------------------------------------- */

const SELLER_PATTERNS = [
  /\bseeking\s+freelance\b(?!\s*(developer|contractor|engineer|designer|consultant|freelancer|help))/i,
  /\bseeking\s+(freelance\s+)?work\b/i,
  /\b(?:i\s+am|i'm)\s+available\b/i,
  /\bavailable\s+for\s+(projects?|contracts?|hire|work|freelance)\b/i,
  /\blooking\s+for\s+(?:a\s+)?(?:job|work|position|employment|opportunity|gig)\b/i,
  /\bseeking\s+(?:a\s+)?(?:job|position|employment|opportunity)\b/i,
  /\b(?:hire|contact)\s+me\b/i,
  /\bmy\s+(?:services|portfolio|resume|cv|rate\s+card)\b/i,
  /\b(?:i\s+am|i'm)\s+(?:a|an)\s+(?:freelance|independent)\s+(?:developer|designer|engineer|consultant)\b/i,
  /\bpart[- ]?time\s*\/\s*freelance\s*:\s*yes\b/i,
  /\bagency\s+available\b/i,
];

const BUYER_PATTERNS = [
  /\bseeking\s+(?:(?:a|an)\s+)?(?:(?:paid|independent|freelance|fractional)\s+)*(?:[a-z0-9_.-]+\s+)?(?:freelancer|contractor|subcontractor|developer|designer|engineer|consultant|cto|specialist|help|website|site|app|system|integration|workflow|project)\b/i,
  /\blooking\s+for\s+(?:(?:a|an)\s+)?(?:(?:paid|independent|freelance|fractional)\s+)*(?:[a-z0-9_.-]+\s+)?(?:freelancer|contractor|subcontractor|developer|designer|engineer|consultant|cto|specialist|help|website|site|app|system|integration|workflow|project)\b/i,
  /\b(?:we|our\s+(?:team|company|startup|agency|business))\s+(?:need(?:s)?|seek(?:s)?|(?:are|is)\s+(?:hiring|looking\s+for))\s+(?:(?:a|an)\s+)?(?:(?:paid|independent|freelance|fractional)\s+)*(?:[a-z0-9_.-]+\s+)?(?:freelancer|contractor|subcontractor|developer|designer|engineer|consultant|cto|specialist|help|website|site|app|system|integration|workflow|project)\b/i,
  /\bneed(?:s)?\s+(?:(?:a|an)\s+)?(?:(?:paid|independent|freelance|fractional)\s+)*(?:[a-z0-9_.-]+\s+)?(?:freelancer|contractor|subcontractor|developer|designer|engineer|consultant|cto|specialist|help|website|site|app|system|integration|workflow|project)\b/i,
  /\b(?:hiring|hire)\s+(?:(?:a|an)\s+)?(?:(?:paid|independent|freelance|fractional)\s+)*(?:[a-z0-9_.-]+\s+)?(?:freelancer|contractor|subcontractor|developer|designer|engineer|consultant|cto|specialist)\b/i,
  /\bseeks?\s+(?:(?:a|an)\s+)?(?:(?:paid|independent|freelance|fractional)\s+)*(?:[a-z0-9_.-]+\s+)?(?:freelancer|contractor|subcontractor|developer|designer|engineer|consultant|cto|specialist)\b/i,
  /\bseeking\s+freelancers?\b/i,
  /\b(?:an?\s+)?(?:independent|freelance)\s+(?:paid\s+)?(?:[a-z0-9_.-]+\s+)?(?:contractor|developer|engineer|consultant)\s+can\s+(?:deliver|build|develop|implement|create)\b/i,
];

const EMPLOYMENT_PATTERNS = [
  /\bfull[- ]?time\b(?!.*\b(?:independent|freelance|contractor)\b)/i,
  /\bsalary\s+and\s+benefits\b/i,
  /\b(?:salary|benefits|visa|401k|health\s+insurance|stock\s+options|pto|perks)\b/i,
  /\bemployee\s+payroll\b/i,
  /\b(?:on\s+our|on\s+the)\s+(?:employee\s+)?payroll\b/i,
  /\bfull[- ]?time\s+employment\s+only\b/i,
];

const FORMAL_JOB_BOARD_HOSTS = { himalayas: "himalayas.app", jobicy_rss: "jobicy.com", remotive: "remotive.com" } as const;
type FormalJobBoard = keyof typeof FORMAL_JOB_BOARD_HOSTS;
function isFormalJobBoard(provider: string): provider is FormalJobBoard {
  return Object.prototype.hasOwnProperty.call(FORMAL_JOB_BOARD_HOSTS, provider);
}

function boardApplication(context: DiscoveryContext) {
  if (context.item_type !== "listing" || !isFormalJobBoard(context.provider)) return undefined;
  const host = FORMAL_JOB_BOARD_HOSTS[context.provider];
  const onBoard = (value: string) => {
    if (!httpsUrl.safeParse(value).success) return undefined;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && url.hostname === host && !url.port && !url.username && !url.password)
        return url;
    } catch { return undefined; }
  };
  const listing = onBoard(context.original_url);
  if (!listing) return undefined;
  if (context.application_url && onBoard(context.application_url))
    return { field: "application_url", value: context.application_url } as const;

  const path = listing.pathname.replace(/\/$/, "");
  const listingPath = context.provider === "himalayas" ? /^\/companies\/[^/]+\/jobs\/[^/]+$/ :
    context.provider === "jobicy_rss" ? /^\/jobs\/\d+(?:-[^/]+)?$/ : /^\/remote-jobs\/[^/]+\/[^/]+$/;
  if (!listingPath.test(path)) return undefined;
  const target = context.contact_link_targets.find(value => {
    const targetPath = onBoard(value)?.pathname.replace(/\/$/, "");
    return targetPath === path || targetPath === path + "/apply";
  });
  if (target) return { field: "contact_link_targets", value: target } as const;
  // Earlier Jobicy snapshots stored the verified listing only as original_url.
  const jobicyListingId = /^\/jobs\/(\d+)(?:-|$)/.exec(path)?.[1];
  if (context.provider === "jobicy_rss" && jobicyListingId && context.provider_record_id === "post:" + jobicyListingId)
    return { field: "original_url", value: context.original_url } as const;
}
const JOB_BOARD_BUYER_PATTERNS = [
  /\b(?:employment|job|engagement|contract)\s*type\s*:\s*(?:contractor|contract|freelance|project[- ]based)\b(?![- ]to[- ]hire\b)/i,
  /\bthis\s+is\s+a\s+(?:contract|freelance|project[- ]based)\s+(?:position|role|engagement)\b/i,
  /\b(?:looking\s+for|hiring)\s+[^.\n]{1,60}\bon\s+a\s+contract\s+basis\b/i,
];

const UNPAID_PATTERNS = [
  /\bunpaid\b(?!.*\bnot\s+unpaid\b)(?!.*\bno\s+unpaid\b)/i,
  /\bvolunteer\b/i,
  /\bequity[- ]?only\b/i,
  /\bfor\s+equity\s+only\b/i,
  /\bcofounder\b.*\bequity\b/i,
  /\brevenue[- ]?share[- ]?only\b/i,
];

const AGGREGATOR_PATTERNS = [
  /\bhere\s+are\s+\d+\s+(?:remote\s+)?(?:developer\s+)?jobs\b/i,
  /\b\d+\s+(?:remote\s+)?(?:developer\s+)?(?:jobs|openings|positions)\b/i,
  /\bjob\s+listings?\s+(?:index|directory|roundup|compilation)\b/i,
];

const PROMOTION_PATTERNS = [
  /\bjoin\s+our\s+newsletter\b/i,
  /\bour\s+product\s+(?:makes|helps|lets)\b/i,
  /\btry\s+our\s+(?:free|new)\b/i,
  /\bsign\s+up\s+(?:for|to)\b/i,
];

const INTERNSHIP_PATTERNS = [
  /\binternship\b/i,
  /\bintern\s+(?:position|role|opening)\b/i,
];

const INDEPENDENT_ENGAGEMENT_PATTERNS = [
  /\bindependent\s+(?:contractor|consultant|developer|engineer)\b/i,
  /\bfreelance(?:r)?\b/i,
  /\bfixed[- ]?(?:price|budget|fee|scope)\b/i,
  /\bretainer\b/i,
  /\bfractional\b/i,
  /\bconsulting\b/i,
  /\bsubcontractor\b/i,
  /\bcontract(?:or)?\b(?!\s*(?:to[- ]?hire|position|role|employee|employment|payroll))/i,
  /\b(?:paid|client|short[- ]?term)\s+project\b/i,
  /\bproject[- ]?(?:based|work)\b/i,
];

const EXPLICIT_INDEPENDENT_HIRE_PATTERN =
  /\b(?:need|seeking|looking\s+for|hiring|hire)\s+(?:(?:a|an)\s+)?(?:(?:paid|independent|freelance|fractional)\s+)*(?:[a-z0-9_.-]+\s+)?(?:freelancers?|contractors?|subcontractors?|consultants?)\b/i;
const PROJECT_BUYER_PATTERN =
  /\b(?:fixed[- ]?(?:price|budget|fee|scope)|project[- ]based|paid\s+project)\b/i;

const COMPANY_HIRING_LANGUAGE_PATTERN =
  /\b(?:we\s+(?:are|'re)\s+(?:currently\s+)?(?:hiring|looking\s+for|seeking)|we\s+need|looking\s+to\s+hire|join\s+(?:our|the)\s+(?:team|company)|apply\b)\b/i;

const ISOLATED_INDEPENDENT_CLAUSE_PATTERN =
  /\b(?:alternatively|also|independent(?:ly)?|freelance|contractor)\s+.*?\b(?:deliver|build|develop|implement|create)\b/i;

const PAID_AMOUNT_PATTERN = /(?:USD|EUR|GBP|INR|\$|€|£|₹)\s*[\d,]+(?:\.\d+)?|\d+(?:,\d{3})*(?:\.\d+)?\s*(?:USD|EUR|GBP|INR|dollars?|euros?|pounds?|rupees?)/i;
const BOARD_PAY_RANGE = /(USD|EUR|GBP|INR|\$|€|£|₹)[ \t]*([\d,]+(?:\.\d+)?)[ \t]*(?:[-–—]|to)[ \t]*(?:\1[ \t]*)?([\d,]+(?:\.\d+)?)(?![\d,.]|\s*(?:[kKmM]\b|USD|EUR|GBP|INR|\$|€|£|₹))/i;
const BOARD_PAY_CUE = /\b(?:compensation[ \t]*:[ \t]*competitive\b|salary[ \t]+range\b|(?:(?:hourly|daily|contract)[ \t]+)?rate[ \t]*:|budget[ \t]+available\b|DOE\b)/i;
const PAID_EXPLICIT_PATTERN = /\b(?:paid|rates?\s+(?:negotiable|flexible)|budget|compensation|fee)\b/i;
const COMMERCIAL_HIRING_PATTERN = /\b(?:hiring|hire)\s+(?:a\s+|an\s+)?(?:independent|freelance|paid)\b/i;

const TIMELINE_STATED_PATTERN = /\b(?:deadline|within\s+\d+\s+(?:weeks?|months?|days?)|finish\s+(?:this|next)\s+(?:week|month)|start\s+(?:immediately|asap|this|next)|\d+[- ]?week|\d+[- ]?month|by\s+(?:end\s+of|january|february|march|april|may|june|july|august|september|october|november|december))\b/i;
const TIMELINE_FLEXIBLE_PATTERN = /\b(?:flexible|discuss\s+timeline|timeline\s+(?:is\s+)?flexible|flexible\s+(?:start|timeline|deadline))\b/i;

const CONTACT_EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const CONTACT_URL_PATTERN = /https?:\/\/[^\s<>"']+(?:apply|form|contact|hire|submit)/i;
const CONTACT_DM_PATTERN = /\b(?:DM\b|direct\s+message|reply\s+(?:here|to\s+this|by\s+email)|email\s+(?:us|me)|contact\s+(?:us|me))\b/i;

/** Classic job-posting title patterns: "Company | Role | Location" */
const JOB_POSTING_TITLE_PATTERN = /^[^|]+\|\s*(?:(?:principal|staff|lead|senior|junior)\s+)?(?:(?:software|ios|android|frontend|front-end|backend|back-end|full[- ]?stack|devops|data|ml|platform|cloud|infra|qa|site\s+reliability|security|mobile|web)\s+)?(?:engineer|developer|architect|scientist|analyst|manager|designer|director|coordinator|specialist)\s*(?:\||$)/i;

/* ---------- Prefilter -------------------------------------------- */

export interface PrefilterResult {
  pass: boolean;
  reason: RejectionReason | null;
  evidence: string;
}

/**
 * Stage 1-2 cheap prefilter. Returns early rejection reason or pass.
 * Checks source allowlist, availability, staleness and obvious seller headers
 * before any deeper analysis.
 */
export function prefilterDiscovery(
  context: DiscoveryContext,
  now: string,
  policy: QualificationPolicy = defaultQualificationPolicy,
): PrefilterResult {
  // Source allowlist
  if (!ALLOWED_SOURCES.has(context.provider)) {
    return { pass: false, reason: "SOURCE_NOT_ALLOWED", evidence: `provider=${context.provider}` };
  }

  // Dead or deleted
  if (context.dead || context.deleted) {
    return { pass: false, reason: "SOURCE_UNAVAILABLE", evidence: context.dead ? "dead=true" : "deleted=true" };
  }

  // Staleness
  if (context.expires_at && Date.parse(context.expires_at) <= Date.parse(now)) {
    return { pass:false, reason:"STALE_OR_CLOSED", evidence:"Publisher expiry has passed" };
  }
  if (context.published_at) {
    const ageDays = (Date.parse(now) - Date.parse(context.published_at)) / 86400000;
    if (ageDays > policy.max_age_days) {
      return { pass: false, reason: "STALE_OR_CLOSED", evidence: `age=${Math.round(ageDays)}d > ${policy.max_age_days}d` };
    }
  }

  // Truncated / incomplete: hold, don't reject
  // (handled downstream as INSUFFICIENT_CONTEXT if remaining gates can't be satisfied)

  return { pass: true, reason: null, evidence: "" };
}

/* ---------- Rule-based evidence extraction ----------------------- */

export interface RuleEvidence {
  discovery_semantics?: DiscoverySemantics;
  intent: "BUYER" | "SELLER" | "EMPLOYMENT" | "PROMOTION" | "MIXED" | "UNKNOWN";
  lead_type: (typeof leadTypes)[number];
  requester_type: (typeof requesterTypes)[number];
  engagement_type: (typeof engagementTypes)[number];
  budget_signal: BudgetSignal;
  timeline_signal: string | null;
  required_skills: string[];
  seniority: (typeof seniorities)[number];
  location_or_remote_policy: string | null;
  contact_method: { type: (typeof contactTypes)[number]; value: string | null };
  rejection_reason: RejectionReason | null;
  evidence_quotes: ExtractionEvidence[];
  provider_signal?: z.infer<typeof providerSignalSchema>;
  all_reasons: RejectionReason[];
  missing_fields: string[];
}

function matchSpan(text: string, pattern: RegExp): string | null {
  const m = text.match(pattern);
  return m ? m[0] : null;
}

function skillPattern(skill: string): RegExp {
  return new RegExp("\\b" + skill.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&") + "\\b", "i");
}

function extractSkills(text: string, exact = false): string[] {
  const skills: string[] = [];
  const lowerText = text.toLowerCase();
  for (const cap of SERVICE_CAPABILITIES) {
    if ((exact ? skillPattern(cap).test(text) : lowerText.includes(cap)) && !skills.includes(cap)) {
      skills.push(cap);
    }
  }
  return skills.slice(0, 12);
}

function checkNegation(text: string, keyword: string): boolean {
  // Check if the keyword appears negated: "not unpaid", "no unpaid", "not seeking unpaid"
  const negationPattern = new RegExp(
    `\\b(?:not|no|never|without|isn't|aren't|don't|doesn't|won't)\\s+(?:\\w+\\s+){0,3}${keyword}\\b`,
    "i"
  );
  return negationPattern.test(text);
}

/**
 * Stage C: Extract evidence from text using deterministic rules.
 * Performs clause-level analysis — does not reject just because a keyword appears.
 */
export function extractRuleEvidence(
  text: string,
  context: DiscoveryContext | null,
): RuleEvidence {
  const canonical = context
    ? canonicalEvidence(context)
    : text;

  const allReasons: RejectionReason[] = [];
  const evidenceQuotes: ExtractionEvidence[] = [];
  const missingFields: string[] = [];
  const formalBoard = context?.item_type === "listing" && isFormalJobBoard(context.provider);
  const verifiedEngagement = formalBoard && matchProviderEngagement(context.provider, context.provider_verified_engagement);
  // Some boards use "salary range" as a pay label for confirmed contracts.
  const employmentText = verifiedEngagement ? canonical.replace(/\bsalary[ \t]+range\b/gi, "") : canonical;

  function addEvidence(field: EvidenceField, quote: string) {
    if (quote && quote.length <= 320) {
      evidenceQuotes.push({ field, quote: quote.slice(0, 320) });
    }
  }

  // ---- Determine intent/direction ----
  let intent: RuleEvidence["intent"] = "UNKNOWN";
  let isSeller = false;
  let isBuyer = false;
  let isEmployment = false;
  let isPromotion = false;
  let isUnpaid = false;
  let isAggregator = false;
  let isInternship = false;

  // Check for explicit "SEEKING FREELANCE" header (seller-side)
  const seekingFreelanceHeader = /^seeking\s+freelance\b/im.test(canonical);

  // Check seller patterns
  for (const pattern of SELLER_PATTERNS) {
    const span = matchSpan(canonical, pattern);
    if (span) {
      isSeller = true;
      addEvidence("intent", span);
      break;
    }
  }

  // Check buyer patterns — buyer can override a weak seller signal when
  // the text says "not seeking work" or "seeking a freelancer"
  for (const pattern of BUYER_PATTERNS) {
    const span = matchSpan(canonical, pattern);
    if (span) {
      isBuyer = true;
      addEvidence("intent", span);
      break;
    }
  }

  if (!isBuyer && context && isFormalJobBoard(context.provider) &&
      !EMPLOYMENT_PATTERNS.some(pattern => pattern.test(employmentText))) {
    const span = JOB_BOARD_BUYER_PATTERNS.map(pattern => matchSpan(canonical, pattern)).find(Boolean) ||
      matchSpan(canonical, /(?:^|\n)[ \t]*scope\s+of\s+work\b/i)?.trim();
    if (span) {
      isBuyer = true;
      addEvidence("intent", span);
    }
  }

  const clearIndependentBuyerLanguage =
    isBuyer &&
    (EXPLICIT_INDEPENDENT_HIRE_PATTERN.test(canonical) ||
      (/\b(?:build|deliver|develop|implement|create|design|migrate|optimize|integrate)\b/i.test(canonical) &&
        PROJECT_BUYER_PATTERN.test(canonical)));

  // Check for negated unpaid: "Not seeking unpaid" / "No unpaid work"
  const unpaidNegated = checkNegation(canonical, "unpaid") ||
    /\bnot?\s+unpaid\b/i.test(canonical) ||
    /\bno\s+unpaid\b/i.test(canonical);

  // Check unpaid patterns with clause-level negation awareness
  if (!unpaidNegated) {
    for (const pattern of UNPAID_PATTERNS) {
      const span = matchSpan(canonical, pattern);
      if (span) {
        isUnpaid = true;
        addEvidence("exclusion", span);
        break;
      }
    }
  }

  // Check job posting title format: "Company | Role | Location"
  const titleEvidence =
    context?.original_title?.trim() ||
    canonical.split("\n").find((line) => line.trim()) ||
    "";
  const jobTitleMatch = matchSpan(titleEvidence, JOB_POSTING_TITLE_PATTERN);

  // Check employment patterns with clause-level awareness
  // "full-time preferred, independent contract also available" — look for independent clause
  const hasIndependentClause = INDEPENDENT_ENGAGEMENT_PATTERNS.some(p => p.test(canonical));

  for (const pattern of EMPLOYMENT_PATTERNS) {
    const span = matchSpan(employmentText, pattern);
    if (span) {
      // If there's also an independent/freelance clause, this is MIXED, not pure employment
      if (!hasIndependentClause) {
        isEmployment = true;
        addEvidence("exclusion", span);
      }
      break;
    }
  }

  // If a classic job title format AND no independent clause, it's employment
  // EXCEPT when there is no body text at all (Spec Section 9 Row 8: “Clad | Software Engineer | NYC.” (no original body)
  // is UNKNOWN direction, holding as REVIEW_INCOMPLETE with INSUFFICIENT_CONTEXT, not invented employment).
  const hasBody = context ? Boolean(context.decoded_text?.trim()) : Boolean(canonical.trim());
  const hasExplicitEmployment = EMPLOYMENT_PATTERNS.some(p => p.test(employmentText));
  const classicHiringRole =
    jobTitleMatch && hasBody && COMPANY_HIRING_LANGUAGE_PATTERN.test(canonical);
  const hiringThread = Boolean(context && /\bwho is hiring\b/i.test(context.thread_title));
  const isolatedIndependentClause = ISOLATED_INDEPENDENT_CLAUSE_PATTERN.test(canonical);
  const threadRoleOrHiringEvidence =
    Boolean(jobTitleMatch) ||
    hasExplicitEmployment ||
    COMPANY_HIRING_LANGUAGE_PATTERN.test(canonical);
  const hiringThreadEmployment =
    hiringThread &&
    hasBody &&
    threadRoleOrHiringEvidence &&
    !isSeller &&
    !clearIndependentBuyerLanguage &&
    !isolatedIndependentClause;
  if (
    jobTitleMatch &&
    !clearIndependentBuyerLanguage &&
    (hasExplicitEmployment || classicHiringRole)
  ) {
    isEmployment = true;
    addEvidence("exclusion", jobTitleMatch);
  }
  if (hiringThreadEmployment) {
    isEmployment = true;
    const evidence =
      jobTitleMatch ||
      context?.original_title ||
      context?.decoded_text.slice(0, 200) ||
      "";
    if (evidence) addEvidence("exclusion", evidence);
  }

  // Check aggregator
  for (const pattern of AGGREGATOR_PATTERNS) {
    const span = matchSpan(canonical, pattern);
    if (span) {
      isAggregator = true;
      addEvidence("exclusion", span);
      break;
    }
  }

  // Check promotion
  for (const pattern of PROMOTION_PATTERNS) {
    const span = matchSpan(canonical, pattern);
    if (span && !isBuyer) {
      isPromotion = true;
      addEvidence("exclusion", span);
      break;
    }
  }

  // Check internship
  for (const pattern of INTERNSHIP_PATTERNS) {
    const span = matchSpan(canonical, pattern);
    if (span) {
      isInternship = true;
      addEvidence("exclusion", span);
      break;
    }
  }

  // Determine overall intent
  if (seekingFreelanceHeader && !isBuyer) {
    // Explicit SEEKING FREELANCE header = seller
    isSeller = true;
    intent = "SELLER";
  } else if (isSeller && isBuyer) {
    // Mixed posts: check if isolated contract unit exists
    // "We hire full-time; alternatively an independent paid contractor can deliver..."
    if (ISOLATED_INDEPENDENT_CLAUSE_PATTERN.test(canonical)) {
      intent = "BUYER";
      isSeller = false;
    } else {
      intent = "MIXED";
    }
  } else if (isEmployment && isBuyer) {
    // e.g. "We hire full-time; alternatively an independent paid contractor can deliver..."
    if (ISOLATED_INDEPENDENT_CLAUSE_PATTERN.test(canonical)) {
      intent = "BUYER";
      isEmployment = false;
    } else {
      intent = "MIXED";
    }
  } else if (isSeller) {
    intent = "SELLER";
  } else if (isBuyer) {
    intent = "BUYER";
  } else if (isEmployment) {
    intent = "EMPLOYMENT";
  } else if (isPromotion) {
    intent = "PROMOTION";
  } else {
    intent = "UNKNOWN";
  }

  let providerSignal: RuleEvidence["provider_signal"];
  const provider = context?.provider;
  if ((provider === "himalayas" || provider === "jobicy_rss") && context?.item_type === "listing" &&
      context.complete && !context.truncated && hasBody && !seekingFreelanceHeader && !isSeller &&
      !isEmployment && !hasExplicitEmployment && !isUnpaid && !isAggregator && !isPromotion && !isInternship &&
      !PROMOTION_PATTERNS.some(pattern => pattern.test(canonical))) {
    const engagement = matchProviderEngagement(provider, context.provider_verified_engagement);
    if (engagement) {
      providerSignal = { provider, engagement, used_for: [] };
      if (intent === "UNKNOWN") {
        intent = "BUYER";
        providerSignal.used_for.push("intent");
      }
    }
  }

  // ---- Apply rejection precedence ----

  // SELLER_SELF_PROMOTION
  if (intent === "SELLER") {
    allReasons.push("SELLER_SELF_PROMOTION");
  }

  // FULL_TIME_ONLY / EMPLOYMENT_CONTRACT_ONLY
  if (isEmployment && intent !== "BUYER") {
    // Distinguish full-time vs fixed-term employee contract
    if (
      /\bemployee\s+payroll\b/i.test(canonical) ||
      /\bfixed[- ]?term\b.*\b(?:employee|payroll)\b/i.test(canonical) ||
      ((jobTitleMatch || hiringThreadEmployment) && /\bcontract\b/i.test(canonical))
    ) {
      allReasons.push("EMPLOYMENT_CONTRACT_ONLY");
    } else {
      allReasons.push("FULL_TIME_ONLY");
    }
  }

  // Job posting title without body → INSUFFICIENT_CONTEXT
  if (jobTitleMatch && !context?.decoded_text && !hasIndependentClause) {
    // No body text — might be employment but we can't tell
    // The spec says: "no original body → UNKNOWN / REVIEW_INCOMPLETE, not invented employment"
    if (!context?.decoded_text?.trim()) {
      // Will be handled downstream
    }
  }

  // INTERNSHIP
  if (isInternship) {
    allReasons.push("INTERNSHIP");
  }

  // UNPAID_OR_EQUITY_ONLY
  if (isUnpaid) {
    allReasons.push("UNPAID_OR_EQUITY_ONLY");
  }

  // AGGREGATOR_ONLY / NO_CLIENT_NEED
  if (isAggregator) {
    allReasons.push("AGGREGATOR_ONLY");
  }
  if (isPromotion && !isBuyer) {
    allReasons.push("NO_CLIENT_NEED");
  }

  // ---- Requester type ----
  let requesterType: RuleEvidence["requester_type"] = "UNKNOWN";
  if (intent === "SELLER") {
    requesterType = "FREELANCER_SELLER";
  } else if (isEmployment && intent !== "BUYER") {
    requesterType = "EMPLOYER";
  } else if (intent === "BUYER") {
    if (/\b(?:agency|subcontract)\b/i.test(canonical)) {
      requesterType = "AGENCY_BUYER";
      const span = matchSpan(canonical, /\b(?:agency|subcontract)\w*/i);
      if (span) addEvidence("requester", span);
    } else if (/\b(?:startup|founder|co-?founder)\b/i.test(canonical)) {
      requesterType = "FOUNDER";
      const span = matchSpan(canonical, /\b(?:startup|founder|co-?founder)\w*/i);
      if (span) addEvidence("requester", span);
    } else if (/\b(?:our\s+company|our\s+team|we|our)\b/i.test(canonical)) {
      requesterType = "COMPANY";
      const span = matchSpan(canonical, /\b(?:our\s+company|our\s+team|we|our)\b/i);
      if (span) addEvidence("requester", span);
    } else {
      const span = matchSpan(canonical, /\b(?:I|my|client|hiring|seeking|need)\b/i);
      if (span || (!formalBoard && !providerSignal?.used_for.includes("intent"))) {
        requesterType = "INDIVIDUAL_CLIENT";
        if (span) addEvidence("requester", span);
      }
    }
  }

  // ---- Engagement type ----
  let engagementType: RuleEvidence["engagement_type"] = "UNKNOWN";
  if (isEmployment && intent !== "BUYER") {
    if (
      /\bemployee\s+payroll\b/i.test(canonical) ||
      /\bfixed[- ]?term\b/i.test(canonical) ||
      ((jobTitleMatch || hiringThreadEmployment) && /\bcontract\b/i.test(canonical))
    ) {
      engagementType = "EMPLOYEE_FIXED_TERM";
    } else {
      engagementType = "EMPLOYEE_FULL_TIME";
    }
  } else if (isInternship) {
    engagementType = "INTERNSHIP";
  } else if (isUnpaid) {
    engagementType = "UNPAID";
  } else if (intent === "BUYER" || intent === "MIXED") {
    if (/\bfixed[- ]?(?:price|budget|fee|scope)\b/i.test(canonical)) {
      engagementType = "FIXED_PROJECT";
      const span = matchSpan(canonical, /\bfixed[- ]?(?:price|budget|fee|scope)\w*/i);
      if (span) addEvidence("engagement", span);
    } else if (/\b(?:paid|client|short[- ]?term)\s+project\b/i.test(canonical) || /\bproject[- ]?(?:based|work)\b/i.test(canonical)) {
      engagementType = "FIXED_PROJECT";
      const span = matchSpan(canonical, /\b(?:paid|client|short[- ]?term)\s+project\b/i) || matchSpan(canonical, /\bproject[- ]?(?:based|work)\b/i);
      if (span) addEvidence("engagement", span);
    } else if (/\bretainer\b/i.test(canonical)) {
      engagementType = "RETAINER";
      const span = matchSpan(canonical, /\bretainer\b/i);
      if (span) addEvidence("engagement", span);
    } else if (/\bfractional\b/i.test(canonical)) {
      engagementType = "FRACTIONAL";
      const span = matchSpan(canonical, /\bfractional\b/i);
      if (span) addEvidence("engagement", span);
    } else if (/\bconsulting\b/i.test(canonical)) {
      engagementType = "CONSULTING";
      const span = matchSpan(canonical, /\bconsulting\b/i);
      if (span) addEvidence("engagement", span);
    } else if (/\bindependent\s+(?:[a-z0-9_.-]+\s+)*(?:contractor|consultant|developer|engineer)\b/i.test(canonical)) {
      engagementType = "INDEPENDENT_CONTRACT";
      const span = matchSpan(canonical, /\bindependent\s+(?:[a-z0-9_.-]+\s+)*(?:contractor|consultant|developer|engineer)\b/i);
      if (span) addEvidence("engagement", span);
    } else if (/\bfreelance(?:r)?\b/i.test(canonical)) {
      engagementType = "INDEPENDENT_CONTRACT";
      const span = matchSpan(canonical, /\bfreelance(?:r)?\b/i);
      if (span) addEvidence("engagement", span);
    } else if (/\bcontract(?:or)?\b/i.test(canonical)) {
      engagementType = "INDEPENDENT_CONTRACT";
      const span = matchSpan(canonical, /\bcontract(?:or)?\b/i);
      if (span) addEvidence("engagement", span);
    } else {
      engagementType = "UNKNOWN";
    }
  }

  if (intent === "BUYER" && engagementType === "UNKNOWN" && providerSignal) {
    engagementType = "INDEPENDENT_CONTRACT";
    providerSignal.used_for.push("engagement");
  }

  // ---- Lead type ----
  let leadType: RuleEvidence["lead_type"] = "UNKNOWN";
  if (intent === "SELLER") {
    leadType = "SELLER_PROMOTION";
  } else if (isEmployment && intent !== "BUYER") {
    leadType = "EMPLOYMENT";
  } else if (isInternship) {
    leadType = "INTERNSHIP";
  } else if (isUnpaid) {
    leadType = "UNPAID";
  } else if (isAggregator) {
    leadType = "AGGREGATOR";
  } else if (isPromotion && !isBuyer) {
    leadType = "PROMOTION";
  } else if (intent === "BUYER") {
    if (engagementType === "FIXED_PROJECT") leadType = "CLIENT_PROJECT";
    else if (engagementType === "RETAINER") leadType = "RETAINER";
    else if (engagementType === "CONSULTING") leadType = "CONSULTING";
    else if (engagementType === "FRACTIONAL") leadType = "CONSULTING";
    else if (engagementType === "INDEPENDENT_CONTRACT") leadType = "CONTRACT_ROLE";
    else leadType = "UNKNOWN";
  }

  // ---- Budget/payment signal ----
  let budgetSignal: BudgetSignal = {
    kind: "UNKNOWN",
    minimum: null,
    maximum: null,
    currency: "UNKNOWN",
    unit: "UNKNOWN",
  };

  // Parse numeric amounts
  const range = formalBoard ? canonical.match(BOARD_PAY_RANGE) : null;
  const amountMatch = range ?? canonical.match(PAID_AMOUNT_PATTERN);
  if (amountMatch && intent === "BUYER") {
    // Extract currency
    let currency: BudgetSignal["currency"] = "UNKNOWN";
    const amountStr = amountMatch[0];
    if (/USD|\$/i.test(amountStr)) currency = "USD";
    else if (/EUR|€/i.test(amountStr)) currency = "EUR";
    else if (/GBP|£/i.test(amountStr)) currency = "GBP";
    else if (/INR|₹|rupee/i.test(amountStr)) currency = "INR";

    // Extract amount
    const numMatch = amountStr.match(/[\d,]+(?:\.\d+)?/);
    if (numMatch) {
      const amount = parseFloat(numMatch[0].replace(/,/g, ""));
      if (amount > 0 && currency !== "UNKNOWN") {
        // Check if unit is stated
        let unit: BudgetSignal["unit"] = "PROJECT";
        if (/\/\s*(?:hour|hr)\b/i.test(canonical)) unit = "HOUR";
        else if (/\/\s*(?:day)\b/i.test(canonical)) unit = "DAY";
        else if (/\/\s*(?:week)\b/i.test(canonical)) unit = "WEEK";
        else if (/\/\s*(?:month|mo)\b/i.test(canonical)) unit = "MONTH";

        const otherAmount = range ? Number(range[3].replace(/,/g, "")) : amount;
        budgetSignal = {
          kind: "AMOUNT_STATED",
          minimum: Math.min(amount, otherAmount),
          maximum: Math.max(amount, otherAmount),
          currency,
          unit,
        };
        addEvidence("payment", amountStr);
      }
    }
  }

  if (budgetSignal.kind === "UNKNOWN" && intent === "BUYER") {
    const boardPayCue = formalBoard ? matchSpan(canonical, BOARD_PAY_CUE) : null;
    // Check explicit paid wording
    const paidSpan = matchSpan(boardPayCue ? canonical.replace(new RegExp(BOARD_PAY_CUE.source, "gi"), " ") : canonical, PAID_EXPLICIT_PATTERN);
    if (paidSpan) {
      budgetSignal = { kind: "EXPLICIT_PAID", minimum: null, maximum: null, currency: "UNKNOWN", unit: "UNKNOWN" };
      addEvidence("payment", paidSpan);
    } else {
      // Check commercial hiring inference
      const hiringSpan = matchSpan(canonical, COMMERCIAL_HIRING_PATTERN);
      if (hiringSpan) {
        budgetSignal = { kind: "COMMERCIAL_HIRING", minimum: null, maximum: null, currency: "UNKNOWN", unit: "UNKNOWN" };
        addEvidence("payment", hiringSpan);
      } else if (boardPayCue && ELIGIBLE_ENGAGEMENTS.has(engagementType)) {
        budgetSignal.kind = "BOARD_PAID_INTENT_INFERRED";
        addEvidence("payment", boardPayCue);
      }
    }
  }

  if (isUnpaid) {
    budgetSignal = { kind: "UNPAID_OR_EQUITY_ONLY", minimum: null, maximum: null, currency: "UNKNOWN", unit: "UNKNOWN" };
  }

  // ---- Timeline ----
  let timelineSignal: string | null = null;
  const tlStated = matchSpan(canonical, TIMELINE_STATED_PATTERN);
  const tlFlexible = matchSpan(canonical, TIMELINE_FLEXIBLE_PATTERN);
  if (tlStated) {
    timelineSignal = tlStated;
    addEvidence("timeline", tlStated);
  } else if (tlFlexible) {
    timelineSignal = tlFlexible;
    addEvidence("timeline", tlFlexible);
  }

  // ---- Skills ----
  const skills = extractSkills(canonical, formalBoard);
  for (const skill of skills) {
    const m = canonical.match(skillPattern(skill));
    if (m) {
      addEvidence("skill", m[0]);
    }
  }

  // ---- Seniority ----
  let seniority: RuleEvidence["seniority"] = "UNKNOWN";
  if (/\bsenior\b/i.test(canonical)) seniority = "SENIOR";
  else if (/\bjunior\b/i.test(canonical)) seniority = "JUNIOR";
  else if (/\blead\b/i.test(canonical)) seniority = "LEAD";
  else if (/\bmid[- ]?(?:level)?\b/i.test(canonical)) seniority = "MID";

  // ---- Location ----
  let locationPolicy: string | null = null;
  if (context?.location) {
    locationPolicy = context.location;
  }
  const remoteMatch = matchSpan(canonical, /\b(?:remote|on-?site|hybrid)\b/i);
  if (remoteMatch) {
    locationPolicy = remoteMatch;
    addEvidence("location", remoteMatch);
  }

  // ---- Contact ----
  let contactMethod: RuleEvidence["contact_method"] = { type: "UNKNOWN", value: null };
  const emailMatch = canonical.match(CONTACT_EMAIL_PATTERN);
  if (emailMatch) {
    contactMethod = { type: "EMAIL", value: emailMatch[0] };
    addEvidence("contact", emailMatch[0]);
  } else {
    const urlMatch = canonical.match(CONTACT_URL_PATTERN);
    if (urlMatch) {
      contactMethod = { type: context?.contact_link_targets?.find(t => /apply|form|contact/i.test(t)) ? "FORM_URL" : "APPLICATION_URL", value: urlMatch[0] };
      addEvidence("contact", urlMatch[0]);
    } else {
      const dmMatch = matchSpan(canonical, CONTACT_DM_PATTERN);
      if (dmMatch) {
        contactMethod = { type: "REPLY_INSTRUCTIONS", value: dmMatch };
        addEvidence("contact", dmMatch);
      }
    }
  }

  if (contactMethod.type === "UNKNOWN" && context && isFormalJobBoard(context.provider)) {
    const application = boardApplication(context);
    if (application) {
      contactMethod = { type: "APPLICATION_URL", value: application.value };
      providerSignal = {
        provider: context.provider,
        ...(providerSignal?.used_for.length ? { engagement: providerSignal.engagement } : {}),
        application,
        used_for: [...(providerSignal?.used_for ?? []), "contact"],
      };
    }
  }

  if (formalBoard && intent === "BUYER" &&
      budgetSignal.kind === "UNKNOWN" && ELIGIBLE_ENGAGEMENTS.has(engagementType) &&
      contactMethod.type !== "UNKNOWN" && context.complete && !context.truncated) {
    budgetSignal.kind = "BOARD_PAID_INTENT_INFERRED";
  }
  if (budgetSignal.kind === "BOARD_PAID_INTENT_INFERRED") missingFields.push("payment_signal");

  // ---- Apply mandatory gate checks and collect missing fields ----
  const hasNoBody = context ? !context.decoded_text?.trim() : !canonical.trim();
  if (hasNoBody) {
    allReasons.push("INSUFFICIENT_CONTEXT");
    missingFields.push("original_body");
  }

  // Gate 1: Buyer-side demand
  if (intent !== "BUYER") {
    if (intent === "UNKNOWN" && !hasNoBody) {
      allReasons.push("AMBIGUOUS_DIRECTION");
      missingFields.push("buyer_demand");
    }
    // MIXED is handled above
  }

  // Gate 2: Independent/freelance engagement
  if (intent === "BUYER" && engagementType === "UNKNOWN") {
    allReasons.push("ENGAGEMENT_UNCLEAR");
    missingFields.push("engagement_type");
  }

  // Gate 3: Credible paid intent
  if (intent === "BUYER" && budgetSignal.kind === "UNKNOWN") {
    allReasons.push("PAYMENT_UNCLEAR");
    missingFields.push("payment_signal");
  }

  // Gate 4: Defined scope or clear work area
  if (!formalBoard && intent === "BUYER" && skills.length === 0) {
    // Check if there's some scope described even without matching skills
    const hasScope = /\b(?:build|deliver|develop|implement|create|design|migrate|optimize|integrate)\b/i.test(canonical);
    if (!hasScope) {
      allReasons.push("SCOPE_MISSING");
      missingFields.push("scope");
    }
  }

  // Determine primary rejection reason from precedence order
  const PRECEDENCE: RejectionReason[] = [
    "SOURCE_NOT_ALLOWED", "SOURCE_UNAVAILABLE", "UNSAFE_CONTENT", "STALE_OR_CLOSED",
    "SELLER_SELF_PROMOTION", "FULL_TIME_ONLY", "EMPLOYMENT_CONTRACT_ONLY", "INTERNSHIP",
    "UNPAID_OR_EQUITY_ONLY", "AGGREGATOR_ONLY", "NO_CLIENT_NEED",
    "AMBIGUOUS_DIRECTION", "ENGAGEMENT_UNCLEAR", "PAYMENT_UNCLEAR", "SCOPE_MISSING",
    "INSUFFICIENT_CONTEXT", "OUT_OF_SERVICE_SCOPE", "LOCATION_INCOMPATIBLE",
  ];

  let primaryReason: RejectionReason | null = null;
  for (const reason of PRECEDENCE) {
    if (allReasons.includes(reason)) {
      primaryReason = reason;
      break;
    }
  }

  // Add scope/intent evidence for buyer-side
  if (intent === "BUYER") {
    // Scope evidence
    const scopeMatch = matchSpan(canonical, /\b(?:build|deliver|develop|implement|create|design|migrate|optimize|integrate|checkout|api|website)\b.*?\b(?:project|app|site|system|platform|service|integration|tests?|workflow)\b/i);
    if (scopeMatch) {
      addEvidence("scope", scopeMatch.slice(0, 320));
    } else {
      // Look for a work-area description
      const workArea = matchSpan(canonical, /\b(?:React|Python|WordPress|iOS|API|CRM|checkout|performance|architecture)\b.*?\b(?:contractor|developer|consultant|freelancer|integration|migration|optimization)\b/i);
      if (workArea) addEvidence("scope", workArea.slice(0, 320));
      else if (skills.length > 0) {
        for (const skill of skills) {
          const m = canonical.match(skillPattern(skill));
          if (m) {
            addEvidence("scope", m[0]);
            break;
          }
        }
      }
    }
    if (formalBoard && !evidenceQuotes.some(quote => quote.field === "scope")) {
      const sectionMatch = context.decoded_text.match(
        /(?:^|\n)[ \t]*(?:Responsibilities|What you['’]ll do|Key duties)(?:[ \t]*:[ \t]*|[ \t]*(?=\n))\n?[ \t]*(?:[-•][ \t]*)?([^\n]{12,240})/i);
      const section = sectionMatch && sectionMatch[1].trim().split(/\s+/).length >= 3
        ? sectionMatch[0].trim() : "";
      const title = context.original_title.trim();
      const role = /\b(?:engineer|developer|architect|designer|analyst|specialist|consultant|manager|coordinator|administrator|support|devops|analytics|development|automation|writer|editor|producer|researcher|recruiter|accountant)\b/i;
      const scope = section || (role.test(title) ? title : "");
      if (scope) addEvidence("scope", scope);
    }
  }

  return {
    intent,
    lead_type: leadType,
    requester_type: requesterType,
    engagement_type: engagementType,
    budget_signal: budgetSignal,
    timeline_signal: timelineSignal,
    required_skills: skills,
    seniority,
    location_or_remote_policy: locationPolicy,
    contact_method: contactMethod,
    rejection_reason: primaryReason,
    evidence_quotes: evidenceQuotes,
    ...(providerSignal?.used_for.length ? { provider_signal: providerSignal } : {}),
    all_reasons: allReasons,
    missing_fields: missingFields,
  };
}

/* ---------- Scoring ----------------------------------------------- */

export interface FreelanceQualificationResult {
  record: QualificationRecord;
  audit: QualificationAudit;
}

const BOARD_SEAT = /\b(?:long[- ]term contract(?:or| position| role)?|ongoing (?:contract(?:or)?|engagement|role|work)|indefinite (?:contract|engagement)|staff augmentation|founding engineer|members? of (?:the )?technical staff|contractor roster|talent pool|join (?:our|the) (?:engineering )?team|language (?:qa|quality assurance|rater|evaluator)|(?:search|ads|internet|ai) (?:quality )?rater|\d+[ \t]+hours?[ \t]+(?:per|a|each|\/)[ \t]*(?:week|month))\b/i;
const BOARD_EMPLOYMENT = /\b(?:full[- ]time|permanent (?:position|role|employment)|employee benefits|salary and benefits|on (?:the|our) payroll|401\s*\(?k\)?|visa sponsorship)\b/i;
const BOARD_OUTCOME = /\b(?:ship|build|deliver|redesign|migrate|implement|integrate|launch|develop|create|replace|audit|hand over|complete|translate|test|evaluate|label|annotate|design|write|upgrade|fix)\s+(?:(?:the|a|an|our|your|one|[\d,]+)\s+)?(?:[\w.-]+\s+){0,5}(?:system|app|site|website|store|checkout|integration|migration|redesign|prototype|dashboard|report|dataset|batch|pages?|screens?|campaign|workflow|audit|module|portal|script|test suite)\b/i;
const BOARD_BOUNDARY = /\b(?:one[- ]off|one[- ]time|fixed[- ](?:scope|price)|fixed deliverables?|project[- ]based|project scope|acceptance criteria|deliverables?|handoff|hand[ -]over|delivery deadline|deadline (?:is |within |by )|due by)\b/i;
const UNBOUNDED_SEAT = /\b(?:staff augmentation|indefinite (?:contract|engagement)|contractor roster|ongoing (?:role|position|staffing)|founding engineer|members? of (?:the )?technical staff)\b/i;

export function requiresProjectBoundary(context: DiscoveryContext): boolean {
  return context.item_type === "listing" || isFormalJobBoard(context.provider);
}

function groundedDiscoverySemantics(
  semantic: DiscoverySemantics | undefined,
  canonical: string,
): DiscoverySemantics | undefined {
  if (!semantic) return undefined;
  const quotes = [semantic.engagement_evidence, semantic.scope_evidence, semantic.paid_evidence];
  return quotes.every(quote => quote === null || canonical.includes(quote)) ? semantic : undefined;
}

function semanticProjectBoundary(semantic: DiscoverySemantics | undefined, body: string): boolean {
  const boundary = semantic?.engagement_evidence;
  const scope = semantic?.scope_evidence;
  return Boolean(semantic?.lead_kind === "FREELANCE_PROJECT" && semantic.buyer_or_seller === "BUYER" &&
    semantic.engagement_boundary === "FIXED_SCOPE_PROJECT" && boundary && scope &&
    body.includes(boundary) && body.includes(scope) &&
    boundary.trim().split(/\s+/).length >= 4 && scope.trim().split(/\s+/).length >= 4 &&
    (BOARD_BOUNDARY.test(boundary) ||
      /\b(?:until|once|after|at the end of)\b[^.!?\n]{0,100}\b(?:complete[ds]?|ship(?:ped|s)?|deliver(?:ed|s)?|accept(?:ed|s)?|goes live|sign[- ]off)\b/i.test(boundary)));
}

/**
 * Stage C: Score a freelance discovery candidate using the exact rubric
 * from the specification Section 6.
 *
 * All four mandatory gates must pass for eligibility.
 * Ineligible records get score=0, priority=REJECTED.
 */
export function scoreFreelanceQualification(
  evidence: RuleEvidence,
  context: DiscoveryContext,
  now: string,
  policy: QualificationPolicy = defaultQualificationPolicy,
): FreelanceQualificationResult {
  const canonical = canonicalEvidence(context);
  const prefilter = prefilterDiscovery(context, now, policy);

  // Locate evidence quotes and produce final evidence with offsets
  const locatedQuotes: EvidenceQuote[] = [];
  const occurrenceMap = new Map<string, number>();
  const providerSignal = evidence.provider_signal;
  const formalBoard = isFormalJobBoard(context.provider);
  const needsProjectBoundary = requiresProjectBoundary(context);
  const semantics = groundedDiscoverySemantics(evidence.discovery_semantics, canonical);
  const body = context.decoded_text;
  const ruleEmployment = needsProjectBoundary && !/\b(?:not|no)\s+(?:an?\s+)?full[- ]time\b/i.test(canonical)
    ? matchSpan(canonical, BOARD_EMPLOYMENT) : null;
  const groundedBoundary = context.complete && !context.truncated &&
    ((BOARD_OUTCOME.test(body) && BOARD_BOUNDARY.test(body)) || semanticProjectBoundary(semantics, body));
  const modelSeat = semantics?.lead_kind === "LONG_TERM_CONTRACT_SEAT" &&
    semantics.engagement_boundary === "ONGOING_SEAT" && Boolean(semantics.engagement_evidence);
  const ongoingSeat = modelSeat ||
    (needsProjectBoundary && (UNBOUNDED_SEAT.test(canonical) || (!groundedBoundary && BOARD_SEAT.test(canonical))));
  const projectBoundary = ongoingSeat ? "ONGOING_SEAT" : groundedBoundary ? "BOUNDED" : "UNVERIFIED";
  const updatedAt = Date.parse(context.source_updated_at ?? "");
  const updateAge = Date.parse(now) - updatedAt;
  const freshHimalayasUpdate = !context.published_at && context.provider === "himalayas" &&
    context.item_type === "listing" && updateAge >= 0 &&
    updateAge <= policy.max_age_days * 86_400_000;
  const hasFreshnessEvidence = Boolean(context.published_at) || freshHimalayasUpdate;

  for (const eq of evidence.evidence_quotes) {
    // A board listing's single skill mention can substantiate both skill and scope.
    const occurrenceKey = formalBoard ? `${eq.field}\0${eq.quote}` : eq.quote;
    const occ = occurrenceMap.get(occurrenceKey) ?? 0;
    try {
      const loc = locateEvidence(canonical, eq.quote, occ);
      locatedQuotes.push({
        field: eq.field,
        quote: eq.quote,
        start: loc.start,
        end: loc.end,
      });
      occurrenceMap.set(occurrenceKey, occ + 1);
    } catch {
      // Quote not found in canonical text — skip it
    }
  }

  // Collect all reasons including prefilter
  let allReasons = [...evidence.all_reasons];
  let primaryReason = evidence.rejection_reason;
  const modelFullTime = semantics?.lead_kind === "FULL_TIME_JOB" && semantics.engagement_boundary === "EMPLOYMENT"
    ? semantics.engagement_evidence : null;
  const modelSeller = semantics?.lead_kind === "SELLER_PROMO" && semantics.buyer_or_seller === "SELLER"
    ? semantics.engagement_evidence : null;
  // A quoted semantic exclusion may narrow acceptance, even if publisher metadata implied buyer intent.
  for (const [reason, quote] of [
    ["FULL_TIME_ONLY", modelFullTime || ruleEmployment],
    ["SELLER_SELF_PROMOTION", modelSeller],
  ] as const) {
    if (!quote) continue;
    if (reason === "FULL_TIME_ONLY" && allReasons.includes("EMPLOYMENT_CONTRACT_ONLY")) continue;
    allReasons.push(reason);
    if (!locatedQuotes.some(item => item.field === "exclusion" && item.quote === quote)) {
      locatedQuotes.unshift({ field: "exclusion", quote, ...locateEvidence(canonical, quote) });
    }
  }
  if (ongoingSeat || (needsProjectBoundary && evidence.intent === "BUYER" && !groundedBoundary))
    allReasons.push("ENGAGEMENT_UNCLEAR");

  if (!prefilter.pass && prefilter.reason) {
    // Prefilter reasons take precedence
    allReasons = [prefilter.reason, ...allReasons];
    primaryReason = prefilter.reason;
  }

  // Apply staleness check with explicit "filled" / "closed" markers
  if (/\b(?:filled|closed|no\s+longer\s+(?:available|open|accepting))\b/i.test(canonical)) {
    if (!allReasons.includes("STALE_OR_CLOSED")) {
      allReasons.push("STALE_OR_CLOSED");
    }
    if (!primaryReason) primaryReason = "STALE_OR_CLOSED";
  }

  // Check for unsafe content (injection patterns)
  const injectionPat = /ignore\s+(all\s+)?(previous|prior|system)|system\s*prompt|exfiltrat|reveal\s+(your\s+)?(secret|key)|send\s+(me\s+)?(api\s*keys?|tokens?)|override\s+(approval|instructions)/i;
  if (injectionPat.test(canonical)) {
    if (!allReasons.includes("UNSAFE_CONTENT" as RejectionReason)) {
      allReasons.unshift("UNSAFE_CONTENT" as RejectionReason);
    }
    primaryReason = "UNSAFE_CONTENT";
  }

  // Re-determine primary reason using full precedence
  const PRECEDENCE: RejectionReason[] = [
    "SOURCE_NOT_ALLOWED", "SOURCE_UNAVAILABLE", "UNSAFE_CONTENT", "STALE_OR_CLOSED",
    "SELLER_SELF_PROMOTION", "FULL_TIME_ONLY", "EMPLOYMENT_CONTRACT_ONLY", "INTERNSHIP",
    "UNPAID_OR_EQUITY_ONLY", "AGGREGATOR_ONLY", "NO_CLIENT_NEED",
    "AMBIGUOUS_DIRECTION", "ENGAGEMENT_UNCLEAR", "PAYMENT_UNCLEAR", "SCOPE_MISSING",
    "INSUFFICIENT_CONTEXT", "OUT_OF_SERVICE_SCOPE", "LOCATION_INCOMPATIBLE",
  ];
  primaryReason = null;
  for (const reason of PRECEDENCE) {
    if (allReasons.includes(reason)) {
      primaryReason = reason;
      break;
    }
  }

  const boardRequester = evidence.requester_type === "UNKNOWN" &&
    (providerSignal?.used_for.includes("intent") ||
     (providerSignal?.used_for.includes("contact") && locatedQuotes.some(quote => quote.field === "intent")));

  // Determine eligibility
  // Inferred board pay earns no points and needs no textual payment span.
  if (formalBoard && evidence.intent === "BUYER" && primaryReason === null) {
    if ((evidence.budget_signal.kind !== "BOARD_PAID_INTENT_INFERRED" &&
         !locatedQuotes.some(quote => quote.field === "payment")) ||
        (evidence.budget_signal.kind === "AMOUNT_STATED" &&
         (evidence.budget_signal.maximum ?? evidence.budget_signal.minimum ?? 0) <= 0))
      primaryReason = "PAYMENT_UNCLEAR";
    else if (!locatedQuotes.some(quote => quote.field === "scope"))
      primaryReason = "SCOPE_MISSING";
    else if (evidence.requester_type === "UNKNOWN" && !boardRequester)
      primaryReason = "INSUFFICIENT_CONTEXT";
    if (primaryReason) allReasons.push(primaryReason);
  }

  const isEligible = primaryReason === null &&
    evidence.intent === "BUYER" &&
    ELIGIBLE_LEAD_TYPES.has(evidence.lead_type) &&
    (ELIGIBLE_REQUESTERS.has(evidence.requester_type) || boardRequester) &&
    ELIGIBLE_ENGAGEMENTS.has(evidence.engagement_type) &&
    PAID_BUDGET_KINDS.has(evidence.budget_signal.kind);

  // ---- Compute score (Section 6 rubric) ----
  let score = 0;
  const breakdown: Record<string, number> = {};

  if (isEligible) {
    // Explicit buyer-side request: 20
    breakdown.buyer_demand = 20;

    // Explicit independent/project/retainer/consulting engagement: 15
    breakdown.engagement = ELIGIBLE_ENGAGEMENTS.has(evidence.engagement_type) ? 15 : 0;

    // Paid intent: 20/15/10/0
    if (evidence.budget_signal.kind === "AMOUNT_STATED") {
      breakdown.paid_intent = 20;
    } else if (evidence.budget_signal.kind === "EXPLICIT_PAID") {
      breakdown.paid_intent = 15;
    } else if (evidence.budget_signal.kind === "COMMERCIAL_HIRING") {
      breakdown.paid_intent = 10;
    } else {
      breakdown.paid_intent = 0;
    }

    // Scope: 15/10/5/0
    const hasDeliverable = /\b(?:deliver|build|implement|create|integrate|migrate|optimize)\b.*?\b(?:with|including|and|plus)\s+\w+/i.test(canonical);
    const hasWorkArea = /\b(?:checkout|api|website|performance|architecture|migration|platform|integration)\b/i.test(canonical);
    const hasDefinedRole = evidence.required_skills.length > 0 ||
      (formalBoard && locatedQuotes.some(quote => quote.field === "scope"));
    if (hasDeliverable) {
      breakdown.scope = 15;
    } else if (hasWorkArea) {
      breakdown.scope = 10;
    } else if (hasDefinedRole) {
      breakdown.scope = 5;
    } else {
      breakdown.scope = 0;
    }

    // Agency service fit: 5/0
    const hasMatchingSkill = evidence.required_skills.some(s => SERVICE_CAPABILITIES.has(s.toLowerCase()));
    breakdown.service_fit = hasMatchingSkill ? 5 : 0;

    // Timeline: 10/5/0
    if (evidence.timeline_signal && TIMELINE_STATED_PATTERN.test(evidence.timeline_signal)) {
      breakdown.timeline = 10;
    } else if (evidence.timeline_signal && TIMELINE_FLEXIBLE_PATTERN.test(evidence.timeline_signal)) {
      breakdown.timeline = 5;
    } else {
      breakdown.timeline = 0;
    }

    // Contact path: 10/0
    breakdown.contact_path = evidence.contact_method.type !== "UNKNOWN" ? 10 : 0;

    // Freshness: 5/0
    breakdown.freshness = hasFreshnessEvidence ? 5 : 0;

    score = Object.values(breakdown).reduce((a, b) => a + b, 0);

    // Caps: HIGH without contact → cap at 84
    if (score >= 85 && evidence.contact_method.type === "UNKNOWN") {
      score = 84;
    }

    // Missing publication or verified recent board update → cap at 64
    if (!hasFreshnessEvidence && score > 64) {
      score = 64;
    }

    // Score below 50 → not eligible
    if (score < 50) {
      // This shouldn't happen in practice given the gates, but add safety
    }
  }

  // Priority band
  let priority: Priority;
  if (!isEligible) {
    priority = "REJECTED";
    score = 0;
  } else if (score >= policy.high_threshold) {
    priority = "HIGH";
  } else if (score >= policy.medium_threshold) {
    priority = "MEDIUM";
  } else if (score >= policy.low_threshold) {
    priority = "LOW";
  } else {
    priority = "REJECTED";
    // Below 50 → INSUFFICIENT_CONTEXT, hold
    if (!primaryReason) primaryReason = "INSUFFICIENT_CONTEXT";
  }

  // Eligibility state
  let eligibilityState: EligibilityState;
  if (isEligible && score >= policy.low_threshold) {
    eligibilityState = "ELIGIBLE";
  } else if (primaryReason === "UNSAFE_CONTENT") {
    eligibilityState = "QUARANTINED";
  } else if ([
    "AMBIGUOUS_DIRECTION", "ENGAGEMENT_UNCLEAR", "PAYMENT_UNCLEAR",
    "SCOPE_MISSING", "INSUFFICIENT_CONTEXT",
  ].includes(primaryReason || "")) {
    eligibilityState = "REVIEW_INCOMPLETE";
  } else {
    eligibilityState = "REJECTED";
  }

  // For non-eligible: score=0, priority=REJECTED
  if (eligibilityState !== "ELIGIBLE") {
    score = 0;
    priority = "REJECTED";
  }

  // Confidence score (Section 6)
  let confidence: number;
  if (primaryReason && ![
    "AMBIGUOUS_DIRECTION", "ENGAGEMENT_UNCLEAR", "PAYMENT_UNCLEAR",
    "SCOPE_MISSING", "INSUFFICIENT_CONTEXT",
  ].includes(primaryReason)) {
    // Confirmed exclusion with exact evidence
    confidence = 0.95;
  } else if (evidence.budget_signal.kind === "AMOUNT_STATED" && isEligible) {
    confidence = 0.95;
  } else if (evidence.budget_signal.kind === "COMMERCIAL_HIRING" && isEligible) {
    confidence = 0.85;
  } else if (evidence.budget_signal.kind === "EXPLICIT_PAID" && isEligible) {
    confidence = 0.85;
  } else if (evidence.missing_fields.length > 0) {
    confidence = 0.60;
  } else if (evidence.intent === "MIXED") {
    confidence = 0.40;
  } else if (!context.decoded_text?.trim()) {
    confidence = 0.20;
  } else {
    confidence = 0.85;
  }

  // Build contact method with permission_state
  const contactMethodFinal = {
    type: evidence.contact_method.type,
    value: evidence.contact_method.value,
    permission_state: "UNKNOWN" as (typeof permissionStates)[number],
  };

  const record: QualificationRecord = {
    is_valid_freelance_lead: eligibilityState === "ELIGIBLE",
    lead_type: evidence.lead_type,
    requester_type: evidence.requester_type,
    engagement_type: evidence.engagement_type,
    budget_signal: evidence.budget_signal,
    timeline_signal: evidence.timeline_signal,
    required_skills: evidence.required_skills,
    seniority: evidence.seniority,
    location_or_remote_policy: evidence.location_or_remote_policy,
    contact_method: contactMethodFinal,
    confidence_score: confidence,
    rejection_reason: eligibilityState === "ELIGIBLE" ? null : primaryReason,
    evidence_quotes: locatedQuotes.slice(0, 16),
    ...(providerSignal ? { provider_signal: providerSignal } : {}),
    quality_score: score,
    priority,
    eligibility_state: eligibilityState,
  };

  const audit: QualificationAudit = {
    schema_version: QUALIFICATION_SCHEMA_VERSION,
    rules_version: QUALIFICATION_RULES_VERSION,
    prompt_version: QUALIFICATION_PROMPT_VERSION,
    capability_list_version: CAPABILITY_LIST_VERSION,
    policy_version: QUALIFICATION_POLICY_VERSION,
    source_hash: context.source_hash,
    classified_at: now,
    method: "rules",
    reasons: allReasons.filter((r, i, arr) => arr.indexOf(r) === i) as QualificationAudit["reasons"],
    missing_fields: needsProjectBoundary && projectBoundary !== "BOUNDED"
      ? [...new Set([...evidence.missing_fields, "project_boundary"])] : evidence.missing_fields,
    breakdown,
    warnings: [],
    ...(providerSignal ? { provider_signal: providerSignal } : {}),
    ...(freshHimalayasUpdate ? { freshness_basis: "HIMALAYAS_LAST_UPDATE" as const } : {}),
    ...(semantics ? { discovery_semantics: semantics } : {}),
    ...(needsProjectBoundary || ongoingSeat ? { project_boundary: projectBoundary } : {}),
  };

  if (providerSignal || record.budget_signal.kind === "BOARD_PAID_INTENT_INFERRED")
    validateQualificationEvidence(record, context);
  return { record, audit };
}
