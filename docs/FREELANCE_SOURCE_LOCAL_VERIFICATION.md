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
