# LeadFlow resumed execution — 24 November 2026

The later pilot and current runtime status are in [PIPELINE_OPERATIONS.md](PIPELINE_OPERATIONS.md). The clean run below is historical and remains the baseline for the operational follow-up.

## Progress

- [x] Recovered interrupted changes, reconciled provider-test expectations with cooldown behavior, tested and pushed both foundations.
- [x] Added first-party identity checks, structured parent/branch evidence, locally throttled public retrieval, prospective service evidence and resumable decision storage.
- [x] Added source-aware intake, explicit classifier retry and source-evidence states, valid verdict caching, and existing-site draft positioning.
- [x] Created verified backups and ran a clean, shadow-only acquisition. Retained evidence and historic outreach records remain available for audit and are excluded from the fresh counts.
- [x] Verified metro and international acquisition and exercised the dashboard in Chromium.
- [ ] Achieve 400–500 genuine freelance candidates and 40–50 qualified opportunities.
- [ ] Achieve 50 evidence-qualified prospects in each metro and produce newly qualified email drafts where an appropriate, verified route exists.

## Clean run and provenance

The producer backup `leadflow-local-backups/leads-20261124-201412-927/leadflow.sqlite` passed SQLite integrity validation. The reset removed 991 disposable rows, preserved five source states, and invalidated stale conditional validators without advancing cooldowns. The consumer archived its previous ledger, inventory, enrichment results and draft outputs in `leadflow-local-backups/ai-20261124-201445-898`. Retained ownership evidence continues to be archived separately from fresh qualification. No suppression or source-rate bypass was used.

The new freelance run screened 26 Hacker News posts, imported zero and accepted zero. Five other publisher sources returned deferred. The authorized intake path was available and had no authorized buyer file. Compare with the previous 100 unique Jobicy candidates and zero acceptances. On the previous set, the new state logic distinguishes 36 retryable, ambiguous rows, one unresolved model decision and 63 other rejections. This was an audit of saved results. It made zero new provider calls. Find a Tender redirects and eligibility exclusions passed deterministic fixtures; live verification is due after the retained lease.

| Metro | Old publisher rows | Fresh publisher rows |
| --- | ---: | ---: |
| Mumbai | 125 | 249 |
| Pune | 123 | 245 |
| Bengaluru | 125 | 249 |
| Hyderabad | 120 | 242 |
| Kolkata | 123 | 247 |
| Delhi | 122 | 244 |
| Chennai | 123 | 246 |
| Total | 861 | 1,722 |

Overpass returned 502 on the first attempt and stayed paused for the remaining six cities in this run. Overture used the remaining city budget. No Foursquare import was available. These numbers count publisher records, not unique owners or qualified businesses. London returned 20 fresh records. The UK follow-up added 20 each in Birmingham and Glasgow, and repeated London returned zero new.

## Evidence outcomes and runtime drafts

There were 142 evaluation attempts over 141 distinct publisher records. The saved results contain 96 evidence reviews, 45 source retries, zero new automated exclusions and zero automatic qualifications. Existing deterministic corporate screening excluded 141 further inventory rows before enrichment. Of 704 directory-listed emails, only two evaluated sites produced a verified public contact observation. Those records lacked sufficient opportunity evidence. No prospect became draft-ready, and the new output directory contains zero EMLs.

| Main evidence outcome | Saved records |
| --- | ---: |
| Identity lacked both business name and corroborating location/contact | 40 |
| Page unavailable | 37 |
| Robots restriction | 27 |
| Official domain verified without ownership evidence | 18 |
| Aborted response | 8 |
| Content type, size or encoding rejected | 4 |
| Local control without a supported opportunity | 4 |
| HTTP 404 / 403 | 3 |

The run never restored previous ownership judgments into the fresh results. Two eligible records used prior official URLs only as hints for new retrieval. One returned an aborted response and one lacked sufficient ownership evidence. Draft generation tests exercised the new positioning, CTA, HTML escaping and price gate against fixtures. Runtime drafts from newly qualified leads remain blocked by the observed yield. Previous real drafts remain in the consumer backup and are historical.

## Browser and infrastructure

Chromium verified seven metro options, populated review rows, the enrichment control, decision filtering, the fresh-run label and an opt-in default for Jobicy. The browser observed no page errors. A local write with a missing origin header returned 403. No production UI deployment or external sends were made. Draft improvements omit ₹5,999 from existing-site proposals, support different calls to action, preserve the inline GIF and static fallback, and keep approvals local.

Graphify was refreshed in both repos. Context Mode summarized the archived ledger and scan data without displaying row-level contacts. RTK ran separately. A bounded local delegation asked about ownership gates and returned three useful checks in 11.8 seconds, 1,955 prompt and 146 output tokens. No global tool configuration or service port changed.

Consumer `npm run build` (including typecheck) and `npm test` passed with 243 tests. Producer `npm run typecheck` and `npm test` passed with 45 tests. Final producer commit is `2a3a935489f3ccb9a10da6ad6db53d1a79a48c1d` on `feature-new-sources-aa`. Foundation consumer commit was `4e46283ab64ace5106d70370de01e3f65078ffab` on `main`. Neither repository has tracked GitHub deployment workflows. Tests do not establish that live Find a Tender works through the Worker or that any model verdict is available in the zero-candidate clean run.

## Remaining limits

The strongest blockers are high-intent inventory and verified public evidence coverage. Public evidence fetches remain subject to robots policies and real transport limits. The candidate generator discovers source-listed and business-email domains. It lacks authorized broader search and native marketplace API credentials. The ownership reconciliation does not resolve every legal entity or multisite group. Add better lawful source evidence and classification fixtures before increasing targets. Delivery and reply telemetry remain outside the local draft flow.

## Run and resume

- Producer directory `leadflow-leads`. Run `npm run dev -- --port 8787 --ip 127.0.0.1 --persist-to .wrangler/state`.
- Consumer directory `leadflow-ai`. Set `FREELANCE_QUALIFICATION_MODE=shadow`, `TELEGRAM_ENABLED=false`, and `SAFE_OWNER_EMAIL_TEST=false` in PowerShell, then start `npm run dev -- --port 5174 --host 127.0.0.1 --strictPort`.
- Start a bounded business batch with `npm run business:scan -- --enrich-metros --limit=56`. Completed rows checkpoint automatically. Revisit eligible historical official URL hints with `npm run business:scan -- --enrich-metros --limit=7 --recheck-official-hints`. This re-fetches evidence and applies current gates; the old verdict is never counted.
- Resume freelance acquisition after the retained lease with `npm run external:collect -- --limit=100 --max-candidates=500 --fresh-days=14 --pages=5`, then `npm run external:run -- --drain`. Find a Tender, WordPress Jobs, Jobicy and Remotive are due after 22:14 IST on 24 November, and Himalayas after 00:46 IST on 25 November. Native marketplace connectors still require approved API access. For manual authorized import and detailed contracts see `COPILOT_HANDOFF.md`.

The dashboard is at `http://127.0.0.1:5174/pipeline`. The producer health endpoint is `http://127.0.0.1:8787/health`.
