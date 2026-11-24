# Operational verification ledger

## 24 November 2026, baseline before changes

- [x] Read the resume reports and checked both Git worktrees. Consumer `8670cfd` on `main`, producer `2a3a935` on `feature-new-sources-aa`. Both matched their upstreams. Private untracked `AGENTS.md` files are outside the change set.
- [x] Reconciled the saved metro snapshot against persisted enrichment. Of 1,722 publisher records, 141 were pre-screened out, 141 were evaluated (96 evidence review, 45 retry), and 1,440 were awaiting enrichment. No active enrichment job or new qualified prospects. Publisher IDs cannot establish a distinct owner count.
- [x] Backed up JSON and SQLite using SQLite's backup API before pilot writes. Local backup `D:\freelance_personal\leadflow-local-backups\operations-20261124-203805`.
- [x] Improve evidence corroboration and verify a real Mumbai/Pune pilot against saved inventory.
- [x] Verify buyer-source availability and authorized brief preview and deduplication in test storage.
- [x] Verify dashboard controls and initial draft artifacts.
- [x] Finish the existing enrichment backlog and measure results. Pilot yield remains below the requested ten.
- [ ] Verify an authorized live marketplace import and a due Find a Tender poll. No five-opportunity pilot exists yet.

The saved inventory is the pilot input. Avoid a destructive reset while diagnosing it. Retain source cooldowns and use only unsent local artifacts.

## Pilot checkpoints

- First automated pass, 72 Mumbai/Pune records drawn from the untouched queue. Zero qualified, 46 evidence review and 26 source retries. Top reasons were DNS resolution failure (20), undocumented ownership after site match (17), and name/location mismatch (15).
- Representative allowed pages showed local founders identified in owner bios, with forms, booking partners, phone or WhatsApp enquiry paths that the original extractor treated similarly. The follow-up evidence pass recovered four qualified records in the saved inventory by the 54th checkpoint. Three had an email route and one had a phone route. The result needs spot checking before scaling. Sites disallowing the crawler remain restricted.
- Existing HN collector screened 26 posts and imported zero. The last retained cooldown is 22:14 IST for Find a Tender, Jobicy RSS, WordPress Jobs and Remotive, and 00:46 IST for Himalayas. The Freelancer RSS source reports `ready: false` because no permitted feed is registered.

At the 21:02 IST checkpoint the live dashboard showed 537 completed enrichments out of 1,722 publisher records, 1,038 awaiting, three processing, 147 excluded, 353 evidence reviews, 174 source retries, seven qualified, 48 independently verified public contact routes across all decisions, and five qualified email draft-ready. The continuing backlog will change these counts. Normalized publisher IDs do not verify unique ownership. Three actual unsent drafts were checked in Chromium. One used local Ollama and two used the grounded fallback. Each EML contained plain text, HTML and the ten-frame embedded GIF. No recipient was populated.

The producer preview/search changes are at `a0e88902fd0b6efceb63d99301430c70e78f58f4` on `feature-new-sources-aa`, verified on its remote. Producer typecheck and 46 tests passed. Consumer typecheck, 245 tests and its storefront/automation build passed. The build emitted Vite warnings for future native configuration loading and large existing 3D chunks. Chromium verified city selection, filters, pagination, preview validation, pause/resume availability and draft downloads against the local services.

Consumer implementation checkpoint `bc5b30649ceec18234b9514ecebe6b6aee1ed510` is verified on `main`. Chromium also triggered the complete freelance control for the import-only source, observed an `IMPORT_ONLY` result, and reloaded the persisted results. The tighter copy validation rejected a local AI subject that duplicated its call to action. All three latest drafts used the evidence-backed templates and were saved as local EML previews.

At 21:07 IST, 792 rows had completed evaluation. The dashboard showed 783 awaiting enrichment, three processing, 148 excluded, 599 evidence reviews, 181 source retries, eight qualified, 57 public contact routes across all decisions and six qualified email draft-ready. Qualified/count of verified public contact routes by city: Mumbai 3/14, Pune 2/5, Bengaluru 0/6, Hyderabad 0/5, Kolkata 1/7, Delhi 2/8, Chennai 0/12. The first-party domain or independent operator evidence was missing for 169 updated-rule records and a further 162 domains failed identity corroboration. These are observed gaps. Expanding publisher inventory alone does not resolve them.

### Completed existing backlog at 21:10 IST

The worker resumed after a browser-triggered pause and evaluated all 1,113 candidates in its resumed selection. The final persisted inventory has 1,578 completed evidence evaluations and 144 pre-screened exclusions without evidence evaluation. Compared with the backup, there are 1,437 first-time evaluations and 20 re-evaluated records. The dashboard has zero awaiting or processing, 148 excluded overall, 1,383 evidence reviews, 183 source retries, eight qualified, 57 verified public contact routes across all outcomes and six qualified email draft-ready. The dataset has 1,653 observed name/city combinations. They are neither unique owners nor a verified distinct-business count.

| City | Publisher records | Qualified | Verified public contact route | Draft-ready |
| --- | ---: | ---: | ---: | ---: |
| Mumbai | 249 | 3 | 14 | 2 |
| Pune | 245 | 2 | 5 | 2 |
| Bengaluru | 249 | 0 | 6 | 0 |
| Hyderabad | 242 | 0 | 5 | 0 |
| Kolkata | 247 | 1 | 7 | 0 |
| Delhi | 244 | 2 | 8 | 2 |
| Chennai | 246 | 0 | 12 | 0 |

Of the evaluated records, 932 had no corroborated first-party domain or independent operator source, 194 had a site that failed the identity check, 99 candidate sites lacked sufficient ownership evidence, 97 had DNS resolution failures, and 82 encountered a robots restriction. The final reset remains pending while authorized-source and live verification work is open. The 10-pilot, 50-per-city, 350-overall and 40–50 freelance targets remain unmet.

## Runtime contracts

- `scripts/business-evidence.ts` accepts name, region, public domain, address and contact hints. Corroboration uses first-party title/structured name plus location, postcode or matching phone. Operator and franchise facts, digital opportunity and public contact observations are stored separately. Known booking providers or an existing flow suppress a redundant booking proposal. DNS/network failures, policy restrictions and official-identity mismatches keep their separate result codes. A missing publisher website field carries no assertion about the business's website.
- `scripts/business-web.ts` continues to pin public DNS, revalidate redirects and enforce robots policy. Gzip and Brotli streams have wire and decoded byte ceilings. A refused policy, certificate failure or non-public target never opens access to the underlying page.
- `scripts/local-business.ts` checkpoints every three records in `data/local-business/enrichment-v1.json`. `enrichment-batch.json` contains the active local worker PID and record keys. `enrichment.pause` requests a stop after the current batch. The runner preserves completed checkpoints on resume. Two-hour transport retries cover common 5xx/timeout responses, and other retry classes retain longer delays. The updated-rules pass selects eligible old evidence reviews and excludes robots, denied access and parent decisions. Concurrent entry points share one lease.
- The local dashboard reads the same snapshot and classifier profile as the runners. Process environment `LEADFLOW_LOCAL_PROFILE` takes dashboard precedence, followed by `EXTERNAL_LOCAL_PROFILE` and the latter key from `.env.external`. Any explicit CLI profile should match the dashboard profile. The dashboard run controls suppress Telegram and email side effects.
- Worker `POST /import/authorized-projects` accepts `permission_confirmed`, `projects` and `preview`. Preview returns per-row `valid`, `invalid`, `duplicate_in_file` or `already_imported`. The importer verifies the original HTTPS reference, active UTC deadline, source authorization and basic scoped-project evidence. Stored aliases deduplicate by canonical URL. The browser invokes the Worker through loopback Vite middleware and never receives its bearer token. Production publishing and sending are outside this path.

## Run and recover

```powershell
# LeadFlow Leads, 127.0.0.1:8787, existing local D1 profile
npm run dev -- --port 8787

# LeadFlow AI, 127.0.0.1:5174
npm run dev -- --port 5174 --host 127.0.0.1

# From LeadFlow AI, in a separate terminal. Scans existing saved candidates.
npm run business:scan -- --enrich-metros --backlog
npm run business:scan -- --pause-enrichment
npm run business:scan -- --enrich-metros --cities=Mumbai,Pune --updated-rules --limit=56
```

Use `--retry-eligible` for due transient failures. Open `/pipeline`, choose a city, enable **Show all listings** for evidence and status details, and use **Resume existing backlog** to continue. Downloads are unsent EMLs with no recipient. Preview new authorized briefs and import only after permission is confirmed.

After the Worker `/diagnostics` marks Find a Tender due, run this from LeadFlow AI to verify the real Worker path once and qualify any collected briefs in shadow mode:

```powershell
$env:EXTERNAL_LEADS_SOURCES = 'uk_tender'
$env:FREELANCE_QUALIFICATION_MODE = 'shadow'
$env:TELEGRAM_ENABLED = 'false'
$env:SAFE_OWNER_EMAIL_TEST = 'false'
npm run external:run -- --complete --drain --limit=20 --max-candidates=20 --pages=3
```

## Source readiness and blockers

| Source | Current finding and follow-up |
| --- | --- |
| Overture | Populated the saved seven-city snapshot. OSM+Overture budget reallocation already works. Shared publisher lineage is not independent corroboration. |
| Overpass | Previous run's public interpreter returned HTTP 502 for the 8.5 km four-family `nwr` search, before local normalization. The query requests named POIs with a 25-second server budget. The city runner stops further Overpass queries after the first upstream 429/5xx. The response alone cannot identify Overpass server load versus network intermediaries. If public service remains unsuitable, use a regional [Geofabrik OSM extract](https://download.geofabrik.de/asia/india/index.html), filter locally to a city's extent and required tags, and preserve ODbL attribution. Avoid endpoint rotation. |
| Foursquare | File import only, with no authorized export in this environment. [Foursquare Places Portal instructions](https://docs.foursquare.com/data-products/docs/access-fsq-os-places) describe registering, generating an Iceberg catalog token, filtering by locality or bounding box in DuckDB, and exporting a city slice. The existing `fsq_os` importer requires a provenance manifest. This is not a live source. |
| Website discovery | Current candidates come from permitted publisher websites and public business-domain email hints. An independent licensed directory or an approved search integration is needed to corroborate operator evidence for businesses without a discoverable site. Google's [Gemini 3.5 Flash-Lite pricing](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite) lists Google Search grounding as unavailable on the free tier for the configured model. The text-only classifier leaves that tool disabled. |
| Hacker News | The revised bounded search pulls two current/recent monthly threads plus scoped Ask HN phrases. Live result was 51 screened, zero buyer candidates. The local qualification run also pulled zero, so no AI provider was called. |
| Freelancer | The existing RSS connector requires an authorized feed. Set `FREELANCER_RSS_ENABLED=true` and `FREELANCER_RSS_FEEDS_JSON` to an array such as `[{ "feedId": "...", "url": "https://www.freelancer.com/...", "rightsReference": "..." }]` in the producer's ignored `.dev.vars`. For native API access, register via the [Freelancer Developer portal](https://developer.freelancer.com/) and request read access for active project discovery only. Native OAuth and its vendor-approved scope names still need verification. The authorized file workflow is available now. |
| Upwork | [Upwork API access instructions](https://support.upwork.com/hc/en-us/articles/115015857647-How-to-request-an-API-key-from-Upwork) describe applying for a key and review. An approved export or alert can be imported now where its use is permitted. |
| UK Find a Tender | Await the live `/diagnostics` lease. The earlier direct HTTP 200 does not prove Worker recovery. Redirect, scope and deadline fixtures pass. After the retained due time, run one Worker collection and record its actual HTTP outcome before altering transport. Keep geographic and capacity exclusions. |
| Employment boards | Diagnostics are useful, but enabling them by default did not generate buyer demand. The default dashboard keeps HN and WordPress Jobs selected. A recent public GitHub bounty search also predominantly returned zero-reward, test, repost or non-service listings, so it was not enabled. |
