# Connect the live V3 workflow

The website accepts consented enquiries through a Cloudflare Pages Function. It verifies Turnstile, then signs a request to Apps Script. Apps Script saves the enquiry immediately; its bounded scheduler qualifies it, prepares a reply, asks the owner through Telegram, and sends that exact email through Gmail only after approval.

Public /demo remains a local simulation. Discovery feeds, manual CSV imports and selected-label Gmail opportunities use the original draft-only workflow.

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

Create a versioned Web app deployment executing as the owner and allowing anonymous requests. The endpoint itself rejects unsigned/expired/invalid POSTs. It exposes only a generic health response to GET. Copy the /exec URL to Cloudflare's APPS_SCRIPT_URL. After code changes update the same deployment to the new version.

## Telegram

Use verified @BotFather → /newbot; open the resulting bot privately and send /start. Store its token in Script Properties. Read getUpdates using a local secret-aware client, and use the exact private chat/user IDs. No group approvals or third-party identity bots are needed. Disable any old webhook before enabling polling.

The venture bot is @LeadsFlowwBot. `connectTelegramOwner` links exactly one recent private /start sender, refuses to replace a different existing owner, and enables Telegram. Run `tick` once to verify the response; the installed trigger subsequently checks commands and approvals about every 10 minutes. BotFather creation alone does not run a responder.

Approval messages show recipient, subject, full body, score and drafting method. **Approve & send email** authorizes that exact text. Defer and Reject never send. Discovered opportunity alerts instead say **Draft proposal** and never email a prospect.

## Gemini

Create an API key in Google AI Studio using the venture account and a project with no billing enabled. Confirm the model's current free eligibility in AI Studio. Do not assume every model has a free tier. The application has a daily call cap and falls back to deterministic rules when unavailable or when evidence/schema checks fail.

Verified 14 November 2026: venture project `gen-lang-client-0249682189` shows Free tier, with no billing configured. `gemini-3.5-flash-lite` passed real qualification and draft-plan requests. The draft response schema constrains quotations to excerpts taken directly from the enquiry. Recheck model availability and [free-tier pricing](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite) before changing models.

Free API content may be used for product improvement and human review under Google's terms. The live privacy notice and consent explain AI processing. Only the project requirements needed for qualification/planning are sent; email address is not included in the drafting call. Do not submit confidential/sensitive information.

## Cloudflare and scheduling

Follow DEPLOY_CLOUDFLARE.md. Complete LIVE_SMOKE_TEST.md with only the venture email. The 10-minute trigger is installed while EMAIL_TEST_MODE=true; set EMAIL_TEST_MODE=false only after the full smoke passes. Processing is approximate, not instantaneous: enquiry processing and approval delivery each wait for a scheduler poll. Keep daily run/email/Gemini caps. No paid service or domain is required.

SourceRuns automatically rolls into timestamped archive tabs after 4,000 rows, preserving every row. The new active log starts with the same schema. Include these archive tabs in normal retention and spreadsheet-capacity reviews. Other operational tables retain the 5,000-record guard.

Stop automated delivery with GMAIL_SEND_ENABLED=false. Stop all live integration calls with DRY_RUN=true and remove the tick trigger. For compromised credentials, rotate them at the provider and update Script Properties/Cloudflare secrets.

