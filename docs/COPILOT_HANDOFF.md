# LeadFlow surgical continuation

## Checklist

- [x] Reviewed and pushed prior source and documentation changes. LeadFlow AI main advanced from `13c78daa5599addf9ac2de8d4ba217ad302fa168` to `52275b08acf85665eadb034cf88c39a677955aed`. LeadFlow Leads feature-new-sources-aa advanced from `12b987a84e6792132dbcb7a5927d76c31ca8bb4b` to `839ab73852792a4ea23200a2ba6949b09244d834`. Both verified via `git ls-remote`. Local AGENTS.md and private artifacts remain unstaged.
- [x] Enrichment transport, automatic evidence extraction and resumable storage.
- [x] Buyer-side source defaults, authorized import and Find a Tender transport diagnostics.
- [x] Explicit classification failure, fixtures and validation.
- [x] Diagnose and fix the equal budget split after source failure.
- [x] Verified foundation checkpoints remotely. Consumer `4e46283ab64ace5106d70370de01e3f65078ffab`. Producer `0b6b3913086501a50fb8b73a4e99ace912410232`.
- [ ] Unmet supply and qualification targets remain open. See the fresh-run report for current evidence.

Interrupted local enrichment sampled 21 rows and recorded 0 qualified, 0 excluded, 6 review and 15 retry in about 53 seconds. The main groups were seven robots restrictions, seven transport errors, one 404, two identity mismatches, three ownership gaps and one opportunity gap. These observations are local and ignored by Git. Do not count them as fresh after a reset.

Use `PIPELINE_OVERHAUL.md` for the previous run, architecture and backup locations. The previous samples are ignored local output. Keep both apps on their existing loopback ports and keep outreach in shadow mode.

## Buyer-side source matrix

| Category | Action |
| --- | --- |
| Explicit buyer requests | HN monthly and wide scoped buyer queries, plus WordPress Jobs project feeds. These are the default poll selections. |
| Authorized marketplace exports or alerts | Use Bearer-authenticated `POST /import/authorized-projects` at the local Worker. Existing Upwork/Freelancer pages do not constitute automation permission. Require appropriate developer/API approval before enabling a native connector. |
| Procurement | UK Find a Tender stays opt-in and review-only. It rejects expired, staffing, framework, over-£75,000 GBP and explicit UK-only/clearance cases. The £75,000 value is a conservative assumed ceiling, not proof that lower-value work is eligible. |
| Agency-friendly contracts | Himalayas targeted searches are optional. Confirm bounded delivery from the actual brief. |
| Employment-oriented inventory | Jobicy and Remotive remain opt-in. The old live sample gave zero qualifications from 100 Jobicy records. |

Only use briefs you are entitled to retain and process. JSON envelope `{"permission_confirmed":true,"projects":[...]}` accepts 1–100 objects with `title`, `description`, `buyer`, original public HTTPS `url`, UTC `published_at`, UTC `active_until`, and `provenance` (`buyer_shared`, `authorized_marketplace_export`, or `authorized_alert`). CSV can be selected with PowerShell `Import-Csv` and converted to this JSON envelope. Keep purely local. The collector removes tracking parameters and applies active deadlines and idempotent canonical URL IDs. Fields prove no right to contact the buyer. The most direct authorized paths are the [Freelancer developer API](https://developer.freelancer.com/) and [Upwork Developer Space](https://www.upwork.com/developer).

## Operational contract

- `scripts/business-web.ts` validates URL, resolves DNS, rejects non-public answer sets and pins the approved socket IP while preserving the original host for TLS. Redirects and robots policies are revalidated. No login, JavaScript execution, arbitrary tools or crawler output sent to AI. Page, time and domain rates are bounded.
- `scripts/business-evidence.ts` reads only candidate domains derived from public source website and business-domain email hints. It matches localized identity before qualifying, records citeable literal fragments, recognizes a parent or franchise signal, and separately checks public contact. Phone-only routes do not generate email-ready status. Model suggestions never establish ownership. Missing website fields never imply absence.
- `scripts/local-business.ts` writes ignored `data/local-business/enrichment-v1.json` atomically after every batch and uses an exclusive process lock. Rows are keyed by publisher ID and an input fingerprint. Retry after one day for transient fetch failures, seven days for review and 30 days for a qualification. Exact matched business name, country and official host suppress duplicate recommendations. Aliases, independent operators within a verified shared domain, and ownership across inconsistent publisher IDs still need review. Resume `npm run business:scan -- --enrich-metros --limit=56`. A stale lock can only be removed after verifying the old process is stopped.
- `packages/core/discovery-state.ts` stores or derives `QUALIFIED`, `REJECTED`, `REVIEW`, `RETRY_CLASSIFICATION` and `AWAITING_ENRICHMENT`. Only qualified records route onward. Ordinary local runs can retry stored AI failures within provider cooldowns. Cache keys bind evidence, prompt/policy version and configured model list. The existing binary decision is retained for backwards compatibility.
- `src/adapters/ukTender.ts` now follows only bounded same-origin canonical redirects and distinguishes HTTP, redirect, content-type and timeout failures. Prior Worker 502 mapped unavailable upstream conditions to a general response. Native HTTP 200 alone does not establish why the earlier Worker request failed. Verify with one allowed poll after the lease.
- `scripts/local-business.ts` previously allocated 125 of 250 to Overture even when Overpass failed. It now allocates remaining capacity to Overture, reads two pages if necessary and pauses an unstable Overpass source for the rest of the run. No alternate public endpoint rotation.
