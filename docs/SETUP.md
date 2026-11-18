# Connect the live V3 workflow

The website accepts consented enquiries through a Cloudflare Pages Function. It verifies Turnstile, then signs a request to Apps Script. Apps Script saves the enquiry immediately; its bounded scheduler qualifies it, prepares a reply, asks the owner through Telegram, and sends that exact email through Gmail only after approval.

Public /demo remains a local simulation. Discovery records use a separate freelance qualification; rejected, incomplete, low-priority, quarantined and legacy-unqualified records must not notify. Approved discovery proposals remain manually submitted. Inbound enquiry handling is unchanged.

## Freelance discovery qualification (Stages A–G)

The classifier checks permitted source/freshness and source availability, then evaluates buyer vs seller/employer/promotion direction, independent engagement, paid intent and scope. Explicit seller availability, employment/full-time, employee-contract, internship, unpaid/equity, aggregator and promotion evidence is rejected in the documented precedence order. A classic role title with company hiring language is rejected as employment unless the posting clearly requests independent freelance/project work. Ambiguous direction on less explicit/non-classic posts remains a review hold, not an accepted lead.

The live workflow forwards validated discovery-provider `discoverySignals` into Stage C scoring instead of dropping the extraction. Gemini remains supported, and the optional OpenAI-compatible provider is limited to discovery. Exact source evidence is validated, and deterministic hard exclusions remain authoritative. HN “Who is hiring?” thread context, the first non-empty post-body line when `original_title` is missing, and seller-availability patterns strengthen employment and seller rejection. Mixed posts retain the explicit independent-clause handling.

The score bands are HIGH >=85, MEDIUM >=65, LOW >=50; all mandatory gates must pass. Discovery routing also requires `ELIGIBLE`, MEDIUM/HIGH and confidence >=0.85. `FREELANCE_QUALIFICATION_MODE` accepts `shadow` or `enforce` and defaults to `shadow`. Shadow computes and persists qualification/audit but suppresses discovery approval notices; enforce permits only routed candidates. Inbound enquiry email behavior is not controlled by this discovery switch.

The local importer defaults to `EXTERNAL_LEADS_SOURCES=hackernews` and asks the API for that configured single source newest-first (`sort=found_at&order=desc`). Arbeitnow is an employment job board and is not part of the current HN freelance qualification pull. The normal batch is capped at five; run more than once to page through additional records.

## Local discovery commands and safe mode check

Copy `.env.external.example` to ignored `.env.external`. `npm run external:run` requires `EXTERNAL_LEADS_ENABLED=true`; by default it uses shadow mode. It uses duplicate reuse, so an unchanged record is not automatically rescored.

```powershell
# Safe preview: real source reads, isolated data/external-preview.json, no Gemini/Telegram/email.
npm run external:run -- --dry-run

# Revisit the first external page and requalify only stored HN duplicates missing qualification.
npm run external:run -- --requalify-missing

# Force-rescore every locally stored discovery record that has discovery_context.
npm run external:run -- --requalify-all
```

Normal runs reuse duplicates and do not rescore them. Requalification modes always suppress notifications. `--requalify-all` uses saved source context and skips records without it; it does not synthesize qualification for legacy records. `--dry-run` performs bounded source reads, uses `data/external-preview.json`, and disables Gemini as well as notifications; do not use it to test the AI path or compare modes.

To compare shadow and enforce locally without Telegram or owner email, run normal pipeline passes with process-scoped PowerShell settings:

```powershell
$env:EXTERNAL_LEADS_ENABLED = 'true'
$env:EXTERNAL_LEADS_SOURCES = 'hackernews'
$env:TELEGRAM_ENABLED = 'false'
$env:SAFE_OWNER_EMAIL_TEST = 'false'
$env:FREELANCE_QUALIFICATION_MODE = 'shadow'
npm run external:run

$env:FREELANCE_QUALIFICATION_MODE = 'enforce'
npm run external:run
```

In shadow there are no discovery alerts. Enforce can create local preview payloads for qualifying opportunities, but nothing is sent with both sending switches disabled. The mode value is local and does not update Apps Script Script Properties.

Local snapshot verified 19 November 2026: upstream D1 had 85 rows (67 HN, 18 Arbeitnow); `data/external-gemini.json` had 15 evaluated HN records (10 Gemini, 5 rules fallback), all 15 rejected, with 0 eligible. Keep `.env.external` and `data/external-*.json` ignored and untracked.

For a no-message OpenAI-compatible local check, configure `AI_ENABLED=true`, `AI_PROVIDER=openai`, `AI_API_KEY`, an account-enabled `AI_MODEL`, `AI_API_BASE_URL`, and `AI_DATA_USE_APPROVED=true` in the current shell or ignored `.env.external`. Keep `FREELANCE_QUALIFICATION_MODE=shadow`, `TELEGRAM_ENABLED=false`, and `SAFE_OWNER_EMAIL_TEST=false`; do not use `--dry-run`, which disables AI. A successful extraction is attributed as `openai-compatible` and written to `data/external-openai.json`. The dashboard reads whichever non-preview external state file was most recently updated and displays that filename. The provider path is mocked in tests, not verified against a live account.

Gemini is optional; quota, invalid output or missing approval flags fall back to deterministic rules and persist a warning. A successful command does not prove a live Apps Script deployment. The Stage G bundle is local-only and has not been redeployed; production Apps Script behavior is not verified.

## Venture resources created

- Owner/sender: leadsflowwai@gmail.com
- Sheet: https://docs.google.com/spreadsheets/d/1M8xzzMJNbuBvUpdBso_kqmDv7HmAovCSAVLYggk21VM/edit
- Script: https://script.google.com/home/projects/1OYm2k-iT0VUkFolx9EdvtfUXS5Ub7C4JaF-7vIT-2x724HAfx5HH18_U/edit
- Cloudflare project: leadflow-agency. Live production origin: https://leadflow-agency.pages.dev
- Actual launch status is recorded in CHECKLIST.md, not inferred from these identifiers.

The original XLSX remains unchanged. Its Leads CRM import mapping is supported. To reuse its visual tabs, import the original into the existing native Sheet using **Insert new sheet(s)**, never Replace spreadsheet, then run **Import legacy Leads CRM**. It originally contains no entered leads.

## Google

Run npm run build:automation, then npx @google/clasp --user leadflow push. The ignored .clasp.json binds this local project to the venture script. Google authorization uses the venture account, not the unrelated Gmail connector.

Run setup in the script editor. It creates version-2 engine tabs and stores SHEET_ID automatically for a bound Sheet. Existing original tabs are preserved; unrecognized engine headers stop setup instead of overwriting data. Reload the Sheet to attach the LeadFlow menu.

The manifest requests Sheets, Gmail read/send, external HTTP, trigger management and Sheet UI. Gmail reading is independently disabled unless GMAIL_ENABLED=true and GMAIL_LABEL is explicitly set. Sender delivery verifies Gmail's current account matches GMAIL_SENDER_EMAIL.

All settings are strings in **Project Settings → Script Properties**. See apps/automation/settings.example.json for defaults.

| Property | Required value |
|---|---|
| SHEET_ID | Venture Sheet ID |
| PUBLIC_SITE_URL | Exact production HTTPS origin |
| INTAKE_HMAC_SECRET | Same random 32+ character secret as Cloudflare |
| INTAKE_ENABLED, DRY_RUN | true, false for live intake |
| GMAIL_SEND_ENABLED, GMAIL_SENDER_EMAIL | true, venture email |
| EMAIL_TEST_MODE, SMOKE_TEST_EMAIL | true and venture email until live smoke passes |
| TELEGRAM_ENABLED | true after bot/owner IDs verified |
| TELEGRAM_BOT_TOKEN | BotFather secret |
| TELEGRAM_OWNER_USER_ID, TELEGRAM_OWNER_CHAT_ID | Exact numeric IDs from private /start update |
| GEMINI_ENABLED | true after key/free-tier/data-use setup |
| GEMINI_API_KEY, GEMINI_MODEL | Owner key and a currently eligible free model |
| GEMINI_FREE_TIER_CONFIRMED, GEMINI_DATA_USE_APPROVED | true only after owner's review |
| FREELANCE_QUALIFICATION_MODE | `shadow` by default; `enforce` only after review. Stage G is not yet deployed to the live Apps Script |

Create a versioned Web app deployment executing as the owner and allowing anonymous requests. The endpoint itself rejects unsigned/expired/invalid POSTs. It exposes only a generic health response to GET. Copy the /exec URL to Cloudflare's APPS_SCRIPT_URL. After code changes update the same deployment to the new version.

## Telegram

Use verified @BotFather → /newbot; open the resulting bot privately and send /start. Store its token in Script Properties. Read getUpdates using a local secret-aware client, and use the exact private chat/user IDs. No group approvals or third-party identity bots are needed. Disable any old webhook before enabling polling.

The venture bot is @LeadsFlowwBot. `connectTelegramOwner` links exactly one recent private /start sender, refuses to replace a different existing owner, and enables Telegram. Run `tick` once to verify the response; the installed trigger subsequently checks commands and approvals about every 10 minutes. BotFather creation alone does not run a responder.

Approval messages show recipient, subject, full body, score and drafting method. **Approve & send email** authorizes that exact text. Defer and Reject never send. Discovered opportunity alerts instead say **Draft proposal** and never email a prospect.

## Gemini

Create an API key in Google AI Studio using the venture account and a project with no billing enabled. Confirm the model's current free eligibility in AI Studio. Do not assume every model has a free tier. The application has a daily call cap and falls back to deterministic rules when unavailable or when evidence/schema checks fail. Safe warning categories distinguish HTTP 429 quota/rate limiting, 400 request/schema, 401/403 access, 404 model/endpoint, 5xx service errors and transport failures without logging response bodies or credentials.

Verified 19 November 2026: the configured `gemini-3.5-flash-lite` appeared in the Gemini model list with `generateContent` support. Local live discovery extraction succeeded for multiple HN records and its validated skills/evidence reached Stage C; intermittent HTTP 503/transport errors still fell back to rules. No HTTP 429 was observed in that bounded run, but quota remains a possible provider limit. Confidence and final scores are computed by core code, not trusted from the model. The draft response schema constrains quotations to excerpts taken directly from the enquiry. Recheck model availability and [free-tier pricing](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite) before changing models.

Free API content may be used for product improvement and human review under Google's terms. The live privacy notice and consent explain AI processing. Only the project requirements needed for qualification/planning are sent; email address is not included in the drafting call. Do not submit confidential/sensitive information.

## Cloudflare and scheduling

Follow DEPLOY_CLOUDFLARE.md. Complete LIVE_SMOKE_TEST.md with only the venture email. The 10-minute trigger is installed while EMAIL_TEST_MODE=true; set EMAIL_TEST_MODE=false only after the full smoke passes. Processing is approximate, not instantaneous: enquiry processing and approval delivery each wait for a scheduler poll. Keep daily run/email/Gemini caps. No paid service or domain is required.

SourceRuns automatically rolls into timestamped archive tabs after 4,000 rows, preserving every row. The new active log starts with the same schema. Include these archive tabs in normal retention and spreadsheet-capacity reviews. Other operational tables retain the 5,000-record guard.

Stop automated delivery with GMAIL_SEND_ENABLED=false. Stop all live integration calls with DRY_RUN=true and remove the tick trigger. For compromised credentials, rotate them at the provider and update Script Properties/Cloudflare secrets.

