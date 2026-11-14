# Handoff — LeadFlow AI

This is the entry point for any AI (or human) picking up this repository. Read this file first, then open the latest capsule.

## Latest capsule

→ [[2026-11-14_particle-1-handoff]]

## Current state in one paragraph

The private loop is **live and verified end-to-end**. A consented website enquiry travels from the Cloudflare Pages Function through signed Apps Script intake into the private Google Sheet, is qualified (Gemini-assisted with rules fallback), a reply is drafted, the owner is alerted in private Telegram, and the exact approved email is delivered through Gmail. The first real send (`lf_aa56b3a2c2e1bd54`) is confirmed `SENT` with a Gmail message ID, and a second enquiry (`lf_dedbc78879f48cc6`) was correctly `REJECTED` with no email sent. `EMAIL_TEST_MODE` is still `true` and must be set to `false` before real prospects are contacted.

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
| 2026-11-14 | [[2026-11-14_particle-1-handoff]] | First verified live send; rejection path verified; test mode still on |

## Rules for the next AI

1. **Do not claim a live result you have not seen evidence for.** Mocked tests are not live delivery.
2. **Never set `EMAIL_TEST_MODE=false`** without the owner's explicit instruction.
3. **Never retry an `UNCERTAIN` email.** Check Gmail Sent first, then reconcile manually.
4. **Never edit `EmailOutbox` body text after review.** The `content_hash` will reject the approval.
5. **Do not add paid tiers, domains, or billing** without owner approval.
6. **Do not scrape marketplaces or send unsolicited outreach.** Discovery is draft-only.
7. **Treat `docs/` and `CHECKLIST.md` as the source of truth** for status, not this summary.
