# Tomah International — Monorepo

Food import & distribution: retail maple products (direct checkout) and
wholesale bulk food (quote-based).

| Path              | App                                             | Stack |
| ----------------- | ----------------------------------------------- | ----- |
| `apps/storefront` | Customer-facing storefront (separate developer) | Vite / `vinext` (React 19) |
| `apps/web`        | Owner/admin dashboard                           | React 18 + TS + Vite |
| `apps/api`        | Admin REST API                                  | Node + Express + TS (one Vercel serverless fn in prod) |
| `packages/db`     | **Shared** data layer                          | PostgreSQL + Prisma |

Every app is backed by **one** PostgreSQL database via
[`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma) — treat
each table as read/write-shared and coordinate migrations. See
[`docs/DATA_MODEL.md`](docs/DATA_MODEL.md), [`docs/API.md`](docs/API.md), and
[`docs/DEPLOY.md`](docs/DEPLOY.md) (Vercel + Supabase).

## Stack (admin)

| Layer     | Choice                                              |
| --------- | -------------------------------------------------- |
| Auth      | Self-hosted JWT (access) + rotating refresh cookie |
| Storage   | Local disk (dev) / Supabase Storage (prod) — swappable adapter |
| Payments  | Stripe (PaymentIntents + webhook — cards, Apple Pay, Google Pay) or manual recording, switchable via `PAYMENT_PROVIDER` |
| Accounting sync | Swappable adapter interface; real adapters deferred |

npm workspaces: `packages/*` + `apps/api` + `apps/web`. `apps/storefront` is a
standalone project (React 19, own lockfile) and is **not** a workspace.

## Prerequisites

- Node.js >= 20
- PostgreSQL 14+ (a `docker-compose.yml` is provided for local dev)

## First-time setup

```bash
# 1. install all workspace deps
npm install

# 2. env files
cp .env.example .env
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example    apps/api/.env
cp apps/web/.env.example    apps/web/.env

# 3. database
docker compose up -d db      # or point DATABASE_URL at your own Postgres
npm run db:migrate           # create schema
npm run db:seed              # test users + sample data

# 4. run both apps
npm run dev                  # api on :4000, web on :5173
```

Open http://localhost:5173 and sign in with a seeded account (see below).

## Seeded accounts

Password for every seeded user: **`Tomah!2026`**

| Email                  | Role           |
| ---------------------- | -------------- |
| `owner@tomah.test`     | Admin          |
| `admin2@tomah.test`    | Admin          |
| `orders1@tomah.test`   | Order Manager  |
| `orders2@tomah.test`   | Order Manager  |
| `content1@tomah.test`  | Content Editor |
| `content2@tomah.test`  | Content Editor |

## Scripts (run from repo root)

| Script                  | Purpose                                        |
| ----------------------- | --------------------------------------------- |
| `npm run dev`           | api + web in parallel                          |
| `npm run dev:api`       | API only                                       |
| `npm run dev:web`       | Web only                                       |
| `npm run db:migrate`    | `prisma migrate dev`                           |
| `npm run db:seed`       | run the seed script                            |
| `npm run db:studio`     | Prisma Studio                                  |
| `npm run db:reset`      | drop + recreate + seed                         |
| `npm run typecheck`     | typecheck api + web                            |
| `npm run build`         | build db client, api, and web                  |

## Repository layout

```
apps/storefront/     Customer site — Vite/vinext, React 19 (separate developer)
packages/db/         Prisma schema, generated client, seed  (@tomah/db)
  prisma/schema.prisma   <- shared data model, every app reads this
apps/api/            Express REST API                        (@tomah/api)
  api/index.ts          Vercel serverless entry (exports the Express app)
  vercel.json           build + rewrite-all-to-function config
  src/routes/            route definitions + inline route map
  src/controllers/       handlers
  src/middleware/        auth, validation, error envelope
  src/lib/storage/       local-disk (dev) + supabase (prod) adapters
apps/web/            React admin client                      (@tomah/web)
  vercel.json           SPA rewrite + /api proxy to the API deployment
  src/theme/tokens.css   design tokens (UI Direction: 70/20/10 colour split)
  src/pages/             screens
docs/                DATA_MODEL.md, API.md, DEPLOY.md
```

## Deployment

Vercel (3 projects) + Supabase (Postgres + Storage) + Stripe. Full runbook —
env vars, migrations, the web↔API cookie/CORS wiring, and how to run **all
three apps together locally** (including the real Stripe test-mode flow) —
in [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Build status by phase

- [x] **Phase 1 — Foundation**: scaffold, schema for all entities, JWT auth +
      3 roles, dashboard shell, seed script.
- [x] **Phase 2 — Product catalogue**: product CRUD (variants, images by URL
      or file upload via a swappable storage adapter, certifications, country
      of origin), retail vs gated wholesale pricing, manual stock override with
      sync-lock, category + status + search filtering, audit logging.
- [x] **Phase 3 — Wholesale accounts**: application queue (pending/approved/
      rejected) with counts + search, offline application intake, approve /
      reject / revoke with reviewer + timestamp, per-account audit trail, and
      the `APPROVED`-gates-wholesale-pricing rule (`apps/api/src/lib/wholesale.ts`).
- [x] **Phase 4 — Quotes & invoicing**: quote builder (line items priced or
      priced-later, per-line + document totals via a Decimal-safe money lib),
      `REQUESTED→DRAFT→SENT→APPROVED→CONVERTED` lifecycle with `REJECTED` /
      derived `EXPIRED`, quote → draft-invoice conversion, invoice
      `DRAFT→SENT→PAID` / `VOID` / derived `OVERDUE`, manual payment recording,
      and swappable payment-provider + accounting-sync adapter interfaces
      (`apps/api/src/lib/{payments,accounting}/`, real impls in Phase 8).
- [x] **Phase 5 — Retail orders**: order queue (status + carrier filters, counts,
      search by order/tracking/customer), detail with a derived fulfilment
      timeline, `PAID→PROCESSING→SHIPPED→DELIVERED` transitions plus `CANCELLED`
      (pre-ship) and full/partial `REFUNDED`, carrier + tracking capture and
      later correction, per-order audit trail, and a documented storefront
      order-tracking contract (`docs/API.md`). Orders are created by the
      storefront; this app owns every status change.
- [x] **Phase 6 — Customers**: unified retail + wholesale directory (type filter,
      per-row order/quote/invoice counts, `typeCounts`, search by name/email/
      company), and a per-customer profile — wholesale-account status (linked),
      saved addresses, recent orders / quotes / invoices (linked to their detail
      pages), and lifetime stats (spend, refunds, open quotes, unpaid invoices).
      Read-only: customer records are written by the storefront + application
      intake.
- [x] **Phase 7 — Content management**: storefront CMS staff edit without a
      deploy — FAQs, testimonials, and recipes (`isPublished` gate + `position`
      ordering, inline create/edit/publish/delete), plus the homepage
      featured-product list (ordered, add/remove/reorder, per-entry internal
      note). New models `Faq` / `Testimonial` / `Recipe` / `FeaturedProduct`
      (migration `content_models`). Reads = any staff; writes = `CONTENT_EDITOR`.
- [x] **Phase 8 — Settings & reporting**: ADMIN-only settings for Stripe keys
      (secret write-only, never returned), shipping-fee rules (free-shipping
      threshold, default + per-region), tax rules per region, and accounting-sync
      (adapter status, `autoSyncOnPayment`, last-run result) with a manual
      `POST /accounting/sync` trigger over the Phase 4 adapter. Revenue reporting
      — `GET /reports/summary` (retail vs wholesale by channel, monthly series,
      order/refund/invoice/quote KPIs) and `GET /reports/top-products` — the
      figures Phase 1 deferred. New `Setting` key/JSON model (migration
      `settings`).

All 8 phases delivered.
