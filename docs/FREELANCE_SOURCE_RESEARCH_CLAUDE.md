# Freelance buyer source research — Himalayas, Jobicy, Remotive (and why we're avoiding others)

21 November 2026 · Companion research memo to `CODEX_EXPANSION_BLUEPRINT.md` and `FREELANCE_LEAD_QUALIFICATION_SPEC.md`. Verified live via web search on this date — re-check before relying on any parameter list below, since job-board APIs change without notice (Upwork and Reddit both did, within the last 18 months).

## 0. Context

Both currently-active sources skew toward regular job postings, for different reasons:

- **Hacker News** — the live local run on 2026-11-21 pulled 5 rows from thread `50338728` ("Ask HN: Who is hiring? (November 2026)"), all tagged `company_hiring`, all correctly rejected `FULL_TIME_ONLY`. A later query for `category=freelance_request&sources=hackernews` returned 0 rows (`NO_BUYER_CANDIDATES`) — **not because real freelance posts were rejected, but because no rows were ever written under `freelance_request` from HN at all.** The qualification spec (§3, stage 1) is explicit that the freelance candidate feed should default to the current month's **"Freelancer? Seeking freelancer?"** thread, with "Who is hiring?" as a secondary, opt-in, `company_hiring`-only feed. Before adding new sources, confirm which thread `src/adapters/hackernews.ts` actually targets for the `freelance_request` category — if it's only reading "Who is hiring?", that's the root cause, not a qualification-engine false negative.
- **WordPress Jobs RSS** — collection works (4/4 imported on the last run), but titles like *"Web Site Developer – Project"*, *"WordPress Sales Support Specialist"*, *"[Astra] DevOps Engineer"* show the feed is a general job board; only a fraction of items carry the site's own `Project` job type (as opposed to `Full Time`/`Part Time`). The feed supports native server-side type filtering (WP Job Manager's standard `job_types=<slug>` query arg), so the fix is a config change, not new code: point the adapter at `https://jobs.wordpress.net/feed/?job_types=project` instead of `https://jobs.wordpress.net/feed/`. Confirm the exact slug (displayed label is "Project") against the site's own job-type archive before hardcoding it.

Neither of these fully solves volume — hence the three new sources below.

## 1. Himalayas Remote Jobs API — recommended, highest priority

**What it is:** Public job board (Himalayas Remote Jobs Pty Ltd) for remote-first companies, 95,000–100,000+ active listings per their own badges.

**Endpoints (official, documented at `himalayas.app/docs/remote-jobs-api`, OpenAPI 3.1 spec at `himalayas.app/docs/openapi.json`):**
- Browse (full feed, paginated): `GET https://himalayas.app/jobs/api?limit=20&offset=0`
- Search (filtered): `GET https://himalayas.app/jobs/api/search?employment_type=Contractor&sort=recent&page=1`
- There is also a plain RSS feed of the 100 most recent jobs: `https://himalayas.app/jobs/rss`, and an MCP server at `himalayas.app/mcp`.

**Auth:** None required for either endpoint. An optional free API key (sign up at himalayas.app) reportedly raises the rate limit from the keyless default to roughly 60 requests/minute and 10,000/day (figure from a third-party integration's docs, not Himalayas' own page — confirm in the OpenAPI spec before relying on it). **Do not block on getting this key — the keyless tier is enough to start.**

**The field that matters:** every job object has an `employmentType` field. Per Himalayas' own data dictionary (`himalayas.app/docs/data-dictionary`), the enum values are `Full Time`, `Part Time`, `Contractor`, `Temporary`, `Intern`, `Volunteer`, and `Contractor` is explicitly defined as *"independent contractor or freelance engagement"* — this is about as close as any of these boards gets to our own `engagement_type` gate in `qualification.ts`. The `/jobs/api/search` endpoint accepts `employment_type=Contractor` as a native, documented, server-side filter (confirmed working example in their own docs: `…/jobs/api/search?company=linear&employment_type=Full%20Time`).

**Response fields relevant to `ListingEvidenceV1`:**
| ListingEvidenceV1 field | Himalayas field |
|---|---|
| `original_title` | `title` |
| `original_url` | `url` / `sourceUrl` (the himalayas.app job page — **not** `applicationLink`, see ToS below) |
| `raw_text` / `decoded_text` | `description` (HTML + plain text per docs) |
| `published_at` | posted-date field returned by the API (confirm exact key name against a live response — third-party mirrors show both `postedAt` and `pubDate`-style names) |
| `source_id` | job path is already a stable slug, e.g. `companies/<company-slug>/jobs/<job-slug>` — use that directly as `source_id`, or `post:<path>`; the `url:<sha256>` fallback from the blueprint's identity scheme shouldn't be needed |

**ToS (himalayas.app/terms, API section):** personal and commercial use both permitted. Requirements: (1) every "Apply" action must use the API's `applicationLink` unmodified — never substitute a scraped employer link; (2) credit Himalayas as the source; (3) you may show the jobs on your own site/app/tool, but must not pass them on to other job boards, aggregators, Google Jobs, or LinkedIn Jobs; (4) drop expired listings (check `expiresAt`). None of this conflicts with an internal lead-qualification pipeline — we're not a job board and not redistributing to third parties.

**Pros:** largest volume of the three; explicit, documented, server-side-filterable employment-type field with a definition that maps almost 1:1 onto our gate; clean JSON with full HTML descriptions; generous keyless rate limit; MCP/RSS alternates exist if the JSON API ever misbehaves.

**Cons / caveats:** it's still an *employer-posted* board — `Contractor` can still mean "fixed-term contractor hired directly onto payroll-adjacent terms," which is exactly the `EMPLOYMENT_CONTRACT_ONLY` trap the spec warns about (§2, item 5). Treat the query filter as a volume/precision pre-filter only; full stage 1–8 gating in `qualification.ts` still has to run on every row. Exact posted-date field name needs a live-response check before the adapter is finalized.

## 2. Jobicy — recommended, second priority

**What it is:** Remote job aggregator, skews Americas/Europe per their own docs; smaller than Himalayas but has a dedicated `dev` industry slug and (on the RSS side) an explicit freelance/contract type filter.

**Endpoints:**
- JSON: `GET https://jobicy.com/api/v2/remote-jobs?industry=dev&count=50` — **documented** query params are only `count`, `geo`, `industry`, `tag` (confirmed against Jobicy's own GitHub repo, `github.com/Jobicy/remote-jobs-api`). There is **no documented `job_type` query param for the JSON endpoint** — the response does carry a `jobType` field per job, but filter on it client-side.
- RSS (the one with native type filtering): `GET https://jobicy.com/feed/job_feed?job_categories=dev&job_types=freelance,contract&search_region=...` — this is documented on Jobicy's own feed page and reuses the existing `rss.ts`/`projectRss.ts` parser with no new adapter module needed.

**Auth:** none required for either.

**Response fields:** `jobTitle`, `url`, `jobIndustry`, `jobType`, `jobGeo`, `jobLevel`, `jobDescription` (HTML), `pubDate` (already ISO UTC, UTC+00:00), `id` (unique numeric job ID — use as `source_id`, e.g. `post:<id>`).

**⚠️ One thing to verify at integration time:** Jobicy's own docs describe `jobType` inconsistently across sources — one page shows it as a single string (`"full-time"`), another shows it as an array (`["full-time"]`). Write the parser defensively (accept either shape) and confirm against a live response before shipping.

**ToS (stated on Jobicy's own feed/API page):** access exists to help distribute their listings further; don't redistribute to Jooble, Google Jobs, LinkedIn, or similar; postings are intentionally delayed 6 hours from when they're actually posted (so don't expect same-hour freshness); polling more than roughly once an hour risks throttling — trivially fine against our existing 6-hour `minimumPollMinutes` default.

**Pros:** `dev` industry slug plus a documented RSS-level `freelance`/`contract` type filter gives real server-side volume reduction before anything hits D1; numeric stable ID; clean ISO timestamps.

**Cons:** smaller total volume than Himalayas; JSON endpoint's lack of a documented type param means the JSON path needs client-side filtering (or just use the RSS variant, which is probably the cheaper build).

## 3. Remotive — recommended, third priority

**What it is:** Remote job board, category-organized (`software-dev`, `design`, etc.), moderate volume (vendor estimates put active listings in the 1,500–3,000 range, unverified independently).

**Endpoint:** `GET https://remotive.com/api/remote-jobs?category=software-dev` — note the domain moved from the old `remotive.io` to `remotive.com`; Remotive's own GitHub README carries an explicit warning that the old endpoint is dead.

**Auth:** none required.

**Documented query params (from Remotive's own GitHub README):** `category`, `company_name`, `search`, `limit` — **no job-type filter param**. The `search` param does free-text match against title+description, so `search=freelance` or `search=contract` is a usable (if blunt) keyword proxy if needed.

**Response fields:** `title`, `url`, `company_name`, `category`, `job_type` (optional field — per Remotive's own README comment, *"it's optional and often not [populated]"*), `publication_date`, `id` (use as `source_id`, e.g. `post:<id>`), `description` (HTML).

**ToS (remotive.com/remote-jobs/api):** must link back to the job's Remotive URL and name Remotive as the source, or they'll terminate API access; don't submit Remotive jobs to third-party job sites (Jooble, Neuvoo, Google Jobs, LinkedIn Jobs); Remotive's GitHub docs state excessive requests (more than ~2/minute) get blocked — irrelevant at a 6-hour poll cadence. A separate, private paid API exists if volume needs ever outgrow the free one.

**Pros:** dev-focused categories, simple JSON, permissive rate limit, straightforward attribution-only terms.

**Cons:** weakest employment-type signal of the three (field is sparse/optional) — this source should lean almost entirely on the existing `BUYER_PATTERNS`/`EMPLOYMENT_PATTERNS`/`SELLER_PATTERNS` text gate already in `qualification.ts`, rather than any query-level pre-filter. Expect a noisier buyer ratio than Himalayas or Jobicy until measured.

## 4. Optional / lowest priority: RemoteOK

`GET https://remoteok.com/api` (no key; tag-scoped variants like `remoteok.com/remote-react-jobs.json` also exist). Terms just require a followed link-back and "Remote OK" attribution. The catch: RemoteOK listings **never carry an employment-type field at all** (confirmed across multiple independent integrations describing the data), so there's no query- or field-level way to separate contract/freelance from salaried roles — everything depends on the text gate alone. Largest raw volume of any of these boards, but almost certainly the noisiest buyer ratio. Recommend running this one in shadow mode only, and deciding whether to build a permanent adapter after seeing real precision numbers.

## 5. Platforms confirmed NOT viable right now (don't build adapters for these)

| Platform | Why |
|---|---|
| **Upwork** | RSS was permanently discontinued August 20, 2024 (Upwork's own support article); still dead in 2026, every old feed URL 404s, no replacement RSS was ever offered. Official GraphQL API exists but is gated behind partner/app review — not self-serve. |
| **Freelancer.com** | Per the blueprint's own finding: no verified public feed; Terms §33 requires express written permission for automated access. Unchanged. |
| **We Work Remotely** | Has a public-looking RSS, but their own API Terms & Guidelines explicitly prohibit storing/scraping any WWR data outside their sanctioned API, **and explicitly ban building "tools for hiring remote workers or contacting remote workers for hire" or "a job advertising or job search service"** — which is precisely what this pipeline is. Don't use it even though the RSS technically responds. |
| **Reddit (r/forhire, r/slavelabour)** | Changed very recently: unauthenticated `.json` access was killed in May 2026, and on **September 30, 2026 Reddit announced it is ending RSS support entirely (effective November 13, 2026 — 8 days before this memo) and ending public API access altogether**, specifically to stop AI/scraper traffic. What remains is a paid, OAuth-gated commercial tier whose free tier is explicitly non-commercial-only and whose terms forbid AI/ML training use. No free/public path exists anymore. |
| **PeoplePerHour, Guru.com** | No official public API or RSS found for either; every available tool is unofficial scraping of public pages with no documented automated-access terms. Same posture as Freelancer.com — avoid without written permission. |
| **LinkedIn Jobs** | No self-serve public job-search API. The Talent Solutions / Recruiting System Connect APIs are versioned, partner-administered integrations (confirmed via LinkedIn's own developer release notes) — not available to arbitrary developers. User Agreement prohibits scraping. |
| **Indeed** | The old public Publisher API is retired; current integration paths (Job Sync GraphQL API, XML feeds) are partner/ATS-only; Indeed's terms forbid scraping individual listings. |

## 6. Suggested config additions (naming to match existing conventions)

Worker (`leadflow-leads`), in `.dev.vars` (local) / Worker secrets (prod) and `wrangler.toml`:
```
HIMALAYAS_JSON_ENABLED=true
HIMALAYAS_API_KEY=            # optional — only if/when signed up for a higher rate limit
JOBICY_RSS_ENABLED=true
REMOTIVE_JSON_ENABLED=true
WORDPRESS_JOBS_RSS_JOB_TYPES=project   # new: makes the existing feed's type filter configurable
DAILY_FREELANCE_SOURCES=hackernews,wordpress_jobs_rss,himalayas,jobicy_rss,remotive
```

Consumer (`leadflow-ai`) `qualification.ts`:
```
ALLOWED_SOURCES = new Set([
  "hackernews", "wordpress_jobs_rss", "freelancer_rss",
  "himalayas", "jobicy_rss", "remotive",
]);
```
and `.env.external` / `.env.external.example`:
```
EXTERNAL_LEADS_SOURCES=hackernews,wordpress_jobs_rss,himalayas,jobicy_rss,remotive
```

None of the above requires a paid signup to start. Treat Himalayas' optional key purely as a later rate-limit upgrade, not a blocker.
