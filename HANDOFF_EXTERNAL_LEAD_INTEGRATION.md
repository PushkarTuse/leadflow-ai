# External lead integration recovery log

## 2026-11-16 — Initial inspection

Read `docs/EXTERNAL_LEAD_INGESTION_CONTRACT.md` completely and inspected existing automation adapters/runtime. Cloned co-founder repository read-only into `D:/freelance_personal/leadflow-leads` at HEAD `52f8c49899dfcddc58d09e4bff92f9447163238d`. No dependency install, database creation, source collection or hosting performed there.

The supplied CSVs contain a richer schema than the example: `source_id`, `title`, `url`, `signal`, `found_at`, plus names/contact fields and producer score/status. Existing strict LeadInput does not accept producer score/status or arbitrary source names. Discovered opportunities must retain UNKNOWN permission and stay outside the consented inbound EmailOutbox path. HN needs no API key; API_TOKEN protects the co-founder's own API and is self-chosen.

Plan: inspect actual endpoints/adapters, map a bounded pull batch into canonical inputs, connect the poller to existing Engine.ingest without changing email permissions, add focused synthetic tests, document later local setup. Google Places stays excluded; Kapicks unchanged. Prefer a disabled-by-default pull connector over creating the separate proposed public signed ingress; this avoids a new public attack surface for iteration one.

Commands: `git ls-remote ... HEAD`; `git clone --depth 1 ...`; inspected CSV headers/first rows and repository file inventory. Next: inspect types/index/collect/HN and the current source scheduling code, then implement validated mapping and cursor handling.

## Inspection decisions — actual upstream behavior

`GET /leads` returns `{ok,total,count,limit,offset,leads}` with Bearer API_TOKEN auth. Supported sorting includes found_at (with id DESC tie-break), not id. Use bounded offset pages sorted found_at ASC, without status filtering, wrap to zero at end so future scans recover shifts/deletions; Engine dedup makes repeated scans safe. No claim of transactional/exactly-once producer pagination. Do not PATCH upstream statuses: `contacted` would misrepresent ingestion. Only GET /leads and official HN GETs are needed; never trigger collection automatically from Apps Script.

HN upstream collects monthly comments via Algolia, not jobstories; source_id is the HN comment ID. It drops original text/time and includes only truncated headline plus a synthesized signal. Fetch original HN Firebase item by source_id before mapping; fail closed on missing/dead/deleted/non-job-or-comment data. Use original timestamp, text, and canonical HN URL. This is the main schema gap, solved in our adapter without changing the co-founder's repo. Other keyless rows can map as incomplete source summaries with provenance notes, but default routing enables HN only. No marketing vertical inferred; no producer score/status/contact consent trusted.

Mapping: hackernews → hn, other reviewed keyless sources → csv; source_id → source_external_id (namespaced for non-HN); url → source_url (HN rebuilt); found_at → discovered_at; original HN time → posted_at; title → title (HN canonical title/text preferred); original HN text → raw_description; name → client_name_if_public only for non-HN (HN author is not verified client); city/country → country_or_region; budgets null/currency UNKNOWN; contact_email empty/permission UNKNOWN; owner_notes records provider/category/incomplete evidence. Drop phone/email/address/producer score/status/notes/tags from canonical authority. Reject Google Places and unknown sources.

## Implementation checkpoint

Added `apps/automation/external-leads.ts`: bounded response/row validation, explicit keyless source allowlist, secure HTTPS origin and 32+ character token validation, canonical mapping, official HN enrichment, per-item invalid counts, duplicate-safe ingest callback and wrapping offset. Added disabled-by-default Script Properties to settings example and a source-cycle pull branch in `main.ts`. Existing runtime HTTP guard now permits only the configured external origin's `/leads?` path; redirects remain disabled and provider responses/errors remain bounded/redacted. CRM flush occurs before offset persistence. Failure before checkpoint replays the page and deduplicates existing records; no provider status writes or external collection calls.

Important: Apps Script cannot reach localhost. This integration can be exercised with an injected fake HTTP transport now, but real scheduled pulls require a reachable HTTPS deployment later. No new public discovery receiver was built; the old proposed HMAC receiver contract remains a future design. Existing engine dedup retains first-seen records, including changed repeats; it is not the proposed HTTP receiver's changed-payload rejection protocol. Non-HN summaries omit producer signal to avoid synthesised score evidence. No full original date/body exists upstream, so those sources default off pending source-use review and richer evidence.

Next: focused tests through Engine for dedup/scoring, validation/host/token boundaries, retry handling; typecheck and automation bundle. Then append exact local setup and activation steps.

## Verification and session completion — 16 November 2026

Implemented files: `apps/automation/external-leads.ts`, scheduling/HTTP allowlist in `apps/automation/main.ts`, disabled properties in `settings.example.json`. Added six adapter tests in `tests/external-leads.test.ts` and a real bundled GAS runtime test in `tests/gas-runtime.test.ts`. That runtime test exercises source pull → original HN lookup → Sheet persistence → internal qualification → owner Telegram review, then replay deduplication; EmailOutbox contains headers only and Gmail send count stays zero. All provider interactions are simulated.

Commands/results:
- `npx vitest run tests/external-leads.test.ts tests/gas-runtime.test.ts`: **16 passed**.
- `npm run build:automation`: passed; local Code.gs bundle only.
- `npm test`: **82 passed** across five files.
- Final `npm run typecheck`: passed after parsing an unknown fixture through inputSchema in the new runtime test.
- `git diff --check`: passed (Windows newline notices only).
- Python csv module inspected both attached files without copying contacts into repo: each has 105 rows (67 hackernews, 23 remoteok, 12 arbeitnow, 3 jobicy). These totals do not establish unique leads across files. Neither CSV has been imported to Sheets or used to contact anyone.

Created `docs/EXTERNAL_LEAD_API_SETUP.md` with exact mapping, later local commands/Postman order, Script Properties, HTTPS deployment prerequisite, pagination/retry semantics and remaining acceptance gates. Linked this work from root HANDOFF, CHECKLIST and original external contract. Original contract is retained with an implementation addendum, not replaced. No Kapicks files, deployment, credentials, live Script Properties or Gmail rules changed. This session's integration code is local and disabled; it has not been uploaded to Apps Script or pushed/deployed.

### Exact next session sequence

1. Read this file plus `docs/EXTERNAL_LEAD_API_SETUP.md`. API clone is at D:/freelance_personal/leadflow-leads, reference commit above.
2. Run `npm ci`, create ignored .dev.vars with strong self-chosen API_TOKEN and no Google key, `npm run db:local`, `npm run dev`. Use initialsetup Postman collection: health → sources → collect/hackernews with limit 5 → leads → runs. Do not print tokens or copy private CSV contact data into Git.
3. Verify returned source_id/url/found_at and original HN post evidence. No subscription or HN login is needed. Check current repository state before any edits; local API runtime/dependency install is deliberately untested here.
4. For real scheduled pull, deploy external API free-first with D1 and strong private token; localhost is unreachable from Google. Do not configure Places. Decide provider hosting only after local API validation. Review free quotas before deployment.
5. Build/upload compatible Apps Script, set EXTERNAL_LEADS properties privately, HN-only initially; retain existing Gmail approval/test flags. Run one bounded tick and inspect SourceRuns, Sheet record, original evidence and owner Telegram notification, then replay for dedup. This is a discovered-lead draft workflow, not an automatic cold-email authorization.
6. Later enrich other source descriptions/dates and review permissions before enabling them. Add marketing-specific scoring, stronger upstream keyset pagination/dedup, reply monitoring/digests and permitted outbound policy as separate changes. Proposed public signed discovery receiver remains unimplemented and unnecessary for this pull iteration.

## Continuation — 16 November 2026: push and local setup

Reviewed status/diff, committed all integration work as `cc71818` (feat: add external lead API adapter with HN enrichment and tests), pushed origin/main and verified remote HEAD matches. Co-founder clone was clean; no code changes or pushes there. Ran `npm ci` in leadflow-leads: 75 packages installed, audit zero vulnerabilities. Created ignored `.dev.vars` with a self-chosen local-only token long enough for our adapter and empty GOOGLE_API_KEY. Ran `npm run db:local`: all seven migration commands succeeded locally. Started `npm run dev -- --ip 127.0.0.1 --port 8787`; Wrangler reports Ready, local DB binding. Process session 92005 at this checkpoint. Production connector/config remains unchanged/disabled. Next: health/auth/source checks, bounded HN collect and API/SQLite verification, then real-data adapter mapping.

## Local collection and real-data adapter validation — 16 November 2026

Local API remains running at http://127.0.0.1:8787 (restart with `npm run dev -- --ip 127.0.0.1 --port 8787` from leadflow-leads if stopped). Health succeeds; /sources confirms HN ready and Google Places not ready. Unauthenticated GET /leads returns 401. Authenticated POST /collect/hackernews with limit 5 returned fetched=5, inserted=5, duplicates=0 in 4397 ms. /leads and /stats confirm five HN company_hiring records, all status=new. Direct `npx wrangler d1 execute leadflow --local --command "SELECT source, COUNT(*) AS count FROM leads GROUP BY source;" --json` confirms hackernews=5. SQLite file: `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/9ba2b04bf514d9facfd57ed57d849e77241a7adc99d1c1545d06688b43d84248.sqlite`. No other source collection needed to meet the bounded first validation.

Added repeatable `scripts/validate-external-local.mjs` in our repo. Run from leadflow-ai with `node scripts/validate-external-local.mjs` (optional API repo path argument). It reads only the adjacent ignored local .dev.vars, fetches the real five-row API page and real original HN Firebase items, then replays those responses through the production synchronous adapter using an explicit in-memory transport. A virtual HTTPS hostname is a transport key only; it makes no external request and does not relax production HTTPS validation. Engine and Store are in memory; no Google/Telegram/Gemini/Gmail credentials loaded, no live CRM/outbound effects. The script uses bounded fetch timeouts, blocks redirects, validates canonical mapping and replays for duplicate checks.

Validation passed: first imported=5, invalid=0; replay duplicates=5/imported=0. HN IDs 50345770, 50353098, 50403646, 50428062, 50495944. Original text lengths 1036, 621, 719, 1237, 674. Rules scores 66,11,36,72,59 respectively: three PENDING_APPROVAL and two NEW in the local memory store. All canonical source=hn, original links/time preserved, contact_email empty, permission UNKNOWN, no consent fabricated. This is a real-data adapter check, not a live Sheet/Gemini/Telegram delivery test.

Co-founder repo tracked files remain untouched and nothing was pushed there. Only ignored node_modules, .dev.vars and .wrangler state were created. No production deploy, connector activation, remote D1 creation or Kapicks work performed. Next: review documented future HTTPS setup; production activation requires a later explicit task. Keep EXTERNAL_LEADS_ENABLED=false.
