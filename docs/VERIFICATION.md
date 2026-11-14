# Verification record — 14 November 2026

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
