# Commercial readiness · 26 November 2026

## First application

The [RSL WordPress listing](https://jobs.wordpress.net/job/wordpress-website-developer-18/) still displayed its Apply via Email route. The disclosed client is a private Canadian management consulting startup. Its identity is reserved for shortlisted applicants. It wants roughly six pages from existing storyboards, branding and approved copy, in Gutenberg using Kadence Theme and Kadence Blocks. It prefers an immediate start and lists a fixed C$2,000–2,500 budget. Remote is explicit. International or agency eligibility is unspecified.

The local [Sales activity panel](http://127.0.0.1:5174/pipeline#commercial) keeps the exact From, To, subject, message, HTML, attachment list and content fingerprint under **Exact application draft**. The source requests completed WordPress examples, Kadence experience and availability. The local records did not substantiate them. The current draft offers a non-confidential Kadence proof of concept, asks about timing, and includes the public booking URL and an email reply option. State is awaiting owner approval and there is no attachment. Check the listing again immediately before any approved send.

The verified Resend route is the owner-test route. It uses the provider's shared test sender, and must stay separate from the venture Gmail application sender. The in-app Gmail workspace was signed into the venture mailbox. The connected Gmail tool was signed into a different mailbox, so it was not used for venture mail.

## Owner-only live confirmation

- At 00:29 IST on 26 November, authenticated Resend SMTP accepted the plain-text and HTML verification message with `From: LeadFlow AI <onboarding@resend.dev>` and the venture Gmail as Reply-To. The exact subject was subsequently found in the venture Gmail **Inbox** in the browser.
- Bot and private destination identity were verified. Telegram accepted the owner-only test and returned message ID **32**.
- The ignored owner receipt is under `data/commercial`. The local one-shot command is `npx tsx scripts/commercial-owner-check.mts --confirm-owner-test`. An exclusive receipt file prevents re-sending the same test after an uncertain outcome.
- The SMTP stage verified transport, HTML, plain-text, sender label, Reply-To, and portfolio link. Logo animation and its static fallback are part of the existing business EML/HTML previews. The test contained no Calendly link or approval callback. The historical Apps Script approval workflow remains separate from this trial.

## Channel results

| Channel | Outcome |
| --- | --- |
| Direct | 232 persistent freelance candidates, one qualified RSL listing, 151 rejected and 80 evidence reviews. WordPress returned unchanged. Hacker News screened 19 and imported zero. Scoped reclassification found no eligible saved record and made no AI calls. |
| Procurement | Find a Tender screened 71 and Contracts Finder 90. Both responded through the Worker and returned zero eligible notices. |
| Marketplace | Verified an individual Upwork Freelancer account with proposal submission allowed by the profile identity check, and a zero Connects balance. Two topic searches returned eight results before a platform rate limit. Two active automation listings were read in detail and their fixed budgets were US$250 and US$200. No proposal preview or submission was started. Open listing-specific Connects and current screening questions in Upwork. No marketplace records were stored. |
| Local business | All seven metros refreshed with official Overture acquisition and existing verified offline OSM/Foursquare inventory. Overture introduced zero new records. Existing lead and draft state was preserved. |

The Windows enrichment checkpoint initially stopped on a transient rename error. Bounded rename retries preserve the existing atomic checkpoint. The worker resumed from its saved progress and processed all 107 remaining eligible rows, moving 64 to evidence review and scheduling 43 retries. The final snapshot has 2,908 records, 24 qualified, 23 with verified contact routes, 16 saved drafts, 2,545 reviews and 132 source retries. An older failed automated checkpoint attached to a manually evidenced qualified row stayed outside the retry worker.

## Local sales lifecycle and approvals

`scripts/commercial-ledger.ts` is a local, ignored JSON ledger with serialized updates. Application channels are direct email, direct form, marketplace native, procurement and business email. Prepare resets any prior approval. Approve requires the complete SHA-256 fingerprint and a live deadline if the listing provides one. Receipt registration requires approval and idempotently records only the same provider receipt. The ledger does not perform external delivery.

```powershell
npx tsx scripts/commercial-ledger.ts approve rsl-wordpress <exact-reviewed-SHA256>
npx tsx scripts/commercial-ledger.ts receipt rsl-wordpress <verified-receipt.json>
npx tsx scripts/commercial-ledger.ts reply rsl-wordpress <message-from-matched-thread.json>
npx tsx scripts/commercial-ledger.ts milestone rsl-wordpress <verified-milestone.json>
```

Only after explicit owner authorization, recheck recipient and listing, send the approved message once from the venture mailbox and record its actual RFC Message-ID, provider thread ID and timestamp. Reconcile Gmail Sent if the network or UI outcome is uncertain. A reply import needs the matching thread, an exact reference to the original Message-ID and the published recipient as sender, with an allowance for a verified delivery failure. Auto-replies and duplicates do not count. Opt-outs and bounces suppress future follow-up on the row. A reply can suggest qualification questions, budget clarification, scope or milestones for owner review. No substantive commitment or message is automatic.

Follow-up due is an advisory state seven days after provider acceptance while the listing remains active and no reply, opt-out or terminal outcome has been recorded. It does not send. The installed production Gmail poll reads labelled lead alerts. Continuous venture Gmail reply monitoring and reply-triggered Telegram delivery were not activated or live verified. The local exact-thread ingestion and classification were exercised with synthetic fixtures.

## Calendly

The owner's [public 30-minute event](https://calendly.com/leadsflowwai/30min) showed bookable days in the browser. It is set as `LEADFLOW_CALENDLY_URL` in the ignored `.env.external`. A public booking link needs no PAT. Automated meeting detection stays separate.

`npx tsx scripts/refresh-business-booking.ts --apply` revised the CTA in 16 eligible canonical drafts. It updates plain text, standalone HTML, and both EML alternatives while preserving the subject, signature, CID images, opt-out and other content. Originals were archived in `outputs/local-business` by fingerprint. The older review package remains an archival export. A second pass found zero changes. The latest 16 drafts were verified to contain all three alternative subjects, blank recipients, both logo variants and the live booking link.
