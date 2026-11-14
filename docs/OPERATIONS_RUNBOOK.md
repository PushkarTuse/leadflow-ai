# Operating the agency from your phone

## V3 website enquiries

Check the exact recipient and full proposed email in Telegram. Approve & send email queues that single reply; Defer/Reject do not send. Confirm EmailOutbox becomes SENT with a Gmail message ID, and check venture Gmail for replies. Polling is approximately every ten minutes. UNCERTAIN or NOTIFYING requires owner review, not blind retry. Renew unsent/deferred email reviews from the Sheet menu; changed nonces invalidate old buttons. Test and emergency-stop steps are in LIVE_SMOKE_TEST.md and SETUP.md. The discovery routine below remains draft-only.

## Morning routine (about ten minutes)

1. Open your private bot and send `/stats`. These are real CRM counts, not assumed revenue.
2. Send `/pending`. Review the original listing yourself: is it still open, paid, relevant and safe to respond to? Do not assume an email alert confirms current availability.
3. Tap **Draft proposal** only for a lead worth reviewing. **Review later** defers it by one day. **Reject** stops that lead's draft workflow.
4. Read each draft, verify names/facts, remove internal instructions and confirm the exact permitted submission channel. Approval does not establish contact consent.
5. Submit manually only where allowed. Then record `CONTACTED_MANUALLY` with `manual_confirmation=true` in the Sheet's **Update selected lead** menu. For mobile, drafts/decisions work in Telegram; the custom Sheet menu may require desktop Sheets or a desktop browser. Advanced CRM updates remain a desktop operation in P0.
6. Send `/followups`. Renew an expired/deferred alert from the Sheet menu if you want a new approval request. Check `SourceRuns` for failures and the last successful source time. Keep discovery focused on a handful of well-matched opportunities.

The trigger normally runs every ten minutes; source reads happen at most hourly. Bot commands wait until the next poll. No round-the-clock service-level promise is implied.

## Lead editing and follow-up

Select the whole lead row in `Leads` and choose **Update selected lead**. Examples:

```json
{"contact_permission_state":"PLATFORM_ONLY","contact_channel":"Upwork","owner_notes":"Reviewed current listing and permitted manual platform proposal"}
```

```json
{"status":"CONTACTED_MANUALLY","manual_confirmation":true,"next_followup_at":"2026-11-16T04:30:00Z"}
```

```json
{"status":"REPLIED","owner_notes":"Client replied; clarify scope before quote"}
```

Use the actual date and verified facts, not these sample dates. UTC timestamps are stored; the trigger and budget day use Asia/Kolkata by default. Status progression is validated. Skip no legal, pricing or contact decision just because a draft is present.

## Failure and recovery

| Symptom | Likely cause | Safe recovery |
|---|---|---|
| No real calls/messages | `DRY_RUN=true` or source disabled | Leave safe mode until ready; enable only the needed source and run a manual cycle |
| Gmail has no leads | Label mismatch, date filter, no valid body or source interval not elapsed | Check exact label on a few messages, configured age limit and next source interval; never expand to the whole inbox as a workaround |
| Invalid Gmail page token | Mailbox changed during pagination | The adapter clears that token on failure; next bounded source cycle restarts and deduplicates |
| `classifier=rules` | No key/model/attestation, provider quota, invalid evidence | Read classification_warning; verify free eligibility and configuration. Rules remain operational; do not attach billing automatically |
| Telegram command delayed | Scheduled polling, expired updates or trigger failure | Run one cycle; inspect Apps Script Executions and SourceRuns. Send the command again if its reply was lost |
| `ApprovalRequests=FAILED` or stuck SENDING | Ambiguous send/network failure | Check the private chat before manually renewing. The engine intentionally avoids automatic resends |
| Button unavailable | Wrong owner/chat/message, expired request, old or consumed button | Use current request; select pending lead and **Renew selected approval alert** if necessary. Unknown users should always fail |
| Approved but no draft yet | Execution interrupted after decision persistence | Run one cycle; recorded decisions reconcile without re-approval. Check Drafts even if a Telegram delivery failed |
| `BUDGET_LIMIT` | Daily or soft runtime cap reached | Wait for the configured timezone's next budget day or lower batch size. Raise limits only within provider quotas |
| `SCHEMA_ERROR` | Edited header or missing tab | Stop triggers, restore headers from the source schema/backups, then run setup. Do not delete real rows to silence an error |
| Duplicate-looking source | Different URL or source ID for same opportunity | Review both, archive the redundant record. Fuzzy identity merging is intentionally not automatic |
| Sheet counts differ from original Dashboard | Original workbook dashboard is still linked to legacy CRM | Use EngineDashboard. The original is preserved, not silently rewired |

Retries are limited to read-safe HTTP failures (429/5xx) with 250/500ms backoff. Writes such as Telegram send and Gemini generation do not retry automatically. The next scheduled source cycle is the broader retry mechanism. Error bodies/credential-bearing URLs are not logged.

## Backup, retention, deletion and shutdown

- Weekly: export the native Sheet and local private state to owner-controlled storage. Keep sensitive backups out of Git. Verify one restoration on a disposable copy before relying on it.
- Proposed retention: review inactive, rejected and unneeded leads after 90 days. This is an operating policy proposal, not automatic legal compliance or a running deletion job.
- Before deleting a lead, stop its source from re-importing it: remove its Gmail label or delete the source import row/file. Select the lead, choose **Delete selected lead data**, and type its ID. This deletes associated engine data including its audit. Remove source emails, ManualInbox copies, exports, backups and Telegram messages separately when required.
- To stop everything: set `DRY_RUN=true`, disable all `*_ENABLED` switches and choose **Remove triggers**. Revoke/rotate compromised tokens at the issuing provider. The local website still works.
- Apps Script operational table reads stop above 5,000 data rows, including ActivityLog. SourceRuns automatically rolls into timestamped archive tabs at 4,000 rows and preserves the complete old log; this prevents routine idle polling from stopping the workflow after a week. Include archive tabs in weekly backups and the retention/capacity review. These remain small-business MVP bounds.

## Weekly funnel review

Inspect discovered, qualified, approved, drafts, manually submitted, replied, discovery calls and won counts. Read a few disqualified items to identify poor sources. Count time spent and actual replies before expanding automation. Prices are confirmed only through scope; no KPI should be invented to fill an empty dashboard.
