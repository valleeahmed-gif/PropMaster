# PropMaster

Property management for South African landlords — properties, tenants,
leases, invoices, payments, running costs (with a built-in municipal / levy
statement reader), maintenance and reports, plus a tenant portal.

- **Frontend:** React 18 + Vite 7 + Tailwind, two entry points:
  `/` (marketing page, `index.html`) and `/app` (React SPA, `app/index.html`).
- **Backend:** Supabase (Postgres + Auth + Row Level Security), schema in
  `supabase/migrations/`.
- **Hosting:** Cloudflare Workers with static assets (`wrangler.toml`,
  `worker.js`, `public/_headers`).

## What it does

- **Monthly invoice run** — one click creates an invoice for every active
  lease: rent (monthly / quarterly / half-yearly / yearly) plus that month's
  recoverable running costs, due on the lease's due day. Already-invoiced
  leases are skipped, so it is safe to run twice.
- **Statement reader** — upload a municipal or levy statement and the
  charges are read on the device and checked against the statement total.
- **Needs attention** — the dashboard lists overdue invoices, leases not yet
  invoiced this month, leases about to expire, urgent maintenance and
  months with no running costs captured.
- **Reports** — profit & loss, rent roll and outstanding invoices, with
  quick ranges including the SARS tax year (1 March – end of February);
  PDF and CSV export.
- **Account statements** — a PDF of every invoice and payment on a lease
  with a running balance, for the landlord and in the tenant portal.
- **Tenant portal** — tenants see their lease, invoices, payments and log
  maintenance requests.

Billing rules live in `src/lib/billing.ts` (unit-tested).

## Design

The interface uses the colours of the South African flag (not the flag
itself): black for structure, green for primary actions, gold for
highlights, red for overdue and danger, blue for information, white for
surfaces. The scales live in `tailwind.config.js` (Tailwind's `green`,
`amber`, `gray`, `red` and `blue` are remapped to them, so every screen
stays on palette). `src/components/Brand.tsx` holds the two signature
elements: `ColourBar`, a four-colour accent bar, and `ColourTiles`, a
geometric tile pattern. Fonts: Bricolage Grotesque (headings) and DM Sans.

## Local development

```bash
npm ci
npm run dev          # Vite dev server
npm test             # unit tests (statement reader)
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

## Statement reader (no AI)

`src/lib/statements/` reads City of Johannesburg and other municipal
accounts, and body corporate / HOA levy statements, entirely in the browser:

1. **Text** — `pdf.ts` pulls positioned text out of the PDF with pdf.js.
   Scanned PDFs and photos go through on-device OCR (`ocr.ts`, Tesseract
   WebAssembly). Password-protected PDFs prompt for the password.
2. **Rules** — `parse.ts` finds the charges two ways (CoJ-style service
   sections, and table / transaction rows), in English and Afrikaans.
3. **Breakdown** — each service section is also split into its separate
   charges (consumption with tariff steps merged, service and network
   charges, levies, sewer), so every line can be given its own "who pays".
   A breakdown is only offered when its lines add up to the section total.
4. **Cross-check** — the result is compared with the statement's own
   "current charges" / "total due". A mismatch lowers the confidence shown
   to the user and, where a printed subtotal disagrees with its detail
   lines, the statement total decides which one is right.

The file never leaves the device; only the confirmed line items are saved.
Engine files (OCR model, WASM) are copied from `node_modules` into
`public/vendor/` by `scripts/copy-statement-assets.mjs` before dev/build —
nothing is fetched from a CDN.

**Adding a layout:** paste the statement's text into
`src/lib/statements/__tests__/fixtures.ts` (with personal details changed),
add the expected amounts to `parse.test.ts`, run `npm test`, then adjust
the keyword rules in `classify.ts` / `parse.ts` until it passes.
