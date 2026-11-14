# Security, permissions and commercial-launch responsibilities

This MVP is owner-operated. It has tested guardrails but is not a certified CRM or multi-tenant security boundary.

## Technical controls

- Public site has no private admin route. Its contact Function validates exact origin, bounded JSON, honeypot, Turnstile hostname/action and explicit consent before signing a short-lived HMAC request to Apps Script. Script POST validates signature/schema/timestamp and deduplicates submission IDs. Invalid requests cannot read CRM data. Demo inputs remain only in browser memory.
- Gemini key, bot token, Sheet ID and owner IDs stay in Apps Script Properties. They must never use a public `VITE_` prefix. Local `.env`, generated outputs and private state are gitignored.
- Telegram authorization checks the exact owner user ID **and** private chat ID, chat type, original message ID, random request nonce, expiration, pending lead status and unused request. Replay or unknown callers cannot transition a lead. Bots can still receive unwanted updates; quotas bound processing.
- Website enquiries create a draft before owner review. Email approval binds the owner, chat, message, nonce, expiry and cryptographic hash of recipient/subject/body. Gmail delivery requires explicit inbound consent and exact approved content; ambiguous dispatch becomes UNCERTAIN and never automatically retries. A saved Gmail message ID supports reconciliation. Discovery proposals remain draft-only; there is no platform-message, bid, SMS or voice sender. CONTACTED_MANUALLY requires verified permission and owner confirmation.
- Inputs and model outputs use strict schemas, lengths and allowed enums. Score is code-owned and bounded. AI evidence must occur in the listing; extra fields are rejected. Suspicious embedded instructions are quarantined using a heuristic. That heuristic is not a complete prompt-injection detector: safety also depends on no model tools, no secrets in prompts, strict outputs and human review.
- Sheets/CSV values that could execute as spreadsheet formulas are escaped. HTTPS source links are validated and never crawled. HTML is rendered as React text, not injected HTML.
- Apps Script uses a script lock, persisted cursor, bounded batches and execution/daily budgets. Read retries are finite. Network errors do not print tokens or raw provider responses.
- CSV import is capped at 2 MB / 500 rows. Engine tables have 5,000-row read guards. There is no promise of multi-user transactional behavior. Restrict Sheet/script editors; editors can bypass app controls or read stored secrets.

## Data permissions

Use the dedicated venture account. Gmail OAuth includes read and send; optional discovery reads remain selected-label only, while outbound sends are restricted to approved consented website enquiries. Label selection is a software boundary, not a label-scoped Google permission. Never enable ingestion on an employer account. Keep EMAIL_TEST_MODE=true until the owner-email smoke test passes.

Gemini free-tier data use must be reviewed before activation. The code sends limited listing text only; free text can still contain names or emails. Remove sensitive material before labeling/importing it or keep Gemini disabled. Publishing a form requires a verified identity/contact channel, a suitable privacy notice, a stated purpose and retention/deletion operations.

## Source policy boundaries

- Upwork: no scraping, browser automation, automatic bids or platform messaging. Only owner-received notification data/manual input is parsed. Listing availability and permitted submission must be checked manually; this implementation is not an Upwork API authorization. See [Upwork's automation policy](https://support.upwork.com/hc/en-us/articles/43342677368467-Use-bots-and-other-automation-properly).
- HN: the optional source uses the [official Firebase API](https://github.com/HackerNews/API); it does not confer permission to contact people or imply freelance suitability.
- Freelancer: an official API extension is disabled until access and intended-use approval are verified. No fallback scraper.
- LinkedIn and Reddit: no adapters in this MVP. Separate provider review would be required.
- Calls and bulk messages: excluded. Public phone numbers are not proof of consent. Any later voice/SMS feature needs a specific opt-in/legal/provider review; consult [TRAI's UCC guidance](https://www.trai.gov.in/what-spam-or-ucc).

## Launch decisions the owner must make

Review employment/moonlighting/conflict-of-interest terms before commercial activity. Keep employer code, equipment restrictions, credentials, infrastructure, confidential material and clients separate. Approve the business identity, brand availability, public prices, privacy/terms and written client scope. Obtain professional legal/tax advice where needed; the draft website policies are not legal certification.

V3 explicitly authorizes site publication and owner-approved enquiry replies. Current live status is in CHECKLIST.md. No domain purchase or paid tier is authorized. Real smoke tests use only the venture email address.
