# Verification record — 14 November 2026

## Mobile preference release — 16 November 2026

Studio https://b4b0af4e.leadflow-agency.pages.dev and marketing https://d03c5861.signal-and-slate.pages.dev were published to their stable Pages domains. Strict `npm run build` passed. The local mobile suite passed 11/12 on its first run; the one iPhone WebKit failure asserted canvas bounds immediately after a landscape resize, before the resize observer settled. The corrected assertion waits for the canvas to fit, and its targeted rerun passed. Studio e2e passed 14/16 before updating two assertions for the renamed button; both targeted reruns passed. Marketing e2e exposed the new preference notice covering the opened mobile menu; raising the header stacking order fixed it and the targeted iPhone test passed. Marketing desktop WebGL and context-loss checks passed on rerun. After deployment, the **four live iPhone WebKit checks passed** against the stable domains for automatic 3D, scroll/rotation/quality bounds, pause/recovery and Reduce Motion/Data Saver override. These are browser engine checks; the owner separately confirmed a physical iPhone Safari works with Reduce Motion disabled. Sustained hardware frame rate remains unmeasured. No production form or email was sent in this release.

## iPhone preference diagnosis — 15 November 2026

The owner shared a physical iPhone Safari screenshot showing the CSS still composition and “Enable 3D”. They checked iOS Accessibility → Motion → Reduce Motion, found it enabled, disabled it, and confirmed that the live 3D journey works. Separately, the prior public releases passed 4/4 iPhone WebKit browser checks (automatic 3D on normal settings, reduced-motion/Save-Data still view, scroll, rotation and recovery). The screenshot therefore reflected the deliberate preference gate, not a confirmed asset failure. The new preference notice makes that reason and the explicit override visible. This owner report verifies basic functionality on one physical iPhone, not sustained frame rate or other Safari versions.

## Mobile sharpness and source-contract revision — 15 November 2026

User reported that the now-loading mobile scenes looked blurry. Inspection found the prior compact renderer forced DPR 1 and disabled MSAA, while mobile CSS reduced the canvas to 85% opacity. Studio and marketing scenes now clamp drawing resolution to the device ratio up to DPR 2, enable antialiasing, render their one-shot procedural reflection environments at resolution 64 and use full canvas opacity with an edge vignette. Decorative object counts remain compact and rendering still pauses in hidden tabs. Reduced-motion/Save-Data still allow an optional still view. No external 3D assets are fetched.

Root production build/typecheck passed. `npm run test:mobile -- --project=iphone-chromium --project=android-chromium` passed 8/8 locally; the updated assertion checks drawing-buffer width is near `min(devicePixelRatio, 2) × CSS width` through portrait and rotated landscape. Android screenshots before/after were visually inspected: gold/cyan rings and studio grid/wireframe edges are cleaner. Local images: `outputs/screenshots/mobile-{studio,marketing}-{iphone,android}-chromium.png`. These are browser phone profiles, not physical Safari/Android or sustained-FPS measurements.

Published studio release: https://93fe977c.leadflow-agency.pages.dev. Published marketing release: https://6f42b779.signal-and-slate.pages.dev. Stable domains are https://leadflow-agency.pages.dev and https://signal-and-slate.pages.dev. With `SCENE_LIVE=true`, the same read-only mobile suite passed **8/8** on the stable production domains: automatic scene loading, successful asset responses, up-to-2× drawing buffer, scroll/rotation framing, pause and context-loss recovery, reduced-motion and Save-Data. Public Android screenshots were visually inspected. No form was submitted, and Apps Script/email settings were untouched. Physical Safari/Android and sustained frame rate remain unverified.

The adjacent source handoff is documented in `docs/EXTERNAL_LEAD_INGESTION_CONTRACT.md`; no new discovery endpoint, source adapter or Gmail reply detector was deployed. Provider policy/price references are linked there.

## Mobile 3D loading fix — 15 November 2026, afternoon

Root cause found in both wrappers: touch phones and <=4-core devices deliberately defaulted to still mode, so the lazy scene import never ran. Studio's mobile canvas also used an off-screen absolute position, and its isolated stacking context allowed the footer to intercept fixed controls. These policies/layout issues were corrected; no missing external model URL was involved because geometry is procedural.

Both apps gained a shared preference policy and automatic compact 3D on phones. That initial loading release capped drawing at DPR 1, disabled MSAA and lowered the one-shot environment to resolution 32; the sharpness revision above supersedes those quality settings. Studio decorations and marketing particles remain halved. Wider camera framing and fixed viewport-bound canvases work in portrait/landscape. Reduced-motion/Save-Data opt out by default; pause/resume and context-loss fallbacks remain usable.

Verified locally: root strict production build; 75 unit/integration tests; 16 studio browser tests; 10 marketing tests; 2 live-contact boundary tests; 8 targeted mobile checks. No mobile WebGL cases are skipped anymore. Targeted Chromium iPhone 13 and Pixel 7 profiles use four CPU cores to reproduce the old gate, check successful JS/font responses, rendered canvases, all scroll stages, viewport bounds, DPR budget, orientation, pause, context loss/retry, reduced-motion and Save-Data. Screenshots are in `outputs/screenshots/mobile-*`. Phone emulation is not a physical-device or Safari verification.

Run `npm run test:mobile` locally. To check deployed pages without submitting forms, run with `SCENE_LIVE=true`. Optional WebKit engine: install it with `npx playwright install webkit`, then set `SCENE_TEST_WEBKIT=true`; that engine was not run here. Physical iPhone Safari / Android hardware and sustained frame-rate checks remain open.

Published releases: https://12a7111a.leadflow-agency.pages.dev and https://b0c7919d.signal-and-slate.pages.dev. Their stable public domains remain https://leadflow-agency.pages.dev and https://signal-and-slate.pages.dev. No backend settings, credentials or email approval rules changed; no real enquiry or email was sent by these checks.

After publication, `$env:SCENE_LIVE='true'; npm run test:mobile` completed **8/8 passes** against the stable public domains. This includes automatic production WebGL loading, successful scene chunk/JS/font responses, compact pixel budget, scroll stages, portrait/landscape bounds, usable footer-level controls, context loss/retry, reduced-motion and Save-Data on iPhone and Android Chromium profiles. Live screenshots: `outputs/screenshots/mobile-live-{studio,marketing}-{iphone,android}-chromium.png`. This is production-browser emulation, not a physical Safari/device or sustained-FPS result.

## Studio blueprint revision — 15 November 2026

- Root production build: strict TypeScript, both Vite apps and Apps Script pass. Optional scene chunk has the documented size advisory; no type or bundler errors.
- Unit/integration: 75 pass, including both brand/vertical pairs through signed edge intake and the compiled Apps Script runtime, CRM persistence and owner-reviewed drafts. Untagged historical intake stays valid.
- Studio e2e: 15 pass, 1 mobile WebGL-only case skipped. Routes/axe/overflow, guided/free-form demo, package links, reduced-motion deferred loading, camera stages, pause and WebGL recovery verified. Recovery exposed stale ready state, corrected before the passing run.
- Contact e2e: 2 pass, desktop and iPhone-size Chromium. Consent, failure/retry with identical submission ID, metadata and truthful receipt display verified with simulated providers.
- Marketing regression: 8 pass, 2 mobile WebGL-only skips.
- Production dependency audit: zero known vulnerabilities. `git diff --check`: passed.
- Production preview inspected in the browser; mobile still composition inspected from the test screenshot. No physical-device FPS certification or new live Gmail send is claimed.
- Compatible shared Apps Script deployed to the existing endpoint as version 6 before the studio release. Script Properties, test mode, triggers and approval gate were not changed.
- Live release https://0cf14a89.leadflow-agency.pages.dev is served by https://leadflow-agency.pages.dev. Home/services/contact/demo/privacy/terms, favicon and social PNG returned 200. New JS asset `/assets/index-CLtiTV8i.js` returned 200 and contains the studio scene, current prices and web-app-dev metadata. Invalid contact payload returned 400; Apps Script health returned 200. Live WebGL and Launchpad package selection were inspected in IAB. The public form was not submitted; provider delivery claims remain limited to the historical owner smoke and the new mocked integration checks. Turnstile emitted opaque provider-frame diagnostic console messages; no new receipt or delivery is inferred from simply rendering its container.
- P0.1 Notion notes saved and reloaded with both implementation and release evidence present. Screenshot of the public 1280×900 desktop composition saved as `outputs/screenshots/studio-blueprint-live.png`; temporary viewport emulation reset after inspection.

## Executed locally

| Check | Result |
|---|---|
| Strict TypeScript and automation build | Passed after Gemini quoting and log rollover changes |
| Unit, adapter and bundled Apps Script runtime tests | 67 passed |
| Desktop and iPhone-size site end-to-end tests | 10 passed in V3 implementation |
| Live-contact interface with mocked provider boundary | 2 passed; stable retry ID and truthful receipt |
| Guided demo | Six steps, backward navigation, Escape, focus handling, mobile CTA and accessibility passed |
| Production website build | Passed; index, headers, redirects, favicon, social PNG and bundles generated |
| Accessibility and overflow | No axe WCAG A/AA violations or horizontal overflow in tested desktop/mobile routes |
| Offline fixture pipeline | 15 rows → 12 unique, 1 duplicate, 2 invalid; rerun idempotent |
| Dependency audit | Zero known vulnerabilities at installation on 12 November |

Runtime tests execute the real compiled Apps Script bundle with mocked Google and Telegram services. They cover signed intake, deduplication, exactly-once approval handling, consent checks, no automatic retry after uncertain Gmail delivery, and preservation/recovery of diagnostic log archives. Mocked checks do not count as live delivery evidence.

## Live evidence

- Public deployment: https://leadflow-agency.pages.dev. Six routes, favicon and social image returned HTTP 200. Malformed contact payload was rejected.
- Venture account leadsflowwai@gmail.com owns the CRM/script and authorized the requested Google scopes.
- Apps Script deployment version 4 is live with signed intake and configured Cloudflare server secrets. Sheet writes are explicitly flushed before outbound delivery attempts; runtime tests enforce the Gmail SENDING barrier.
- @LeadsFlowwBot identity verified using getMe. Private owner connection established; actual /start response observed in Telegram. Commands and description registered.
- One recurring 10-minute tick trigger exists. SourceRuns exported from the live Sheet shows successful scheduled Telegram, intake and email phases.
- Google AI Studio project shows Free tier. Real gemini-3.5-flash-lite qualification and draft-plan requests returned HTTP 200 and passed application validation. No billing enabled.
- Synthetic enquiry submitted through the public browser form. The site returned lf_aa56b3a2c2e1bd54; matching lead and intake row verified in the exported live Sheet.
- Actual Telegram alert shows score 91/100, classifier gemini and draft method gemini-assisted, with the venture address as recipient.
- Live rejection test lf_dedbc78879f48cc6: Telegram Reject changed both lead and outbox to REJECTED; Gmail Sent remained empty. Both enquiries show method=gemini and draft_method=gemini-assisted in the exported Sheet.
- First enquiry lf_aa56b3a2c2e1bd54 remains REVIEW_PENDING. Owner approval, actual Gmail delivery and replay verification remain outstanding. EMAIL_TEST_MODE remains enabled. These must pass before declaring first-customer readiness.

Screenshots are in outputs/screenshots. Original workbook and project brief are preserved. No real prospect has been contacted.

## Limits

- Physical Safari/device testing, full screen-reader review and complete accessibility certification are not established.
- Free quotas and model availability can change. Provider failures fall back to rules or retain work for review; daily caps remain enforced.
- Sheets is not transactional. Interrupted or uncertain delivery requires checking Gmail Sent before manual reconciliation.
- Automated discovery remains limited to explicitly enabled, permitted sources and manual submission of drafts. No marketplace scraping or unsolicited automated outreach is enabled.

Current launch status is maintained in CHECKLIST.md.

## Studio storefront — 15 November 2026

Build/typecheck passed; 69 unit/integration tests, 10 desktop/mobile site tests and 2 contact boundary tests passed. Automated route checks found no tested WCAG A/AA violations or overflow. Verified package query preselection, selected-package and low-budget context in submitted briefs, consent gating, stable retry ID and truthful receipt. Browser provider calls are simulated. Release: https://5b44ef4c.leadflow-agency.pages.dev; main site https://leadflow-agency.pages.dev. Live homepage and Launch package selection observed; four routes returned 200 and malformed intake returned 400. No new email was sent.

## Signal & Slate — P0.2 build, 15 November 2026

- Root production build succeeds: strict TypeScript, both storefronts, Apps Script bundle. Marketing assets are in apps/marketing/dist. The optional Three.js chunk produces a size advisory; no TypeScript/bundler errors.
- 73 unit/integration tests pass, including signed marketing metadata, origin stamping, backward-compatible development intake, Sheet record_json tags in the actual compiled Apps Script runtime, and owner-gated branded email drafting.
- Marketing Playwright: 8 passed, 2 intentionally skipped mobile WebGL-specific cases. Desktop traverses all four actual WebGL stages, pauses, and recovers to still content on context loss. Desktop/mobile test content accessibility, overflow, package selection, calculator values, consent and failed receipt retry. Local-preview form sends no request.
- Existing storefront regression: 10 site tests + 2 contact-boundary tests pass.
- Production marketing preview opened at http://127.0.0.1:4175 and WebGL hero observed. Notion P0.2 set In Progress with implementation, test and remaining activation notes; values read back after reload.
- No live Signal & Slate form, real CRM row or Gmail delivery was claimed. Live hostname, Turnstile/server configuration and compatible backend publication precede owner smoke testing. Physical-device 60 fps remains unverified.
