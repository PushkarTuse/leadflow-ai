# Implementation Change Log: Expansion Blueprint Steps 1–8

Date: 21 November 2026
Scope: `D:\freelance_personal\leadflow-leads` and `D:\freelance_personal\leadflow-ai`
Blue print: `D:\freelance_personal\leadflow-ai\docs\CODEX_EXPANSION_BLUEPRINT.md`

This document records the uncommitted implementation state produced in this session. It is a forensic change log, not a claim that all live providers or deployments were verified. No live source collection, live provider call, live deployment, credential change, or secret value is recorded here.

## Repository state before implementation

### `leadflow-leads`

Branch:

```text
feature-new-sources-aa
```

Before this implementation, the worktree had only the PDF untracked. Baseline commit was `71d0a5a`.

### `leadflow-ai`

Branch:

```text
main
```

Before this implementation, the worktree was clean and tracked `8463503` followed by `668b259` for the blueprint.

## Step 1 — Establish baseline

### Exact commands

```powershell
Set-Location D:\freelance_personal\leadflow-leads
git status -sb
npm run typecheck
npm test
git diff --check
```

Outcome:

- `git status -sb`: only `?? Sources-temp-leadflow-leads-feature-new-sources-aa.pdf` was untracked.
- `npm run typecheck`: exit 0.
- `npm test`: exit 0, 30 tests passing.
- `git diff --check`: exit 0.

```powershell
Set-Location D:\freelance_personal\leadflow-ai
git status -sb
npm run typecheck
npm test
git diff --check
```

Outcome:

- `git status -sb`: clean, tracking `origin/main`.
- `npm run typecheck`: exit 0.
- `npm test`: exit 0, 173 tests passing.
- `git diff --check`: exit 0.

### Baseline file review

No files were changed in Step 1. The baseline implementation had:

- HN, job-board, OSM and Google adapters in `leadflow-leads`.
- Foursquare and HERE disabled stubs.
- Migration `0001_init.sql`.
- Existing qualification, shadow/enforce, Gemini/OpenAI, dashboard and local-manual-sync code in `leadflow-ai`.

## Step 2 — Storage and category boundaries

### Exact commands

```powershell
Set-Location D:\freelance_personal\leadflow-leads
npm run db:local
npm run typecheck
npm test
npm run db:local
npm test
git diff --check
```

`npm run db:local` first applied `0002_expansion.sql`; a later run returned “No migrations to apply,” proving idempotent migration state.

`npm run typecheck` and `npm test` were run repeatedly after RCA fixes.

### Created file

#### `leadflow-leads/migrations/0002_expansion.sql`

Created as an additive migration. It never resets or replaces `0001_init.sql`.

Lead columns added:

```sql
ALTER TABLE leads ADD COLUMN listing_evidence_json TEXT;
ALTER TABLE leads ADD COLUMN published_at TEXT;
ALTER TABLE leads ADD COLUMN last_seen_at TEXT;
ALTER TABLE leads ADD COLUMN registered_on TEXT;
ALTER TABLE leads ADD COLUMN activity_code TEXT;
ALTER TABLE leads ADD COLUMN activity_label TEXT;
ALTER TABLE leads ADD COLUMN pagespeed_checked_at TEXT;
ALTER TABLE leads ADD COLUMN pagespeed_url_key TEXT;
ALTER TABLE leads ADD COLUMN queue_revision INTEGER NOT NULL DEFAULT 0;
```

The lead additions support:

- RSS/listing evidence JSON.
- Publication and observation timestamps.
- MCA registration/activity fields.
- PageSpeed cache measurement provenance.
- Optimistic revision checking for manual follow-up updates.

The migration creates `source_observations`:

```sql
CREATE TABLE IF NOT EXISTS source_observations (
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  lead_id INTEGER NOT NULL,
  release_id TEXT,
  source_ref TEXT,
  license_id TEXT,
  observed_at TEXT NOT NULL,
  canonical_json TEXT,
  PRIMARY KEY (source, source_id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
```

It also creates:

- `source_observations_lead` on `lead_id`.
- `leads_updated_cursor` on `(updated_at, id)`.
- `leads_published` on `published_at`.
- `pipeline_source_state`.
- `pagespeed_cache`.
- `pipeline_daily_usage`.

`pipeline_source_state` holds ETag, Last-Modified, failure count, next due, last success, lease ID and lease expiry.

`pagespeed_cache` holds URL-key state, score, LCP, TBT, CLS, tested time, retry time, attempts, provider error and lease fields.

`pipeline_daily_usage` uses `(day_utc, bucket)` as a primary key for atomic-style daily attempts.

### Modified file

#### `leadflow-leads/src/types.ts`

Added `ListingEvidenceV1` at approximately lines 61–73:

```ts
export interface ListingEvidenceV1 {
  version: 1;
  original_title: string;
  original_url: string;
  raw_text: string;
  decoded_text: string;
  published_at: string | null;
  observed_at: string;
  link_targets: string[];
  content_hash: string;
  complete: boolean;
  truncated: boolean;
}
```

Added evidence, publication and MCA fields to `Lead`:

```ts
listingEvidence?: ListingEvidenceV1 | null;
publishedAt?: string | null;
registeredOn?: string | null;
activityCode?: string | null;
activityLabel?: string | null;
```

Added `feedId` to `CollectParams`.

Added Worker environment types:

- `WORDPRESS_JOBS_RSS_ENABLED`
- `FREELANCER_RSS_ENABLED`
- `FREELANCER_RSS_FEEDS_JSON`
- `DAILY_FREELANCE_SOURCES`
- `PAGESPEED_ENABLED`
- `PAGESPEED_DAILY_LIMIT`
- `PAGESPEED_API_KEY`
- `GOOGLE_PLACES_PROSPECTING_ENABLED`

### Modified file

#### `leadflow-leads/src/db.ts`

Changes include:

- Added all migration fields to `COLS`.
- Added freelance URL-based dedupe:

```ts
if (l.category === "freelance_request") {
  if (/^https?:\/\//i.test(l.url ?? "")) {
    const normalized = new URL(l.url as string);
    normalized.hash = "";
    return `listing:${normalized.href}`;
  }
}
```

- Added `listingEvidence`, `publishedAt`, MCA fields and manual revision defaults to `toRow`.
- Changed `upsertLeads` from count-before/count-after source counting to per-row `(source, source_id)` handling.
- The per-row implementation first reads an existing source/source-ID row.
- Existing rows are updated directly; this is classified as a duplicate and does not increase `inserted`.
- New rows use bound `INSERT` with `ON CONFLICT DO NOTHING`.
- Existing refreshes preserve manual status and notes and preserve `queue_revision`.
- A refresh updates `listing_evidence_json`, publication/MCA fields and last-seen time.
- `updated_at` changes only when meaningful listing identity/text/evidence values changed; identical refreshes preserve the old timestamp.
- Added `sources`, `include`, `after_id` and `until_id` to `LeadQuery`.
- Added source allowlisting for `hackernews`, `wordpress_jobs_rss` and `freelancer_rss`.
- Added freelance-only cursor mode with:
  - ascending `id`
  - `id > after_id`
  - `id <= snapshot/until_id`
  - limit 1–5 in cursor mode
  - `snapshot_until_id`
  - `next_after_id`
  - `has_more`
- Legacy offset paging remains available for non-cursor calls.

`formatLead` now optionally projects `listing_evidence` only when `include=evidence`; default and CSV output omit evidence.

### Modified file

#### `leadflow-leads/src/index.ts`

- `/leads` now catches invalid source/cursor query combinations and returns HTTP 400 instead of generic 500.
- Cursor metadata is added to `/leads` only in cursor mode.
- Legacy body fields remain available.
- New `/exports/new-companies.csv` exports MCA/new-company rows from `category=new_company&source=mca`.
- The manual patch route now supports `expected_revision`.
- Legacy PATCH requests without `expected_revision` remain available for existing clients.
- A revision-aware PATCH verifies the row is `local_business` or `new_company` and not Google Places/Nearby.
- Revision mismatch returns 409.
- Successful manual status/note writes increment `queue_revision`.

### Step 2 RCA fixes

#### RCA 1: TypeScript array callback

Failing command:

```text
npm run typecheck
```

Observed error:

```text
src/db.ts(246,73): error TS2345
Argument of type '(row, includeEvidence?) => Record...' is not assignable...
```

Root cause:

`formatLead` had acquired a second parameter, and the legacy `rows.results.map(formatLead)` form passed the array index as `includeEvidence`.

Fix:

```ts
rows.results.map((row) => formatLead(row, false))
```

Re-run outcome: `npm run typecheck` passed.

#### RCA 2: Test fixture did not apply migration 0002

Failing command:

```text
npm test
```

Observed:

16 of 30 tests failed because `upsertLeads` queried additive columns that were absent in the test D1 schema.

Root cause:

`test/api.test.ts` applied only `migrations/0001_init.sql` in `beforeAll`.

Fix:

The fixture setup now loops through both:

```ts
for (const migration of [
  "migrations/0001_init.sql",
  "migrations/0002_expansion.sql",
]) {
  ...
}
```

Re-run outcome: 28 of 30 passed initially; remaining failures identified the next RCA.

#### RCA 3: Conflict refresh counted as insert

Failing command:

```text
npm test
```

Observed:

RemoteOK idempotency counted 1 inserted instead of 1 duplicate; HN mode-all also counted refreshes as inserted.

Root cause:

SQLite `RETURNING` returned an existing row after conflict refresh, so result length could not distinguish insert versus update.

Fix:

`upsertLeads` now:

1. Selects by `(source, source_id)`.
2. Runs an explicit update for an existing row.
3. Increments `duplicates`.
4. Uses `RETURNING id` only for the actual new-row branch.

Re-run outcome: 30 of 30 tests passed.

### Step 2 final sanity

- Migration first apply: passed.
- Migration second apply: passed with no migrations to apply.
- Typecheck: passed.
- Tests: 30 passed.
- `git diff --check`: passed.

## Step 3 — Project feeds and scheduler

### Exact commands

```powershell
Set-Location D:\freelance_personal\leadflow-leads
npm install fast-xml-parser@^5
npm run typecheck
npm test
git diff --check
```

All sanity commands passed after fixture cleanup.

### Created files

#### `leadflow-leads/src/feeds/rss.ts`

Added:

- `FeedPolicy`
- `RssItem`
- `directArray`
- `text`
- `stripHtmlHtml`
- `parseRss`

`parseRss`:

- Rejects `<!DOCTYPE` and `<!ENTITY`.
- Rejects bodies over 1 MiB.
- Uses `fast-xml-parser` with `processEntities=false`.
- Uses namespace-prefix removal.
- Requires an RSS root and channel.
- Parses direct channel children up to 100 items.
- Extracts title, link, guid, publication date, description, `content:encoded`/`encoded` and `post_id`.

`stripHtmlHtml`:

- Collects at most 10 hrefs.
- Removes script/style blocks.
- Converts paragraph/heading/div/list breaks to visible paragraph boundaries.
- Removes remaining executable markup.
- Decodes XML entities once.
- Normalizes whitespace.

#### `leadflow-leads/src/adapters/projectRss.ts`

Added:

- `WORDPRESS_POLICY`
- `validCanonicalUrl`
- `sha256`
- `cheapFilter`
- `mapProjectItem`
- `collectProjectFeed`
- `wordpressJobsRss`

`WORDPRESS_URL` is fixed to:

```text
https://jobs.wordpress.net/feed/
```

The default policy:

- feed ID `wordpress-default`
- enabled only by literal `WORDPRESS_JOBS_RSS_ENABLED=true`
- minimum poll six hours
- exact host `jobs.wordpress.net`

The adapter:

- Rejects a supplied alternate feed ID.
- Reads ETag/Last-Modified/source due state from `pipeline_source_state`.
- Sets Accept and descriptive User-Agent.
- Uses 10-second timeout and manual redirect handling.
- Rejects 304 without previous validators.
- Rejects HTML and malformed/non-RSS responses.
- Parses at most 100 feed items.
- Filters seller/employment/unpaid/spam/missing evidence.
- Limits returns to 1–50.
- Emits `category=freelance_request`, `score=0`, and `Unverified requester` when no source-stated buyer name is available.
- Builds `ListingEvidenceV1` with SHA-256 content hash.
- Stores evidence source hash and timestamps on the lead.

Identity output precedence:

1. `post:<postId>` when published `post_id` is available.
2. Otherwise `url:<sha256(canonicalUrl)>`.

### Modified files

#### `leadflow-leads/src/adapters/hackernews.ts`

Changed `SELLER_SELF_PROMOTION` from broad body matching to a first-clause/header-style check:

```ts
/^\s*(?:seeking work|seeking freelance...|for hire|...)\b/i
```

This avoids rejecting ordinary buyer paragraphs that merely mention vendor availability, and keeps seller filtering focused on explicit seller headers.

#### `leadflow-leads/src/collect.ts`

Added `wordpressJobsRss` import and registration in `ADAPTERS`.

`KEYLESS_FEEDS` remains unchanged.

`runDaily` now:

- Runs existing keyless feeds.
- Runs WordPress RSS only when `WORDPRESS_JOBS_RSS_ENABLED === "true"`.
- Runs Google only when `GOOGLE_PLACES_PROSPECTING_ENABLED === "true"` and `GOOGLE_API_KEY` exists.

#### `leadflow-leads/src/index.ts`

Added `feedId` parsing to the collection parameter merger.

#### `leadflow-leads/wrangler.toml`

Added default expansion variables:

```toml
DAILY_FREELANCE_SOURCES = "hackernews"
WORDPRESS_JOBS_RSS_ENABLED = "false"
FREELANCER_RSS_ENABLED = "false"
FREELANCER_RSS_FEEDS_JSON = "[]"
PAGESPEED_ENABLED = "false"
PAGESPEED_DAILY_LIMIT = ""
GOOGLE_PLACES_PROSPECTING_ENABLED = "false"
```

Daily search and Nearby values remain present in the existing config but do not dispatch unless the explicit Places gate and key are present.

#### `leadflow-leads/.dev.vars.example`

Added only variable placeholders, no credentials:

- `WORDPRESS_JOBS_RSS_ENABLED=false`
- `FREELANCER_RSS_ENABLED=false`
- `FREELANCER_RSS_FEEDS_JSON=[]`
- `PAGESPEED_ENABLED=false`
- `PAGESPEED_DAILY_LIMIT=`
- `GOOGLE_PLACES_PROSPECTING_ENABLED=false`

#### `leadflow-leads/package.json`

Added:

```json
"import:prepare": "tsx scripts/prepare-import.ts"
```

Added dependencies:

- runtime `fast-xml-parser`
- development `tsx`

#### `leadflow-leads/package-lock.json`

Updated to record `fast-xml-parser`, `tsx` and the resulting dependency graph.

### Test additions

`leadflow-leads/test/api.test.ts` added RSS fixture parsing and isolation coverage:

- Paid React booking buyer fixture.
- Seller `for hire` fixture.
- Entity/HTML-root parser rejection.
- Fixed feed enabled/disabled behavior.
- Seller cheap filtering.
- Evidence content hash and complete flag.

The collection test sets WordPress enabled, runs a fixture, deletes synthetic rows, and restores disabled state.

### Step 3 RCA fix

Failing command:

```text
npm test
```

Observed:

- The suite reported 33 tests with 2 failed.
- The synthetic WordPress paid buyer remained in D1, increasing later freelance count and total count.

Root cause:

The RSS fixture test was not cleaning synthetic rows inserted by its enabled-feed collection.

Fix:

The test now queries `source=wordpress_jobs_rss` and deletes every synthetic row before restoring `WORDPRESS_JOBS_RSS_ENABLED=false`.

Re-run outcome: 33 tests passed.

### Step 3 final sanity

- Typecheck: passed.
- Tests: 33 passed.
- `git diff --check`: passed.
- No live RSS network call was made.
- Google/Freelancer remained disabled.

## Step 4 — Open-data/MCA conversion

### Exact commands

```powershell
Set-Location D:\freelance_personal\leadflow-leads
npm install --save-dev tsx@^4
npm run typecheck
npm test
git diff --check
```

All final sanity commands passed after the manifest and score fixes.

### Created file

#### `leadflow-leads/scripts/prepare-import.ts`

Added an offline Node CLI, invoked as:

```text
npm run import:prepare -- --source overture|fsq_os|mca --input <path> --manifest <path> --out <directory>
```

Functions in the script:

- `opt(name)` reads a named CLI argument.
- `parseCsv(text)` performs real quoted CSV parsing.
- Reads input bytes and manifest JSON.
- Computes batch SHA-256.
- Validates manifest/source match.
- Outputs canonical JSON in `<out>/<source>-manifest.json`.
- Reports received, accepted, rejected and SHA-256.
- For MCA, accepts explicit field bindings and emits CIN, name, category, registered date and activity metadata.
- For Overture/FSQ OS, emits source ID, name and canonical local-business fields.

The script does not download Datasets, connect to APIs or scan a global dataset.

### Modified file

#### `leadflow-leads/src/import.ts`

Added `ImportManifest`:

```ts
export interface ImportManifest {
  source: "overture"|"fsq_os"|"mca";
  release_id: string;
  input_sha256: string;
  source_url: string;
  license_id: string;
  attribution: string;
  retrieved_at: string;
  field_bindings?: Record<string,string>;
}
```

Added `cleanControls`.

Changed `importLeads` to accept an optional manifest.

Manifest validation now checks:

- manifest source equals route source.
- release ID exists.
- input SHA-256 exists.
- source URL is HTTP(S).
- license ID exists.
- attribution exists.
- retrieval timestamp exists.

MCA mapping now:

- Reads `activity_code` and `activity_label`.
- Stores them on `Lead`.
- Uses `email: null` when calling `scoreNewCompany`.
- Prevents an unverified MCA-listed email from earning contact points.
- Writes legacy `registered:<date>` tag for compatibility.

MCA score behavior remains:

- base 60
- recency 15
- customer-facing activity 10
- software activity -20
- no contact point for unverified email

### Modified file

#### `leadflow-leads/src/index.ts`

Import route now:

- Parses `{ leads, manifest }`.
- Passes manifest to `importLeads`.
- Returns 400 for manifest mismatch or validation error.
- Preserves partial-row import behavior for valid batches.

Added `/exports/new-companies.csv`:

- category `new_company`
- source `mca`
- stable 200-row paging
- max 10,000 export rows
- columns include registered date, activity code/label and source URL fields
- formula cells are apostrophe-prefixed
- unverified MCA email is not included

### Modified file

#### `leadflow-leads/test/api.test.ts`

Added tests for:

- manifest-backed MCA import
- mismatched provenance source rejection
- `/exports/new-companies.csv`
- corrected software/new-company scoring expectation

Existing import tests continue to cover Overture/FSQ/MCA replay and bad rows.

### Step 4 RCA fixes

#### RCA 1: MCA software fixture score

Failing command:

```text
npm test
```

Observed:

Byteforge Labs returned 55 instead of the previous test expectation 60.

Root cause:

The fixture is recent and software-focused:

- base 60
- recency +15
- software -20
- no email contact point

The result is 55.

Fix:

Updated the test expectation from 60 to 55.

Re-run: fixture suite passed.

#### RCA 2: Manifest mismatch returned 500

Failing command:

```text
npm test
```

Observed:

The mismatched manifest route returned HTTP 500 instead of 400.

Root cause:

`importLeads` threw a validation error that reached the generic route handler.

Fix:

The `/import/:source` handler now wraps import execution and returns 400 for manifest or batch validation errors.

Re-run: 34 tests passed.

### Step 4 final sanity

- Dependency install: passed.
- Typecheck: passed.
- Tests: 34 passed.
- `git diff --check`: passed.
- No live Overture, FSQ or MCA download was performed.

## Step 5 — Mobile PageSpeed enrichment

### Exact commands

```powershell
Set-Location D:\freelance_personal\leadflow-leads
npm run typecheck
npm test
git diff --check
```

These commands passed after policy-aligned fixture and score fixes.

### Modified file

#### `leadflow-leads/src/enrich/pagespeed.ts`

Added `PageSpeedOutcome`:

```ts
export type PageSpeedOutcome =
  | {
      state: "OK";
      score: number;
      lcp_ms: number | null;
      tbt_ms: number | null;
      cls: number | null;
      tested_at: string;
    }
  | {
      state:
        | "SITE_UNREACHABLE"
        | "QUOTA"
        | "AUTH"
        | "RETRYABLE"
        | "INVALID_RESULT";
      error_code: string;
      retry_after_seconds?: number;
    };
```

Added `normalizePagespeedUrl`:

- accepts HTTP(S) input
- prefixes HTTPS when no scheme is present
- normalizes lower-case host
- removes fragment
- removes `utm_*`, `fbclid` and `gclid`
- rejects credentials, custom ports, IP literals, local hosts and invalid public host shapes
- rejects an exact/subdomain social/directory host list

Social hosts include:

- Facebook
- Instagram
- LinkedIn
- YouTube
- Twitter/X
- TikTok
- WhatsApp short links
- Google Maps

Replaced the old numeric-only `pagespeedScore`:

- calls fixed Google PageSpeed endpoint
- sends `strategy=mobile`
- sends `category=performance`
- optionally uses `PAGESPEED_API_KEY`
- falls back to `GOOGLE_API_KEY` when explicitly present
- uses 40-second timeout
- maps 429 to quota
- maps 403 to auth/key
- maps 5xx to retryable
- maps navigation/result/schema failures to explicit states
- extracts Lighthouse performance 0–1, LCP, TBT and CLS

Changed `enrichPagespeed`:

- default/max manual limit is 5
- selects only permitted `local_business` rows
- excludes `google_places` and `google_nearby`
- selects oldest due measurement then ID
- normalizes a target URL
- hash-deduplicates cache work
- queries `pagespeed_cache`
- applies 30-day successful cache
- reserves UTC/daily attempts with `pipeline_daily_usage`
- defaults 5 attempts keyless and 10 keyed
- caps configured max at 20
- updates a matching row only with `id` and current `website`
- caches provider success even if the selected row changed
- does not expose URL keys or provider bodies in aggregate output

New result counters:

- `requested`
- `checked`
- `cache_hits`
- `deferred`
- `blocked`
- `remaining`
- bounded `{id,state,error_code}` entries

### Modified file

#### `leadflow-leads/src/index.ts`

Existing `/enrich/pagespeed` route was retained.

The route still does not read `PAGESPEED_ENABLED` before dispatch; feature gating is therefore not yet route-level and remains an open implementation gap.

### Step 5 RCA fixes

#### RCA 1: Order-dependent test

Failing command:

```text
npx vitest run test/api.test.ts -t "re-scores sites"
```

Observed:

`requested=0`, `checked=0`, because earlier collection tests were skipped.

Root cause:

The test assumed D1 state created by preceding tests.

Fix:

The test now creates Google and OSM fixture rows itself.

#### RCA 2: Google exclusion policy

Failing command:

```text
npm test
```

Observed:

Only 1 of 2 expected PageSpeed rows checked, not 2.

Root cause:

The implementation intentionally excludes Google Places/Nearby; only the OSM record was eligible.

Fix:

Updated PageSpeed test to expect:

- 1 checked
- OSM Koregaon
- Google test records excluded

#### RCA 3: Slow-score value

Failing command:

```text
npm test
```

Observed:

Koregaon score was 80 instead of 85.

Root cause:

The fixture has no phone/rating, so `scoreLocalBusiness` adds no bonuses.

Fix:

Updated the fixture to expect 80.

Re-run outcome: 34 tests passed.

### Step 5 final sanity

- Typecheck: passed.
- Tests: 34 passed.
- `git diff --check`: passed.
- No live PageSpeed request was made.

## Step 6 — Freelance consumer

### Exact commands

```powershell
Set-Location D:\freelance_personal\leadflow-ai
npm run typecheck
npm test
git diff --check
```

All final sanity commands passed after the policy-version fixture update.

### Modified file

#### `leadflow-ai/apps/automation/external-leads.ts`

Expanded `externalSources`:

```ts
export const externalSources = [
  "hackernews",
  "wordpress_jobs_rss",
  "osm",
  "remoteok",
  "arbeitnow",
  "jobicy",
] as const;
```

Added `listingEvidenceSchema`:

- strict Zod object
- version 1
- title max 300
- HTTPS/HTTP URLs
- raw text max 20,000
- decoded text max 12,000
- publication/observation timestamps
- at most 10 URL targets
- 64-character lowercase SHA-256
- complete/truncated booleans

Added RSS mapping in `externalToLead`:

- requires `category=freelance_request`
- rejects missing or invalid evidence
- rejects incomplete evidence for this mapping
- creates `source='csv'`
- creates `source_external_id='wordpress_jobs_rss:'+source_id`
- creates strict `discovery_context`
- sets `item_type='listing'`
- sets provider, provider record ID, title/body, publication time, source hash and complete/truncated flags
- sets thread fields empty
- sets `deleted=false` and `dead=false`

The existing HN branch remains separate and unchanged except for source allowlist coexistence.

Pull behavior now:

- requests evidence only when `wordpress_jobs_rss` is in the allowed source set
- requires exact category `freelance_request`
- rejects contextless RSS rows
- filters company hiring/local business before ingest
- ignores upstream status/score/contact values

### Modified file

#### `leadflow-ai/packages/core/qualification.ts`

Changed policy version:

```ts
QUALIFICATION_POLICY_VERSION = "policy.v2"
```

Changed approved provider set:

```ts
const ALLOWED_SOURCES = new Set([
  "hackernews",
  "wordpress_jobs_rss",
]);
```

No live provider behavior was changed.

### Modified test

#### `leadflow-ai/tests/external-leads.test.ts`

Added a strict RSS evidence fixture test:

- valid evidence maps to `discovery_context`
- provider is `wordpress_jobs_rss`
- item type is `listing`
- source hash is copied exactly
- missing evidence throws

### Modified test

#### `leadflow-ai/tests/qualification-pipeline.test.ts`

Changed audit expectation from `policy.v1` to `policy.v2`.

### Step 6 RCA fix

Failing command:

```text
npm test
```

Observed:

The eligible qualification fixture expected `policy.v1`, but the implementation returned `policy.v2`.

Root cause:

Adding approved RSS source support is a qualification-policy change.

Fix:

Updated the test fixture audit expectation to `policy.v2`.

Re-run outcome: 174 tests passed.

### Step 6 final sanity

- Typecheck: passed.
- Tests: 174 passed.
- `git diff --check`: passed.
- No live Gemini/OpenAI/Telegram call was made.
- Existing inbound suite remained passing.

## Step 7 — Manual queues and UI

### Exact commands

```powershell
Set-Location D:\freelance_personal\leadflow-leads
npm run typecheck
npm test
git diff --check

Set-Location D:\freelance_personal\leadflow-ai
npm run typecheck
npm test
git diff --check
npm run build:automation
git diff --check
```

All final sanity commands passed after legacy-PATCH and count-fixture fixes.

### Modified file

#### `leadflow-ai/apps/automation/local-business-sync.ts`

Added `pullManualProspects`.

For `category=local_business`, it delegates to `pullLocalBusinesses`.

For `category=new_company`:

- requests `/leads?category=new_company&source=mca...`
- validates a 1–200 row page
- validates strict MCA row fields
- maps `company_key=mca:<sourceId>`
- maps stable API ID
- maps registration date
- maps activity code/label
- maps campaign status and notes
- sets synchronized timestamp
- never invokes qualification or notification code

Added `saveManualProspectFollowup`:

- validates HTTPS origin and token
- validates numeric API ID
- validates status enum
- validates notes max 2,000
- performs category/source GET
- rejects Google Places/Nearby
- sends status, notes and optional `expected_revision`
- makes no AI/Telegram/Gmail call

### Modified file

#### `leadflow-ai/apps/automation/sheets.ts`

Added the `New Companies` table schema:

- `company_key`
- `api_id`
- `source`
- `source_id`
- `name`
- `category`
- `title`
- `registered_on`
- `activity_code`
- `activity_label`
- `city`
- `country`
- `address`
- `score`
- `signal`
- `source_url`
- `campaign_status`
- `last_contacted_at`
- `campaign_notes`
- `synced_at`

Added `SheetStore.upsertNewCompany`.

The method preserves existing:

- `campaign_status`
- `last_contacted_at`
- `campaign_notes`

It refreshes upstream source fields.

### Modified file

#### `leadflow-ai/apps/automation/main.ts`

Imported the generic manual-prospect functions.

Added menu items:

- `Sync new companies`
- `Save selected new-company follow-up`

Added `syncNewCompanies`:

- blocked in dry-run mode
- requires `LOCAL_BUSINESS_SYNC_ENABLED=true`
- uses the existing HTTPS origin/token
- writes only `New Companies`
- runs no AI or notification logic

Added `saveSelectedNewCompanyFollowup`:

- requires an active `New Companies` row
- reads selected status/notes
- sends a revision-aware update payload
- uses no Engine/approval/Gmail path

### Modified file

#### `leadflow-ai/packages/core/csv.ts`

Added `exportManualProspectCsv(headers, rows)`.

The helper:

- emits quoted CR/LF CSV
- uses `safeCell`
- prefixes dangerous leading formula characters
- is reusable for manual local-business/new-company exports

### Modified file

#### `leadflow-leads/src/index.ts`

Extended manual PATCH behavior:

- reads `category`, `source` and `queue_revision`
- increments revision on status/notes update
- protects revision-aware local/new-company writes
- permits legacy PATCH for older callers
- rejects non-manual Google/Local category writes only when an expected revision was supplied

### Modified tests

#### `leadflow-ai/tests/local-business-sync.test.ts`

Added:

- MCA/new-company sync fixture
- strict category/source mapping
- manual revision update request test
- Google/local isolation remains covered

### Step 7 RCA fixes

#### RCA 1: Legacy PATCH behavior

Failing command:

```text
npm test
```

Observed:

The existing update/read test received no updated lead because the route had become revision-only.

Root cause:

The new manual-category restriction was applied even to legacy PATCH calls without `expected_revision`.

Fix:

Legacy PATCH calls now retain existing behavior.

The category/source/Google restriction is enforced only when `expected_revision` is supplied.

Re-run: updater test passed.

#### RCA 2: Expected suite count

Failing command:

```text
npm test
```

Observed:

The suite returned 7 total rows, while a fixture assertion had been changed to 8.

Root cause:

The test database did not gain a synthetic eighth row; PageSpeed/Google isolation did not add it.

Fix:

Restored:

```text
total 7
local_business 3
company_hiring 3
freelance_request 1
```

Re-run: 34 upstream tests passed.

#### RCA 3: Consumer unused parameter

Failing command:

```text
npm run typecheck
```

Observed:

Unused `url` parameter in `tests/local-business-sync.test.ts`.

Root cause:

The mock HTTP callback named but did not use URL.

Fix:

Renamed parameter to `_url`.

Re-run: typecheck passed.

### Step 7 final sanity

- Upstream typecheck: passed.
- Upstream tests: 34 passed.
- Upstream `git diff --check`: passed.
- Consumer typecheck: passed.
- Consumer tests: 176 passed.
- Automation bundle build: passed locally.
- `git diff --check`: passed.
- No deployed Apps Script change was made.

## Step 8 — Integrated acceptance

### Exact commands

```powershell
Set-Location D:\freelance_personal\leadflow-leads
npm run db:local
npm test
npm run typecheck
git diff --check

Set-Location D:\freelance_personal\leadflow-ai
npm test
npm run typecheck
npm run build:automation
npm run build
git diff --check

Set-Location D:\freelance_personal\leadflow-ai
$env:TELEGRAM_ENABLED='false'
$env:SAFE_OWNER_EMAIL_TEST='false'
npm run external:run -- --dry-run
```

### Final verification outcomes

#### `leadflow-leads`

- `npm run db:local`: migration already applied, no migration to apply.
- `npm test`: 34 passing.
- `npm run typecheck`: exit 0.
- `git diff --check`: exit 0.

#### `leadflow-ai`

- `npm test`: 176 passing.
- `npm run typecheck`: exit 0.
- `npm run build:automation`: built `apps/automation/dist/Code.gs` locally.
- `npm run build`: exit 0.
- `git diff --check`: exit 0.

### Shadow dry-run

The actual dry-run result:

```json
{
  "mode": "DRY RUN — real reads, local rules, preview only",
  "imported": 5,
  "duplicates": 0,
  "invalid": 0,
  "nextOffset": 5,
  "pending": 0,
  "ai_attempted": false,
  "telegram": "suppressed by shadow mode",
  "email_test": "DISABLED",
  "alerts": 0
}
```

The five HN/dummy records used local rules and wrote only the preview state file.

No live AI, Telegram or owner email was used.

## Per-file final inventory

### `leadflow-leads`

| File | Status | Exact change |
|---|---|---|
| `.dev.vars.example` | Modified | Added expansion switches and PageSpeed/Places placeholders. |
| `package.json` | Modified | Added `import:prepare`, `fast-xml-parser` and `tsx`. |
| `package-lock.json` | Modified | Updated dependency graph for XML and TSX tooling. |
| `wrangler.toml` | Modified | Added disabled-by-default expansion variables. |
| `migrations/0002_expansion.sql` | Created | Additive lead columns and four expansion tables/indexes. |
| `src/types.ts` | Modified | Added evidence, MCA, PageSpeed and Worker config types. |
| `src/db.ts` | Modified | Per-row upsert, D1 cursor, evidence projection, source filter and dedupe. |
| `src/index.ts` | Modified | Cursor/400 handling, new-company CSV, expected-revision PATCH. |
| `src/import.ts` | Modified | Manifest validation and MCA metadata/email handling. |
| `scripts/prepare-import.ts` | Created | Offline pinned CSV/import preparation CLI. |
| `src/feeds/rss.ts` | Created | Safe Workers RSS parser and HTML sanitizer. |
| `src/adapters/projectRss.ts` | Created | Fixed WordPress RSS adapter with filters/evidence. |
| `src/adapters/hackernews.ts` | Modified | Seller regex is first-clause/header-oriented. |
| `src/collect.ts` | Modified | Adapter registry plus explicit RSS/Google daily gates. |
| `src/enrich/pagespeed.ts` | Modified | URL preflight, outcomes, cache, budget and state handling. |
| `test/api.test.ts` | Modified | Added/updated RSS, migration, import and score fixtures/tests. |

### `leadflow-ai`

| File | Status | Exact change |
|---|---|---|
| `apps/automation/external-leads.ts` | Modified | Added WordPress source/evidence mapping and strict context. |
| `apps/automation/local-business-sync.ts` | Modified | Added generic manual new-company pull/save functions. |
| `apps/automation/main.ts` | Modified | Added New Companies menu/sync/follow-up operations. |
| `apps/automation/sheets.ts` | Modified | Added New Companies headers and upsert method. |
| `packages/core/csv.ts` | Modified | Added manual-prospect CSV exporter. |
| `packages/core/qualification.ts` | Modified | Approved source set and policy version change. |
| `tests/external-leads.test.ts` | Modified | Added RSS evidence fixture and missing-evidence behavior. |
| `tests/local-business-sync.test.ts` | Modified | Added MCA/new-company sync and revision-save tests. |
| `tests/qualification-pipeline.test.ts` | Modified | Updated policy-version audit expectation. |

No changes were made to `apps/web/src/PipelineDashboard.tsx` or `vite.config.ts` in this implementation. Existing dashboard/provider controls are reused.

## Source-by-source readiness matrix

| Source | Code | Active/gate | Fixture/input | Live verification |
|---|---|---|---|---|
| `hackernews` | Existing adapter plus tightened seller regex | Default HN freelance mode; no key | HN Algolia/Hacker News fixtures | Live HN behavior previously verified outside this change set; no live call in Steps 1–8 |
| `wordpress_jobs_rss` | `projectRss.ts`, `rss.ts`, adapter registry | Implemented but `WORDPRESS_JOBS_RSS_ENABLED` defaults false; fixed WordPress host | RSS XML fixtures | Not live-tested; no live network call |
| `freelancer_rss` | No adapter; only config placeholders | Disabled | No feed URL/permission fixture | Not implemented; activation remains prohibited until written permission |
| `osm` | Existing live adapter | Available by keyless direct route; no expansion switch | Overpass fixtures | Live OSM test existed in earlier session; Steps 1–8 used fixtures |
| `googlePlaces` | Existing adapter | Adapter remains callable; cron only when `GOOGLE_PLACES_PROSPECTING_ENABLED=true` and key present | Google fixture | Live not verified; direct route lacks a route-level switch in this implementation |
| `googleNearby` | Existing adapter | Cron only with explicit Places gate and key | Nearby fixture | Live not verified; direct route lacks a route-level switch |
| `pagespeed` | `pagespeed.ts` cache/outcome implementation | Direct route exists; `PAGESPEED_ENABLED=false` default | Lighthouse fixture | Live PageSpeed not verified; no live network call |
| `overture` | Existing canonical import plus offline preparer | Import route exists; no Worker download | Canonical JSON/CSV fixtures | Live pinned release not tested |
| `fsq_os` | Existing canonical import plus offline preparer | Import route exists; no paid Foursquare adapter | Canonical JSON/CSV fixtures | Live release not tested |
| `mca` | Canonical import, score and New Companies export | Import route exists; no recurring download | Synthetic CIN/date/CSV fixtures | Live government release not tested |

## Environment and credential audit

No secret values are reproduced in this section.

### `leadflow-leads/.dev.vars.example`

Keys are aligned to existing/expansion code:

| Key | Local fixture need | Status |
|---|---|---|
| `API_TOKEN` | Required for authenticated local Worker routes | Example placeholder present |
| `GOOGLE_API_KEY` | Only live Google Places/Nearby/PageSpeed fallback | Optional/empty by default |
| `FOURSQUARE_API_KEY` | Commercial adapter; code is a stub | Optional/empty |
| `HERE_API_KEY` | HERE adapter; code is a stub | Optional/empty |
| `WORDPRESS_JOBS_RSS_ENABLED` | Enables fixture/live WordPress adapter | Added; default false |
| `FREELANCER_RSS_ENABLED` | Reserved disabled switch | Added; default false |
| `FREELANCER_RSS_FEEDS_JSON` | Reserved array of permitted feeds | Added; `[]` |
| `PAGESPEED_ENABLED` | Declared expansion flag | Added; default false, but route currently does not read it |
| `PAGESPEED_DAILY_LIMIT` | Budget override | Added; empty means code-derived default |
| `GOOGLE_PLACES_PROSPECTING_ENABLED` | Cron/Google gate | Added; default false |

`PAGESPEED_API_KEY` is referenced by code but was not added to `.dev.vars.example` or `wrangler.toml` key comments. It should be documented explicitly when live PageSpeed is activated.

### `leadflow-leads/wrangler.toml`

The expansion variables are present and default-safe.

Existing `DAILY_SEARCHES` and `DAILY_NEARBY` remain in config, but actual daily dispatch now requires the Google gate and key.

`USER_AGENT` is descriptive and can identify the caller.

### `leadflow-ai/.env.external`

The local file is present and ignored.

Key-name audit, without values:

- existing external lead keys
- existing Gemini keys/model/attestation flags
- existing Telegram owner credentials
- existing owner email/SMTP settings

The following OpenAI-compatible keys exist in `.env.external.example` but are not required for the implementation’s current local HN fixture:

- `AI_ENABLED`
- `AI_PROVIDER`
- `AI_API_KEY`
- `AI_MODEL`
- `AI_API_BASE_URL`
- `AI_DATA_USE_APPROVED`

Check: `.env.external` was used for the successful dry-run. It did not need OpenAI keys for rules fallback/dry-run.

No secret values are copied into this document.

### `leadflow-ai/.env.external.example`

Example includes all local runner keys and default-safe values:

- external ingestion disabled
- loopback API origin example
- HN source
- batch 5
- shadow mode
- Gemini disabled
- OpenAI-compatible disabled
- Telegram disabled
- owner test setting

The examples cover existing API/provider/notification settings. It does not currently list upstream expansion flags because those belong to the Worker/`.dev.vars` side.

### `leadflow-ai/.env.example`

Contains public Vite/browser variables only.

No private provider, Telegram or API credential variable belongs here.

### `leadflow-ai/apps/automation/settings.example.json`

Includes shadow qualification, external pull and local-business sync keys.

For the expansion implementation, no new property was added for MCA/new-company sync beyond reusing `LOCAL_BUSINESS_SYNC_ENABLED`.

Missing explicit Apps Script examples for a future Worker:

- `PAGESPEED_API_KEY` is not an Apps Script consumer key.
- upstream expansion switches are Worker vars, not Sheet properties.

### Credentials/features without new web credentials

These work with the current local fixture/mock setup:

- migration application
- RSS XML parsing and mapping fixtures
- PageSpeed result parsing fixtures
- MCA/import parsing fixtures
- HN local rules qualification
- shadow shadow-safe dry-run
- dashboard build
- manual queue unit tests
- Apps Script local bundle build

No new credential is required for those fixture-only checks.

### User-obtainable credentials/permissions for live features

| Feature | Required user setup |
|---|---|
| WordPress Jobs RSS | No API key under fixed feed; retain review of publisher terms and retention/use policy |
| Freelancer RSS | Express written permission for exact feed URLs; owner-selected feed list and rights reference |
| Google Places/Nearby | Google Cloud project, billing, Places API access, restricted API key, source-policy review |
| PageSpeed | Optional `PAGESPEED_API_KEY`; Google API key fallback can be used only by deliberate config |
| Overture | Pinned release, license/attribution, offline source files, approved bbox/polygon |
| FSQ OS | Pinned release, Apache/NOTICE attribution and offline local import |
| MCA | Pinned official release, manifest, field bindings, release terms |
| Gemini | Existing provider key/model/attestation flags; live quota remains provider-dependent |
| OpenAI-compatible | Public HTTPS-compatible base, key, model, paid/quota/billing permission and data-use approval |
| Telegram | Existing private bot token/chat IDs; no live send was required |
| SMTP owner test | Existing relay credentials/verified sender and recipient; no new local fixture credential |
| HTTPS upstream | Deploy Worker or other reachable HTTPS API and private 32-character API token |

## Known incomplete or open blueprint items

1. **Migration 0002 and test fixture are complete, but revision-aware PATCH implementation should be validated against a live D1 instance.**
2. **`PAGESPEED_ENABLED` is not read by `/enrich/pagespeed`; direct route dispatch can occur even if the flag is false.** Add route/schedule guards before production activation.
3. **Google direct routes are not preflight-gated by `GOOGLE_PLACES_PROSPECTING_ENABLED`.** Cron dispatch is gated, but direct `/collect/google_places` and `/collect/google_nearby` remain callable if they have a key.
4. **`DAILY_FREELANCE_SOURCES` is declared but the scheduler still uses a fixed keyless list plus explicit WordPress.** Implement a bound parser and source allowlist if dynamic scheduling is required.
5. **Freelancer RSS has no adapter and no FeedPolicy implementation.**
6. **PageSpeed cache lease logic is schema-present but not fully implemented in the current function:** no lease is written during fetch, and provider failure cache/lease states are less complete than the blueprint.
7. **The RSS retry, 429 cooldown, lease and 304 state implementations are partial.** No live provider circuit state was implemented end-to-end.
8. **`source_observations` is created but no source observation write path populates it.**
9. **Cursor paging is implemented but full replay/upper-snapshot semantics need a dedicated integration test.** In particular, `until_id` behavior and mixed `after_id/until_id` validation should be reviewed.
10. **The offline import preparer is minimal.** It does not implement DuckDB, pinned Overture geospatial filtering, GeoJSON polygon checks, Overture/FSQ category joins or a full manifest publisher/registry.
11. **Common v2 import `{manifest,leads}` server handling is not fully strict.** Unknown keys, byte caps, 500-row/1 MiB limits and per-row v2 codes are incomplete compared with the blueprint.
12. **Conservative cross-source matching is not implemented.** The existing domain/phone overlap can still be the identity mechanism for local-business rows.
13. **Google existing rows are excluded from the PageSpeed and PageSpeed cron result, but legacy Google fields are not inventoried or removed from D1.**
14. **Dashboard source-health UI fields were not added in this implementation.** Existing dashboard/provider controls remain; source health and cache counters need separate UI work.
15. **Apps Script menus and sheet headers are implemented locally, but no live Sheet schema setup/deployment was performed.**
16. **No live WordPress, PageSpeed, Overture, FSQ OS or MCA run was executed.**

## Open questions and suggested next steps

1. Should route-level Google Places gates be added now to match the blueprint, even though existing paid/local manual adapters are currently callable directly?
2. Which WordPress Jobs RSS source permissions and retention policy will the owner approve for a live trial?
3. Should `PAGESPEED_ENABLED` become the route gate and cron gate before any key is configured?
4. Which URL hosts count as directories/social pages, and should this list be maintained in a separate module?
5. Should cursor snapshots use `until_id` only, `after_id` only, or a separate checkpoint containing both?
6. Which Overture release and pinned license should be used for the first offline import?
7. Which FSQ OS release and NOTICE should be used for its import?
8. Which official MCA monthly file and field bindings should be tested in Pune/India fixtures?
9. Is existing `PAGESPEED_API_KEY` absent from `.env.external.example` and `.dev.vars.example` intentionally, or should both examples include it?
10. Should `data/external-preview.json` remain as the only runner state for future fixture runs?
11. Should the untracked PDF be permanently removed or remain outside Git for the life of the feature branch?
12. Before a live deployment, which D1 migration checkpoint and backup are required?

## Hygiene audit

Final current state at the end of implementation:

`leadflow-leads`:

- working tree has modified source/package/migration/test files
- `Sources-temp-leadflow-leads-feature-new-sources-aa.pdf` remains untracked
- `.dev.vars` remains ignored
- no `.env` or runtime state was staged

`leadflow-ai`:

- working tree has modified automation/core/test files
- `.env.external` remains ignored
- `data/external-preview.json` remains ignored
- no secret value was staged

Hygiene commands to run in both repos before commit:

```powershell
git status -sb
git diff --check
git diff --cached --name-only
git check-ignore -v .dev.vars .env.external data/external-preview.json
```

## 2026-11-21 — Gap closure and local happy-path verification

The earlier gap list remains the historical baseline. This section records the new state of producer `feature-new-sources-aa` and consumer `main`.

### Root cause and operating decisions

- The local Worker and consumer could use different loopback ports. Wrangler now declares `127.0.0.1:8787`. The runner and subprocess share `EXTERNAL_LEADS_API_ORIGIN`, validated as an explicit IPv4 loopback HTTP origin and port. The separately running operator services at 8787 and 5173 were kept running. Verification used an isolated fixture Worker at 8790 and Vite at 5174.
- The upstream table contained legacy employment and business records. Resetting the old offset re-read the same opening employment records. The new request is scoped to `category=freelance_request` plus an approved source set, with a second category guard before ingestion. Existing corporate and manual-prospect rows stay available in their own queries.
- The fixture run used real local Miniflare D1 bindings and synthetic provider payloads. The producer fixture harness uses a temporary Wrangler config and an isolated D1 database. The consumer used rules in shadow mode, with Telegram, Gmail owner test, Gemini and other model calls disabled. The Apps Script runtime tests use mocked Sheets and provider services.

### Gap-by-gap record

| Item | Implementation and evidence |
| --- | --- |
| 1. D1 revision writes | `src/index.ts` validates the revision and runs one conditional `UPDATE ... RETURNING` with the old revision, allowed category and verified source guard. Concurrent same-revision writes returned `200` and `409` for both manual categories. The winner advanced revision 0 to 1. Google and freelance records returned 400 through the revision-aware path. The older non-revision API remains available for legacy clients. The Sheets save menus always use the revision-aware path. |
| 2. PageSpeed gates | Both direct dispatch and scheduled dispatch require `PAGESPEED_ENABLED=true`. The fixture tested 403 with the flag off and explicitly enabled the positive path. |
| 3. Google direct gates | Text Search and Nearby require `GOOGLE_PLACES_PROSPECTING_ENABLED=true` and a key before dispatch. Both returned 403 in the fixture. The positive unit fixtures explicitly opt in and stub the HTTP requests. |
| 4. Daily freelance sources | `DAILY_FREELANCE_SOURCES` accepts only Hacker News, WordPress Jobs RSS and Freelancer RSS from a bounded string. The cron isolates source work, uses leases/due state, and does not run the general job feeds. `/collect/all` remains the legacy explicit collection route. |
| 5. Freelancer RSS | Disabled by default. When enabled, a maximum of four exact owner-configured entries each require a unique feed ID, HTTPS URL on an approved Freelancer host and a rights reference. The collector uses only the configured feeds. A disabled fixture resulted in a blocked collection. |
| 6. PageSpeed lease and quotas | D1 URL-keyed two-minute leases and atomic UTC attempt reservation. Fresh results are cached for 30 days. Auth and quota open a shared circuit. Retryable errors cool down 6h, 24h, then 72h. Site failures retry after 72h and malformed results are recorded. The cache fixture checked one URL once and reused the result for a second branch with that exact URL. Provider-response fixtures verified quota, auth, retryable, unreachable and invalid-result classifications. `PAGESPEED_API_KEY` is documented in producer config and the example. |
| 7. RSS polling state | Six-hour minimum, 10-second fetch timeout, at most one connection/5xx retry with jitter, 401/403 floor, 429 cooldown and bounded XML. Conditional validators survive 304, malformed responses and errors. A capped response clears validators while any changed candidates remain unprocessed. Fixture covered successful poll, due deferral, 304, rejected HTML and 429 with an eight-hour `Retry-After`. |
| 8. Observations | Open-data observations preserve source/ref/release, license, timestamps and canonical metadata bounded to 8 KiB. Four observed fixture source rows were retained. No Google observation was written. Legacy imports carry `UNVERIFIED_PROVENANCE` and cannot overwrite a previously verified observation. |
| 9. Cursor replay | `category=freelance_request&include=evidence&order=asc&after_id=0` opens a snapshot and subsequent calls can use `until_id`. Tests covered an interleaved insert, exact-page termination, identical replay, next-snapshot discovery and HTTP 400 for invalid or mixed pagination. CLI checkpoints are keyed by origin and sorted source scope. Apps Script stores the same checkpoint concept after flushing the CRM. |
| 10. Offline preparer | `scripts/prepare-import.ts` pins input SHA-256, applies validated WGS84 bbox and optional Polygon/MultiPolygon filters, normalizes source fields, sorts by ID and writes a rejection summary and per-batch digests. The CLI accepts local CSV/JSON/GeoJSON and sliced local Parquet. Synthetic Overture JSON verified bbox and polygon-hole exclusion. A quoted MCA CSV verified explicit field bindings/month filtering. Input and output hashes matched. A temporary DuckDB 1.4.4 CLI verified both FSQ and Overture Parquet paths with one of two synthetic points selected for each, using the spatial extension for Overture. The optional FSQ category lookup accepts a separately pinned CSV. |
| 11. Import contract | Stream cap of 1 MiB, 500 rows maximum, manifest source/release/URL/hash/date validation, strict source row keys and source mismatch rejection. Fixture returned 413 and 400 for the respective caps and 400 for an all-invalid override attempt. Legacy imports remain accepted and marked as unverified. Source permission, supplied release and attribution must be verified by the operator before a real dataset is imported. |
| 12. Place identity | Exact source ID and observed aliases use distinct identities. Shared compatible FSQ references or corroborated exact name/location/address/E.164 plus distance can match. Domain and phone alone are review hints. Distinct branches sharing a website/phone remained independent in D1, and a Google row with the same phone did not suppress the OSM row. OSM stays separate for its license provenance. Matching updates the observation rather than copying another source's attributes into the canonical row. |
| 13. Legacy Google isolation | Authenticated, read-only `/diagnostics` inventories legacy Google rows. Places/Nearby rows are excluded from place matching, PageSpeed, CSV exports and the verified Sheets queues. Fixture stats counted one isolated legacy Google row and the prospect CSV excluded it. |
| 14. Dashboard visibility | Loopback Vite middleware returns the selected profile's qualification state and producer health. The dashboard distinguishes received buyers, no buyers stored, no new buyers and upstream failure. It shows per-source run counts, PageSpeed cache/deferred counts and effective upstream port. The controls require loopback host, same-origin POST and an explicit request header. Browser test verified 403 on a request missing the control headers. |
| 15. Port diagnostics | The loopback helper shares the configured origin across the runner and transport. Requests to an unused port returned `Upstream http://127.0.0.1:8799 returned ECONNREFUSED. Check Wrangler's listening port and local API token.` and persisted `UPSTREAM_ERROR`. Existing Worker `GET /health` at 8787 returned `ok:true`. |
| 16. Local happy path | Both CLI modes consumed three synthetic freelance buyers (two HN, one WordPress), all scored by rules and awaiting review. Synthetic employment and manual categories never entered that queue. Browser rendering showed the three rows, the PageSpeed cache count and a no-new-buyers state on replay. Both manual categories exported and passed mocked Sheets sync/save. Synthetic MCA listed email was absent from the CSV and New Companies Sheet row. Both repositories' checks and limitations are recorded below. |

### Reproduction

Producer, from `D:\freelance_personal\leadflow-leads`:

```powershell
npm run db:local
npm test
npm run typecheck
npx tsx scripts/verify-local-fixtures.ts --check
npx tsx scripts/verify-local-fixtures.ts
git status -sb
git diff --check
git diff --cached --name-only
```

The final fixture command serves GET requests at `http://127.0.0.1:8790`. It emits 9 total D1 rows: 3 freelance buyers, 1 corporate listing, 4 local businesses including the isolated Google fixture, and 1 new company. It verifies cursor replay, concurrent PATCH, cache reuse, RSS state and both CSVs before opening the port. Use `LEADFLOW_FIXTURE_PORT` to pick a different free port. For an offline data file with a pinned manifest, run `npm run import:prepare -- --source overture --input <local-file> --manifest <manifest.json> --bbox 73,18,74,19 --polygon <region.geojson> --out <new-output-directory>`. For a local MCA file use `--source mca` and `--month YYYY-MM`, with explicit manifest column bindings for noncanonical headers.

Consumer, from `D:\freelance_personal\leadflow-ai`, in a new PowerShell session:

```powershell
$env:EXTERNAL_LOCAL_PROFILE='gap-check'
$env:EXTERNAL_LEADS_API_ORIGIN='http://127.0.0.1:8790'
$env:EXTERNAL_LEADS_API_TOKEN='fixture-only'
$env:EXTERNAL_LEADS_ENABLED='true'
$env:EXTERNAL_LEADS_SOURCES='hackernews,wordpress_jobs_rss'
$env:EXTERNAL_LEADS_BATCH_SIZE='5'
$env:FREELANCE_QUALIFICATION_MODE='shadow'
$env:TELEGRAM_ENABLED='false'
$env:SAFE_OWNER_EMAIL_TEST='false'
$env:AI_ENABLED='false'
$env:GEMINI_ENABLED='false'
npm run external:run -- --dry-run
npm run external:run
npm run dev -- --port 5174
```

Open [the fixture dashboard](http://127.0.0.1:5174/pipeline). `Run Full Pipeline Now` advances only its local profile. A fresh profile imports three, while replay displays **No new buyer candidates since the last run**. All three fixture rows rendered with `ELIGIBLE` qualification. The verification browser reported `qualifiedRows=3`, `notificationRows=0`, `crossOriginControl=403`. Both runner modes reported `invalid=0`, `after=5`, `alerts=0`, and `email_test.status=DISABLED`. A fresh `gap-empty` profile scoped to the unused `freelancer_rss` fixture category returned `NO_BUYER_CANDIDATES` with zero imports. The profile ledgers and outputs are ignored by Git. To repeat from fresh state, choose a new `EXTERNAL_LOCAL_PROFILE` for the runner and Vite, without deleting an existing ledger.

Verification commands on the consumer: `npm test` (177 passed), `npm run typecheck`, `npm run build:automation`, `npm run build`, `git status -sb`, `git diff --check`, `git diff --cached --name-only`. Producer tests: 34 passed. Local migrations reported no pending migrations on the existing database and the fixture applied 0001 and 0002 from scratch. Apps Script build output is local. Vite emitted the existing large 3D bundle warning.

### Decisions on the twelve open questions

1. Require the Places flag and key at both entry points.
2. Keep WordPress Jobs off for real collection until the owner approves source use and retention. The fixture grants neither permission nor retention rights.
3. Require the PageSpeed flag on the HTTP route and schedule before any call.
4. Keep the PageSpeed directory/social exclusion list with URL normalization in the producer; review it before adding source cohorts.
5. Use `after_id` plus an optional frozen `until_id` and persist the pair while the snapshot has another page.
6. Use a synthetic Overture manifest for verification. A real pinned release and its Places license await dataset selection.
7. Use a synthetic FSQ OS manifest for verification. Pin the actual data file, license and release NOTICE before importing a real release.
8. Use an explicitly bound synthetic MCA CSV. Choose and confirm the publisher's actual monthly file, column bindings and field permissions before a real import.
9. Keep the PageSpeed key in the producer configuration only. Places authentication is independent.
10. Use named ignored profiles for repeatable runs. The preview and shadow ledgers remain separate.
11. Leave the reference PDF untracked and outside staging.
12. Before any later rollout, record the applied migration ID, take a recoverable D1 export, capture producer/consumer versions and checkpoint scopes, and test restoration in an isolated database.

Existing Sheets tabs can append the two revision columns by rerunning setup on the updated bundle. After a sync, rows with unsaved edits retain their base revision. On a conflict, sync to see `upstream_queue_revision`, compare against the upstream status and notes, and reconcile the draft before intentionally rebasing. No live CRM deployment or credentials were needed for the fixture.

### Follow-up — five-source local live shadow trial

The next local trial added Himalayas, Jobicy RSS, and Remotive. HN now resolves the exact current month. WordPress Jobs RSS ignores the proposed type switch, so the producer uses explicit project evidence from the published text. Migration 0003 adds source health metrics. The isolated Worker on port 8791 and dashboard on port 5174 handled 57 candidates and found one LOW-priority opportunity. See [the command outputs and source breakdown](FREELANCE_SOURCE_LOCAL_VERIFICATION.md).
