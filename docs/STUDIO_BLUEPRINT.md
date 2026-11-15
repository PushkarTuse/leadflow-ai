# LeadFlow studio — blueprint to product

15 November 2026. Implementation: `apps/web`. Public host remains Cloudflare Pages; Azure migration is a separate roadmap task.

## Design and behaviour

Ink (#0A100E), mineral jade and warm platinum; self-hosted Manrope and IBM Plex Mono, with a restrained editorial serif accent. Procedural artwork uses no remote models, textures or font services. The photography cover is labelled visual direction, not a fabricated client screenshot. Existing simulated property demo, consent and approval controls remain intact.

The homepage camera follows section positions: blueprint assembly → browser/mobile/Unity-style spatial object → layered shield → finished interface. GSAP ScrollTrigger supplies progress; a damped Catmull-Rom camera path and pointer parallax run inside Fiber without per-frame React state. Native scrolling, anchors and keyboard navigation remain available.

`StudioScene.tsx` is lazy-loaded. Desktop DPR is capped at 1.5 and the procedural environment renders once at resolution 64; no shadows or postprocessing are used. Touch/narrow/low-core devices automatically load compact 3D at up to DPR 2 with antialiasing, environment resolution 64 and 24 decorative nodes. The mobile canvas remains full opacity and stays fixed inside portrait/landscape viewport bounds. Hidden documents stop rendering. Only reduced-motion and Save-Data preferences default to a CSS composition. Users can pause or explicitly enable the journey; context loss reveals the composition with a retry control. A physical-device 60fps claim has not been established.

## Current introductory scopes

These replace the earlier 7,999 / 24,999 / 59,999 offer experiment at the owner's latest instruction. Final costs and deliverables require a written scope.

| Offer | Starting development fee | Boundary | Support/domain allowance |
|---|---:|---|---|
| Launchpad Starter | ₹5,999 one-time | One page, six sections, one revision; HTTPS/Turnstile/security headers | 7-day defect fixes; first-year domain up to ₹800 |
| Growth Web & App Suite | ₹18,999 one-time | One choice: five web pages OR three pilot screens OR one Unity scene; one enquiry integration | 30-day defect fixes; first-year domain up to ₹1,200 |
| Scale, Custom Apps & Unity 3D | ₹44,999+ custom | One agreed product release and platform; extra platforms/assets quoted | 90-day priority defect support; domain allowance and response targets agreed |

JWT/RBAC and WAF apply to suitable Growth architectures. Scale signing, CI/CD checks and provider-managed AES-256 at rest require suitable infrastructure and written acceptance checks. These are scoped controls, not certifications. Premium domain excess, renewals, provider usage, store fees, tax and ongoing maintenance are additional. No domain purchase or new paid service was made. Validate delivery margins before accepting a quote; reduce scope rather than promise a full app for a small website fee.

## Intake and release order

The live studio form sends `vertical: web-app-dev` and `brand: LeadFlow AI`. Both public and signed schemas enforce valid brand/vertical pairs; untagged historical requests stay valid. The edge stamps the trusted configured origin, signs the bounded payload and retains Turnstile/origin checks. CRM `record_json` and readable `owner_notes` retain the tags; no workbook header migration is needed. Marketing still uses its own matched tags and remains local-brief mode until configured separately.

Deploy the compatible Apps Script bundle to the existing `/exec` deployment **before** publishing the newly tagged studio form. Preserve all Script Properties, test-mode settings and owner approvals. No new prospect email is needed to verify this visual revision; do not claim the historical smoke send as a new test.

## Verification

Run `npm run build`, `npm test`, `npm run test:e2e`, `npm run test:contact`, and `npm run test:marketing`. Browser checks cover routes/contrast/overflow, guided-demo controls, package preselection, consent, stable retry IDs, exact metadata, camera stages, pause, reduced-motion deferred loading and context recovery. Provider tests use explicit mocks, including the actual compiled Apps Script runtime. Vite reports an advisory for the optional ~984 KB scene chunk (~265 KB gzip); it is excluded from still-mode loading.

Official implementation references: [Fiber performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [ScrollTrigger lifecycle](https://gsap.com/docs/v3/Plugins/ScrollTrigger/).

## Published release

https://leadflow-agency.pages.dev — release https://0cf14a89.leadflow-agency.pages.dev, 15 November 2026. Compatible Apps Script v6 deployed first. Public routes/assets, backend health, malformed-request rejection, live WebGL and package preselection verified. P0.1 notes saved/reloaded in Notion. Build and 100 automated checks pass, with three deliberate mobile WebGL skips. This was a visual and metadata release; no new live email send was tested. Remaining: physical-device performance, approved portfolio evidence, and separate domain/Azure work.
