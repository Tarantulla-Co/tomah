# Deploying Tomah (Vercel + Supabase)

This monorepo hosts three deployables:

| App               | Path              | What it is                              | Vercel project    |
| ----------------- | ----------------- | --------------------------------------- | ----------------- |
| Storefront        | `apps/storefront` | Customer site (Vite / `vinext`)         | `tomah-storefront`|
| Admin API         | `apps/api`        | Express REST API as one serverless fn   | `tomah-api`       |
| Admin dashboard   | `apps/web`        | React + Vite SPA                        | `tomah-admin`     |

`packages/db` is the **shared** Prisma schema + client — one Supabase database
backs every app. Run migrations from **one** place and coordinate schema changes
with the storefront developer.

> `apps/storefront` is **not** an npm workspace (React 19, its own lockfile, and
> it is currently wired for Cloudflare Workers). Moving it onto Vercel is a
> separate task owned by the storefront developer; this guide covers the admin
> API + dashboard. The storefront is a pure client of the admin API's
> `/api/v1/public/*` endpoints — see [`docs/storefront-handover.md`](storefront-handover.md).
> Its one required production variable is `TOMAH_API_BASE_URL` = the deployed
> admin API root **including `/api/v1`** (plus `TOMAH_API_MODE=live`). It calls
> those endpoints server-side through its own proxy, so the admin API's
> `CORS_ORIGINS` does **not** need the storefront origin.

---

## 1. Supabase

1. **Create a project.** Save the database password, project ref (`<ref>`), and region.
2. **Connection strings** — Project Settings → Database → *Connection string*:
   - **Transaction pooler** (port `6543`) → this is `DATABASE_URL`.
     Append `?pgbouncer=true&connection_limit=1`.
   - **Direct connection** (port `5432`) → this is `DIRECT_URL` (used only by
     `prisma migrate`).
3. **Storage** — Storage → New bucket → name `product-images` → **Public bucket: ON**.
4. **API credentials** — Project Settings → API:
   - *Project URL* → `SUPABASE_URL`
   - *`service_role` secret* → `SUPABASE_SERVICE_ROLE_KEY` (server-only — never
     exposed to the browser; the admin API uses it to write to the bucket).

## 2. Apply the schema + seed (once)

From a machine with the repo checked out. Point `packages/db/.env` at Supabase
(`DATABASE_URL` = pooler, `DIRECT_URL` = direct), then:

```bash
npm install
npm run db:migrate:deploy   # applies packages/db/prisma/migrations to Supabase
npm run db:seed             # OPTIONAL — staff users + demo catalogue/orders
```

The API build also runs `prisma migrate deploy` on every deploy, so step 2's
migrate is optional if you deploy the API first. **Seeding is always manual.**
If you seed, immediately change the demo passwords (`Tomah!2026`) or create real
ADMIN users and delete the demo ones.

## 3. Vercel project `tomah-api`

- **New Project → import `Tarantulla-Co/tomah`.**
- **Root Directory:** `apps/api` — tick *“Include source files outside of the
  Root Directory”* (monorepo install needs the repo root).
- **Framework preset:** Other. Build/install commands are already defined in
  `apps/api/vercel.json` (installs from the repo root, generates the Prisma
  client, runs `prisma migrate deploy`, compiles the API).
- **Node.js version:** 20.x.
- **Environment variables** (Production + Preview):

  | Var | Value |
  | --- | --- |
  | `NODE_ENV` | `production` |
  | `DATABASE_URL` | Supabase **pooler** URL + `?pgbouncer=true&connection_limit=1` |
  | `DIRECT_URL` | Supabase **direct** URL |
  | `JWT_ACCESS_SECRET` | 48+ random bytes (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`) |
  | `JWT_REFRESH_SECRET` | another 48+ random bytes |
  | `ACCESS_TOKEN_TTL` | `15m` |
  | `REFRESH_TOKEN_TTL_DAYS` | `30` |
  | `COOKIE_DOMAIN` | *(empty)* |
  | `COOKIE_SECURE` | `true` |
  | `COOKIE_SAMESITE` | `lax` (proxy setup, §5A) or `none` (§5B) |
  | `CORS_ORIGINS` | `https://<admin-web-domain>` |
  | `STORAGE_ADAPTER` | `supabase` |
  | `SUPABASE_URL` | `https://<ref>.supabase.co` |
  | `SUPABASE_SERVICE_ROLE_KEY` | service-role secret |
  | `SUPABASE_STORAGE_BUCKET` | `product-images` |
  | `PAYMENT_PROVIDER` | `manual` (no online collection) or `stripe` |
  | `STRIPE_SECRET_KEY` | required if `PAYMENT_PROVIDER=stripe` |
  | `STRIPE_PUBLISHABLE_KEY` | required if `PAYMENT_PROVIDER=stripe` (safe to expose to the browser) |
  | `STRIPE_WEBHOOK_SECRET` | required if `PAYMENT_PROVIDER=stripe` — from the Stripe Dashboard webhook endpoint pointed at `/api/v1/public/payments/stripe/webhook` |
  | `ACCOUNTING_ADAPTER` | `noop` |
  | `INVOICE_DUE_DAYS` | `14` |

  Stripe's **automatic payment methods** surface Apple Pay and Google Pay on
  the storefront's Payment Element automatically — enable them (and add/verify
  your domain) in the Stripe Dashboard under Settings → Payment methods; no
  extra backend config.

- **Deploy**, then give it a stable alias (e.g. `tomah-api.vercel.app`).
- **Smoke test:**
  - `GET https://tomah-api.vercel.app/api/v1/healthz` → `{"status":"ok",…}`
  - `GET https://tomah-api.vercel.app/api/v1/readyz` → `{"status":"ready"}` (proves the DB connection)

## 4. Vercel project `tomah-admin` (dashboard)

- Import the **same repo**. **Root Directory:** `apps/web` (include outside files).
- **Framework preset:** Vite.
- **Before the first deploy:** edit `apps/web/vercel.json` and replace both
  `https://YOUR-API-DEPLOYMENT.vercel.app` occurrences with the real API alias
  from §3, then commit/push.
- **Environment variables:** none required (`VITE_API_BASE_URL` defaults to
  `/api/v1`, which the rewrite in `vercel.json` proxies to the API).
- **Deploy**, open the URL, sign in with an ADMIN account.

## 5. How the dashboard reaches the API

**A. Proxy (default — recommended).** `apps/web/vercel.json` rewrites
`/api/*` and `/uploads/*` to the API deployment. The browser only ever talks to
the dashboard origin, so the refresh-token cookie is first-party. Keep
`COOKIE_SAMESITE=lax`.

**B. Direct cross-origin.** Remove the two proxy rewrites from
`apps/web/vercel.json`, set `VITE_API_BASE_URL=https://tomah-api.vercel.app/api/v1`
in the `tomah-admin` project, and on the API set `COOKIE_SAMESITE=none` +
`COOKIE_SECURE=true` + `CORS_ORIGINS=https://<dashboard-origin>`. Simpler wiring;
Safari caps the cookie lifetime to 7 days (refresh rotation absorbs this).

## 6. Post-deploy checklist

- [ ] `/api/v1/healthz` and `/readyz` green.
- [ ] Sign in to the dashboard; the network tab shows `POST /api/v1/auth/login`
      setting the `tomah_rt` cookie, and a later `POST /api/v1/auth/refresh` 200.
- [ ] Create a product and upload an image — confirm the image URL points at
      `…supabase.co/storage/v1/object/public/product-images/…` and renders.
- [ ] Replace demo staff accounts with real ones.
- [ ] Custom domains on both Vercel projects; update `CORS_ORIGINS` /
      `apps/web/vercel.json` to match.

## 7. Known MVP limitations

- Cold starts of ~1–2 s on the first API request after idle.
- No background jobs / cron. Derived states (`OVERDUE`, `EXPIRED`) are computed
  on read, so this is fine.
- `prisma migrate deploy` runs inside the API build. To gate migrations, drop it
  from `apps/api/vercel.json` `buildCommand` and run `npm run db:migrate:deploy`
  by hand.
- Real accounting sync is still a stub (`ACCOUNTING_ADAPTER=noop`). Stripe
  collection is fully wired (`PAYMENT_PROVIDER=stripe`); `manual` stays
  available as a no-account fallback.

## 8. Local development — admin (API + dashboard)

```bash
docker compose up -d db
npm install
cp .env.example .env
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example    apps/api/.env
cp apps/web/.env.example    apps/web/.env
npm run db:migrate
npm run db:seed
npm run dev            # API on :4000, dashboard on :5173
```

With `apps/api/.env` left at its default `PAYMENT_PROVIDER=manual`, checkout
works with zero external accounts — the storefront's "Simulate payment
success (dev only)" button calls `POST /public/checkout/:ref/confirm-dev`.

### Testing the real Stripe flow locally

1. Create a free [Stripe](https://dashboard.stripe.com/register) account — test
   mode needs no business verification. Grab the test **Secret key** and
   **Publishable key** (Dashboard → Developers → API keys).
2. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run
   `stripe login` once.
3. In `apps/api/.env`:
   ```
   PAYMENT_PROVIDER=stripe
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...   # printed by `stripe listen` below — paste it in and restart the API
   ```
4. In a separate terminal, forward webhooks to the local API:
   ```bash
   stripe listen --forward-to localhost:4000/api/v1/public/payments/stripe/webhook
   ```
   (It prints a `whsec_...` the first time — that's `STRIPE_WEBHOOK_SECRET`.)
5. Restart `npm run dev`. Checkout now returns a real `clientSecret`; the
   storefront's Payment Element takes a [test card](https://docs.stripe.com/testing)
   (`4242 4242 4242 4242`, any future date/CVC). Apple Pay / Google Pay only
   render on a supporting browser/device over HTTPS — they won't appear on
   plain `http://localhost`.

## 9. Local development — storefront

The storefront needs **Node ≥ 22.13** (the admin apps need only ≥ 20) and is
not an npm workspace, so it gets its own install:

```bash
nvm install 22 && nvm use 22    # or any Node >=22.13 manager
cd apps/storefront
npm install
cp .env.example .env
```

Edit `apps/storefront/.env` to point at the local admin API:

```
TOMAH_API_MODE=live
TOMAH_API_BASE_URL=http://localhost:4000/api/v1
TOMAH_PUBLIC_SITE_URL=http://localhost:3000
```

Then, with the admin API running (§8) and the storefront's own DB-free:

```bash
npm run dev
```

Open the printed local URL (typically `http://localhost:3000`) — browse
`/products` (seeded catalogue), add the maple syrup to cart, and check out.
Leave `TOMAH_API_MODE=mock` (the default) to run the storefront standalone
against its built-in fixtures instead, with no API required.
