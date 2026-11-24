# Local pipeline overhaul

## Execution checklist

- [x] Read the project and tooling instructions. Query both Graphify indexes and confirm behavior against source and the saved ledgers.
- [x] Reconcile the old data. The saved 57 were historical, with 55 AI verdicts, two rules verdicts, one scoped WordPress acceptance and 56 rejections. Of those, 29 had unclear engagement, 14 full-time, 11 ambiguous direction, one stale and one unpaid. Eight unclear samples included physicians, a clinician, an evaluator, an app tester and a technical contractor opening. A contract tag supplied no project boundary.
- [x] Reconcile the saved metro scan. Its 578 directory rows included 52 exclusions and three holds. The 523 row queue meant absence of a chain flag, which did not verify ownership. Listed email counts did not verify a business contact route.
- [x] Add bounded acquisition and a local review view. Report collector totals separately from intake and qualification.
- [x] Require affirmative ownership and digital opportunity evidence. Run bounded local Ollama screening as an advisory signal.
- [x] Generate five real, manually evidenced draft samples, subject alternatives and branded EML files. All remain unsent.
- [x] Back up and reset generated data, preserve source cooldowns, restart both servers and run fresh discovery.
- [x] Reconcile an orphaned provenance defect and verify the final dataset without re-polling the affected provider.
- [ ] Broaden legitimate buyer-side inventory enough to reach 40–50 qualified opportunities. Continue verified business enrichment toward 50 per city.

## Ownership

The Worker collects, normalizes and deduplicates into local D1. The LeadFlow AI runner consumes source evidence and writes its own qualification ledger. The local business runner resolves locations, invokes the Worker and Overture reader, and stores a separate review snapshot and drafts. The dashboard exposes local-only operations. Shared Ollama is loopback-only on port 11434. The Worker uses 8787 and the dashboard 5174. No production deployment or repository push is part of this task.

## A. Causes

Job boards published employment-like roles under a contract tag, including physicians, evaluators and ongoing staffing. The old counts combined persisted inventory with the latest source state. The business shortlist inferred independence from the absence of a known chain flag. Neither a missing website field nor a source-listed email verified an opening for outreach.

## B. Changes by repository

- LeadFlow Leads added `src/adapters/ukTender.ts` for official active UK procurement notices, with a lease, bounded pagination, deadlines and canonical IDs. Related route and expiry filters are in `src/index.ts` and `src/db.ts`. The source stays in local review pending human verification of agency eligibility.
- LeadFlow AI added bounded collection flags in `scripts/external-pipeline.ts` and source selection, an acquisition cap, duplicate counts and a review view in `apps/web/src/PipelineDashboard.tsx`. Fresh-only reset uses the producer's `found_at` field, rather than implying all public posts were published this run.
- `scripts/local-business.ts` and `packages/core/business-qualification.ts` separate pre-screening, linked human-checked evidence, contact-path availability and draft eligibility. `scripts/local-business-data.py` captures Overture brand metadata and resolves GeoNames aliases. Review evidence includes ownership, website state, dated source links and a specific opportunity. Configurable scan budget defaults to 250 per city, up to 400.
- `scripts/ollama-local.ts` uses the HTTP runtime directly with structured output, a loopback allowlist, one in-flight request per process and a timeout. Local AI can flag reviews. Existing approved models can assist drafting or classification. Rules and safety gates continue to apply.
- `packages/core/business-draft.ts`, the local API and the dashboard now support alternative subjects, a preferred subject, a service idea, branded EML and local approval/rejection bound to the exact draft fingerprint. Approving records a local review event and has no sender.

## C. Reconciled before and after

| Metric | Archived view | Fresh result |
| --- | ---: | ---: |
| Freelance raw rows seen by current collectors | Not comparable from old ledger | 149 |
| Freelance unique ingested | 57 historical | 100 fresh |
| Freelance accepted | 1 | 0 |
| Freelance rejected / review displayed | 56 rejected on old binary view | 63 rejected / 37 review |
| Freelance contactable / draft-ready | Not measured using this gate | 0 / 0 |
| Indian business listings | 578 historical | 861 fresh publisher IDs |
| Business excluded / review | 52 / 3 under old rules | 81 / 775 |
| Business qualified / public contact path / draft-ready | Not measured under the new evidence standard | 5 / 5 / 5 |

No historical lead rows were included in the refreshed dashboard counts. The 100 new freelance records took about 122 seconds from first ingest to completed drain. Business insert timestamps span about 166 seconds across the seven metros. These are measured timestamps, and exclude setup, manual evidence checks and draft generation. A count of publisher IDs does not certify 861 distinct business owners.

## D. Freelance source results

| Source | Raw | New | Duplicates | Qualified | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Hacker News | 33 | 0 | 0 | 0 | No buyer candidates |
| Himalayas | 0 | 0 | 0 | 0 | Deferred under its retained cooldown |
| Jobicy RSS | 116 | 100 | 0 | 0 | 111 passed collector checks. The per-source cap retained 100 |
| Remotive | 0 | 0 | 0 | 0 | Publisher returned unchanged |
| UK Find a Tender | 0 | 0 | 0 | 0 | Worker returned 502. The official public API replied 200 to a separate diagnosis |
| WordPress Jobs | 0 | 0 | 0 | 0 | Publisher returned unchanged |

Jobicy acceptance yield was 0/100. Underlying reasons were 71 unclear engagement, 18 full-time, nine ambiguous direction, one internship and one unpaid. The local review view separates 37 ambiguous cases from the 63 non-actionable rejections. The model found ongoing seats even in listings with attractive technical keywords. The saved example `Senior Backend Engineer (Booking Integrations, Contract)` was classified as an ongoing seat. [UK open data documentation](https://www.gov.uk/government/publications/open-contracting#find-a-tender)

## E. Business results

| City | Fetched / unique source IDs | Corporate exclusions | Evidence review | Qualified | Public route / draft-ready |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mumbai | 125 / 125 | 7 | 117 | 1 | 1 |
| Pune | 123 / 123 | 2 | 121 | 0 | 0 |
| Bengaluru | 125 / 125 | 20 | 102 | 3 | 3 |
| Hyderabad | 120 / 120 | 12 | 107 | 1 | 1 |
| Kolkata | 123 / 123 | 13 | 110 | 0 | 0 |
| Delhi | 122 / 122 | 12 | 110 | 0 | 0 |
| Chennai | 123 / 123 | 15 | 108 | 0 | 0 |

No city reached the 50 qualified target. A total of 339 rows listed an email. Only the five public contact routes used for draft readiness were reviewed. Overpass returned HTTP 502 in all seven metro requests. Overture supplied all 861 usable rows. The run had no verified Foursquare open import. London returned ten new Overture listings. A subsequent UK scan returned ten in Birmingham and ten in Glasgow, and London returned zero new because its ten were deduplicated. Overpass was paused for the international checks after the seven failures. [Overture Places provenance](https://docs.overturemaps.org/guides/places/)

## F. AI and developer tooling

The real metro screening made seven Ollama batches and received 84 preliminary annotations, using 2,533 prompt and 728 output tokens in 13.2 seconds of model runtime. A small six-case focused fixture got three labels right and missed a brand alias, franchise wording and an adversarial listing. That is insufficient for final qualification. The 100-row freelance run used 30 requests across approved providers. Gemini returned seven verdicts from nine requests, Groq seven from 11, Cloudflare two from six and OpenRouter zero from four. Rules finalized 84 rows. No new paid provider or recurring cost was added. No billing receipt was available for those preconfigured services.

Queried and incrementally refreshed both Graphify graphs. The local development bridge returned preliminary tests from one tracked file using 1,402 prompt tokens, 350 output tokens and 13 seconds. Native tools for Context Mode and the local bridge were absent in this desktop session. Their existing stdio transports worked without changing registration. Context Mode reported 13.6 KB indexed and 186 B surfaced in the measured indexing probe. RTK ran explicitly; its new narrow output produced no measured savings. These are tool metrics, not GPT subscription usage. [Ollama structured output](https://docs.ollama.com/capabilities/structured-outputs)

## G. Dashboard

Open `http://127.0.0.1:5174/pipeline`. Select **Refresh freelance feeds** to poll only the chosen sources. **Qualify next batch** consumes saved results. **Show review and excluded listings** exposes the evidence review form for local businesses. Verified evidence moves a listing to the default view. A verified public route enables **Draft for …**. Draft preview, download and review controls are local.

Chromium verified the 500 cap control, Find a Tender source selection, the business review list, the Abhinava draft preview, three alternative subjects and a successful EML download. The API verified drafts for all five reviewed prospects. A request without the local same-origin write header received HTTP 403. Approval decisions remain for the owner.

## H. Tests and safety

`npm run build` and `npm test` in LeadFlow AI, and `npm run typecheck` and `npm test` in LeadFlow Leads. LeadFlow AI had 228 passing unit tests and LeadFlow Leads had 41. Tests include active versus expired tenders, staffing exclusion, verified business gating and contact evidence. Browser and runtime checks used local endpoints only for writes. User-supplied public evidence links are stored, never automatically fetched by the application. No outbound message, deployment, paid model or repository push happened.

## I. Draft examples

See the ignored local `outputs/local-business/OUTREACH_SAMPLES.md` for the five editorial samples, subject alternatives, evidence links and reusable structure. The app generated unsent EMLs with plain text, HTML, and inline logo IDs for the same five recipients. The logo has a static PNG fallback. Gmail and Outlook were not sent the files for rendering verification.

## J. Restart, resume and backup

Start the producer in `D:\freelance_personal\leadflow-leads` with `npm run dev -- --port 8787 --ip 127.0.0.1 --persist-to .wrangler/state`. From `D:\freelance_personal\leadflow-ai`, set `FREELANCE_QUALIFICATION_MODE=shadow`, `TELEGRAM_ENABLED=false`, `SAFE_OWNER_EMAIL_TEST=false`, and run `npm run dev -- --port 5174 --host 127.0.0.1 --strictPort`. Health checks are `http://127.0.0.1:8787/health`, `http://127.0.0.1:11434/api/tags`, and the dashboard URL. Local Ollama startup is `D:\freelance_personal\.codex-tools\ollama\start-local.ps1` when its port is free.

Resume collection using `npm run external:collect -- --limit=100 --max-candidates=500 --fresh-days=14 --pages=5` after the relevant source cooldown, then `npm run external:run -- --drain`. The 14-day setting applies to Find a Tender. The other providers retain their own window and freshness rules. For business refresh use `npm run business:scan -- india-metros`. For an intentional future reset use the two stages of `scripts/reset-local-pipeline.ps1` with `-PreserveHistory`. The reset preserves reviewed statuses and source deadlines. For rollback, stop both local services before restoring a desired backup.

Backups are `leadflow-local-backups/leads-20261124-161416-097/leadflow.sqlite`, `leadflow-local-backups/ai-20261124-161436-019` and `leadflow-local-backups/provenance-repair-20261124-162036.sqlite`. The initial reset left 772 orphan source-observation rows because the local FK has no cascade. A follow-up backup and transaction relinked 448 matching publisher IDs in the same Overture release, preserving their original evidence dates. The remaining 324 orphan observations are in the backup and were removed from the active index. The reset now deletes observations for disposable leads explicitly and enables FK enforcement.

## K. Still open

The numerical targets remain unmet. Investigate the detailed Find a Tender Worker error on its next permitted poll. A legitimately accessible project-marketplace connector still needs approved data access. The present business evidence workflow is manual, so scaling beyond five records requires additional permitted evidence, further reviewer time or both. Deduplication by actual ownership, resume of interrupted multi-city scans, and full outbound delivery/reply tracking are incomplete. Approval is local and there is no delivery route in this task.

The retained lease puts Find a Tender, WordPress Jobs, Remotive and Jobicy after about 22:14 IST on 24 November. Himalayas is after about 00:46 IST on 25 November. Leave these deadlines intact.
