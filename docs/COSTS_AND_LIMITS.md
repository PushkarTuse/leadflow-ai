# Free-first costs and provider checks

Live configuration and relevant official limits checked on **14 November 2026**. The venture Gemini project shows Free tier. No paid account or billing enrollment was created. Zero-cost operation is bounded by quotas, not unlimited service.

| Component | MVP use | Cost boundary / checked source |
|---|---|---|
| React/Vite/core/CLI | Local code and static assets | No hosted service charge; dependencies are open-source libraries |
| Cloudflare Pages + Functions | Static site and signed contact endpoint on pages.dev | Static requests are free; Functions share the Workers Free allowance of 100,000 requests/day, resetting at midnight UTC. [Function pricing](https://developers.cloudflare.com/pages/functions/pricing/) |
| Turnstile | Managed spam check on contact | Free plan supports the production widget; no paid bot-management upgrade. [Plans](https://developers.cloudflare.com/turnstile/plans/) |
| Apps Script | 10-minute trigger and Sheets integration | Consumer accounts have 90 minutes/day total trigger runtime and 6 minutes/execution. Application soft cap is 45 seconds, 160 runs/day; monitor actual execution duration as data grows. [Official quotas](https://developers.google.com/apps-script/guides/services/quotas) |
| Google Sheets | Private CRM and audit | Account storage/API quotas apply. Engine bounds are intentionally much lower than spreadsheet capacity |
| Gemini | Structured qualification and draft planning | gemini-3.5-flash-lite verified on the venture Free tier. Input/output can be used for product improvement. Quotas vary; rules fallback remains enabled. [Pricing](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite) |
| Telegram Bot API | Owner-only alerts and commands | Standard HTTPS bot methods; no paid broadcast feature. Polling and webhooks are mutually exclusive; pending updates have limited retention. [Official API](https://core.telegram.org/bots/api) |
| Gmail | Exact owner-approved inbound replies | Application cap is 10 sends/day, subject to Gmail/account limits; no bulk-email service or paid Workspace subscription |
| HN | Optional limited jobstories/item reads | Official public API; useful source quality is not guaranteed. [API reference](https://github.com/HackerNews/API) |
| Cal.com | Optional owner-supplied scheduling link | No account has been created and individual-plan suitability has not been verified for the owner. Leave blank until verified |
| Domain / maintenance | Optional commercial operations | Domain registration costs and third-party usage are separate; require approval |

The initial code defaults to 5 source records per hourly cycle, two new Telegram alerts per cycle, ten Telegram updates per poll, 400 HTTP attempts/day and ten model attempts/day. These are conservative application controls, not provider limits. They may still need adjustment for actual consumer Apps Script trigger-runtime quotas. Read-safe HTTP retries count against the HTTP budget. Gmail API calls are bounded by source interval and batch size; they are not counted in the UrlFetch HTTP budget.

Do not raise a budget to solve quota failure without checking the provider account. A valid Gemini key attached to a billed project can incur charges despite `GEMINI_FREE_TIER_CONFIRMED`; the application cannot inspect your billing arrangement. The setup rule is to use a verified non-billed eligible project, or leave AI disabled.

The live site uses one Pages Function at /api/contact. Wrangler deploys the assets and Function together. No paid Worker subscription, custom domain or external form service is needed.

n8n, Zoho Invoice, UptimeRobot, telephony providers, paid marketplace bidding and advanced email delivery are not used by P0. Their current plans, commercial terms and quotas have not been validated for an owner account in this build.
