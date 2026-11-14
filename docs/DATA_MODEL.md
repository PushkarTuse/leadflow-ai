# Data model and workbook reuse

The original XLSX was inspected without editing it. It has `Leads CRM` (29 headers), `Dashboard`, `Projects`, `Maintenance`, `Lead Sources`, and `START HERE`. The CRM, project and maintenance input areas contain no entered records. Dashboard formulas refer to the legacy CRM and should not be treated as the new engine's counts.

## Original-to-engine mapping

| Original header | Engine field / treatment |
|---|---|
| Lead ID | `source_external_id`, preserving legacy provenance; new immutable engine ID |
| Captured At | Retained in original; new ingestion timestamp unless explicitly supplied through canonical import |
| Source | Retained in original; migration is `source=csv` |
| Source URL | `source_url`, canonicalized for deduplication |
| Business / Client | `client_name_if_public` (owner must verify its use is appropriate) |
| Contact Name | Not imported automatically; minimize personal data |
| Contact Channel | `contact_channel`, still requires policy verification |
| Requested Work | `raw_description`; first 120 characters initialize title |
| Budget Min / Max (₹) | `stated_budget_min/max`, currency INR; blanks stay null |
| Intent /30, Skill Fit /25, Budget Fit /20, Urgency /10, Credibility /10, Outreach OK /5 | Recomputed with code; exact original maxima reused |
| Score /100, Priority | Recomputed |
| Pipeline Stage, Owner Approval | Not trusted as fresh engine authorization; original remains preserved |
| Consent / Policy Check | Engine starts UNKNOWN until explicit owner review |
| Notes | `owner_notes` |
| Deal value, proposal URL, follow-up, last-contact date, owner | Retained in legacy tab for manual review, not inferred or silently discarded from the original |

`Projects`, `Maintenance` and `Lead Sources` are preserved as operating references. Setup adds `EngineDashboard` instead of repointing the original Dashboard's formulas. Import at most 500 legacy rows per invocation (the supplied template's initial input range). Repeated imports deduplicate.

## Engine tables, schema v2

V2 preserves the original engine table headers and adds IntakeReceipts and EmailOutbox. Lead record_json includes source=inbound, contact_email, consent_at and consent_version. Submitted personal names are private consented contact data even though the reused field is named client_name_if_public. The Sheet is never public.

IntakeReceipts stores submission UUID, lead ID, payload hash, received/processed times and queue state. EmailOutbox stores exact recipient/subject/body, content hash, random nonce, Telegram message binding, expiry, decision/owner timestamps, Gmail message ID and delivery state. States are DRAFT, NOTIFYING, REVIEW_PENDING, APPROVED, DEFERRED, REJECTED, SENDING, SENT, UNCERTAIN. EMAIL_SENT is a lead state reachable only by the approved-email service. Do not directly edit outbox text after review; its hash detects changes.

`setup` creates required headers and records the version in Settings. Existing tables with unexpected headers cause a clear stop rather than a destructive migration. Future schema changes need a versioned migration and backup; the first version is repeatable, not a claim of support for unknown schemas.

- **Leads**: all minimum brief fields, posting time, priority, classifier, extraction warning and hidden `record_json`. Numeric budgets are nullable; score is 0–100; confidence is an evidence-completeness heuristic from 0.15–0.9, not a calibrated probability. Arrays export as JSON strings. `record_json` is the authoritative typed object; visible columns are projections.
- **ActivityLog**: `event_id`, `lead_id`, timestamp, actor, event type, previous/new states, short redacted details. No raw provider responses or credentials.
- **Drafts**: stable `draft_id`, lead ID, creation time, text, source URL and `review_required=true`.
- **ApprovalRequests**: immutable request ID, lead ID, unpredictable nonce, authorized chat ID, Telegram message ID, expiration, delivery/consumption state and recorded decision. Owner-only data.
- **SourceRuns**: run ID, source, start/end timestamps, status, imported/duplicate/invalid counts, retry count, redacted error code. Failed runs may have partial persisted progress; counters on those runs are not complete totals.
- **ManualInbox**: editable import fields and an import-result column. No credentials. `OK` rows are skipped on repeated imports; clear a result only when intentionally retrying a corrected input.
- **Settings**: schema/configuration notes. Operational properties and credentials are in Script Properties, not this table.
- **EngineDashboard**: counts from current records and audited stage entries; an empty system displays real zeroes. Not revenue estimates.

## Status and permission rules

```text
NEW → QUALIFIED → PENDING_APPROVAL → APPROVED_FOR_DRAFT → DRAFT_READY
    → CONTACTED_MANUALLY → REPLIED → DISCOVERY → QUOTED → WON → MAINTENANCE
                                                   ↘ LOST
```

ARCHIVED and REJECTED are terminal branches where permitted. A review decision keeps PENDING_APPROVAL, changes approval_status to DEFERRED and sets next_followup_at one day later. Approval is only for drafting. `CONTACTED_MANUALLY` requires explicit owner confirmation and a permitted contact state. An UNKNOWN/BLOCKED contact state blocks that transition even with a high score. A draft can still be prepared for internal review but includes a HOLD instruction.

Permitted states: `PLATFORM_ONLY` means use only the reviewed source platform; `EXPLICIT_OPT_IN` means use only the contact purpose/channel actually granted. Neither is inferred from public availability or AI output. Gmail/HN defaults are UNKNOWN.

Score weights: hiring 30, supported skills 25, budget 20, timeline 10, identity credibility 10, contact route 5. The current scoring maximum for supplied identity alone is 7/10 credibility because no external verification is performed. Missing budgets get 5/20 and lower confidence, not a fabricated value. Default software-project budget floors: INR 15,000 / USD 200 / EUR 180 / GBP 160; these are explicit independent thresholds, not exchange-rate conversions. Thresholds are configurable in core; source priority cutoffs are configurable in Apps Script.

## IDs, export and privacy

The dedup key prefers the canonical HTTPS URL, then source + external ID, then normalized content. Tracking parameters and fragments are removed conservatively; query parameters that identify records are retained. A matching source ID also deduplicates when a link changes. No target URL is fetched for deduplication. IDs use a deterministic dual hash; this is an identity convenience, not a cryptographic authorization token. Nonces use UUID randomness.

CSV and Sheet cells beginning with formula-triggering characters are escaped. Quoted/multiline CSV is supported, malformed rows are rejected and import size is bounded. CSV export contains the minimum requested fields in stable order and can be opened in Sheets. To transfer into the engine, map canonical input columns into ManualInbox; exported scores/statuses never grant new approvals.

Deletion removes lead, draft, approval and activity rows for the selected immutable ID. Original emails, source CSVs, ManualInbox rows, exports, backups and Telegram messages require separate owner cleanup. A deleted source may be re-imported if it is still labeled or present in an import file; remove the source from ingestion first.
