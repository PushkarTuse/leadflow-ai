import { z } from "zod";
import { discoveryContextSchema } from "./qualification";
import type {
  DiscoveryContext,
  QualificationRecord,
  QualificationAudit,
} from "./qualification";

export const permissions = [
  "UNKNOWN",
  "PLATFORM_ONLY",
  "EXPLICIT_OPT_IN",
  "BLOCKED",
] as const;
export const statuses = [
  "NEW",
  "QUALIFIED",
  "PENDING_APPROVAL",
  "APPROVED_FOR_DRAFT",
  "DRAFT_READY",
  "EMAIL_SENT",
  "CONTACTED_MANUALLY",
  "REPLIED",
  "DISCOVERY",
  "QUOTED",
  "WON",
  "LOST",
  "MAINTENANCE",
  "ARCHIVED",
  "REJECTED",
] as const;
export type Status = (typeof statuses)[number];
export const inputSchema = z
  .object({
    source: z.enum(["manual", "csv", "gmail", "hn", "inbound"]),
    vertical: z.enum(['digital-marketing', 'web-app-dev']).optional(),
    brand: z.enum(['Signal & Slate', 'LeadFlow AI']).optional(),
    source_external_id: z.string().max(160).default(""),
    source_url: z
      .string()
      .max(2000)
      .refine(
        (v) => !v || /^https:\/\/[^\s/@]+(?:[/:?#][^\s@]*)?$/i.test(v),
        "Use an HTTPS source URL without credentials",
      )
      .default(""),
    discovered_at: z.string().datetime().optional(),
    posted_at: z.string().datetime().optional(),
    title: z.string().trim().min(5).max(200),
    raw_description: z.string().trim().min(20).max(12000),
    client_name_if_public: z.string().trim().max(120).default(""),
    country_or_region: z.string().max(100).default(""),
    stated_budget_min: z
      .number()
      .finite()
      .nonnegative()
      .max(1e9)
      .nullable()
      .default(null),
    stated_budget_max: z
      .number()
      .finite()
      .nonnegative()
      .max(1e9)
      .nullable()
      .default(null),
    currency: z
      .enum(["INR", "USD", "EUR", "GBP", "UNKNOWN"])
      .default("UNKNOWN"),
    contact_channel: z.string().max(100).default("Not verified"),
    contact_permission_state: z.enum(permissions).default("UNKNOWN"),
    contact_email: z.union([z.string().trim().email().max(160),z.literal('')]).default(''),
    consent_at: z.string().datetime().optional(),
    consent_version: z.string().max(40).default(''),
    owner_notes: z.string().max(2000).default(""),
    discovery_context: discoveryContextSchema.optional(),
  })
  .strict()
  .superRefine((x, ctx) => {
    if (!((!x.vertical && !x.brand) ||
      (x.vertical === 'digital-marketing' && x.brand === 'Signal & Slate') ||
      (x.vertical === 'web-app-dev' && x.brand === 'LeadFlow AI'))) {
      ctx.addIssue({code: 'custom', message: 'Supply a matching brand and service vertical', path: ['vertical']});
    }
    if (
      x.stated_budget_min !== null &&
      x.stated_budget_max !== null &&
      x.stated_budget_min > x.stated_budget_max
    )
      ctx.addIssue({
        code: "custom",
        message: "Budget minimum exceeds maximum",
        path: ["stated_budget_max"],
      });
    if (
      (x.stated_budget_min !== null || x.stated_budget_max !== null) &&
      x.currency === "UNKNOWN"
    )
      ctx.addIssue({
        code: "custom",
        message: "Specify currency with budget",
        path: ["currency"],
      });
  });
export type LeadInput = z.infer<typeof inputSchema>;

export const configSchema = z
  .object({
    highThreshold: z.number().int().min(1).max(100).default(75),
    reviewThreshold: z.number().int().min(1).max(100).default(55),
    maxAgeDays: z.number().int().min(1).max(365).default(30),
    minBudgets: z
      .object({
        INR: z.number().positive(),
        USD: z.number().positive(),
        EUR: z.number().positive(),
        GBP: z.number().positive(),
      })
      .default({ INR: 15000, USD: 200, EUR: 180, GBP: 160 }),
    ownerUserId: z.string().default("demo-owner"),
    ownerChatId: z.string().default("demo-chat"),
    approvalHours: z.number().min(1).max(168).default(24),
  })
  .refine(
    (c) => c.reviewThreshold < c.highThreshold,
    "Review threshold must be below high threshold",
  );
export type Config = z.infer<typeof configSchema>;
export const defaults = configSchema.parse({});
export interface Breakdown {
  intent: number;
  fit: number;
  budget: number;
  timeline: number;
  credibility: number;
  permission: number;
}
export interface Assessment {
  score: number;
  breakdown: Breakdown;
  reasoning: string[];
  confidence: number;
  missing: string[];
  skills: string[];
  summary: string;
  priority: "HIGH" | "REVIEW" | "LOW";
  quarantined: boolean;
  method: "rules" | "gemini" | "openai-compatible";
  extractionWarning: string;
}
export interface Lead extends LeadInput, Assessment {
  lead_id: string;
  dedup_key: string;
  status: Status;
  approval_status: "PENDING" | "APPROVED" | "DEFERRED" | "REJECTED" | "NONE";
  draft_id: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  next_followup_at: string;
  /**
   * Optional discovery qualification record. Absent on legacy and inbound records.
   */
  qualification?: QualificationRecord;
  /** Stage A: optional preserved discovery evidence context. */
  discovery_context?: DiscoveryContext;
  /** Stage E: audit data persisted independently from the producer assessment. */
  qualification_audit?: QualificationAudit;
  /** Legacy discovery rows remain held until their original evidence is available. */
  qualification_status?: "NEEDS_REQUALIFICATION";
}
export interface Activity {
  event_id: string;
  lead_id: string;
  timestamp: string;
  actor: string;
  event_type: string;
  previous_state: string;
  new_state: string;
  details: string;
}
export interface Draft {
  draft_id: string;
  lead_id: string;
  created_at: string;
  text: string;
  source_url: string;
  review_required: boolean;
}
export interface ApprovalRequest {
  request_id: string;
  lead_id: string;
  nonce: string;
  chat_id: string;
  message_id: string;
  expires_at: string;
  state: "PREPARED" | "SENDING" | "SENT" | "CONSUMED" | "FAILED";
  decision: "" | "approve" | "review" | "reject";
}
export interface Store {
  leads(): Lead[];
  get(id: string): Lead | undefined;
  save(lead: Lead): void;
  activity(event: Activity): void;
  activities(): Activity[];
  draft(draft: Draft): void;
  drafts(): Draft[];
  request(request: ApprovalRequest): void;
  requests(): ApprovalRequest[];
}
export interface Clock {
  now(): string;
}
export const systemClock: Clock = { now: () => new Date().toISOString() };
export function hash(s: string): string {
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < s.length; i++) {
    a = Math.imul(a ^ s.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ s.charCodeAt(i);
  }
  return (
    (a >>> 0).toString(16).padStart(8, "0") +
    (b >>> 0).toString(16).padStart(8, "0")
  );
}
export function canonicalUrl(value: string): string {
  // Does not fetch or follow links. Pure string implementation also runs in Apps Script.
  const match = value
    .trim()
    .match(/^https:\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?/i);
  if (!match) return "";
  const query = (match[3] || "")
    .split("&")
    .filter((x) => x && !/^(utm_[^=]*|ref|source|fbclid|gclid)=/i.test(x))
    .sort()
    .join("&");
  return (
    "https://" +
    match[1].toLowerCase().replace(/:443$/, "") +
    (match[2].replace(/\/$/, "") || "") +
    (query ? "?" + query : "")
  );
}
export function dedupKey(input: LeadInput): string {
  if (input.source === 'inbound') return 'inbound:' + input.source_external_id;
  const url = canonicalUrl(input.source_url);
  return url
    ? "url:" + url
    : input.source_external_id
      ? input.source + ":" + input.source_external_id
      : "content:" +
        hash(
          input.title.trim().toLowerCase() +
            "|" +
            input.raw_description.trim().toLowerCase(),
        );
}
export function isDuplicate(
  input: LeadInput,
  existing: Lead[],
): Lead | undefined {
  const key = dedupKey(input);
  return existing.find(
    (l) =>
      l.dedup_key === key ||
      Boolean(
        input.source_external_id &&
        l.source === input.source &&
        l.source_external_id === input.source_external_id,
      ),
  );
}
export function canContact(
  lead: Pick<LeadInput, "contact_permission_state">,
): boolean {
  return (
    lead.contact_permission_state === "PLATFORM_ONLY" ||
    lead.contact_permission_state === "EXPLICIT_OPT_IN"
  );
}
