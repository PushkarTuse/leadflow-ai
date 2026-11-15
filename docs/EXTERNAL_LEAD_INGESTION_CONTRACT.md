# External lead producer → LeadFlow: integration contract

Status: **design/handoff, 15 November 2026**. This document describes the existing engine and a proposed discovery ingress. **The proposed HTTP endpoint does not exist or accept requests yet.** Do not point an external producer at `/api/contact` or at the current Apps Script `doPost`: those accept only consented website enquiries. The existing HN job-story poller already uses the official HN Firebase API when `HN_ENABLED` is enabled.

## What to give Claude

**Start with this file.** For code-level compatibility, also provide `packages/core/model.ts` (the authoritative strict input schema), `apps/automation/adapters.ts` (current HN/Gmail extraction), `apps/automation/main.ts` (source polling and intake boundaries), `packages/core/scoring.ts` (current software-only rubric), and `packages/core/workflow.ts` (draft-only discovery approval). `apps/automation/sheets.ts` is useful if Claude prepares a temporary `ManualInbox` import. Do not give Claude `.env`, `.dev.vars`, Script Properties, the private Sheet, tokens or OAuth files. Ask for a producer that emits the proposed JSON contract and synthetic fixtures; direct HTTP delivery waits until this repo has a separate authenticated discovery receiver.

## What the existing pipeline actually does

`apps/automation/main.ts` runs a bounded Apps Script trigger. The existing source jobs are the official HN `jobstories` feed and a specifically selected Gmail label. `Engine.ingest` validates a strict `packages/core/model.ts` `inputSchema`, deduplicates, calculates a code-owned score (Gemini may extract short evidence), and writes the private Sheet. Qualified discovered opportunities trigger an owner-only Telegram review. **Approval creates a draft for manual, permitted submission; it does not authorize Gmail delivery to a discovered prospect.** Only `source=inbound` plus verified website opt-in can enter `EmailOutbox` and the exact-text Telegram Approve & send flow. Do not set `source=inbound` for a discovered lead, manufacture `consent_at`, or change `EMAIL_TEST_MODE` through the producer.

The Telegram `/stats` command reports CRM states, but automatic Gmail reply matching, positive-reply classification, 3-hour executive digests and auto-outreach for discovered prospects are **not implemented**. Until reply monitoring exists, a founder checks Gmail and updates `REPLIED`/`DISCOVERY` manually. The external producer must report discovery evidence, not claim a reply or a send.

Current `packages/core/scoring.ts` and the Gemini evidence schema recognize software-development terms. A `digital-marketing`/`Signal & Slate` tag is accepted as metadata, but **discovered marketing opportunities do not yet have a marketing-specific scoring rubric**. Add and test that rubric before using a numerical threshold to suppress or notify marketing opportunities; preserve raw evidence meanwhile.

### Existing canonical `LeadInput` fields

`inputSchema` is strict: unknown keys are rejected. Defaults are listed below, but send explicit values where possible. Do not send a score, approval, outbox state or model verdict; the LeadFlow engine owns those.

| Field | Type and validation | Producer rule |
|---|---|---|
| `source` | Current enum: `manual`, `csv`, `gmail`, `hn`, `inbound` | Official HN records use `hn`; other provider values need a deliberate schema/adapter change. Never use `inbound` for discovery. |
| `source_external_id` | String, max 160, default `""` | Stable immutable ID from source. For HN use decimal item ID as a string. |
| `source_url` | HTTPS URL without credentials, max 2,000, default `""` | Canonical original listing URL, e.g. `https://news.ycombinator.com/item?id=...`. Avoid tracking links. |
| `discovered_at`, `posted_at` | Optional ISO 8601 UTC date-time | Distinguish capture from original publication. Never infer a posting time. |
| `title` | Trimmed string, 5–200 chars | Source-grounded title. |
| `raw_description` | Trimmed string, 20–12,000 chars | Plain text of the permitted source listing, not AI-generated claims; strip markup/scripts and embedded secrets. |
| `vertical`, `brand` | Optional matched pair | `web-app-dev` + `LeadFlow AI`, or `digital-marketing` + `Signal & Slate`; omit both if uncertain. |
| `client_name_if_public` | String, max 120, default `""` | Only an appropriate source-stated business/client name; never infer a person's identity. |
| `country_or_region` | String, max 100, default `""` | Source-stated geography only. |
| `stated_budget_min`, `stated_budget_max` | Number 0–1e9 or `null`, default `null`; min ≤ max | Source-stated amount only. Do not convert currency or estimate a missing budget. |
| `currency` | `INR`, `USD`, `EUR`, `GBP`, `UNKNOWN`; default `UNKNOWN` | Required non-`UNKNOWN` when either budget amount is present. |
| `contact_channel` | String, max 100, default `Not verified` | Source-stated permitted route or `Review posting instructions manually`. |
| `contact_permission_state` | `UNKNOWN`, `PLATFORM_ONLY`, `EXPLICIT_OPT_IN`, `BLOCKED`; default `UNKNOWN` | Use `UNKNOWN` unless explicit, recorded purpose/channel evidence is independently reviewed. Public email/phone does not create opt-in. |
| `contact_email` | Email max 160 or `""`, default `""` | Usually `""` for discovery. Do not extract an address merely to enable automated mail. |
| `consent_at`, `consent_version` | Optional ISO UTC / string max 40 | Reserved for genuine opt-in evidence. Discovery normally omits/uses empty values. |
| `owner_notes` | String, max 2,000, default `""` | Compact provenance, source method, caveats; no credentials or unnecessary personal data. |

Example **canonical HN job lead** for the engine (synthetic; IDs/text are illustrative):

```json
{
  "source": "hn",
  "source_external_id": "12345678",
  "source_url": "https://news.ycombinator.com/item?id=12345678",
  "discovered_at": "2026-11-15T10:00:00.000Z",
  "posted_at": "2026-11-15T09:45:00.000Z",
  "title": "Hiring a developer for a customer portal",
  "raw_description": "We are hiring a contractor to build a React customer portal and integrate our existing API. Please review the original job post for application instructions.",
  "vertical": "web-app-dev",
  "brand": "LeadFlow AI",
  "client_name_if_public": "",
  "country_or_region": "",
  "stated_budget_min": null,
  "stated_budget_max": null,
  "currency": "UNKNOWN",
  "contact_channel": "Review original HN job post manually",
  "contact_permission_state": "UNKNOWN",
  "contact_email": "",
  "owner_notes": "Official HN Firebase API; verify listing availability and permitted application route."
}
```

### Current ways to hand a lead over

1. **Already supported HN:** enable the existing `HN_ENABLED` source job after owner review. It polls `https://hacker-news.firebaseio.com/v0/jobstories.json`, fetches up to `BATCH_SIZE` item details, ignores deleted/dead/non-job items and deduplicates. Avoid a second poller for the same HN jobs unless its added value is clear.
2. **Temporary human-reviewed import:** write a bounded batch into private `ManualInbox` and run the Sheet menu's `importManualInbox`. Its columns are in `apps/automation/sheets.ts`. This import converts rows to `source=csv` and does **not** retain `vertical`/`brand`; use it for review, not for a production autonomous feed. Do not write directly to generated `Leads` or `record_json` columns.
3. **Existing approved-alert email path:** the Gmail source reads only the configured `GMAIL_LABEL`; it is intended for owner-received provider alerts. It is not a general external webhook and its parser does not accept arbitrary JSON email payloads.

## Proposed authenticated discovery ingress (to implement in this repo)

Use a separate server-side endpoint such as `POST /api/discovered-leads/v1` on Cloudflare. It must have its own `DISCOVERY_INGEST_SECRET`, producer allowlist, bounded JSON schema, per-producer quota, timestamp/nonce/replay check, audit receipts and idempotent per-item response. Route server-to-server to a **new** Apps Script discovery branch or queue that calls `Engine.ingest`; never reuse the public contact path or its HMAC secret. Limit first release to 5 items and 128 KiB per request, with conservative daily limits; tune only after actual usage is measured. Sheets is not a transactional high-volume queue. A 202 response means accepted for processing, not scored, notified or emailed.

Suggested transport envelope **for implementation**, not an accepted current API:

```json
{
  "schema_version": "leadflow.discovery.v1",
  "producer_id": "external-hn-scout",
  "batch_id": "8e2f01fa-b9f7-49dc-bf73-8e61d1974e2d",
  "produced_at": "2026-11-15T10:01:00.000Z",
  "items": [
    {
      "idempotency_key": "hn:12345678",
      "provider": "hacker-news",
      "acquisition_method": "official-api",
      "canonical_lead": {
        "source": "hn",
        "source_external_id": "12345678",
        "source_url": "https://news.ycombinator.com/item?id=12345678",
        "posted_at": "2026-11-15T09:45:00.000Z",
        "title": "Hiring a developer for a customer portal",
        "raw_description": "We are hiring a contractor to build a React customer portal and integrate our existing API. Please review the original job post for application instructions.",
        "vertical": "web-app-dev",
        "brand": "LeadFlow AI",
        "stated_budget_min": null,
        "stated_budget_max": null,
        "currency": "UNKNOWN",
        "contact_channel": "Review original HN job post manually",
        "contact_permission_state": "UNKNOWN"
      },
      "provenance": {
        "provider_record_id": "12345678",
        "listing_url": "https://news.ycombinator.com/item?id=12345678",
        "fetched_at": "2026-11-15T10:00:30.000Z",
        "source_published_at": "2026-11-15T09:45:00.000Z",
        "rights_review": "official-public-api; owner must verify contact route",
        "permission_evidence_url": null
      }
    }
  ]
}
```

Proposed response: `{"batch_id":"...","results":[{"idempotency_key":"hn:12345678","state":"accepted","lead_id":"lf_..."}]}`. Per-item states: `accepted`, `duplicate`, `rejected` with a stable safe error code; a retry with the same key and identical payload returns the original result. `lead_id` may be absent until asynchronous processing completes. Do not log source text, email addresses or secrets in general application logs. Only submit HTTPS requests.

**Proposed v1 signing protocol (not implemented):** send `Content-Type: application/json`, `X-LF-Producer: <producer_id>`, `X-LF-Timestamp: <Unix epoch seconds>`, `X-LF-Nonce: <random UUID>` and `X-LF-Signature: v1=<lowercase hex HMAC-SHA256>`. The signed UTF-8 message is `producer_id + "\n" + timestamp + "\n" + nonce + "\n" + lowercase_hex(SHA256(exact_raw_request_body))`. Use the decoded 32-byte `DISCOVERY_INGEST_SECRET` as the HMAC key (store it as base64 in secret storage). Receiver checks a five-minute timestamp window, retains nonces at least ten minutes, compares signatures in constant time and rejects a reused nonce. Reuse the same `batch_id`/item `idempotency_key` with an unchanged body on retry, but generate a new request nonce/timestamp/signature. This is a specification for the receiver and producer to implement together; the current backend does **not** accept these headers.

### Configuration handoff for the other AI

| Variable | Where | Value / purpose |
|---|---|---|
| `LEADFLOW_DISCOVERY_URL` | Producer secret/config, **future** | New discovery endpoint URL once deployed. The current `/api/contact` and Apps Script URL are not substitutes. |
| `LEADFLOW_DISCOVERY_PRODUCER_ID` | Producer config, **future** | Stable identifier, e.g. `external-hn-scout`, for allowlist and audit. |
| `LEADFLOW_DISCOVERY_HMAC_SECRET` | Separate secret in producer and receiver, **future** | Base64 encoding of 32 random bytes; never use `INTAKE_HMAC_SECRET`. Store a key ID during rotation. |
| `LEADFLOW_SCHEMA_VERSION` | Producer config | `leadflow.discovery.v1`; fail closed on unsupported version. |
| `HN_API_BASE_URL` | Producer config | `https://hacker-news.firebaseio.com/v0`; no HN API key for the official public API. |
| `HN_SOURCE_FEEDS` | Producer config | Choose `jobstories` first; `askstories`/`newstories` need additional intent filtering and manual contact review. |
| `SOURCE_POLL_MINUTES`, `SOURCE_BATCH_SIZE`, `SOURCE_MAX_AGE_DAYS` | Producer config | Start 60 minutes, max 5 per delivery, 30-day age; use bounded cursors and backoff. Existing Apps Script defaults: `SOURCE_INTERVAL_MINUTES=60`, `BATCH_SIZE=5`, `MAX_AGE_DAYS=30`. |
| `SOURCE_USER_AGENT`, `SOURCE_TIMEOUT_MS` | Producer config | Identify the producer where a provider allows it; use finite timeouts. |
| `GOOGLE_MAPS_API_KEY` | **Do not configure for prospect export** | Places API requires a billing-linked project and its normal content license does not permit copying Places listings into this CRM/lead list. A separately reviewed, allowed Maps feature would need its own key and approved budget. |

**Do not share** the existing `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`, `GMAIL_SENDER_EMAIL`/OAuth, `SHEET_ID`, Turnstile secret or `INTAKE_HMAC_SECRET` with the discovery producer. LeadFlow's backend owns scoring, CRM writes, Telegram and any permitted email. Do not hard-code any secret in Git or a `VITE_` browser variable.

### Places and HN boundaries

The official HN API is an appropriate technical discovery source for public job items, but an HN listing is not email opt-in; HN also disallows automated/generative posting. Preserve item ID and original link, filter hiring intent, and keep submission manual.

Google's current Places API policy and Maps Platform terms restrict prefetching, indexing, storing or exporting Maps/Places content outside the service, including saved business names/addresses. The standard API also requires a billing-linked project. **Do not build a Places-to-Sheets prospect database or auto-email list from Google Places** under this plan. A place ID has a caching exception, but that does not authorize lead-list or outreach use. If a specific Places use is later approved by the provider and owner, review its license, field mask, retention, attribution and cost separately before coding it. Use independently licensed/opt-in business directories, original job posts, your own website enquiries and owner-received alerts for this pipeline instead.

## Acceptance checks for a future connector

1. Synthetic HN item passes schema; same item twice is one Sheet lead and reports `duplicate` the second time. Changed payload with the same idempotency key is rejected.
2. Wrong secret, old timestamp, reused nonce, oversize batch, unknown source, malformed URL and `source=inbound` are rejected with no CRM write.
3. Missing budget remains `null`/`UNKNOWN`; no invented email, consent, price, company or score is accepted.
4. Candidate is scored by the current engine; qualified discovery creates an owner Telegram **draft-only** alert. Reject/defer/approve paths work independently per lead. No Gmail send occurs.
   Marketing-tagged candidates require a separate marketing-fit scorer before their scores are used for routing.
5. API failures back off and resume from a stored cursor; logs and SourceRuns use redacted errors and bounded counts.
6. A later reply-monitoring feature must match incoming Gmail thread/message IDs to a prior *permitted* send, classify positive/negative/unclear with evidence and owner review, then update CRM and Telegram. It is a separate feature and not part of discovery ingestion.

Sources reviewed: [official HN API](https://github.com/HackerNews/API), [HN Guidelines](https://news.ycombinator.com/newsguidelines.html), [Places API setup](https://developers.google.com/maps/documentation/places/web-service/get-api-key), [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies), [current Maps Platform terms](https://cloud.google.com/maps-platform/terms).
