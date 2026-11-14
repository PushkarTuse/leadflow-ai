# LeadFlow launch checklist

Updated 14 November 2026, Asia/Kolkata. V3 authorizes live website intake and Gmail replies after explicit owner approval. Discovered opportunities remain draft-only/manual submission.

| Work | Status | Evidence / remaining |
|---|---|---|
| Original brief and six-tab XLSX inspection | Done | Originals preserved; legacy import mapped; original CRM has no entered leads |
| Responsive agency site | Tested | Desktop/mobile routes, forms, accessibility |
| Six-step guided demo | Tested | Completion, back, Escape, keyboard focus, CTA, mobile accessibility |
| Cloudflare intake + Turnstile + HMAC | Tested locally | Origin, hostname/action, bounded schema, timestamp/signature, duplicate protection |
| Sheets → qualification/draft → Telegram → approved Gmail | 67 automated tests passed; live smoke in progress | Actual Apps Script bundle completes mocked loop exactly once; real site receipt verified |
| Live contact interface | Tested with mocked provider boundary | Two desktop/mobile tests; retries retain ID; no false receipt |
| Production builds and dependency audit | Passed | npm install/build; zero known vulnerabilities |
| Venture Google account and OAuth | Connected | leadsflowwai@gmail.com; owner approved clasp and script grants |
| CRM Sheet + bound Apps Script | Live | Website smoke receipt lf_aa56b3a2c2e1bd54 persisted in Leads and IntakeReceipts |
| Cloudflare Pages + Turnstile | Live | https://leadflow-agency.pages.dev; actual public form returned a verified receipt |
| Telegram | Connected and tested | @LeadsFlowwBot; private owner /start response verified; command menu registered |
| Gemini | Connected and API-tested | Venture free tier; gemini-3.5-flash-lite; actual qualification and exact-quote draft plan passed |
| Apps Script web deployment + server secrets | Live, version 4 | Signed intake; credentials in Script Properties and Cloudflare secrets; explicit Sheet flush before outbound effects |
| Diagnostic log rollover | Implemented and tested | Archives complete SourceRuns tabs at 4,000 rows; no log deletion; recovery test passed |
| Real public-site smoke test | Waiting for owner approval | Public form → Sheet → Gemini → Telegram passed. First enquiry lf_aa56b3a2c2e1bd54 is REVIEW_PENDING; Gmail Sent is empty. Owner must approve its exact email |
| Live rejection test | Passed | Second enquiry lf_dedbc78879f48cc6 became REJECTED in Leads and EmailOutbox; no email sent |
| Final delivery/replay verification | Remaining after owner approval | Verify Gmail Sent + inbox and persisted message ID, then repeat old approval and confirm one email only |
| Scheduled first-customer operation | Trigger installed; recipient restriction retained | One 10-minute tick trigger verified; EMAIL_TEST_MODE remains true until smoke passes |
| V3 setup and operations documentation | Updated | See SETUP and LIVE_SMOKE_TEST |

No mocked check counts as live verification. No prospect contacted, no domain purchased, no paid service enabled.

