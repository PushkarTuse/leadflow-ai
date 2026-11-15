# Signal & Slate — P0.2

Built 15 November 2026 (Asia/Kolkata). This is the current build priority; P0.2 remains the stable task reference even where the latest brief calls this Website #1.

## Run and build

```powershell
cd D:\freelance_personal\leadflow-ai
npm install
npm run dev:marketing
# http://127.0.0.1:5175
npm run build
npm run preview:marketing
# production output at apps/marketing/dist, preview http://127.0.0.1:4175
npm run test:marketing
```

The root build type-checks the monorepo, builds both independent storefronts and bundles Apps Script. Existing Web/App Studio commands retain their behavior. No React major upgrade: React/React DOM 19.3.1 with Fiber 9.8.2, Drei 10.7.9, Three 0.187.0 and GSAP 3.15.1. The font is self-hosted Plus Jakarta Sans.

## Experience

Four camera stages: market noise and architectural dial; lens/ring corridor and aligned signal streams; telemetry bars; framed final object. GSAP ScrollTrigger supplies progress to a Catmull-Rom camera path. Camera damping and small pointer offsets run outside React state. The metric buttons in the planning model select/highlight a 3D bar. Native scrolling is retained; anchor jumps use CSS smooth scrolling.

All geometry and the reflection environment are procedural; no remote models, HDR maps, image textures or font services. The 3D renderer and GSAP load separately from the content. There are 180 particles, capped pixel ratio (1–1.5), no shadows or post-processing, and no React updates per animation frame. Rendering pauses while the document is hidden. The minified optional 3D chunk is approximately 983 KB / 265 KB gzip; Vite reports its normal large-chunk advisory. Physical-device 60 fps is a target, not a verified guarantee.

Since the mobile fix on 15 November, coarse-pointer phones and low-core devices automatically load compact 3D: up to DPR 2 with antialiasing, environment resolution 64, 90 particles and wider camera framing. The canvas remains at full opacity and fixed inside portrait/landscape viewport bounds. Reduced-motion and Save-Data preferences still default to a CSS composition. A visible control allows enabling or pausing 3D. Restart resets readiness before recreating the renderer. Error boundaries and context-loss handling preserve the usable page. Content, pricing and forms work independently of the canvas.

## Offers and proof

- Launchpad Growth ₹12,999/month: one Meta account, up to two active campaigns, local SEO setup for one location, four ad variations from supplied assets, review every two weeks.
- Scale Accelerator ₹29,999/month: up to four Meta campaigns, technical/on-page priorities for ten pages, weekly reporting and a twelve-post monthly planning calendar.
- Omnichannel Partner: custom scope, Meta/Google channel plan, CRM routing, named strategy lead and weekly calls.

Media spend, tax, shoots, paid tools, major website fixes and separately commissioned production are additional. Capacity, approval rounds, reporting and cancellation terms are agreed in writing. Scale is labelled Recommended; no unverified sales-volume claim.

Bageera is a photography website portfolio project; its marketing direction is explicitly a concept. No campaign growth metrics, testimonials or results are fabricated. The CPL/ROAS calculator is an illustrative model, not an industry benchmark. Default assumptions: ₹18,000 ad spend, ₹600 CPL, 10% conversion, ₹12,000 revenue per customer. Show assumptions alongside outputs; revenue/ad-spend excludes service fees, delivery costs and tax.

## Intake and CRM contract

The form posts to same-origin `/api/contact`. `apps/marketing/functions/api/contact.ts` reuses the protected edge handler. Existing requests remain compatible; the optional marketing context must have both exact values:

```json
{"vertical":"digital-marketing","brand":"Signal & Slate"}
```

Consent, timestamp, Turnstile hostname/action and HMAC checks still apply. The edge stamps the verified configured origin into signed `site_url`, overriding caller input. Apps Script preserves the context in Leads `record_json`; readable tags also appear in the existing `owner_notes` column. No destructive Sheet schema migration is needed. `IntakeReceipts` remains keyed by submission ID and links to the lead. Marketing replies use the Signal & Slate subject/signature and marketing questions; owner approval and Gmail sender controls remain mandatory. Delivery still uses the venture account configured in Apps Script.

Marketing media spend and management fees are distinct in the brief. The legacy setup-budget enum remains “I'd like guidance” to avoid recording recurring ad spend as a one-time development budget.

## Production activation — not performed by this build

1. Publish the compatible updated Apps Script bundle using the existing venture clasp profile; update the existing web deployment. Roll back to version 5 if required. Existing v5 does not understand marketing context, so do this before enabling marketing intake.
2. Choose the final marketing origin (Azure is still the roadmap destination). When using Cloudflare Pages for a free interim host, run deployment from `apps/marketing` so its own functions/ directory and wrangler.toml apply. Do not deploy marketing/dist with the Web/App site's config/project.
3. Configure a Turnstile widget for that exact hostname. In marketing hosting server settings, configure `APPS_SCRIPT_URL`, `INTAKE_HMAC_SECRET`, `TURNSTILE_SECRET_KEY`, `PUBLIC_SITE_URL` for the marketing origin. Keep all secrets server-side.
4. Set `VITE_MARKETING_INTAKE_ENABLED=true` and `VITE_MARKETING_TURNSTILE_SITE_KEY` to its public site key, then rebuild. These flags are independent of the development studio's `.env` values.
5. Owner-only live smoke: audit form → IntakeReceipts and tagged Lead → Gemini/rules → Signal & Slate Telegram email review → owner approval → venture inbox. Record actual evidence before marking P0.2 Live/Done.

Until configured, the preview clearly offers a local brief, never a false delivery receipt. No paid service, new hosting account, domain, campaign, outbound prospect message or live Script Property was changed by this implementation.

## Verification boundaries

73 unit/integration tests cover signed branding, anti-spoofed origin, backward compatibility, compiled Apps Script persistence, branding-specific replies and approval gating. Browser checks cover desktop/mobile accessibility and overflow, pricing selection, calculator arithmetic, consent, failed receipt/retry identity, local-only briefs, four real WebGL stages, pause and context loss. Provider boundaries are mocked; this is not a new live marketing enquiry or Gmail delivery test.

References for implementation: https://r3f.docs.pmnd.rs/getting-started/introduction and https://gsap.com/docs/v3/Plugins/ScrollTrigger/ .

Cloudflare release — 15 November 2026: Signal & Slate is public at https://signal-and-slate.pages.dev (deployment https://9c4fbda2.signal-and-slate.pages.dev). Separate free Pages project; assets and Functions uploaded. Live HTML, JS, CSS and favicon returned 200. Intake remains explicitly in local-brief mode until its Turnstile/server secrets and compatible Apps Script deployment are activated. /api/contact correctly returns 503 while unconfigured.
