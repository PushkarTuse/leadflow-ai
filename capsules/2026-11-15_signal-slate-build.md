---
date: 2026-11-15
project: LeadFlow AI
phase: P0.2 Signal & Slate
status: built-and-tested-local
---

# Signal & Slate marketing storefront

Current priority: build the marketing vertical first. Stable Notion task P0.2: https://app.notion.com/p/P0-2-Build-launch-Digital-Marketing-Agency-website-4184281594848079b767f4da7c16772d . Set In Progress; implementation, verification and activation requirements saved and read back after reload.

Source: apps/marketing. Preview is running at http://127.0.0.1:4175 (npm run preview:marketing); development uses npm run dev:marketing, port 5175. No deployment was requested in this build step and no live account settings or secrets were changed. Production bundle is apps/marketing/dist; root npm run build includes both storefronts and Apps Script.

Implemented: procedural Fiber 9 / Drei / Three scene with four-stage GSAP camera spline, particles-to-signals narrative, telemetry selector, mouse parallax, still/reduced-motion/low-power mode, context-loss recovery, dark slate/gold responsive content, scoped monthly offers, Bageera concept, planning calculator and audit form.

Verification: strict typecheck/build passes; 73 unit/integration tests; marketing 8 browser passes and 2 intentionally skipped mobile WebGL-only cases; existing studio 10 site + 2 contact browser checks pass. No axe A/AA violations or horizontal overflow in tested views. npm audit --omit=dev: zero known vulnerabilities. Optional 3D bundle has a Vite size advisory; 60 fps is not physical-device certified.

Marketing vertical/brand fields are signed and validated. Edge stamps trusted origin; existing Sheets record_json preserves both tags with readable owner_notes. Existing development-site intake remains compatible. Marketing draft subject/signature and clarification questions are adapted, still owner-approved. Tests use mocked Google/Telegram/Gmail providers. No new live marketing CRM row or mail send is claimed.

Before Live/Done: choose marketing origin/host, deploy compatible Apps Script bundle before marketing flags are enabled, configure exact-host Turnstile and edge secrets, deploy site/function, then run an owner-only smoke test. Current v5 live Apps Script rejects the new marketing fields. Default preview prepares an explicitly local brief.

See docs/SIGNAL_AND_SLATE.md. Bageera campaign data is unverified; calculator scenarios are labelled assumptions, not benchmarks or client results. Do not expose credentials or claim production activation from these mocked tests. The historic owner smoke lf_aa56b3a2c2e1bd54 succeeded separately; current live EMAIL_TEST_MODE was not rechecked here.
