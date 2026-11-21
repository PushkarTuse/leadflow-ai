# LeadFlow launch checklist

## OSM local-business pipeline and outreach drafts — 22 November 2026

| Area | Status | Evidence / remaining |
|---|---|---|
| OSM in daily cron (`DAILY_OSM`) | Implemented upstream; local cron verified | `wrangler dev --test-scheduled` stored 182 Pune rows; parser test added; 41 upstream tests pass. Worker **not deployed** (placeholder D1 id) |
| Overpass 406 / overload | Fixed (UA) and mitigated (mirror fallback) | Placeholder UA rejected with 406; three mirrors tried in turn. Public servers still intermittently return 502/504 |
| OSM contactability | Measured | 7/182 public email, 28/182 phone. Most rows need contact research before outreach |
| Local-business email draft module | Implemented and unit tested | `packages/core/local-business-email.ts`; 7 angles; Google/closed/good-site refusal; Gmail-style HTML + animated logo; 183 tests pass |
| Animated signature logo | Generated | `apps/web/public/email/leadflow-logo-animated.gif`; Outlook desktop shows first frame only |
| Opt-out footer | Removed on owner instruction | Revisit before any bulk sending |
| Sample sends | 3 sent with explicit owner approval | Gmail connector, owner's personal Gmail → owner test address; not via EmailOutbox |
| Gmail "Redirect Notice" on link click | Open; not fixable in email content | Caused on Gmail's side (free `pages.dev` domain, no sender history). Needs owner-approved custom domain |
| Sheet/Gmail-draft wiring for local-business drafts | Not built | Drafts are preview-only (`npm run local:drafts`) |
| Lockfile | Broken (pre-existing) | `npm ci` fails: lockfile out of sync; regenerate with `npm install` and review the diff |
| Commit / push | Not done | Both repos have uncommitted changes |

## Current discovery qualification — 19 November 2026

| Area | Status | Evidence / remaining |
|---|---|---|
| Stages A–F: evidence, gates, scoring, persistence/routing and dashboard | Implemented locally | Current `npm test`: 173 passed; `npm run typecheck` passed; `npm run build:automation` passed locally; full `npm run build` passed. Dashboard distinguishes eligible, low, rejected, incomplete, quarantined and needs-requalification |
| Stage D provider handoff | Gemini exercised locally; OpenAI-compatible adapter covered by mocked tests | Validated signals from the selected provider reach Stage C; deterministic hard exclusions remain authoritative. Provider errors fall back to rules. No live OpenAI-compatible request has been verified |
| Stage G: shadow/enforce | Implemented and tested locally; default `shadow` | Enforce routes only eligible MEDIUM/HIGH records with confidence >=0.85. Local Apps Script bundle built but **not redeployed**; live Script Properties/runtime are unverified |
| Stage H documentation | Updated locally | Documentation records local behavior/evidence and clearly separates it from production deployment |
| Local qualification snapshot | Verified 19 November, before provider fallback work | Upstream D1: 85 records (67 HN, 18 Arbeitnow). Dashboard state: 15 HN records (10 Gemini, 5 rules fallback); 15 rejected, 0 eligible |
| Production rollout | Not verified | Stage G/H have not been pushed/deployed to Apps Script; the local leadflow-leads API is not yet hosted at a reachable HTTPS origin. Inbound website enquiries remain unchanged |
| Separate local-business manual queue | Implemented and locally tested | New `Local Businesses` tab, manual sync and selected-row status/note push; no `Engine`, approval or notification path. Upstream CSV/Sheet exports exclude Google Places. Foursquare/HERE remain disabled stubs. Requires `setup()` schema v3 and reachable HTTPS API; not deployed |

The importer requests the configured source newest-first; the current source is `hackernews`. HN “Who is hiring?” context, missing-title body evidence and seller-availability patterns strengthen job/seller rejection. Duplicate records are reused unless explicitly requalified. These results are a bounded local snapshot, not a guarantee that every future/non-classic job post is classified perfectly.

| External one-shot trigger | Status | Remaining |
|---|---|---|
| `npm run external:run` | Two shadow-mode pages imported 10 new HN records; subsequent `--requalify-all` rescored all 15 stored records with zero alerts | Per-run batch is capped at five. Telegram and owner email testing were disabled during verification |

| External API integration (16 November) | Status | Next |
|---|---|---|
| Bounded pull adapter and HN evidence mapping | Implemented locally; importer filters the configured single source and sorts newest-first | Current config is HN-only. Do not route Arbeitnow job-board records through the legacy scorer |
| Local external API refresh | Verified 19 November | 85 D1 rows: 67 HN and 18 Arbeitnow; this repository imports HN discovery only |
| Local qualification and dashboard state | Verified 19 November | 15 evaluated HN records; 15 rejected (10 employment/full-time, 2 employment-contract, 2 seller self-promotion, 1 stale/closed); 0 eligible/incomplete |
| Automation bundle | Built locally | `npm run build:automation` passed; **not deployed** to Apps Script |

## P0.1 — Blueprint studio revision (15 November 2026)

| Work | Status | Evidence / remaining |
|---|---|---|
| Ink/platinum/jade studio, services, work and packages | Implemented and browser tested | Distinct identity; local typography/artwork; bounded ₹5,999 / ₹18,999 / ₹44,999+ offers |
| Four-stage procedural scroll journey | Browser tested | Blueprint → web/mobile/spatial → shield → finished interface; GSAP/spline/parallax; no remote models |
| Accessibility and performance fallbacks | Browser tested | Route axe/overflow, keyboard, mobile/reduced-motion, pause, WebGL loss/retry and deferred scene loading |
| Existing property demo and contact | Regression tested | Guided/free-form demo, consent, retry ID and package preselection retained |
| Web/App intake segmentation | Integration tested; Apps Script v6 deployed | Matched signed web-app-dev/LeadFlow AI; trusted origin, CRM JSON and owner notes; old requests valid |
| Automated verification | Passed | Strict build; 75 unit/integration; 15 studio + 2 contact + 8 marketing browser passes; 3 mobile-only WebGL cases skipped; audit zero vulnerabilities |
| Release and Notion P0.1 notes | Verified | Cloudflare 0cf14a89 + compatible Apps Script v6; six routes/assets/health 200, malformed intake 400; live package preselection; Notion notes persisted after reload |
| Physical-device frame rate, approved Bageera proof | Remaining | No physical iOS/60fps certification or fabricated testimonials |
| Mobile 3D asset/scene loading and sharpness | Sharper release deployed; local and public checks pass | Both sites auto-load compact 3D on touch/low-core devices at up to DPR 2 with antialiasing and full-opacity canvas; 8 local + 8 live iPhone/Android Chromium checks pass. Physical Safari/Android performance confirmation remains open |
| iPhone Reduce Motion explanation | Deployed; live WebKit verified | Owner confirmed the iPhone still view was caused by iOS Reduce Motion; 3D worked after disabling it. Both sites now present a prominent explanation and explicit override when that preference or Data Saver is on; 4/4 live iPhone WebKit checks pass |
| External discovery producer contract | Documented; ingress not implemented | `docs/EXTERNAL_LEAD_INGESTION_CONTRACT.md` has exact input fields, JSON, variables, permission boundary and proposed signed endpoint. HN API poller exists; Google Places prospect export is excluded under standard terms |
| Azure migration and domains | Separate roadmap work | Free Cloudflare retained; no purchases |

Design and scope: `docs/STUDIO_BLUEPRINT.md`. Older sections below are historical snapshots.

Current public studio: https://leadflow-agency.pages.dev (release https://0cf14a89.leadflow-agency.pages.dev). Screenshot: `outputs/screenshots/studio-blueprint-live.png`. P0.1 remains In Progress for founder portfolio/release review. This revision did not run a new live Gmail send or change secrets, test mode, triggers or the owner approval gate.

Updated 14 November 2026, Asia/Kolkata. V3 authorizes live website intake and Gmail replies after explicit owner approval. Discovered opportunities remain draft-only/manual submission.

| Work | Status | Evidence / remaining |
|---|---|---|
| Original brief and six-tab XLSX inspection | Done | Originals preserved; legacy import mapped; original CRM has no entered leads |
| Responsive agency site | Tested | Desktop/mobile routes, forms, accessibility |
| Six-step guided demo | Tested | Completion, back, Escape, keyboard focus, CTA, mobile accessibility |
| Cloudflare intake + Turnstile + HMAC | Tested locally | Origin, hostname/action, bounded schema, timestamp/signature, duplicate protection |
| Sheets → qualification/draft → Telegram → approved Gmail | 67 automated tests passed; live smoke in progress | Actual Apps Script bundle completes mocked loop exactly once; real site receipt verified |
| Live contact interface | Tested with mocked provider boundary | Two desktop/mobile tests; retries retain ID; no false receipt |
| Production builds and dependency audit | Passed | npm install/build; zero known vulnerabilities |
| Venture Google account and OAuth | Connected | leadsflowwai@gmail.com; owner approved clasp and script grants |
| CRM Sheet + bound Apps Script | Live | Website smoke receipt lf_aa56b3a2c2e1bd54 persisted in Leads and IntakeReceipts |
| Cloudflare Pages + Turnstile | Live | https://leadflow-agency.pages.dev; actual public form returned a verified receipt |
| Telegram | Connected and tested | @LeadsFlowwBot; private owner /start response verified; command menu registered |
| Gemini | Connected and API-tested | Venture free tier; gemini-3.5-flash-lite; actual qualification and exact-quote draft plan passed |
| Apps Script web deployment + server secrets | Live, version 4 | Signed intake; credentials in Script Properties and Cloudflare secrets; explicit Sheet flush before outbound effects |
| Diagnostic log rollover | Implemented and tested | Archives complete SourceRuns tabs at 4,000 rows; no log deletion; recovery test passed |
| Real public-site smoke test | Waiting for owner approval | Public form → Sheet → Gemini → Telegram passed. First enquiry lf_aa56b3a2c2e1bd54 is REVIEW_PENDING; Gmail Sent is empty. Owner must approve its exact email |
| Live rejection test | Passed | Second enquiry lf_dedbc78879f48cc6 became REJECTED in Leads and EmailOutbox; no email sent |
| Final delivery/replay verification | Remaining after owner approval | Verify Gmail Sent + inbox and persisted message ID, then repeat old approval and confirm one email only |
| Scheduled first-customer operation | Trigger installed; recipient restriction retained | One 10-minute tick trigger verified; EMAIL_TEST_MODE remains true until smoke passes |
| V3 setup and operations documentation | Updated | See SETUP and LIVE_SMOKE_TEST |

No mocked check counts as live verification. No prospect contacted, no domain purchased, no paid service enabled.


## P0.1 storefront revision — 15 November 2026

- Implemented: client-facing home/services, web/mobile/Unity/automation catalogue, central brand/offer config, three bounded starting packages, honest portfolio labels and quote form context.
- Tested: 69 unit/integration tests, 10 desktop/mobile site checks, 2 contact boundary checks; build/typecheck passed. Route accessibility and no-overflow checks pass. Browser contact tests use simulated providers and do not constitute a new live Gmail send.
- Remaining: approved Bageera walkthrough/testimonials; custom domain and Azure migration; Digital Marketing website. Live account configuration must be rechecked before broad outreach; old checklist rows above are historical.

Storefront release verified 15 November 2026: https://leadflow-agency.pages.dev (release https://5b44ef4c.leadflow-agency.pages.dev). Revised homepage and package-to-contact selection observed live; /, /services, /contact and /demo returned HTTP 200. Malformed contact payload rejected with HTTP 400. P0.1 Notion progress and release note saved and reloaded. This revision did not send a new live email.

## P0.2 — Signal & Slate priority build (15 November 2026)

| Work | Status | Evidence / remaining |
|---|---|---|
| Standalone apps/marketing storefront | Implemented | React 19, dark slate/gold theme, four services, three monthly plans, audit CTA |
| Procedural camera journey | Browser tested | Dial/noise → lenses/signals → telemetry bars → focal frame; lazy R3F/Drei/GSAP |
| Accessibility and fallback | Browser tested | Mobile/reduced motion, pause, WebGL context loss, no-overflow and axe route checks |
| Marketing intake metadata | 73 unit/integration tests passed | Signed brand/vertical and trusted origin, compiled GAS persistence, existing intake compatibility |
| Branded approval draft | Implemented and mocked-runtime tested | Signal & Slate subject/signature; owner approval required |
| CPL/ROAS and Bageera proof | Implemented honestly | Illustrative calculator; Bageera strategy concept, no fabricated results |
| Live marketing origin, deployment and intake | Remaining | Choose host/origin, deploy compatible backend, configure widget/server secrets, owner smoke test |
| Verified Bageera marketing results | Remaining | Founder-approved campaign evidence required |

Setup and verification boundaries: docs/SIGNAL_AND_SLATE.md. No paid service or live account setting changed.

Cloudflare release — 15 November 2026: Signal & Slate is public at https://signal-and-slate.pages.dev (deployment https://9c4fbda2.signal-and-slate.pages.dev). Separate free Pages project; assets and Functions uploaded. Live HTML, JS, CSS and favicon returned 200. Intake remains explicitly in local-brief mode until its Turnstile/server secrets and compatible Apps Script deployment are activated. /api/contact correctly returns 503 while unconfigured.
