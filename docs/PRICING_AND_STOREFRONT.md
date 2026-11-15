# Studio storefront and offer decisions

Updated 15 November 2026, Asia/Kolkata.

**Superseded pricing experiment:** the historical analysis below records the earlier ₹7,999 / ₹24,999 / ₹59,999 decision. The owner's subsequent studio brief explicitly restores ₹5,999 / ₹18,999 / ₹44,999+ introductory prices. Current bounded offers, domain caps and security/support conditions are authoritative in [STUDIO_BLUEPRINT.md](STUDIO_BLUEPRINT.md) and `apps/web/src/studio.ts`. Do not quote the old table as the current storefront offer.

## Offer design

These are proposed introductory starting scopes, not market-rate claims or binding quotes. Separate a marketing website from a production application. Security basics and source handover apply at every price point.

| Offer | Starting fee | Delivery boundary | Included defect support |
|---|---:|---|---|
| Launch Website | ₹7,999 | One tailored page, up to six sections, contact form, click-to-chat, metadata/sitemap, one revision round | 7 days |
| Business Website | ₹24,999 | Up to five pages, one enquiry integration, one agreed CMS collection if needed, two rounds and handover | 30 days |
| Product Pilot | ₹59,999 | One core journey on one target platform: up to five screens OR one Unity scene OR one automation workflow | 30 days |

Internal viability assumptions: approximately 10–14 hours for Launch, 30–40 for Business, and 60–80 for a tightly bounded Pilot. These are planning assumptions to validate against actual delivery, including design, review, testing and handover. If requirements exceed them, reduce scope or quote separately; do not absorb an entire app or game into a website fee. Review margins after the first three projects. No delivery date is promised before the scope review.

The original ₹5,999 / ₹18,999 / ₹44,999 bundles mixed websites, commerce, mobile apps and Unity builds with open-ended support and infrastructure. The revision removes those unbounded alternatives. E-commerce, production SaaS, authentication-heavy apps, custom 3D assets, AR device support, store submission, multiple platforms and ongoing maintenance need an itemized custom scope.

## Costs and security

Domain/DNS connection and HTTPS setup are included; registrar purchase/renewals, hosting usage, app-store memberships, payment fees, paid APIs/plugins, assets and applicable taxes are additional, with approval. No domain subsidy or unlimited hosting is advertised. App store review/approval is outside the studio's control.

All website scopes include HTTPS, input validation, protected forms and appropriate security headers. Authentication, roles, rate limits, backups, restore checks, monitoring and audit controls depend on the data and deployed architecture. HMAC is already used for this site's intake; it is not an end-to-end encryption or compliance certification. No blanket GDPR/DPDP certification, AES-256 guarantee, four-hour SLA, unlimited revisions or free feature iterations is advertised.

Official cost references checked 15 November 2026:
- Apple membership: https://developer.apple.com/help/account/membership/program-enrollment
- Google Play developer registration: https://support.google.com/googleplay/android-developer/answer/6112435
- Cloudflare Turnstile free plan: https://developers.cloudflare.com/turnstile/plans/

## Evidence and intake

Bageera is presented as an existing photography project from the founder brief; no unverified public URL, screenshot, testimonial, performance metric or customer endorsement is invented. The property experience remains accessible as a labelled simulated concept and is removed from primary navigation. A portfolio walkthrough and approved client material remain to be supplied.

Brand configuration: apps/web/src/studio.ts; domain origin: VITE_SITE_URL. Services/package/phone selections are appended to the validated goal field, preserving the deployed strict intake schema. The new under-₹15,000 UI option carries its exact meaning in the goal; the unchanged legacy budget enum uses “I'd like guidance” so it does not invent a numerical budget. Future structured CRM segmentation should version the intake contract before deployment. Optional phone does not grant calling consent. Replies remain email-based and owner-approved.
