# External discovery connector — iteration one

Implemented 16 November 2026 against `aditya91203/leadflow-leads` commit `52f8c49899dfcddc58d09e4bff92f9447163238d`. This is a disabled-by-default **pull** connector, not the proposed signed public ingestion endpoint. Recovery log: `HANDOFF_EXTERNAL_LEAD_INTEGRATION.md`. Original contract: `EXTERNAL_LEAD_INGESTION_CONTRACT.md`.

**Local validation completed, 16 November:** API running on 127.0.0.1:8787; five real HN leads collected and verified via API plus local D1 SQL. `node scripts/validate-external-local.mjs` maps all five with original HN evidence and validates repeat deduplication in an in-memory Engine (5 imported, 0 invalid, 5 duplicates on replay). Three qualified for draft review, two remained NEW. Local token is self-chosen, GOOGLE_API_KEY empty. The local API only accepts loopback traffic. Production is disabled and has not been deployed/activated.

The validation script expects the first API page to contain five HN rows (as collected in the otherwise empty database). It fetches real responses asynchronously then supplies those snapshots to the Apps Script-compatible synchronous adapter. The virtual HTTPS origin is only a transport key, not a hosted URL. Repeat after restarting the API with `npm run dev -- --ip 127.0.0.1 --port 8787` in the sibling leadflow-leads repo. No provider email or alert is sent by this script.

**Follow-up validation:** the owner's local API_TOKEN is now exactly `dev-token`, stored only in the sibling ignored .dev.vars. Restart Wrangler after changing secrets. Health and authenticated collection/read routes pass; local SQLite contains five HN plus five Arbeitnow rows. The overview at `/` is normal public API documentation. In Postman, set Bearer Token to the local token; browsing `/leads` directly without the header returns 401.

The validator now accepts short tokens for the real loopback fetch while keeping the production adapter's 32-character policy intact through a dummy snapshot-transport token. The real-data dry run confirms 5 imported / 0 invalid, replay 5 duplicates; three reach PENDING_APPROVAL. It constructs the real Telegram review payload and simulates owner callbacks: approve → DRAFT_READY, review → DEFERRED, reject → REJECTED; unauthorized and replay callbacks fail. These review actions only affect the in-memory store. Gemini/Telegram/Gmail are not called; the live provider chain remains untested for this external source and production stays disabled.

## Future HTTPS hosting checklist — documentation only

Cloudflare Workers + D1 is the native fit for this repo. Later, with explicit deployment authorization:

1. Authenticate Wrangler to the intended account and review the current free-plan quotas. Create a remote D1 database with `npx wrangler d1 create leadflow`; replace the placeholder database_id in a reviewed deployment config, retaining binding `DB`. Local SQLite rows do not automatically upload.
2. Apply migrations to that remote database with `npx wrangler d1 migrations apply leadflow --remote`. Use a fresh strong random API_TOKEN via `npx wrangler secret put API_TOKEN`; the local development token must not be reused publicly. Keep GOOGLE_API_KEY absent, DAILY_SEARCHES empty and source collection HN-only for the initial smoke check. Review the upstream daily cron: it currently collects all keyless feeds, so remove/defer that trigger for a staged first deployment. Update USER_AGENT to a real owner-approved contact.
3. Deploy the reviewed Worker with Wrangler and confirm the HTTPS workers.dev origin, /health, unauthenticated 401, and authenticated /sources. Collect five HN rows remotely and verify original links before connecting Apps Script. No paid domain is necessary. Do not expose a laptop's dev server publicly as the production service.
4. Upload the compatible Apps Script bundle separately and save origin/token privately. Leave EXTERNAL_LEADS_ENABLED=false until a later approved activation task. A hosted API alone does not activate the connector. Verify HTTP/Gemini budgets and source interval, then use a single bounded tick only when authorized. Maintain original email permissions.

Reference: [Cloudflare D1 setup](https://developers.cloudflare.com/d1/get-started/) and [D1 Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/). No commands in this checklist were executed during local validation.

## Data path and mapping

Apps Script source cycle → authenticated `GET /leads?sort=found_at&order=asc&limit=5&offset=N` → validated adapter → original HN Firebase item → existing Engine → Sheets → Gemini/rules scoring → qualified owner Telegram draft approval. No producer credentials are sent to HN. Collection is managed separately by the external API owner. Nonqualified rows remain in Sheets and do not trigger an alert. Gemini retains its existing opt-in/configuration and daily budget.

| External field | Canonical input / behavior |
|---|---|
| `source=hackernews` | `source=hn`; original HN item ID, canonical URL |
| `osm`, `remoteok`, `arbeitnow`, `jobicy` | `source=csv`; must be explicitly enabled after reviewing source use; default off |
| `source_id` | HN ID unchanged; others prefixed with provider (hashed suffix if too long) |
| `id` | External database row ID ignored; not stable across database rebuilds |
| `url` | Original HTTPS listing URL required for non-HN; HN URL rebuilt from validated ID |
| `found_at` | `discovered_at`; never used as `posted_at` |
| HN original `time`, `text`, `title` | `posted_at`, `raw_description`, `title`; fetched from official API |
| Non-HN `title`, `name`, `city`, `country` | Labeled observed listing summary; original date/body unknown; provenance warns that evidence is incomplete |
| `name` | Public business name for non-HN; blank for HN (upstream may contain an author handle) |
| `city`, `country` | `country_or_region` |
| `score`, `status`, `signal`, `tags`, `notes` | Not used as scoring evidence or workflow authority |
| `email`, `phone`, `address`, permission/consent-like fields | No contact authority imported; canonical email blank, permission UNKNOWN, no consent timestamp |
| Missing budget | null / UNKNOWN; no inferred price |
| Google Places / unknown sources | Rejected |

No `inbound` source is generated. Discovered leads do not enter EmailOutbox or the Gmail send gate. Telegram approval creates a draft for permitted manual submission. Automatic discovered-lead emails, Gmail positive-reply monitoring and executive digests are separate work. A production Gmail send cannot be truthfully verified by this connector alone.

## Local API setup — do later

Code is already cloned to `D:\freelance_personal\leadflow-leads`. No install/DB/source run has been performed. Check its README and `initialsetup/SETUP.md`; the actual Postman collection is `initialsetup/LeadFlow-API.postman_collection.json`.

```powershell
cd D:\freelance_personal\leadflow-leads
npm ci
Copy-Item .dev.vars.example .dev.vars
# Local-only: set API_TOKEN=dev-token as requested by the owner.
# GOOGLE_API_KEY stays empty. No subscription is needed for API_TOKEN or HN.
npm run db:local
npm run dev
```

Use Postman environment variables `baseUrl=http://localhost:8787` and private `token`. Start with `GET /health`, authenticated `GET /sources`, `POST /collect/hackernews` with `{"limit":5}`, then `GET /leads?source=hackernews&sort=found_at&order=asc&limit=5&offset=0`, and `GET /runs`. No real mail is sent. Do not use `/collect/all` for first verification. SQLite is under `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`; a viewer extension is optional. Avoid changing this database during an initial pagination test.

Local HTTP is useful for external API testing, but **Google Apps Script cannot call localhost**. Before real scheduled integration, deploy that API to a reachable HTTPS service with a private strong API_TOKEN and configure its D1 binding/migrations using its deployment guide. This session does not provision hosting or billing. Do not use `dev-token` publicly. Never put the token in a browser/VITE variable or commit it. Configure only HN initially and keep Google disabled.

## LeadFlow activation — after reachable API exists

Build/upload the compatible Apps Script bundle using the existing `docs/SETUP.md` process. Set these in **Apps Script Script Properties**, not frontend config:

```text
EXTERNAL_LEADS_ENABLED=false
EXTERNAL_LEADS_API_ORIGIN=https://your-api.your-subdomain.workers.dev
EXTERNAL_LEADS_API_TOKEN=<same private random 32+ character API_TOKEN>
EXTERNAL_LEADS_SOURCES=hackernews
EXTERNAL_LEADS_BATCH_SIZE=5
EXTERNAL_LEADS_OFFSET=0
```

Origin must be HTTPS with no path, trailing slash, credentials, query or port. The connector follows no redirects. After checking account quotas and source use, set EXTERNAL_LEADS_ENABLED=true and use the existing tick trigger. DRY_RUN=true still blocks all network effects; activation needs the already reviewed live runtime settings. Do not alter email/test-mode flags. SOURCE_INTERVAL_MINUTES controls polling; the existing HTTP/Gemini budgets and runtime deadline apply. Invalid external configuration is logged as a redacted SourceRuns failure without disabling standard Telegram/inbound operations.

Each source cycle processes at most five upstream rows, then flushes CRM before saving EXTERNAL_LEADS_OFFSET. At end it wraps to zero. This is a repeated scan, not exactly-once delivery: upstream deletion/inserts/tied timestamps can shift offsets, so later scans recover missed rows under stable data. A large database can delay newly appended records; filtering/keyset pagination should be an upstream follow-up. Do not sort by producer score or filter by mutable status. Upstream itself deduplicates at company/domain level and may discard distinct opportunities; review `src/db.ts` before scaling.

Malformed/unsupported/disabled rows count as invalid and advance the page. HN provider failure aborts the page and preserves the old offset; already-written leads deduplicate on retry. Repeated identical input does not create another record. Changed repeated IDs retain the first LeadFlow record under the existing engine; richer evidence needs explicit reprocessing. Reset offset to zero when replacing API origin/database, and after correcting previously invalid rows. SourceRuns counts and the private Sheet are the audit surface; no row text/token appears in general errors.

## Verification / next acceptance gate

16 focused adapter and actual bundled Apps Script tests pass. They cover input/host/token bounds, HN evidence mismatch, Places rejection, duplicate replay, Sheets persistence, owner Telegram notification, and an empty EmailOutbox with zero Gmail sends. TypeScript and automation bundle pass. Providers are simulated; no live collection, CRM update, Telegram delivery or email is claimed.

The local sequence and original HN mapping have now passed as recorded above. Remaining later work: approve HTTPS hosting, review free quotas, deploy the API and compatible Apps Script, configure private secrets, then authorize a bounded live integration test of SourceRuns/Sheets/Gemini/Telegram draft notification. Keep production disabled until explicitly authorized and preserve discovered-lead draft-only permissions. The current local dry run sends no emails or Telegram messages.
