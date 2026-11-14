# Real live smoke test

This checklist requires actual service evidence. Unit tests, screenshots of a simulation and mocked responses do not satisfy it.

1. Set EMAIL_TEST_MODE=true and SMOKE_TEST_EMAIL=leadsflowwai@gmail.com. Confirm GMAIL_SENDER_EMAIL is that same account. No external prospect is used.
2. Open the public /contact page. Use name “LeadFlow owner — TEST”, business “Synthetic smoke test”, venture email, and a fictional request for a website/enquiry automation. Choose a budget and consent, complete Turnstile, submit once.
3. Confirm the receipt reference. Find exactly one matching Leads row and one IntakeReceipts row. Retry a failed submission from the same form and verify the same reference.
4. Run tick manually or await the 10-minute trigger. Confirm scoring method/evidence, EmailOutbox draft method, recipient and exact body. If Gemini is expected, verify method=gemini and draft_method=gemini-assisted; rules fallback is safe but does not prove Gemini works.
5. Confirm a real Telegram alert arrived in the owner's private chat. Verify the recipient and every word. Tap Approve & send email yourself.
6. Run tick again or await the next poll. Check EmailOutbox.status=SENT, nonempty gmail_message_id, Lead.status=EMAIL_SENT and the matching Gmail Sent item and inbox receipt. SENT means Gmail accepted the request, not guaranteed inbox placement.
7. Tap the old approval again. Run tick. Confirm there is still exactly one email and one lead.
8. Test a second synthetic request with Defer or Reject and verify no email. Check SourceRuns for unexpected errors.
9. Record evidence privately, set EMAIL_TEST_MODE=false, install one tick trigger and confirm it appears in Apps Script. Keep free quotas and sender-account checks enabled.

If status is UNCERTAIN, check Gmail Sent using the outbox Message-ID and recipient before any action. Never clear it and resend blindly. There is deliberately no automatic retry after an ambiguous send. If confirmed sent but only the lead state is stale, reconciliation repairs it without sending again.

Daily: keep Telegram notifications enabled; review exact emails; check venture Gmail for replies; inspect EngineDashboard/SourceRuns/EmailOutbox for aged queues, quotas and uncertain deliveries. Browsers and this laptop need not remain open after Apps Script triggers and Cloudflare are configured. Do not claim the system is unattended: owner approval and periodic error review remain required.

