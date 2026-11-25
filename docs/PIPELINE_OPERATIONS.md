# Operational verification ledger

## 25 November 2026, source recovery and outreach revision

### Verified live source and AI runs

| Source | Raw | Filtered at collection | New producer rows | Status |
| --- | ---: | ---: | ---: | --- |
| Hacker News | 52 | 52 | 0 | Collector rerun recorded 39 seller offers, 12 without explicit buyer requests and one unmatched monthly-thread post. The earlier 51-post run retained counts only. |
| WordPress Jobs | 10 | 8 | 2 | Feed succeeded. Existing filters require scoped buyer-side work and a usable listing reference. |
| Himalayas | 160 | 18 | 100 | Feed succeeded. Of 142 records that passed the collector, the per-source cap admitted 100. |
| Jobicy RSS | 118 | 5 | 100 | Feed succeeded. The per-source cap admitted 100 of 113 passing records. |
| Remotive | 15 | 0 | 15 | Feed succeeded. Employment-oriented inventory remains opt-in. |
| Find a Tender | 73 | 73 | 0 | Worker request succeeded after its prior cooldown at 00:47 IST. The next call returned `DEFERRED`. The latest lease permitted another poll after 06:47 IST. |
| Freelancer | 0 | 0 | 0 | No authorized feed configured. |

The producer admitted 217 records. The documented shadow drain fetched 217, all already imported into the local consumer state, and reclassified stored evidence. Its 100 inference requests yielded 51 valid verdicts (Groq 34, Cloudflare 17), plus eight rules finalizations. Gemini returned HTTP 503. Groq also reported 429s and unsupported evidence quotes. Cloudflare returned evidence-quote failures in addition to valid verdicts. OpenRouter's automatic free router returned schema failures or timeouts. Its pinned strict-schema free route returned HTTP 429 in the separate bounded probe. The account metadata confirmed OpenRouter's free tier, with no remaining limit exposed. Ollama `qwen2.5-coder:3b` returned valid diagnostic JSON locally. Gemini's model metadata returned HTTP 200. No inference request exposed credentials or changed account plans.

One provisional HIGH match was an hourly AI training task-production contract. Archived evidence exposed explicit task recording and SuperAnnotate language, so the scope guard rejected it as `OUT_OF_SERVICE_SCOPE` with the located quote `Record task execution`. It preserves eligibility for genuine builds of evaluation systems. A focused replay of both WordPress briefs subsequently received two Groq verdicts. A paid, fixed-price six-page WordPress brief qualified at LOW, and an ongoing developer-partner relationship stayed in review. The mixed run had exhausted its local budget before reaching those briefs. Buyer-first replay and a diagnostic-board request budget now leave headroom for buyer-focused feeds in mixed runs. Complete records without a validated AI verdict remain retryable. Incomplete source evidence keeps its enrichment state. The console retains source reports even when the classification summary exceeds the old stdout buffer.

| Source with saved candidates | Qualified | Rejected | Review | AI retry | Awaiting evidence | Saved scoring provenance |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Himalayas | 0 | 47 | 45 | 7 | 1 | Gemini 3, Groq 36, Cloudflare 22, OpenRouter 1, rules 37, source guard 1 |
| Jobicy RSS | 0 | 57 | 9 | 34 | 0 | Groq 7, Cloudflare 2, rules 91 |
| Remotive | 0 | 8 | 0 | 7 | 0 | Rules 15 |
| WordPress Jobs | 1 | 0 | 1 | 0 | 0 | Groq 2 |

Saved provenance includes older runs. The 25 November main drain used Groq and Cloudflare for valid live verdicts. The WordPress replay used Groq. The earlier 30-request run reached its local ceiling with 16 validated AI verdicts. Its 84 rules decisions therefore do not imply that every provider was unavailable. This observation is consistent with the current replay, where transport, rate limits and quote/schema failures consumed some of the bounded requests.

### Offline business source and broader evidence

- The previous Overpass response explicitly said the server was at capacity. A 1.2 km Pune dentist query returned one row in 43 seconds. The same public endpoint was used. Bulk discovery can now reuse an attributed offline extract.
- A 25 MB [BBBike Bombay PBF](https://download.bbbike.org/osm/bbbike/Bombay/) passed through the new streaming CLI and the Worker importer. It added 70 Mumbai records, and the saved city inventory grew from 249 to 319. The importer writes `ODbL-1.0`, release, source URL, SHA-256 and OpenStreetMap attribution. Use city-sized extracts where available; Geofabrik regional extracts are the broader fallback. The parser streams named business nodes and leaves way/relation support for a later expansion. [OpenStreetMap copyright](https://www.openstreetmap.org/copyright)
- The additional businesses brought the saved metro inventory to 1,792. Existing qualification and draft-ready counts remain 8 and 6. The offline slice screened out four records before evidence processing; 66 were evaluated, 64 went to evidence review and two to retry. Bounded public search reviewed 11 existing Mumbai/Pune businesses. Nine had no corroborated first-party domain or independent operator source, one failed identity matching, and one search target returned 404. All 11 stayed in evidence review.
- Tavily's Researcher plan supports some commercial uses. Its current AUP restricts facilitating unsolicited marketing. LeadFlow prospect search requires specific written permission from Tavily and `TAVILY_OUTREACH_PERMISSION_REFERENCE` in the ignored `.env.external`, in addition to an approved plan and `TAVILY_API_KEY`. A key is present locally and this workflow remains disabled. [Plan and usage rights](https://help.tavily.com/articles/5880393096-permitted-use-customer-applications) · [AUP](https://www.tavily.com/acceptable-use-policy)
- [Groq browser search](https://console.groq.com/docs/tool-use/built-in-tools/browser-search) is documented for the GPT-OSS family and runs separately from structured output. Zero-cost browser-tool eligibility was not established for the account, so no browser-tool invocation was made. OpenRouter Web Search is billed separately. Cloudflare text inference did not establish an authorized free web-search capability.
- Foursquare remains unconfigured. Use the [Foursquare Places Portal instructions](https://docs.foursquare.com/data-products/docs/access-fsq-os-places) to create an account, review the terms and generate an Iceberg catalog token. Query a Mumbai bounding box in DuckDB using the portal's snippet, then export active records and supply the release, checksum, license and attribution to `/import/fsq_os`. The [Hugging Face dataset](https://huggingface.co/datasets/foursquare/fsq-os-places) has a separate gated agreement. Give overlapping Overture/Foursquare evidence one provenance lineage where their provider IDs match.

### Local handoff

- Verify the operator workflow at `http://127.0.0.1:5174/pipeline`. Main actions sit above both panels. Advanced source selection and authorized imports are expandable. Draft preview opens and focuses in the page, includes an isolated HTML view, separate clipboard controls and working EML/HTML downloads. Acquisition and qualification statuses have separate summaries.
- Revised unsent review package lives in `outputs/cofounder-review/`. The ZIP includes three each of EML, HTML and text, plus the consolidated PDF and Markdown. The older originals in `outputs/operations-20261124/` have matching hashes. EMLs have no recipient and embed the animated GIF and static PNG. The policy uses a short call, offers a meeting in configured cities, omits pricing and uses a one-line opt-out. No outreach was sent, deployed or reset.
- Offline run: install `osmium` in the existing `.venv/local-business` only, download a permitted city PBF and invoke `scripts/import-osm-extract.py` with `--source-url`, `--release`, `--city`, `--bbox WEST SOUTH EAST NORTH` and `--limit`. Follow with `npm run business:scan -- --sync-osm=Mumbai`. No database reset is needed.
- Worker migration `0004_filter_reasons.sql` adds a nullable diagnostics field and was applied locally using `npm run db:local -- --persist-to .wrangler/state`.

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
| Freelancer | RSS requires a specifically authorized feed in `FREELANCER_RSS_FEEDS_JSON`. The producer also has a separate owner-only terminal search using the official native API and a `basic` personal access token. See the latest checkpoint for setup. |
| Upwork | Use official MCP for an immediate, owner-requested job search. Results remain separate from local imports and scheduled ingestion. [Upwork MCP](https://www.upwork.com/ai/mcp) |
| UK Find a Tender | Await the live `/diagnostics` lease. The earlier direct HTTP 200 does not prove Worker recovery. Redirect, scope and deadline fixtures pass. After the retained due time, run one Worker collection and record its actual HTTP outcome before altering transport. Keep geographic and capacity exclusions. |
| Employment boards | Diagnostics are useful, but enabling them by default did not generate buyer demand. The default dashboard keeps HN and WordPress Jobs selected. A recent public GitHub bounty search also predominantly returned zero-reward, test, repost or non-service listings, so it was not enabled. |

## Offline OpenStreetMap inventory for the Indian metros

Download regional `.osm.pbf` files with their publisher checksums into the ignored `data/local-business/osm-extracts/` directory. The [OpenStreetMap France India catalog](https://download.openstreetmap.fr/extracts/asia/india/) provides smaller state extracts alongside the regional [Geofabrik India catalog](https://download.geofabrik.de/asia/india/index.html). The two catalogs distribute OpenStreetMap data under ODbL. Treat repeated observations from either catalog as the same publisher lineage.

| Metro | State or regional PBF | West, south, east, north |
| --- | --- | --- |
| Mumbai | Maharashtra or Geofabrik Western Zone | `72.805 19.00 72.985 19.28` |
| Pune | Maharashtra or Geofabrik Western Zone | `73.74 18.43 73.99 18.65` |
| Bengaluru | Karnataka | `77.46 12.84 77.72 13.11` |
| Hyderabad | Telangana | `78.34 17.30 78.62 17.53` |
| Kolkata | West Bengal | `88.24 22.45 88.49 22.67` |
| Delhi | National Capital Territory of Delhi | `77.07 28.51 77.365 28.77` |
| Chennai | Tamil Nadu | `80.13 12.97 80.34 13.18` |

Use the PBF header's snapshot date in the release ID. After verifying the publisher MD5, import with the existing isolated Python environment and running local Worker. For example, a Delhi snapshot dated 2026-11-23 can be loaded with these commands.

```powershell
& .venv/local-business/Scripts/python.exe scripts/import-osm-extract.py `
  data/local-business/osm-extracts/national_capital_territory_of_delhi.osm.pbf `
  --source-url https://download.openstreetmap.fr/extracts/asia/india/national_capital_territory_of_delhi.osm.pbf `
  --release osm-france-delhi-2026-11-23 --city Delhi --bbox 77.07 28.51 77.365 28.77 `
  --limit 100 --prioritize-identifiable
npm run business:scan -- --sync-osm=Delhi
```

`--prioritize-identifiable` selects up to the requested cap using public website, phone, email and address hints. The importer streams business nodes and retains a bounded selection in memory. It records source URL, release ID, SHA-256, ODbL and attribution, then posts only to the loopback Worker. Those directory fields still require normal ownership and contact verification.

After importing multiple cities, `npm run business:scan -- --sync-osm=all` refreshes all seven from the saved Worker inventory in one pass.

For an additive Overture refresh using saved OSM while public Overpass is unreliable, run the following in a dedicated local shell. The metro snapshot retains prior observations and verified enrichment.

```powershell
$env:LOCAL_BUSINESS_OSM_ENABLED = 'false'
npm run business:scan -- india-metros
npm run business:scan -- --enrich-metros --backlog
```

## Source expansion and seven-metro verification — 25 November 2026

- [x] Replayed all 48 retry records and verified the original 104 unresolved IDs against a saved local snapshot. Sixteen now have conclusive rejections, 84 have review decisions and four need better original evidence. None remain in provider retry. Reviews are predominantly unclear engagement or buyer direction. Keep them separate from qualified and rejected counts. A valid prior model decision is preserved through provider failure.
- [x] Verified source guards against real archived results. A manual audio adjudication listing was outside our services. A device testing listing had a required delivery date in the past. Both moved out of qualified. The sole qualified freelance record remains the previously discovered six-page WordPress build at C$2,000–2,500. The publisher page still showed its application route. The saved LOW/0 advisory score reflects legacy rules missing buyer and project-boundary fields. The recorded Groq verdict contains exact fixed-budget and scope evidence.
- [x] Ran the complete shadow pipeline after leases expired. The consumer fetched 230 normalized candidates, 217 duplicates and 13 new Jobicy records. Of those 13, 11 were rejected and two went to review. Final ledger totals are 230, with one qualified, 139 rejected, 86 review, four awaiting source evidence and zero provider retry. No email or Telegram was sent.

| Worker source | Latest live result | Raw | Collector passed | New | Qualified new |
| --- | --- | ---: | ---: | ---: | ---: |
| Hacker News | HTTP 200, 39 seller offers, nine missing explicit buyer intent, one unmatched monthly comment | 49 | 0 | 0 | 0 |
| WordPress Jobs | HTTP 200, publisher feed unchanged. One earlier project remains qualified | 0 | 0 | 0 | 0 |
| Jobicy RSS | HTTP 200, three filtered, 13 new selected beyond cursor | 116 | 113 | 13 | 0 |
| Remotive | HTTP 200, all 15 applicable records already seen | 15 | 15 | 0 | 0 |
| UK Find a Tender | HTTP 200 through Worker | 73 | 0 | 0 | 0 |
| UK Contracts Finder | HTTP 200 through Worker. An earlier run also screened 102 notices | 90 | 0 | 0 | 0 |
| Himalayas | Deferred. Next eligible at 00:47 IST on 26 November, based on the retained lease | 0 | 0 | 0 | 0 |

EU TED returned HTTP 200 for a bounded recent service-code search with 232 matching notices and 12 sampled. The sample mixed large or restricted tenders with broadly classified procurement, and none established bidder eligibility. It remains a research-only source. [Official API](https://docs.ted.europa.eu/ODS/latest/reuse/search-api.html)

| Marketplace | Status and operator action |
| --- | --- |
| Upwork | The operator completed setup. The earlier connected `list_accounts` returned `USER_NOT_LOGGED_IN`, and the MCP tools disappeared from the active session. Start a session with the connected Upwork app, check accounts first, then search scoped projects using an India-eligible freelancer or agency account. Keep results in the immediate owner review. No job data was collected or stored by LeadFlow. [Upwork MCP](https://www.upwork.com/ai/mcp) · [Rate limits](https://support.upwork.com/hc/en-us/articles/56577997707923-Rate-limits-for-Upwork-MCP) |
| Freelancer | The `freelancer:review` command implements the official active-project route. After reviewing the terms, get a `basic` production personal access token and set `FREELANCER_API_TOKEN` and `FREELANCER_API_REVIEW_APPROVED=true` in the producer's ignored `.dev.vars`. Run `npm run freelancer:review -- "WordPress redesign"` from an interactive terminal. Costs for this account were not verified, and no native live lookup ran without access. Results stay outside the archive and cloud AI. [Token settings](https://accounts.freelancer.com/settings/develop) · [API terms](https://www.freelancer.com/about/apiterms) |
| PeoplePerHour and Guru | Use native saved searches and alerts. PeoplePerHour supports instant or daily alerts, and Guru's Job Match follows profile skills. The local CSV/JSON importer is ready for briefs the operator has permission to retain and classify. Do not ingest restricted mailbox content. [PeoplePerHour](https://support.peopleperhour.com/hc/en-us/articles/205217987-Saved-Searches) · [Guru](https://www.guru.com/help/freelancer/email-settings-freelancer/) |
| Jobbers, Workana, Truelancer, WorknHire, Algora | Jobbers and Workana restrict extraction. Truelancer terms returned 429, WorknHire failed DNS, and the proposed Algora endpoint returned 404. Algora's legacy controller returns an empty array. No automated source was enabled. [Jobbers terms](https://www.jobbers.io/terms-and-conditions-of-use/) · [Workana terms](https://help.workana.com/hc/en-us/articles/360041499974-WORKANA-TERMS-AND-CONDITIONS) · [Algora source](https://github.com/algora-io/algora/blob/main/lib/algora_web/controllers/api/bounty_controller.ex) |
| Feedsen and Adzuna | Feedsen lists a card-required trial. Adzuna requires written agreement for lead generation. Neither was enabled. [Feedsen](https://feedsen.com/jobs) · [Adzuna API terms](https://developer.adzuna.com/docs/terms_of_service) |

The approved local file importer now retains original URLs and optional marketplace metadata, supports evidence refreshes, and distinguishes repeat imports from exact cross-source URL matches. UK procurement sources use same-origin HTTPS, bounded pagination, six-hour source leases and exact OCDS-ID deduplication. Keep procurement in review until bidder eligibility is established.

### Live classification and business results

Across two replays and the due-source run, Gemini `gemini-3.5-flash-lite` returned 3 valid verdicts from 7 requests, Groq `openai/gpt-oss-120b` 29 from 60, Cloudflare `@cf/meta/llama-3.3-70b-instruct-fp8-fast` 29 from 45, and OpenRouter `inclusionai/ling-3.2-flash:free` zero from four HTTP 429 responses. Gemini had four HTTP 503s, Groq had 17 quota and 14 quote failures, and Cloudflare had 16 quote failures. Recent successful validated provider performance informs automatic routing. Cooldowns and a cache keyed by the content, model set and policy versions remain in use. Local Ollama `qwen2.5-coder:3b` previously returned valid diagnostic JSON. It was not used for a freelance verdict in these runs. Provider dashboards did not establish exact free balances.

The offline OSM imports added 698 observations across seven cities, with two duplicates. Overture's refresh found 1,722 existing observations and added zero. The completed enrichment snapshot contains 2,491 saved distinct Worker IDs, 2,314 evaluated, 187 exclusions, 21 qualified, 191 records with verified public contact routes across all outcomes, 14 draft-ready, 219 source retries and zero awaiting first enrichment. Shared publisher lineage and the ID count do not prove distinct businesses or owners. Most remaining records require corroborating evidence. One initial restaurant match was corrected after its official site showed centrally managed operations across several metros.

| City | Saved IDs | Enriched | Excluded | Qualified | Public contact | Draft-ready | Source retry |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mumbai | 418 | 393 | 28 | 7 | 33 | 4 | 31 |
| Pune | 346 | 324 | 22 | 2 | 18 | 2 | 50 |
| Bengaluru | 349 | 316 | 35 | 3 | 39 | 3 | 26 |
| Hyderabad | 341 | 316 | 25 | 1 | 24 | 1 | 22 |
| Kolkata | 347 | 319 | 29 | 3 | 23 | 0 | 28 |
| Delhi | 344 | 325 | 22 | 4 | 23 | 3 | 29 |
| Chennai | 346 | 321 | 26 | 1 | 31 | 1 | 33 |

Foursquare still requires operator acceptance and an authorized Places Portal Iceberg export. Its rows cannot automatically count as an independent source when provenance matches Overture. Groq Browser Search was not used because zero-cost account eligibility remained unverified. Tavily did not run for this outreach workflow. Keep using the offline OSM import and the verified authorized buyer-brief import while marketplace access is unavailable.

### Verification and next run

Run `npm run test`, `npm run typecheck` and `npm run build` in LeadFlow AI, and `npm run test` and `npm run typecheck` in LeadFlow Leads. In a shell with shadow mode and notifications disabled, `npm run external:run -- --complete --drain --limit=50 --max-candidates=200 --pages=3` respects the stored polling leases. `npm run external:run -- --review-source-guards` reapplies known source exclusions without AI calls. Use `--retry-discovery-ai` for genuine provider failures, and `npm run business:scan -- --enrich-metros --backlog` for eligible business work under existing access policies. Run both local services on ports 5174 and 8787 with the existing profiles.

Current unsent review package is under `outputs/cofounder-review/`. The earlier package was copied to `outputs/cofounder-review-before-cta-20261125-020044/`. All three new CTA drafts were verified with Chromium copy, HTML and logo previews and matching EML/HTML downloads. An optional valid HTTPS `LEADFLOW_CALENDLY_URL` appends a booking link. The current package uses the call invitation because no URL is configured. Revised body fingerprints invalidate any older draft approval.

Verification checkpoint: 261 LeadFlow AI tests and 49 LeadFlow Leads tests passed with both typechecks and the local build. Chromium verified the Contracts Finder source toggle, empty authorized-import gate, state reload and Mumbai/Delhi filters. Producer remote verified at `0620dd1c8485ad94366c5a0c9ed12ab52141a227` on `feature-new-sources-aa`. Both Graphify indexes were refreshed. No external deployment was performed.

## Source activation — 25 November 2026

- [x] Verified `codex --version` in a fresh Windows PowerShell 5.1 process and authenticated the official Upwork MCP via the local CLI. LeadFlow AI has a freelancer account. Marketplace searches and detail reads were owner-requested and read-only. The local database, email pipeline, and external classifiers received no Upwork records.
- [x] Authenticated the Places Portal Iceberg catalog with `FOURSQUARE_ICEBERG_TOKEN` from the ignored `.env.external`. `places.datasets.places_os` provides the official schema. The direct query encountered a string `date_refreshed` field and now applies `TRY_CAST` before checking freshness. Use the Open Source Places token, rather than a Places REST API key.
- [x] Imported 50 Mumbai results. Reimporting the exact same in-memory batch returned zero inserted, 50 duplicates and zero rejected. The other six metros each returned 50 eligible source rows. In total, 350 normalized and 347 inserted, with three cross-source matches and zero rejected. The importer uses Apache-2.0 attribution, bounded metro coordinates, open/recent categories, local-only intake and a reproducible slice hash. Fields remain directory hints until verified.
- [x] Synced all seven metros into the dashboard. A fresh Overture acquisition returned existing inventory. Offline OSM was reused. The Foursquare counts now use successful import receipts without reloading historical city-specific outputs or exposing tokens.
- [x] Ran the configured freelance sources in shadow mode. HN screened 51 posts (39 seller offers, 11 with no explicit buyer request and one unmatched monthly comment). Other configured sources had active leases. The old WordPress publisher page still included its original application route. No new rows entered the persistent freelance queue.
- [x] Used explicit publisher text to move nine unsupported freelance entries to `OUT_OF_SERVICE_SCOPE`. The saved ledger currently shows 230 rows, one qualified, 148 rejected, 80 review and one awaiting evidence. The selective scoped replay found no remaining complete held briefs with grounded project boundaries. Historical outreach and model decisions remain in local state.
- [x] Added numbered evidence spans for compact backup models. Responses still resolve to actual source substrings and invalid IDs fail validation. A bounded live check on the public WordPress project got one valid verdict each from Groq and Cloudflare. Each returned three span identifiers, with no quote failures in that check. Gemini returned 503 and OpenRouter 429. Ollama passed local diagnostic JSON.
- [ ] Finish the new business evidence backlog and verify the resulting city counts and all eligible unsent drafts.

For a future authorized metro refresh, run from LeadFlow AI on Windows after `pip install duckdb` in the existing `.venv/local-business` environment:

```powershell
& .venv/local-business/Scripts/python.exe scripts/import-foursquare-iceberg.py Mumbai --limit 50 --repeat-check
& .venv/local-business/Scripts/python.exe scripts/import-foursquare-iceberg.py Pune Bengaluru Hyderabad Kolkata Delhi Chennai --limit 50
npm run business:scan -- --sync-foursquare=all
$env:LOCAL_BUSINESS_OSM_ENABLED = 'false'
npm run business:scan -- india-metros
npm run business:scan -- --enrich-metros --backlog
npm run business:review-package
```

The Foursquare runtime keeps the free Iceberg token transient and never invokes Places REST. Foursquare and Overture records with the same verified publisher lineage are not independent corroboration. Tavily has a key but prospect discovery remains blocked on provider permission and confirmed Researcher access. Freelancer remains intentionally deferred at the owner's request. No publication, marketplace write or messaging action is required for these runs.
