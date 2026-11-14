# Cloudflare Pages deployment with live intake

Use Wrangler, because the application includes the root functions/api/contact.ts Pages Function. A static dashboard ZIP upload alone does not deploy this backend.

1. Authorize Wrangler under the venture account. Minimal selected scopes: account:read, user:read, pages:write, workers:write, challenge-widgets.write. Wrangler may warn about unrelated missing scopes; do not expand access unless a required operation fails.
2. Create project leadflow-agency with production branch main. Free URL: https://leadflow-agency.pages.dev after deployment.
3. Create a managed Turnstile widget allowing exactly leadflow-agency.pages.dev.
4. Put public build settings in ignored .env: VITE_SITE_URL, VITE_CONTACT_EMAIL, VITE_INTAKE_ENABLED=true, VITE_TURNSTILE_SITE_KEY. Never prefix secrets with VITE_.
5. Set server-side Pages secrets APPS_SCRIPT_URL, INTAKE_HMAC_SECRET, TURNSTILE_SECRET_KEY, PUBLIC_SITE_URL. HMAC must match Script Properties. Use npx wrangler pages secret bulk data/cloudflare-secrets.json --project-name leadflow-agency. This private file is ignored; do not commit or display it.
6. Run npm install, npm test, npm run test:e2e, npm run test:contact, npm run build.
7. Deploy from repository root: npx wrangler pages deploy apps/web/dist --project-name leadflow-agency --branch main. Root functions must be present.
8. Verify the public /, /demo, /contact, /privacy, /terms and /services routes, metadata, favicon, social.png, security headers and POST /api/contact. The backend rejects preview-host submissions unless explicitly configured; production origin is pinned.
9. Run LIVE_SMOKE_TEST.md. Record the deployment ID, lead reference and Gmail message ID privately.

Static assets remain free within Pages limits; the Function uses the free Workers allowance and Turnstile free plan. No billing upgrades are authorized. Free-tier limits are not a 24/7 availability guarantee.

Build output includes index.html, _headers, _redirects, favicon.svg, social.svg, social.png and compiled bundles. Server secrets are not part of those files. Keep the Apps Script deployment version synchronized with backend changes.

