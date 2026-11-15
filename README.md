# LeadFlow AI

Live website: https://leadflow-agency.pages.dev · Owner bot: https://t.me/LeadsFlowwBot

```powershell
cd D:\freelance_personal\leadflow-ai
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. Node 22.18+ or 24 is recommended. With VITE_INTAKE_ENABLED=false the app works without credentials. Live configuration and verified deployment status are tracked in [CHECKLIST.md](CHECKLIST.md).

## What works now

The development studio now has an ink/jade/platinum design and procedural blueprint-to-product 3D journey, with reduced-motion/mobile fallback. See [Studio design, offers and verification](docs/STUDIO_BLUEPRINT.md). The owner’s latest introductory scopes supersede the earlier pricing experiment; live publication status is recorded in CHECKLIST.md.

Mobile 3D now loads automatically with a compact object budget and sharp up-to-2× pixel rendering on both storefronts. Reduced-motion and Save-Data still show an optional still view, with a visible explanation and “View 3D anyway” override. Run `npm run test:mobile` for iPhone/Android Chromium coverage of automatic loading, pixel density, canvas bounds, scroll, rotation and recovery; set `SCENE_TEST_WEBKIT=true` to include iPhone WebKit, and `SCENE_LIVE=true` to run read-only checks against the public sites. See [verification](docs/VERIFICATION.md) for engine/device limits and [external lead-source contract](docs/EXTERNAL_LEAD_INGESTION_CONTRACT.md) for the other AI's data handoff.

- Responsive agency website: home, services, property demo, contact, privacy and terms.
- Interactive enquiry → structured summary → score breakdown → mock CRM → owner alert → reviewed response simulation. No data leaves the demo.
- Private local Opportunity Hunter: manual JSON and CSV import, scoring, deduplication, permission checks, owner decisions, proposal drafts, audit and CSV export.
- Apps Script bundle implementing Sheets, selected-label Gmail, optional HN, Gemini extraction with strict evidence validation and deterministic fallback, and private Telegram approval polling.
- Protected website intake, Gemini-assisted draft planning, persistent email review queue and Gmail delivery after explicit Telegram owner approval. Discovered opportunities still require manual submission.
- Six-step guided demo with keyboard controls, mobile layouts and a direct enquiry CTA.

## Signal & Slate — Digital Marketing storefront

`apps/marketing` is a separate React 19 app with a procedural R3F/GSAP scroll journey, still/mobile fallback, pricing and growth-audit form. Run `npm run dev:marketing` (port 5175), `npm run build:marketing`, or `npm run preview:marketing`. The root production build now includes both storefronts. Marketing delivery uses its own public configuration flags and remains explicitly local until its origin, Turnstile and compatible backend are activated. See [Signal & Slate setup](docs/SIGNAL_AND_SLATE.md).

## Five-minute walkthrough

1. Open `/demo`, choose **Find a home**, change the budget or question and click **Run the enquiry**.
2. Inspect the score and CRM entry. Click **Approve draft** to reveal a sample response. Nothing is sent.
3. Choose **Sell a property**. Its consent is off: the generated draft has an explicit follow-up block.
4. Run `npm run dry-run`. This processes 15 synthetic rows: 12 unique leads, one duplicate and two invalid rows. It archives three suspicious/stale/job-seeker leads, approves one sample and creates one draft. A second ingestion verifies deduplication.
5. Inspect `outputs/dry-run/leads.csv`, `audit.json`, `owner-alert.json` and `proposal.txt`. These are local synthetic outputs, not a live Sheet or Telegram delivery.

## Private local commands

```powershell
npm run hunter -- import fixtures/sample-leads.csv
npm run hunter -- list
npm run hunter -- approve <lead_id> --owner-confirmed
npm run hunter -- review <lead_id> --owner-confirmed
npm run hunter -- reject <lead_id> --owner-confirmed
npm run hunter -- export outputs/my-leads.csv
```

Use the actual `lf_...` ID from `list` instead of `<lead_id>`. Approvals create ready-to-copy drafts; they never submit proposals. The CLI is private by local filesystem access, not a web login. State is kept in ignored `data/hunter.json`. Run one CLI process at a time. `npm run hunter -- help` lists permission, manual-contact and deletion operations. Never put real source files in tracked directories.

## Integration status

| Area | Local implementation | Live prerequisite |
|---|---|---|
| Public website & guided demo | Working and tested | Live on leadflow-agency.pages.dev |
| Private engine & CSV | Working and tested | None |
| Google Sheets CRM | Adapter + versioned setup + migration + menu | Connected; real public enquiries verified |
| Gmail alerts | Selected-label, message-level read-only ingestion | Explicit label and Gmail API permission |
| Telegram | Owner/user/chat/message/nonce/expiry checks; commands; persisted cursor | Connected; real alerts and Reject verified |
| Gemini | Evidence extraction, schema validation and fallback | Connected on verified free tier; qualification and drafting verified |
| Public enquiry delivery | Turnstile + signed Pages Function + Apps Script | Live; real receipts and CRM rows verified |
| Approved enquiry email | Exact recipient/body approval + persistent outbox | Venture Gmail authorized; first live send awaits owner approval; test-recipient restriction retained |
| Scheduling | Configurable Cal.com link | Owner-verified booking URL; optional |

When VITE_INTAKE_ENABLED=true, /contact submits to the same-origin /api/contact endpoint and confirms only a verified Apps Script receipt. When false, it offers an explicitly local, unsent brief. Demo inputs never leave the browser. Secrets stay in Cloudflare server settings and Apps Script Properties. Live test steps are in [LIVE_SMOKE_TEST.md](docs/LIVE_SMOKE_TEST.md).

## Validation commands

```powershell
npm run build
npm test
npm run dry-run
npx playwright install chromium
npm run test:e2e
npm audit
```

`npm run build` type-checks the strict TypeScript project, builds the website into `apps/web/dist`, and bundles the same core into `apps/automation/dist/Code.gs`. The Apps Script tests use mocked Google services; only account-based tests can establish live provider behavior. Playwright runs desktop and iPhone-size Chromium checks; it is not physical iOS Safari verification.

## Setup and operating guides

- [Running checklist](CHECKLIST.md) — implemented, tested, blocked and remaining.
- [Verification record](docs/VERIFICATION.md) — automated checks, actual live integration evidence and remaining verification limits.
- [Integration setup](docs/SETUP.md) — Sheets, Apps Script, Telegram, Gmail, Gemini and revocation steps.
- [Architecture](docs/ARCHITECTURE.md) and [data model & workbook mapping](docs/DATA_MODEL.md).
- [Cloudflare deployment](docs/DEPLOY_CLOUDFLARE.md) — local build ready; publication requires authorization.
- [Operations runbook](docs/OPERATIONS_RUNBOOK.md) — phone routine, failures, renewal, privacy deletion.
- [Security & compliance](docs/SECURITY_AND_COMPLIANCE.md) and [costs, limits & checked sources](docs/COSTS_AND_LIMITS.md).
- [Product brief & demo case study](docs/PRODUCT_BRIEF.md).
- [14-day plan, questionnaire & sales drafts](docs/GO_TO_MARKET.md).

The original master prompt and XLSX in the parent folder remain unchanged. The code is contained entirely in `leadflow-ai`. No GitHub repository, account, domain or paid service has been created.
