---
date: 2026-11-14
author: Particle-1
model: Particle-1
project: LeadFlow AI
repository: leadflow-ai
status: live-verified
phase: P0 private loop
tags:
  - handoff
  - capsule
  - leadflow
  - live-verification
  - apps-script
  - telegram
  - gmail
  - gemini
related:
  - "[[CHECKLIST]]"
  - "[[VERIFICATION]]"
  - "[[HANDOFF]]"
previous: null
next: null
---

# 2026-11-14 — Particle-1 handoff

## TL;DR

The private loop is **live and verified**. The first real owner-approved email was delivered through Gmail, and the rejection path was verified to send nothing. The only remaining gate before real prospects is flipping `EMAIL_TEST_MODE` to `false`.

## Verified live evidence

| Check | Result |
|---|---|
| First enquiry `lf_aa56b3a2c2e1bd54` | **SENT** — Gmail message ID `40172ee23ce4a7b8ec6c7e37376779136` |
| Second enquiry `lf_dedbc78879f48cc6` | **REJECTED** — no email sent, `EmailOutbox` and `Leads` both `REJECTED` |
| Public site | https://leadflow-agency.pages.dev — six routes, favicon, social image all HTTP 200 |
| Signed intake | Turnstile + HMAC verified; real receipt persisted in `Leads` and `IntakeReceipts` |
| Telegram | `@LeadsFlowwBot` private owner chat; real alert, real Approve, real Reject observed |
| Gemini | Free tier confirmed; real qualification and exact-quote draft plan returned HTTP 200 |
| Apps Script | Deployment version 4 live; one 10-minute `tick` trigger installed |
| Automated tests | 67 unit/adapter/GAS-runtime tests passing |

## What the loop does

```
Website /contact
  → Cloudflare Pages Function (Turnstile + HMAC)
  → Apps Script doPost (verifyEnvelope → IntakeReceipts)
  → tick() every 10 minutes
      → processInbound   (Gemini classify + planEmailGemini → EmailWorkflow.prepare)
      → notifyEmails     (Telegram alert, REVIEW_PENDING, nonce + expiry)
      → pollTelegram     (owner send:/hold:/deny: → EmailWorkflow.decide)
      → deliverEmails    (SENDING barrier + flush → Gmail → SENT)
      → syncEmailReviewMessages (edit Telegram to final status, remove buttons)
  → Lead EMAIL_SENT, EmailOutbox SENT with gmail_message_id
```

Discovery (Gmail label / HN / manual CSV) is a **separate draft-only path**. It never emails a prospect.

## Safety properties that are enforced in code

- `content_hash` binds the exact recipient, subject and body; editing the outbox after review invalidates the approval.
- Owner identity, chat ID, chat type, message ID, nonce and expiry are all checked in `EmailWorkflow.decide`.
- `SENDING` is persisted and `SpreadsheetApp.flush()` is called **before** the Gmail call.
- An ambiguous send becomes `UNCERTAIN` and is **never** automatically retried.
- `Gmail.Users.getProfile` must match `GMAIL_SENDER_EMAIL` before any send.
- `EMAIL_TEST_MODE` blocks any recipient other than `SMOKE_TEST_EMAIL`.
- Consent is re-checked at send time, not just at approval time.

## Outstanding before real prospects

1. **Set `EMAIL_TEST_MODE=false`** in Script Properties. This is the only remaining gate. Do it only after the owner is satisfied with the smoke evidence above.
2. **Replay the old approval** for `lf_aa56b3a2c2e1bd54` and run `tick` — confirm exactly one email exists and no duplicate is sent.
3. **Update [[CHECKLIST]] and [[VERIFICATION]]** to record the now-verified send and the replay result.
4. **Record evidence privately** — deployment ID, lead reference, Gmail message ID — outside the repository.

## Known limits (not blockers)

- Physical Safari and full screen-reader certification are not done.
- Google Sheets is not transactional; a hard failure between a row write and its audit append can require manual reconciliation.
- Free-tier quotas are not a 24/7 availability guarantee.
- No domain, paid tier, or billing is authorised.

## Next AI: start here

1. Read [[HANDOFF]].
2. Read [[CHECKLIST]] and [[VERIFICATION]] for the authoritative status.
3. Read `docs/OPERATIONS_RUNBOOK.md` before touching the live system.
4. Do not change `EMAIL_TEST_MODE` without explicit owner instruction.
