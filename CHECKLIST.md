# LeadFlow launch checklist

| Strict freelance qualification | Status | Next |
|---|---|---|
| Eight-stage eligibility/evidence/scoring design | Specification complete; not implemented | Follow docs/FREELANCE_LEAD_QUALIFICATION_SPEC.md stages A–H; shadow evaluation before enforcement; preserve inbound email and prior decisions |

| External one-shot trigger | Status | Remaining |
|---|---|---|
| `npm run external:run` and local config switch | Real provider check passed: five HN leads, three Gemini + two rules, two pending and two owner Telegram preview receipts | Hosted interactive approvals require HTTPS/CRM activation; production stays off, Gmail absent from local runner |

| External API integration (16 November) | Status | Next |
|---|---|---|
| Bounded pull adapter, HN original-evidence mapping, scheduled Engine path | Implemented, disabled by default; 16 focused tests pass | Local external API setup, then reachable HTTPS hosting/configuration and live ingestion verification; see HANDOFF_EXTERNAL_LEAD_INTEGRATION.md |
| Local external API + real HN validation | Completed 16 November | Five HN records in local API/D1; five mapped, zero invalid, replay five duplicates; three in-memory draft-review candidates. Future HTTPS deployment/production activation deferred |
| Local token + integrated approval dry run | Completed 16 November | dev-token authentication verified after restart; 5 HN + 5 Arbeitnow in local SQLite; three review payloads and approve/defer/reject callbacks exercised internally; 16 focused tests pass; no provider sends |

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
