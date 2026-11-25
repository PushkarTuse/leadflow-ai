# Marketplace control centre · 25 November 2026

## Operator workflow

- Open the [local dashboard](http://127.0.0.1:5174/pipeline). Use Overview for persistent freelance and business counts. Persistent freelance opens on qualified results. Decision, source, search and pagination expose the other records. Expand individual descriptions or jump to a queue from Review and retry.
- Marketplace discovery provides official Upwork search links and a copyable owner-directed Codex request. Results live in the authorized owner session. The dashboard has no separately authorized Upwork application or account binding. Review the [current API and MCP terms](https://upwork.pactsafe.io/versions/6aee3ae4b081bf43cecf8f43.pdf), especially sections 4, 5 and 8, before adding another display or reuse path.
- Outreach drafts opens already generated recipient-free EML/HTML for eligible businesses. Copy plain text and subject, preview HTML, download EML or HTML, or open the existing dated PDF/ZIP. Historic alternative subjects are matched by the exact EML fingerprint. New drafts save alternative subjects next to their local files. The live list can be newer than the saved package.
- Advanced freelance controls include authorized brief import. Use the displayed CSV/JSON fields, confirm source permission, preview duplicate and deadline validation, then import and qualify. Keep employment-oriented feeds optional. In a mixed run, buyer-project sources go first and each explicitly selected diagnostic feed can add at most ten records per collection request.

## Live persistent discovery

| Source | Actual result |
| --- | --- |
| WordPress Jobs | HTTP 200, publisher unchanged. The existing six-page WordPress opportunity remained qualified. |
| Hacker News | 19 posts, eighteen seller offers and one ambiguous monthly-thread post. Zero buyer imports. |
| UK Find a Tender | HTTP 200 through the local Worker. 74 notices screened, zero eligible. |
| UK Contracts Finder | HTTP 200 through the local Worker. 90 notices screened, zero eligible. |
| Jobicy RSS | 117 raw, 114 passed collector checks, two new imports. Cloudflare returned valid verdicts for both. Both were rejected for unclear engagement. |
| Remotive | HTTP 200, publisher unchanged. |
| Himalayas | Existing Worker lease deferred collection until 26 November at 00:47 IST. |

The ledger has 232 active rows, including one qualified, 151 rejected and 80 in review. The queue comprises 62 engagement-unclear and 18 ambiguous-direction rows. A source-guard replay and scoped-project reconsideration each moved zero rows. Check the live readiness section before polling. The other leased sources were due again around 23:28 IST on 25 November.

## Marketplace source readiness

| Source | Verified path and remaining requirement |
| --- | --- |
| Upwork | Native MCP account and buyer-posted project search verified. 12 topic searches returned 53 results after deduplication within each batch. Two listing detail reads confirmed active status. The responses omitted account-specific eligibility and Connects. Read those on the current listing. No marketplace records were written to LeadFlow storage. |
| PeoplePerHour | Buyer projects and [saved searches](https://support.peopleperhour.com/hc/en-us/articles/205217987-Saved-Searches). Use the authorized owner account. No approved feed ingest or automation was verified. |
| Guru | Buyer jobs and [Job Match notifications](https://www.guru.com/help/freelancer/email-settings-freelancer/). Use native alerts. Confirm retention and automated-processing rights before creating an ingest. |
| Truelancer | Buyer marketplace. Earlier terms fetch was rate-limited. No verified reusable endpoint or adapter. Obtain publisher authorization for automation. |
| Workana | Buyer marketplace. Review [platform terms](https://help.workana.com/hc/en-us/articles/360041499974-WORKANA-TERMS-AND-CONDITIONS). No approved automated feed or ingestion verified. |
| Algora | OSS bounty inventory can represent scoped work. Proposed endpoint previously returned 404 and the [legacy public handler](https://github.com/algora-io/algora/blob/main/lib/algora_web/controllers/api/bounty_controller.ex) did not yield listings. Await a supported feed or use an individually authorized brief. |
| Jobbers.io | Review native project listings under [platform terms](https://www.jobbers.io/terms-and-conditions-of-use/). No reusable feed or integration verified. |
| Feedsen | [Job feed product](https://feedsen.com/jobs). Zero-cost, no-card entitlement and a scoped-project feed are unverified. |
| EU TED | [Official unauthenticated Search API](https://docs.ted.europa.eu/api/latest/search.html) permits reuse. Prior HTTP 200 returned 232 broad code matches. None of 12 sampled notices established this agency's eligibility. Verify bidder location, registrations, requirements, deadline and scope before importing. |
| Freelancer | Official adapter remains deferred by owner instruction. |

## AI and business evidence

Gemini returned one matching verdict and two HTTP 503 errors in the real-record cohort. Groq and Cloudflare returned four matching verdicts each, including the existing WordPress project as positive control. The numbered references returned by the providers resolved to source spans. OpenRouter returned HTTP 429. Ollama and LiteLLM worked locally, but Qwen 3B accepted the W-2 negative control. Keep it outside final classification. The small, predominantly negative sample does not establish general accuracy.

Missing corroborated primary sources, identity mismatch and undocumented local control are the largest business holds. The verifier already accepts corroborated founder markup and named operator evidence. A directory listing is useful for discovery. It does not establish autonomy or prove a website is absent. Use first-party evidence and authorized evidence hints.

Tavily prospecting remains disabled. Obtain written permission for the actual workflow and record it as `TAVILY_OUTREACH_PERMISSION_REFERENCE` before using the configured key. Groq documents browser search for GPT-OSS 20B and 120B. Account-specific zero-cost search entitlement was unverified, so browser search was not called. [Tavily acceptable use](https://www.tavily.com/acceptable-use-policy) · [Groq browser search](https://console.groq.com/docs/tool-use/built-in-tools/browser-search) · [Groq account limits](https://console.groq.com/settings/limits)

The focused Foursquare trial imported 35 previously unseen appointments-category records each in Pune and Kolkata. Ranking prioritizes website and contact hints for verification. Qualification still requires verified identity, local control and a digital opportunity.

```powershell
& .venv/local-business/Scripts/python.exe scripts/import-foursquare-iceberg.py Pune Kolkata --focus appointments --offset 25 --limit 35
npm run business:scan -- --sync-foursquare=all
npm run business:scan -- --enrich-metros --cities=Pune,Kolkata --source=fsq_os --unevaluated-only --limit=70
```

Of 70 newly imported records, five were excluded by corporate screening. The worker evaluated all 65 remaining businesses. It qualified one, held 60 for evidence, and scheduled four source retries. The new Kolkata salon had a first-party About page documenting local ownership, a verified business contact route, and a phone-based enquiry flow. Its saved email draft proposes a mobile booking path, includes three alternative subjects, and has an empty recipient, no price, and both logo assets.

| Metro | Inventory | Qualified | Verified contact | Saved drafts |
| --- | ---: | ---: | ---: | ---: |
| Mumbai | 468 | 7 | 6 | 4 |
| Pune | 430 | 3 | 3 | 2 |
| Bengaluru | 399 | 3 | 3 | 3 |
| Hyderabad | 391 | 1 | 1 | 1 |
| Kolkata | 432 | 5 | 5 | 2 |
| Delhi | 392 | 4 | 4 | 3 |
| Chennai | 396 | 1 | 1 | 1 |
| Total | 2,908 | 24 | 23 | 16 |

There are 207 exclusions, 2,424 evidence reviews, zero awaiting initial enrichment, and 253 scheduled retries. None were due at the end of verification. The earliest retry was 18:29 IST on 25 November. The three largest review reasons are missing corroborated independent evidence (1,100), identity not corroborated (485), and matched official domain with undocumented owner or operator (236). Source inventory with qualified records is Overture 1,722/13, offline OSM 769/8, and Foursquare 417/3.

Use `npm run business:scan -- --enrich-metros --retry-eligible --backlog` after retries become due. The existing Worker leases and enrichment deadlines determine when each record can be retried. The current evidence yield does not support the 50-qualified-per-metro target without stronger authorized evidence discovery.

## Verification and Git

- Chromium exercised desktop and mobile widths, qualified defaults, review links, pagination, source and keyword filters, description expansion, Upwork query link and clipboard behavior, draft focus, subject/body clipboard, sandboxed HTML, EML/HTML downloads, and the dated review ZIP/PDF. Local screenshots are under `outputs/pipeline-dashboard-verification`.
- LeadFlow AI: 264 tests, typecheck and production build passed. LeadFlow Leads: 49 tests and typecheck passed. Both servers were left up on the existing ports. Graphify was refreshed.
- Marketplace implementation checkpoint is `622f768a9f6c62990e69224897233e7491709c77`. LeadFlow Leads stayed at the verified remote `0620dd1c8485ad94366c5a0c9ed12ab52141a227` on `feature-new-sources-aa`.
