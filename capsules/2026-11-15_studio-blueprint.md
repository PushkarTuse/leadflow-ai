---
date: 2026-11-15
project: LeadFlow AI
phase: P0.1 studio blueprint revision
status: cloudflare-live-studio
---

# Blueprint studio handoff

## Release update, 16 November

Both stable Pages domains now serve the prominent Reduce Motion/Data Saver explanation and override. Releases: studio https://b4b0af4e.leadflow-agency.pages.dev; marketing https://d03c5861.signal-and-slate.pages.dev. Four live iPhone WebKit browser checks pass. Normal mobile 3D starts automatically; the owner's physical iPhone Safari worked after Reduce Motion was disabled. The mobile marketing menu layering was corrected. Full details and test limits: docs/VERIFICATION.md. The external producer handoff is docs/EXTERNAL_LEAD_INGESTION_CONTRACT.md.

## Latest: iPhone Reduce Motion clarified, 15 November

The owner confirmed the physical iPhone Safari screenshot's “Enable 3D” state came from iOS Reduce Motion. With that setting off, the live scene works. Both storefronts keep automatic 3D under normal settings and now show a prominent reason and “View 3D anyway” control when Reduce Motion or Data Saver requests the still view. Prior live releases passed four iPhone WebKit checks; new release verification is recorded in docs/VERIFICATION.md. Physical frame rate remains unmeasured.

## Latest: mobile sharpness and discovery producer contract, 15 November

Mobile 3D stays automatic on both storefronts. High-density phone scenes now render at up to DPR 2 with antialiasing and resolution-64 reflections; CSS no longer dims the canvas to 85%. Local strict build, 8/8 local and 8/8 live iPhone/Android Chromium scene checks passed, and Android before/after images show cleaner edges. Releases: studio https://93fe977c.leadflow-agency.pages.dev and marketing https://6f42b779.signal-and-slate.pages.dev. Physical-device/Safari performance remains unverified; see docs/VERIFICATION.md.

The external lead-source AI can use docs/EXTERNAL_LEAD_INGESTION_CONTRACT.md for exact current `LeadInput` fields, JSON examples, future signed ingress design, variables and acceptance tests. An external discovery HTTP endpoint does not exist yet. Existing HN official API adapter and selected Gmail label are supported; Google Places content is excluded from CRM prospect export under standard Maps terms. Discovery approval is draft-only; positive-reply detection/digests are not implemented. No backend credentials, send permissions or test-mode settings changed.

## Earlier: mobile 3D loading fix, 15 November

Both storefronts automatically load compact 3D on touch phones and low-core devices. The previous policy explicitly disabled their lazy scene imports. Shared policy is in apps/shared/useScenePolicy.ts. The initial compact renderer used DPR 1, no MSAA and resolution-32 environment; the latest sharpness release above supersedes those settings. Fewer decorations and wider framing remain; reduced-motion/Save-Data still opt out by default. Mobile canvases remain inside the viewport in both orientations. Removed studio home isolation to keep fixed controls above the footer; marketing restarts clear stale readiness.

Published and verified: studio release https://12a7111a.leadflow-agency.pages.dev; marketing https://b0c7919d.signal-and-slate.pages.dev. Both stable domains passed all 8 public mobile-emulation checks after deployment. Screenshots are `outputs/screenshots/mobile-live-*.png`; no real form/email was submitted. Reload existing phone tabs to fetch the new bundle. Physical Safari/Android verification remains open.

Build, 75 unit/integration, 16 studio, 10 marketing, 2 contact and 8 targeted mobile browser checks pass. The previous three mobile WebGL skips were removed. Dedicated mobile tests reproduce four-core touch devices, check automatic loading and asset HTTP responses, camera stages, canvas bounds, drawing-buffer budget, pause/retry, orientation, reduced-motion and Save-Data. These are Chromium iPhone/Android profiles, not physical hardware. Real iOS Safari/Android performance confirmation remains open. Optional WebKit project: install playwright webkit, then set SCENE_TEST_WEBKIT=true. Public release evidence follows in HANDOFF/docs/VERIFICATION.

Source: apps/web. Design: ink, warm platinum, mineral jade; local fonts and procedural artwork. R3F9/Drei/Three and GSAP supply the section-driven spline camera, pointer parallax, browser/mobile/Unity-style object, shield and finished-interface composition. Pause, mobile/reduced-motion/low-power still mode, context-loss recovery and hidden-tab rendering pause are implemented. See docs/STUDIO_BLUEPRINT.md.

Latest owner instruction restores the introductory 5,999 / 18,999 / 44,999+ INR offers. Fixed scope choices, domain caps, defect periods and conditional architecture controls avoid unlimited application/security/SLA commitments. No purchases were made. Bageera proof and testimonials remain unverified; no results are invented.

The form now sends web-app-dev / LeadFlow AI. Shared strict schemas preserve the pair and trusted origin in signed intake, record_json and owner_notes, while retaining untagged historical compatibility. Marketing remains independently in local-brief mode. Deploy the compatible Apps Script bundle before the new studio form; preserve secrets, EMAIL_TEST_MODE and Telegram approval gate.

Notion task: https://app.notion.com/p/P0-1-Build-launch-Web-App-Development-Agency-website-4184281594848075ae19ef03f8d9b5ce . Remain In Progress until release checks are recorded. The previous Gmail smoke lf_aa56b3a2c2e1bd54 is historical verified evidence, not a new send from this revision.

Verification passed: strict root build; 75 unit/integration; 15 studio browser passes plus one mobile WebGL skip; 2 contact passes; 8 marketing passes plus two mobile WebGL skips; production dependency audit zero vulnerabilities. Scene resume resets readiness before mounting the replacement canvas. Compatible Apps Script v6 deployed to the existing endpoint before the site. See docs/VERIFICATION.md for release evidence and limitations.

Release: https://leadflow-agency.pages.dev / immutable https://0cf14a89.leadflow-agency.pages.dev. Live routes/assets/health 200; invalid intake 400; live WebGL and Launchpad preselection observed. Notion P0.1 notes saved and verified after reload, still In Progress for founder review. Public form was not submitted and no new Gmail send is claimed. Apps Script settings/secrets/triggers untouched. Marketing's backend compatibility prerequisite is now met by v6; its own intake configuration is still pending. Screenshot: outputs/screenshots/studio-blueprint-live.png. Physical-device FPS, approved portfolio proof, domains and Azure remain separate work.
