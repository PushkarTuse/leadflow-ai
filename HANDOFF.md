# Handoff — LeadFlow AI

This is the entry point for any AI (or human) picking up this repository. Read this file first, then open the latest capsule.

## External discovery integration — 16 November 2026

**Continuation completed:** integration commit cc71818 pushed to GitHub; external API installed/running locally at 127.0.0.1:8787 with five real HN leads confirmed in API and SQLite. Repeatable `node scripts/validate-external-local.mjs` validated five canonical mappings and five duplicates on replay through the in-memory Engine. Three qualify for local draft review, two remain NEW. Production remains disabled; no hosting or live alerts/email. Co-founder repo has only ignored local setup artifacts, no tracked changes or push. Future HTTPS setup is documented in `docs/EXTERNAL_LEAD_API_SETUP.md`; recovery log has full evidence.

Read `HANDOFF_EXTERNAL_LEAD_INTEGRATION.md` next. A disabled-by-default bounded pull connector now maps the co-founder's leadflow-leads API into the existing Apps Script Engine/Sheets/Gemini/Telegram discovery path. HN original text/time is enriched from the official API; producer scores and contact authority are discarded. Focused bundled runtime verification confirms Sheets + owner Telegram review with no EmailOutbox entry/send. No local API setup or live activation performed. Exact mapping, configuration, pagination limits and later setup: `docs/EXTERNAL_LEAD_API_SETUP.md`. Kapicks was not changed in this work.

## Kapicks portfolio update — 16 November 2026

The old Bageera placeholder in both public storefronts has been replaced with **Kapicks**, linking to https://www.kapicks.com/. Each card displays two locally hosted, compressed, watermarked images from the live Kapicks gallery (tiger and bee-eater) with accessible previous/next controls. The marketing card still labels its growth direction as a proposal; it does not claim verified campaign results. This is a portfolio presentation update only; no intake, email, or approval settings changed. See `docs/VERIFICATION.md` for the focused build and release check.

Published to https://leadflow-agency.pages.dev/ and https://signal-and-slate.pages.dev/ on 16 November. Immutable release URLs are recorded in `docs/VERIFICATION.md`.

## Mobile 3D preference release — 16 November 2026

Published the clearer preference notice to both stable Cloudflare Pages sites. Immutable releases: studio https://b4b0af4e.leadflow-agency.pages.dev and marketing https://d03c5861.signal-and-slate.pages.dev. Live iPhone WebKit tests passed **4/4**: normal mobile 3D starts without a tap and survives scroll, rotation, pause and context recovery; Reduce Motion and Data Saver show a clearly labeled still view with a prominent keyboard-accessible override. The duplicate small control is hidden while the notice appears. The marketing mobile menu stays above the notice. Local strict production build passed. No forms, email, credentials or approval rules changed. Existing mobile tabs may need a reload.

## iPhone 3D preference clarification — 15 November 2026

The owner's physical iPhone Safari screenshot showed the still composition and a small “Enable 3D” control. The owner confirmed iOS **Reduce Motion was on**; after turning it off, the public 3D scene worked. Normal mobile visits already start in 3D. Preserve the accessibility preference: when Reduce Motion or Data Saver is on, the still composition remains the initial view. The updated storefronts now show a larger, explicit “3D preview paused” explanation and “View 3D anyway” button so the choice is discoverable. This is an owner-confirmed one-device functional check, not a measured Safari frame-rate result. The mobile browser suite now includes WebKit alongside iPhone/Android Chromium; release evidence is in `docs/VERIFICATION.md`.

## Mobile scene sharpness + external producer handoff — 15 November 2026

The prior mobile-loading release deliberately rendered compact 3D at DPR 1 with antialiasing off; on high-density phones, this made edges noticeably coarse. Both storefronts now keep automatic mobile 3D, render up to DPR 2 with antialiasing on, use resolution-64 procedural reflections and remove the mobile canvas opacity reduction. Particle/node counts and hidden-tab pause still bound work. Reduced-motion and Save-Data still default to the optional still composition. The strict production build, 8 local and 8 public-site iPhone/Android Chromium checks pass; visual screenshots show sharper edges. Published releases: studio https://93fe977c.leadflow-agency.pages.dev and marketing https://6f42b779.signal-and-slate.pages.dev. Physical-device/Safari frame rate remains unverified; see `docs/VERIFICATION.md` for evidence.

The other AI's proposed source pipeline has a concrete handoff at `docs/EXTERNAL_LEAD_INGESTION_CONTRACT.md`: current strict `LeadInput` fields, a JSON example, source/permission rules, a future authenticated discovery endpoint, variables and acceptance checks. **There is no external discovery POST endpoint yet.** HN jobs already have an official API adapter; `/api/contact` is only for consented website enquiries. Google Places API content must not be exported into a prospect CRM/auto-email list under the standard Maps terms, and its API requires a billing-linked project. Discovery stays owner-reviewed and draft-only; the current discovered-lead scorer is software-focused, so marketing leads need their own rubric. Automatic reply detection/positive-result Telegram digests are not implemented. No outbound rules, provider secrets or live email settings were changed in this work.

## Earlier mobile 3D loading fix — 15 November 2026

The reported mobile loading issue was implemented in both storefronts. Previously, coarse-pointer phones and devices with four or fewer CPU cores were deliberately prevented from loading the lazy 3D module. `apps/shared/useScenePolicy.ts` now reserves the automatic still view for reduced-motion and Save-Data preferences. The initial compact renderer used DPR 1, no MSAA and environment resolution 32; the newer sharpness release above supersedes those quality settings. It retains fewer decorative nodes/particles and wider camera framing. Mobile canvases stay fixed within the viewport in portrait and landscape. Removing the studio homepage's isolated stacking context also fixes footer interception of pause/restart controls. The marketing readiness flag now resets on every restart.

Verification: strict root build; 75 unit/integration tests; 16 studio, 10 marketing, 2 contact and 8 targeted iPhone/Android Chromium checks passed, with no mobile WebGL skips. Targeted checks use four-core touch profiles and cover automatic loading, asset responses, viewport/drawing-buffer bounds, scroll stages, rotation, pause, loss/retry and reduced-motion/Save-Data. Physical iOS Safari/Android hardware and 60fps remain unverified; optional WebKit engine checks are available via `SCENE_TEST_WEBKIT=true` after installing that browser. See the latest capsule and `docs/VERIFICATION.md` for public release checks.

Mobile-fix releases: studio https://12a7111a.leadflow-agency.pages.dev; marketing https://b0c7919d.signal-and-slate.pages.dev. Both stable Pages URLs now serve the fix. Existing open phone tabs need a reload to load the new bundle. When reduced-motion or Save-Data is enabled, the visible Enable 3D control intentionally remains available.

Public-site verification completed: all **8 live mobile checks passed** on the stable domains, using iPhone/Android Chromium profiles. Actual production scene chunks loaded successfully; canvases rendered automatically, stayed within portrait/landscape bounds through scrolling, and recovered from pause/context loss. Reduced-motion and Save-Data checks also passed. Screenshots: `outputs/screenshots/mobile-live-studio-android-chromium.png` and `mobile-live-marketing-android-chromium.png`. Physical-device/Safari confirmation remains the only mobile acceptance step not performed here.

## Blueprint studio revision — 15 November 2026

P0.1 now has its own ink/platinum/jade storefront and procedural R3F/GSAP camera journey: blueprint → browser/mobile/spatial object → security shield → finished product. The latest owner instruction supersedes the older price experiment below: ₹5,999 Launchpad, ₹18,999 Growth and ₹44,999+ Scale, with bounded scopes, domain allowances and conditional security/support commitments. Existing routes, guided demo and contact handlers are retained. Intake now carries matched `web-app-dev` / `LeadFlow AI` tags; deploy the compatible Apps Script bundle before publishing the form. See `docs/STUDIO_BLUEPRINT.md` and the latest capsule for verified release evidence and remaining work. No test-mode setting is changed by this revision.

**Release verified:** https://leadflow-agency.pages.dev (immutable release https://0cf14a89.leadflow-agency.pages.dev). Compatible Apps Script **v6** deployed first to the existing endpoint. Six public routes, assets and backend health return 200; invalid contact payload returns 400; new live package preselection and WebGL observed in the browser. Build and 100 automated checks pass (75 unit/integration + 25 browser; three mobile-only WebGL skips). P0.1 Notion implementation/release notes saved and verified after reload; task remains In Progress for founder review. No new live email was sent. Marketing is still local-brief mode; its compatible backend is now deployed but its own origin/secrets/widget activation remains separate. Physical-device performance, approved Bageera evidence, domains and Azure remain outstanding.

**Mobile follow-up status:** The forced mobile fallback, viewport positioning and footer/control layering issues are fixed and browser-tested as described above. Remaining acceptance work is confirmation on physical iPhone/Safari and Android/Chrome hardware; preserve reduced-motion, Save-Data and unsupported-WebGL fallbacks.

## Signal & Slate build — 15 November 2026 (earlier snapshot)

P0.2 is now the priority and is implemented at `apps/marketing/`: standalone dark/gold marketing storefront, procedural R3F camera journey, GSAP scroll, still/mobile fallback, scoped monthly plans, Bageera concept and growth planning model. Start `npm run dev:marketing`; root `npm run build` now builds both sites. Optional signed `vertical`/`brand` context and marketing email drafts are implemented and tested, without changing live settings. Marketing production intake remains off until the compatible Apps Script bundle, exact origin, server secrets and Turnstile are deployed/configured. See `docs/SIGNAL_AND_SLATE.md`. This implementation is not a new live marketing smoke test.

## Storefront update — 15 November 2026 (earlier snapshot)

P0.1 public UI now presents a Web, Mobile & Unity Development Studio. Revised starting offers: Launch Website ₹7,999, Business Website ₹24,999, Product Pilot ₹59,999. Each has explicit boundaries, revision limits, defect support and separately billed operating costs. See `docs/PRICING_AND_STOREFRONT.md` for decisions and estimates. Service/package/optional-phone fields preserve the deployed contact contract. No backend credentials, approval controls or live test-mode settings were changed by this work. Bageera walkthrough/client testimonials remain unverified; Azure migration and Website #2 remain separate work.

## Latest capsule

→ [[2026-11-15_studio-blueprint]]

## Current state in one paragraph

The private loop is **live and verified end-to-end**. A consented website enquiry travels from the Cloudflare Pages Function through signed Apps Script intake into the private Google Sheet, is qualified (Gemini-assisted with rules fallback), a reply is drafted, the owner is alerted in private Telegram, and the exact approved email is delivered through Gmail. The first real send (`lf_aa56b3a2c2e1bd54`) is confirmed `SENT` with a Gmail message ID, and a second enquiry (`lf_dedbc78879f48cc6`) was correctly `REJECTED` with no email sent. The current live `EMAIL_TEST_MODE` value was not rechecked during the storefront build; earlier records conflict, so verify Script Properties before external delivery.

## Where to look

| Question | File |
|---|---|
| What is done, tested, blocked? | [[CHECKLIST]] |
| What evidence exists for each claim? | [[VERIFICATION]] |
| How do I connect the services? | `docs/SETUP.md` |
| How do I deploy the site? | `docs/DEPLOY_CLOUDFLARE.md` |
| How do I run the live smoke test? | `docs/LIVE_SMOKE_TEST.md` |
| How do I operate it day to day? | `docs/OPERATIONS_RUNBOOK.md` |
| Why is it built this way? | `docs/ARCHITECTURE.md` |
| What are the data shapes? | `docs/DATA_MODEL.md` |
| What are the cost/limit boundaries? | `docs/COSTS_AND_LIMITS.md` |
| What are the security boundaries? | `docs/SECURITY_AND_COMPLIANCE.md` |

## Capsule index

| Date | Capsule | Summary |
|---|---|---|
| 2026-11-15 | [[2026-11-15_studio-blueprint]] | Studio 3D redesign live on Cloudflare; compatible Apps Script v6; Notion updated |
| 2026-11-15 | [[2026-11-15_signal-slate-build]] | Signal & Slate built/tested locally; production activation pending |
| 2026-11-14 | [[2026-11-14_particle-1-handoff]] | First verified live send; rejection path verified; test mode still on |

## Rules for the next AI

1. **Do not claim a live result you have not seen evidence for.** Mocked tests are not live delivery.
2. **Never set `EMAIL_TEST_MODE=false`** without the owner's explicit instruction.
3. **Never retry an `UNCERTAIN` email.** Check Gmail Sent first, then reconcile manually.
4. **Never edit `EmailOutbox` body text after review.** The `content_hash` will reject the approval.
5. **Do not add paid tiers, domains, or billing** without owner approval.
6. **Do not scrape marketplaces or send unsolicited outreach.** Discovery is draft-only.
7. **Treat `docs/` and `CHECKLIST.md` as the source of truth** for status, not this summary.

Storefront release verified 15 November 2026: https://leadflow-agency.pages.dev (release https://5b44ef4c.leadflow-agency.pages.dev). Revised homepage and package-to-contact selection observed live; /, /services, /contact and /demo returned HTTP 200. Malformed contact payload rejected with HTTP 400. P0.1 Notion progress and release note saved and reloaded. This revision did not send a new live email.

Cloudflare release — 15 November 2026: Signal & Slate is public at https://signal-and-slate.pages.dev (deployment https://9c4fbda2.signal-and-slate.pages.dev). Separate free Pages project; assets and Functions uploaded. Live HTML, JS, CSS and favicon returned 200. Intake remains explicitly in local-brief mode until its Turnstile/server secrets and compatible Apps Script deployment are activated. /api/contact correctly returns 503 while unconfigured.
