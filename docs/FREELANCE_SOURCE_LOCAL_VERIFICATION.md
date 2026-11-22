# Five-source freelance buyer verification

21 November 2026, Asia/Kolkata. Local Worker with isolated D1 and local rules-only shadow mode. Employer and applicant details stay in ignored local state. Telegram, the owner-test email, and model calls were disabled throughout.

## What the live contracts showed

| Source | Verified behavior and decision |
| --- | --- |
| Hacker News | The adapter already searched for freelance stories and used the general hiring thread only for explicit `mode=all`. Its first-match check could select an unrelated or older story. The adapter now requires the exact current-month title in UTC. November thread 50338744 returned 22 indexed comments, 19 top-level, and 0 buyer headers. The 5 general-hiring records from the earlier run were from a different thread. [November freelance thread](https://news.ycombinator.com/item?id=50338744) |
| WordPress Jobs | The site displays “Project” on its listing pages. `/job-type/project/` returned 404. The default feed, `?job_types=project`, and `?job_types=does-not-exist` returned the same ten IDs. RSS provided a numeric post ID and full content, with no job-type element. The Worker keeps the verified feed URL and requires explicit project evidence in the supplied text. The proposed `WORDPRESS_JOBS_RSS_JOB_TYPES` switch was omitted because its advertised behavior could not be verified. [Publisher project listing](https://jobs.wordpress.net/job/wordpress-website-developer-18/) |
| Himalayas | Keyless search returned HTTP 200 and 20 contractor records. `guid` carries the stable listing path, `pubDate` is a Unix update time, and `expiryDate` supplies expiration. The true publication time stays null. Expired records are excluded from reads and removed on a successful poll. The dashboard credits Himalayas and uses the supplied `applicationLink` exactly. The 24-hour polling floor follows the publisher's refresh interval. [Official API reference](https://himalayas.app/docs/remote-jobs-api) |
| Jobicy | The selected RSS URL returned HTTP 200 and 111 entries, each marked `Contract`. The feed provides its own `id`, namespaced job type, `content:encoded`, and RFC-822 `pubDate` with a UTC offset. The Worker normalizes the date to ISO 8601, uses a six-hour polling floor, credits the source and retains its original listing link. [Official feed documentation](https://jobicy.com/jobs-rss-feed) |
| Remotive | Keyless API on `remotive.com` returned HTTP 200 and 16 software-development jobs. There is no type query filter. Remotive's timestamp strings omitted a zone, so this run left the normalized publication time unknown. The dashboard links back to the original listing and credits Remotive. The rules still inspect the supplied content for employment, seller and buyer evidence. [Official terms and API](https://remotive.com/remote-jobs/api) |

The original JSON implementation returned `502 JSON_FEED_UNAVAILABLE` for both JSON sources with the Worker's `redirect: "error"` request option. Explicit manual redirect handling fixed the local runtime failure. The final Worker received and parsed both JSON feeds. Redirects remain unfollowed. The isolated fixture cooldown rows for those two failed attempts alone were reset before retesting. Neither provider returned a 429 or called for credentials.

## Commands and observed responses

The existing dev servers were already using ports 8787 and 5173. The verification Worker and dashboard used 8791 and 5174 so the operator's database and running servers could stay in use.

```powershell
Set-Location D:\freelance_personal\leadflow-leads
npm run db:local -- --persist-to .wrangler/state-source-verification
npm run dev -- --port 8791 --persist-to .wrangler/state-source-verification --log-level error
```

Wrangler 4.162.0 applied `0001_init.sql` (7 commands), `0002_expansion.sql` (17), and `0003_run_source_health.sql` (6). It reported resource location `local`. `GET /health` returned `{"ok":true,"time":"2026-11-21T14:43:15.411Z"}`. `GET /sources` returned `ready:true` for all five sources. The source names verified in the Worker registry and qualification allowlist are `hackernews,wordpress_jobs_rss,himalayas,jobicy_rss,remotive`; the legacy `jobicy` JSON employment collector remains separate. The permission-gated `freelancer_rss` collector stayed disabled.

Local `.dev.vars` used `WORDPRESS_JOBS_RSS_ENABLED=true`, `HIMALAYAS_JSON_ENABLED=true`, `JOBICY_RSS_ENABLED=true`, `REMOTIVE_JSON_ENABLED=true`, and `DAILY_FREELANCE_SOURCES=hackernews,wordpress_jobs_rss,himalayas,jobicy_rss,remotive`. No key was added. The ignored `.env.external` and its tracked example use the same five-source list.

For each source, the Worker received these requests using the existing local bearer token. This API intentionally caps evidence pages at five.

```powershell
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8791/collect/$source" -Headers $headers
Invoke-RestMethod -Uri "http://127.0.0.1:8791/leads?category=freelance_request&sources=$source&limit=5&include=evidence" -Headers $headers
```

```jsonl
{"ok":true,"source":"hackernews","fetched":0,"inserted":0,"duplicates":0,"duration_ms":1364,"raw":19,"accepted":0,"filtered":19,"state":"NO_BUYER_CANDIDATES"}
{"ok":true,"source":"wordpress_jobs_rss","fetched":1,"inserted":1,"duplicates":0,"duration_ms":1835,"raw":10,"filtered":9,"accepted":1,"state":"OK"}
{"ok":true,"source":"himalayas","fetched":20,"inserted":20,"duplicates":0,"duration_ms":369,"raw":20,"filtered":0,"accepted":20,"state":"OK"}
{"ok":true,"source":"jobicy_rss","fetched":20,"inserted":20,"duplicates":0,"duration_ms":1898,"raw":111,"filtered":1,"accepted":110,"state":"OK"}
{"ok":true,"source":"remotive","fetched":16,"inserted":16,"duplicates":0,"duration_ms":333,"raw":16,"filtered":0,"accepted":16,"state":"OK"}
```

All final POSTs returned HTTP 200. The first evidence page for each source returned the following result counts. Each returned row had `listing_evidence.version=1`.

| Source | GET total | GET count | Evidence on first page |
| --- | ---: | ---: | --- |
| Hacker News | 0 | 0 | Empty |
| WordPress Jobs | 1 | 1 | 1 complete |
| Himalayas | 20 | 5 | 5 complete with unmodified apply links |
| Jobicy RSS | 20 | 5 | 5 complete |
| Remotive | 16 | 5 | 3 complete, 2 marked truncated |

```powershell
Set-Location D:\freelance_personal\leadflow-ai
$env:EXTERNAL_LEADS_API_ORIGIN='http://127.0.0.1:8791'
# Use the existing local bearer token for EXTERNAL_LEADS_API_TOKEN.
$env:EXTERNAL_LEADS_ENABLED='true'
$env:EXTERNAL_LEADS_BATCH_SIZE='5'
$env:FREELANCE_QUALIFICATION_MODE='shadow'
$env:TELEGRAM_ENABLED='false'
$env:SAFE_OWNER_EMAIL_TEST='false'
$env:AI_ENABLED='false'
$env:GEMINI_ENABLED='false'
$env:EXTERNAL_LEADS_SOURCES=$source
$env:EXTERNAL_LOCAL_PROFILE="live-$source-check"
npm run external:run
```

Reruns followed each cursor until `until` disappeared from the saved state. The verbatim CLI output from every qualification page is in the ignored local file `outputs/external/live-source-verification.txt`. First-page imports were 0, 1, 5, 5 and 5 in table order. Each first page reported `invalid=0`; the source state was `NO_BUYER_CANDIDATES` for HN and `OK` for the other sources. All 57 stored candidates were imported and classified with no invalid rows or alerts.

| Source | Fetched | Eligible LOW / MEDIUM / HIGH | Primary reason counts | Open issue |
| --- | ---: | --- | --- | --- |
| Hacker News | 0 | 0 / 0 / 0 | No candidates entered qualification | Current monthly thread yielded zero buyer headings |
| WordPress Jobs | 1 | 0 / 0 / 0 | `AMBIGUOUS_DIRECTION` 1 | Feed ignores the proposed type query |
| Himalayas | 20 | 1 / 0 / 0 | `AMBIGUOUS_DIRECTION` 19 | Only eligible post is U.S.-based; source supplies update time |
| Jobicy RSS | 20 | 0 / 0 / 0 | `AMBIGUOUS_DIRECTION` 20 | Contract tags alone leave direction uncertain; 20 of 110 feed candidates were imported in this poll |
| Remotive | 16 | 0 / 0 / 0 | `AMBIGUOUS_DIRECTION` 10, `FULL_TIME_ONLY` 5, `UNPAID_OR_EQUITY_ONLY` 1 | No publisher type prefilter, dates lacked a timezone |

`SELLER_SELF_PROMOTION` and `STALE_OR_CLOSED` each had zero **primary** rejections among imported rows. HN filtering and the Himalayas expiry check happen before qualification. The only eligible listing was “Web Developer: WordPress & HubSpot (U.S. Based, Remote Contractor),” scored 64. The pipeline produced no confirmed medium- or high-priority opportunities.

## Dashboard and checks

The combined `live-five-sources` local profile used the same flags and the complete source list. `npm run dev -- --port 5174` exposed [the dashboard](http://127.0.0.1:5174/pipeline). Chromium verified all five health entries, 57 candidates, one eligible result, 20 publisher-provided Himalayas apply links, zero Telegram records, and a disabled email receipt.

`npm run typecheck`, producer `npm test` (37 passed), fixture `npx tsx scripts/verify-local-fixtures.ts --check`, consumer `npm test` (177 passed), `npm run build` including Apps Script, and `git diff --check` passed. No deployment, remote migration, external notification, or account signup was performed.

## 23 November 2026 engagement evidence replay

The first change added formal buyer wording for Himalayas, Jobicy RSS, and Remotive. The second preserved Himalayas `employmentType=Contractor` and Jobicy's per-item `job_type` through `/leads?include=evidence`. The rules may use that metadata to fill missing intent or engagement, with `provider_signal` recording which fields used it. Payment and scope still require text evidence. Explicit exclusions and incomplete evidence can block metadata fallback. Mixed Jobicy type tags supply no verified signal.

The same Worker on port 8791 collected the three sources. The local dashboard on port 5174 used profile `verified-engagement-20261123`. The table counts rows refreshed by this poll, using `last_seen_at` to exclude earlier rows from the comparison. The dashboard includes all 80 active rows in the isolated snapshot. The current feed contents can differ from the 21 November baseline.

| Source | Fetched | Eligible LOW / MEDIUM / HIGH | Primary reasons | Used publisher metadata |
| --- | ---: | --- | --- | ---: |
| Himalayas | 20 | 4 / 0 / 0 | `AMBIGUOUS_DIRECTION` 5, `PAYMENT_UNCLEAR` 6, `SCOPE_MISSING` 5 | 13 |
| Jobicy RSS | 20 | 0 / 3 / 0 | `FULL_TIME_ONLY` 2, `PAYMENT_UNCLEAR` 4, `SCOPE_MISSING` 11 | 14 |
| Remotive | 16 | 0 / 0 / 0 | `AMBIGUOUS_DIRECTION` 10, `FULL_TIME_ONLY` 5, `UNPAID_OR_EQUITY_ONLY` 1 | 0 |

Shadow ingestion reported zero invalid rows and alerts. A replay of the saved snapshot also verified the final qualification schema, audit schema, and exact source offsets of every eligible record. The replay corrected a collision where a single listing span could supply two evidence fields. The only existing fixture expectation that changed was `rules_version`, from `rules.v1` to `rules.v2`. Final checks passed with 37 producer and 189 consumer tests, the local D1 fixture check, both typechecks, and the build. Gemini, Telegram and email remained disabled.

## Application path, freshness, and payment replay

The three source polls on port 8791 returned `DEFERRED` during their cooldowns. The dashboard on port 5174 was refreshed from the 80 stored rows in profile `verified-engagement-20261123`. These counts use the same 56 listings as the preceding table.

| Source | Replayed | LOW / MEDIUM / HIGH | Known contact paths | Primary reasons |
| --- | ---: | --- | ---: | --- |
| Himalayas | 20 | 0 / 6 / 3 | 20 | `SCOPE_MISSING` 6, `AMBIGUOUS_DIRECTION` 5 |
| Jobicy RSS | 20 | 1 / 6 / 2 | 20 | `SCOPE_MISSING` 9, `FULL_TIME_ONLY` 2 |
| Remotive | 16 | 0 / 0 / 0 | 16 | `AMBIGUOUS_DIRECTION` 10, `FULL_TIME_ONLY` 5, `UNPAID_OR_EQUITY_ONLY` 1 |

The live Himalayas response exposed `pubDate` and `expiryDate` as its only job-level date fields. The publisher describes `pubDate` as the last update. All 20 replayed Himalayas listings had a recent update that qualified under the existing freshness window. Their `published_at` values remain null. [Himalayas API reference](https://himalayas.app/docs/remote-jobs-api)

Application paths retain their provider provenance in the audit without implying permission to contact. The team chose zero payment points for inferred paid intent. All 80 records passed the qualification and audit schemas and source evidence validation. The browser confirmed 80 expandable descriptions and labeled held rows as pending review. The only previous fixture expectation changed in this pass was the audit rules version from `rules.v2` to `rules.v3`. The D1 fixture check, 37 producer tests, 203 consumer tests, both typechecks, and build passed. Shadow replay produced zero alerts and kept Gemini, Telegram, and email disabled.

## Freelance project boundary verification

The same 80 saved board listings were pulled through the local Worker into `gemini-freelance-check-20261123`. Gemini produced validated semantic classifications for 20 listings across the three sources. HTTP 429, HTTP 503, and invalid model responses led to conservative fallback. Bounded retries recovered one Himalayas and one Remotive classification.

| Source | Raw | Prior HIGH / MEDIUM / LOW | Current HIGH / MEDIUM / LOW | Held | Rejected | Gemini / rules |
| --- | ---: | --- | --- | ---: | ---: | --- |
| Jobicy RSS | 26 | 2 / 6 / 1 | 0 / 0 / 0 | 20 | 6 | 18 / 8 |
| Himalayas | 38 | 3 / 8 / 0 | 0 / 0 / 0 | 26 | 12 | 1 / 37 |
| Remotive | 16 | 0 / 0 / 0 | 0 / 0 / 0 | 8 | 8 | 1 / 15 |

The leading reasons were `ENGAGEMENT_UNCLEAR` (35), `FULL_TIME_ONLY` (25), and `AMBIGUOUS_DIRECTION` (19). A final replay validated the schemas, quote offsets, and exact semantic excerpts for all 80 records. The browser confirmed Gemini attribution, project-boundary labels, and expandable descriptions. A bounded freelance checkout project still passes in a fixture with inferred pay at zero points. The live cohort had zero accepted listings, so it does not establish recall.

Run the Worker in its own PowerShell from the producer repo.

```powershell
Set-Location D:\freelance_personal\leadflow-leads
npm run db:local -- --persist-to .wrangler/state-source-verification
npm run dev -- --ip 127.0.0.1 --port 8791 --persist-to .wrangler/state-source-verification
```

Run qualification from the consumer repo. The runner reads the bearer token and approved Gemini settings from the existing ignored local files. An unavailable approved Gemini setup falls back to rules.

```powershell
Set-Location D:\freelance_personal\leadflow-ai
$env:EXTERNAL_LEADS_API_ORIGIN='http://127.0.0.1:8791'
$env:EXTERNAL_LEADS_ENABLED='true'
$env:EXTERNAL_LEADS_SOURCES='himalayas,jobicy_rss,remotive'
$env:EXTERNAL_LEADS_BATCH_SIZE='5'
$env:FREELANCE_QUALIFICATION_MODE='shadow'
$env:TELEGRAM_ENABLED='false'
$env:SAFE_OWNER_EMAIL_TEST='false'
$env:AI_PROVIDER='gemini'
$env:AI_ENABLED='true'
$env:GEMINI_ENABLED='true'
$env:EXTERNAL_LOCAL_PROFILE='gemini-freelance-check-20261123'
npm run external:run
```

Repeat `external:run` until the snapshot cursor has no `until` value. After a provider quota error, set `EXTERNAL_DISCOVERY_AI_MAX_REQUESTS=0` to finish paging in the same profile with rules. After the quota resets, use a positive budget and `npm run external:run -- --retry-discovery-ai` to retry saved rules-only rows for the sources selected in `EXTERNAL_LEADS_SOURCES`. This preserves successful Gemini results and the ingestion cursor.

Start Vite with the same profile and shadow flags in a separate PowerShell with those variables set.

```powershell
npm run dev -- --port 5174 --strictPort --host 127.0.0.1
```

Open [the dashboard](http://127.0.0.1:5174/pipeline) and compare the classification method, qualification reason, and project boundary. The verification created zero approval requests or alerts and left the email test disabled.

## Binary AI discovery decisions

The model returns `ACCEPT` or `REJECT`. The operator sees **Accepted** or **Rejected**. The old rule state, categorization, score, and reasons are available as advisory information. A valid AI acceptance can route at any advisory score. Missing, invalid, or skipped model verdicts fail closed to Rejected. Source access, unavailability, and unsafe-input checks can block classification. Contact permission and the separate approval process still apply.

Reuse the Worker and shadow environment from the preceding commands. Select a fresh profile and run from the consumer repo. The existing local Gemini settings and API bearer stay in their ignored files.

```powershell
$env:DISCOVERY_AI_PROVIDER='gemini'
$env:EXTERNAL_LOCAL_PROFILE='gemini-binary-check-20261123'
$env:EXTERNAL_DISCOVERY_AI_MAX_REQUESTS='100'
npm run external:run
```

Repeat until the saved cursor ends. The Worker supplies up to five candidates per page. The former 16-call source HTTP guard no longer counts classifier requests. The classifier cap defaults to 100 provider requests per invocation and can be set from 0 to 500. Provider quota, authorization failures, and timeouts are separate limits. `ai_attempted` counts candidates sent to a provider in that invocation, `ai_succeeded` counts validated verdicts including cache hits, `ai_failed` counts failed candidate requests, and `ai_skipped` counts processed candidates without a call or verdict. `accepted` and `rejected` describe the stored profile.

After provider quota recovers, retry rows without a valid model verdict. Existing model decisions and the source cursor are preserved.

```powershell
$env:EXTERNAL_LEADS_SOURCES='himalayas,jobicy_rss,remotive'
$env:EXTERNAL_DISCOVERY_AI_MAX_REQUESTS='20'
npm run external:run -- --retry-discovery-ai
```

OpenRouter is a manually selectable alternative for the local runner. Create an API key in OpenRouter and keep it in the ignored `.env.external` file. Use `openrouter/free` or an explicitly free model that supports JSON mode. Provider availability and quotas still apply. [OpenRouter setup](https://openrouter.ai/docs/quickstart) · [Free model options](https://openrouter.ai/docs/faq#what-free-tier-options-exist)

```dotenv
DISCOVERY_AI_PROVIDER=openrouter
OPENROUTER_API_KEY=<your key>
OPENROUTER_MODEL=openrouter/free
AI_ENABLED=true
AI_DATA_USE_APPROVED=true
GEMINI_ENABLED=false
FREELANCE_QUALIFICATION_MODE=shadow
TELEGRAM_ENABLED=false
SAFE_OWNER_EMAIL_TEST=false
EXTERNAL_LOCAL_PROFILE=openrouter-binary-check
```

Use `npm run external:run` to build the alternate provider profile and start Vite with that same profile to view it. For an OpenAI account, use `DISCOVERY_AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` instead. This switch is local and manual.

The 23 November shadow replay used the same 80 candidates. The previous profile had valid Gemini results on 20 rows. Its run logs recorded 29 requests and 9 unsuccessful requests, including retries. The final binary profile covered 76 rows with 100 cumulative requests and 24 unsuccessful attempts. The reasons for unsuccessful attempts were 10 service errors, 5 exact-quote mismatches, 4 JSON/schema errors, 3 other provider or validation failures, and 2 rate-limit errors. Of the four remaining rows without a verdict, two ended with invalid JSON/schema, one with a quote mismatch, and one exceeded the input bound. Coverage was 24/26 Jobicy, 38/38 Himalayas, and 14/16 Remotive.

Final result was 0 Accepted and 80 Rejected. Gemini classified 57 as ongoing contractor seats, 17 as full-time jobs, one as a seller promotion, and one as unknown. The remaining four had no validated model verdict. All 80 rows passed schema and exact-quote validation. The local browser confirmed 80 binary badges and zero Pending review badges. Telegram, the email test, and deployment stayed disabled. The bundled Apps Script still has a separate configurable `DAILY_AI_LIMIT` with a default of 10 requests per day. This run used only the local runner.
