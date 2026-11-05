# PropMaster

Property management for South African landlords — properties, tenants,
leases, invoices, payments, running costs (with AI statement extraction),
maintenance and reports, plus a tenant portal.

- **Frontend:** React 18 + Vite 7 + Tailwind, two entry points:
  `/` (marketing page, `index.html`) and `/app` (React SPA, `app/index.html`).
- **Backend:** Supabase (Postgres + Auth + Row Level Security), schema in
  `supabase/migrations/`, AI extraction edge function in `supabase/functions/`.
- **Hosting:** Cloudflare Workers with static assets (`wrangler.toml`,
  `worker.js`, `public/_headers`).

## Local development

```bash
npm ci
npm run dev          # Vite dev server
npm run cf:dev       # production build served by the real Workers runtime
```

Optional `.env.local` overrides (defaults point at the production project):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_APP_URL=...      # base URL used in tenant invite links (default: current origin)
```

## Deploying to Cloudflare

**Option A — GitHub Actions (in this repo).** `.github/workflows/deploy.yml`
builds every PR and deploys `main`. Add two repository secrets
(Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` — create at dash.cloudflare.com → My Profile →
  API Tokens → "Edit Cloudflare Workers" template.
- `CLOUDFLARE_ACCOUNT_ID` — shown on the Workers & Pages overview page.

**Option B — Cloudflare Workers Builds.** In the Cloudflare dashboard,
connect this GitHub repo to the `propmaster` Worker with build command
`npm run build` and deploy command `npx wrangler deploy`. (Use A or B, not both.)

**Option C — from your machine.** `npx wrangler login && npm run deploy`.

### After changing the domain

Add the site URL to Supabase → Authentication → URL Configuration
(Site URL and Redirect URLs, e.g. `https://your-domain/app/accept-invite`),
otherwise tenant invite links will be rejected. If you add another external
host (images, APIs), update the Content-Security-Policy in both
`public/_headers` and `worker.js`.

## Database

Migrations live in `supabase/migrations/` and are applied to project
`cghiodbvbggizghxuvna`. RLS is enabled on every table; cross-owner
references are rejected by triggers (see
`20261104090000_integrity_and_tenant_hardening.sql`).

AI extraction setup: see `DEPLOY-AI-EXTRACTION.md`.
