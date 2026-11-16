import { z } from "zod";

/**
 * Stage A: qualification schemas, versioning and cross-field validation only.
 *
 * This module deliberately contains no scoring engine, no ingestion, no Gemini
 * call and no routing. Nothing here is wired into the live pipeline yet.
 */

export const QUALIFICATION_SCHEMA_VERSION = "freelance.v1";
export const QUALIFICATION_RULES_VERSION = "rules.v1";
export const QUALIFICATION_PROMPT_VERSION = "prompt.v1";
export const CAPABILITY_LIST_VERSION = "capabilities.v1";
export const QUALIFICATION_POLICY_VERSION = "policy.v1";

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
    (value) => /^https:\/\/[^\s/@]+(?:[/:?#][^\s]*)?$/i.test(value),
    "Use a credential-free HTTPS URL",
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
    collected_at: z.string().datetime(),
    fetched_at: z.string().datetime(),
    tags: z.array(z.string().min(1).max(60)).max(20).default([]),
    location: z.string().max(240).default(""),
    contact_link_targets: z.array(httpsUrl).max(10).default([]),
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

export const extractionSchema = z
  .object({
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
  .strict();

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
    quality_score: z.number().int().min(0).max(100),
    priority: z.enum(priorities),
    eligibility_state: z.enum(eligibilityStates),
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
const URL_PATTERN = /^https:\/\/[^\s/@]+(?:[/:?#][^\s]*)?$/i;

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
  const fields = new Set(record.evidence_quotes.map((q) => q.field));

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

    if (!fields.has("contact"))
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
    for (const required of ["intent", "requester", "engagement", "payment", "scope"] as const)
      if (!fields.has(required))
        issue(["evidence_quotes"], `Eligible records require ${required} evidence`);
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
    if (!ELIGIBLE_REQUESTERS.has(record.requester_type))
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
    method: z.enum(["rules", "gemini"]),
    reasons: z.array(z.enum(rejectionReasons)).max(20),
    missing_fields: z.array(z.string().min(1).max(60)).max(20),
    breakdown: z.record(z.string().min(1).max(40), z.number().int().min(0).max(100)),
    warnings: z.array(z.string().min(1).max(240)).max(20),
  })
  .strict();

export type QualificationAudit = z.infer<typeof qualificationAuditSchema>;
