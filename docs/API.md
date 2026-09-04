# Admin API — contract

Base URL: `/api/v1` (dev: `http://localhost:4000/api/v1`)

> Phase 1 ships auth + a dashboard summary. This file grows one section per
> phase. The storefront consumes its **own** endpoints (to be designed with
> that developer); the routes here are for the admin client, but the response
> conventions below apply to every future route.

## Conventions

### Auth

- **Access token**: JWT, `Authorization: Bearer <token>`, ~15 min TTL. Claims:
  `sub` (user id), `role`, `name`, `email`, `iss: "tomah-admin"`.
- **Refresh token**: opaque, sent as the httpOnly cookie `tomah_rt` (path
  `/api/v1/auth`). Rotated on every `/auth/refresh`; the old one is revoked.
  Only a SHA-256 hash is stored server-side (`refresh_tokens` table), so
  sessions can be revoked (`/auth/logout`, `/auth/logout-all`).
- Send `credentials: "include"` on browser requests.

### Error envelope

Every non-2xx response:

```json
{ "error": { "code": "STRING_CODE", "message": "Human readable", "details": {} } }
```

Common codes: `VALIDATION_ERROR` (422), `UNAUTHORIZED` (401), `FORBIDDEN`
(403), `NOT_FOUND` (404), `CONFLICT` (409), `INTERNAL_ERROR` (500).

### Roles

`requireRole(...)` guards. `ADMIN` passes every check. Role → area:

| Role             | Access |
| ---------------- | ------ |
| `ADMIN`          | everything, incl. settings & sensitive reports |
| `ORDER_MANAGER`  | orders, quotes, invoices, wholesale accounts, customers |
| `CONTENT_EDITOR` | product catalogue, CMS content |

## Endpoints — Phase 1

### `GET /healthz`
Liveness. `200 { "status": "ok", "uptime": <seconds> }`. No auth.

### `GET /readyz`
Readiness, checks the DB. `200 { "status": "ready" }`. No auth.

### `POST /auth/login`
Body: `{ "email": string, "password": string }`

`200`:
```json
{
  "user": { "id", "email", "name", "role", "lastLoginAt" },
  "accessToken": "<jwt>"
}
```
Also sets the `tomah_rt` refresh cookie. `401 UNAUTHORIZED` on bad
credentials; `403 FORBIDDEN` if the account is deactivated.

### `POST /auth/refresh`
No body. Reads the `tomah_rt` cookie, rotates it, returns a fresh
`{ user, accessToken }`. `401` if the cookie is missing/expired/revoked.

### `POST /auth/logout`
Revokes the presented refresh token and clears the cookie. `204`.

### `POST /auth/logout-all`  — requires auth
Revokes every refresh token for the current user. `204`.

### `GET /auth/me`  — requires auth
`200 { "user": { "id", "email", "name", "role", "lastLoginAt" } }`

### `GET /overview`  — requires auth
Non-sensitive operational counts for the dashboard landing page:
```json
{
  "staffCount": 0,
  "customers": { "retail": 0, "wholesale": 0 },
  "products": { "published": 0, "draft": 0 },
  "actionQueue": {
    "pendingWholesaleApplications": 0,
    "openQuotes": 0,
    "unpaidInvoices": 0,
    "ordersToShip": 0
  }
}
```
Revenue/financial reporting is deliberately excluded here — added, role-scoped,
in Phase 8.

## Endpoints — Phase 2 (Product catalogue)

Reads require any authenticated staff. Writes require `CONTENT_EDITOR`
(`ADMIN` implicitly). All mutations append to `audit_logs`.

Money fields are returned as **decimal strings** (`"14.99"` / `null`) and
accepted as a number or numeric string. `wholesalePrice` /
`minimumOrderQuantity` are gated fields — the storefront must withhold them
from non-approved customers (see `DATA_MODEL.md`); the admin API always
returns them.

### `GET /products`
Query params (all optional): `q` (name/SKU/barcode), `category` (enum),
`status` (`published` | `draft`), `stock` (`in` | `out`),
`channel` (`retail` | `wholesale`), `page` (default 1),
`pageSize` (default 25, max 100),
`sort` (`name|-name|updatedAt|-updatedAt|stock|-stock`, default `-updatedAt`).

```json
{
  "data": [ Product, ... ],
  "pagination": { "page": 1, "pageSize": 25, "total": 4, "pageCount": 1 },
  "categoryCounts": { "POULTRY": 1, "PORK": 0, "...": 0 }
}
```

`Product` shape:
```json
{
  "id", "sku", "barcode", "name", "slug",
  "shortDescription", "longDescription",
  "category", "countryOfOrigin", "certifications": [],
  "currency": "USD",
  "retailPrice": "14.99" | null,
  "wholesalePrice": "9.10" | null, "minimumOrderQuantity": 24 | null,
  "isRetailAvailable": true, "isWholesaleAvailable": false,
  "stock": { "quantity": 50, "source": "MANUAL"|"ACCOUNTING_SYNC",
             "syncEnabled": true, "updatedAt": "ISO" },
  "isPublished": false, "createdAt": "ISO", "updatedAt": "ISO",
  "images":   [ { "id", "url", "altText", "position", "isPrimary" } ],
  "variants": [ { "id", "name", "sku", "barcode",
                  "retailPrice", "wholesalePrice", "minimumOrderQuantity",
                  "stockQuantity", "weightGrams", "isActive", "position" } ]
}
```

### `GET /products/:id`
`{ "data": Product }`. `404` if not found.

### `POST /products`  — `CONTENT_EDITOR`
Body: `name`, `sku`, `category` required; `slug` auto-generated (unique) if
omitted; `barcode`, `shortDescription`, `longDescription`, `countryOfOrigin`,
`certifications[]`, `currency` (3-letter, default `USD`), `retailPrice`,
`wholesalePrice`, `minimumOrderQuantity`, `isRetailAvailable` (default true),
`isWholesaleAvailable` (default false), `stockQuantity` (default 0),
`stockSyncEnabled` (default true), `isPublished` (default false).
`201 { "data": Product }`. Duplicate `sku` → `409`.

### `PATCH /products/:id`  — `CONTENT_EDITOR`
Any subset of the create fields **except `stockQuantity`** (use the stock
endpoint so every change is explicit and stamps `MANUAL`).
`200 { "data": Product }`.

### `DELETE /products/:id`  — `CONTENT_EDITOR`
`204`. Referencing order/quote line items keep their snapshots; their
`productId` FK is set `NULL`.

### `PATCH /products/:id/stock`  — `CONTENT_EDITOR`
Body: `stockQuantity` (int, required), `stockSyncEnabled` (bool, optional),
`note` (string, optional — recorded in the audit log). Always sets
`stock.source = "MANUAL"` and bumps `stock.updatedAt`. Setting
`stockSyncEnabled: false` tells the Phase 8 accounting-sync job to skip this
product. `200 { "data": Product }`.

### Variants — `CONTENT_EDITOR`
- `POST   /products/:id/variants` — body: `name`, `sku` required; `barcode`,
  `retailPrice`, `wholesalePrice`, `minimumOrderQuantity`, `stockQuantity`,
  `weightGrams`, `isActive`, `position`. `201 { "data": Product }`.
- `PATCH  /products/:id/variants/:variantId` — partial. `200 { "data": Product }`.
- `DELETE /products/:id/variants/:variantId` — `200 { "data": Product }`.

### Images — `CONTENT_EDITOR`
Two ways to add an image; both return `{ "data": Product }`. Each image is
`{ id, url, altText, position, isPrimary, isUploaded }` — `isUploaded: true`
means the API hosts the file (deleting the row deletes the file);
`isUploaded: false` is an external URL left untouched on delete.

- `POST /products/:id/images` — **by URL**. Body: `url` (required), `altText`,
  `position`, `isPrimary`. Setting `isPrimary` clears it on siblings.
- `POST /products/:id/images/upload` — **file upload**. `multipart/form-data`
  with field `file` (JPEG/PNG/WebP/GIF/AVIF, ≤ `MAX_UPLOAD_MB`, default 8MB),
  plus optional text fields `altText`, `isPrimary` (`"true"`). Stored through
  the configured storage adapter. Bad type → `415`; too large → `400`.
- `PATCH  /products/:id/images/:imageId` — partial (`altText`, `position`,
  `isPrimary`).
- `DELETE /products/:id/images/:imageId` — removes the row and, for uploads,
  the underlying file.

**Storage adapter** — `STORAGE_ADAPTER=local` (default) writes under
`STORAGE_LOCAL_DIR` and serves at `ASSET_PUBLIC_BASE_URL` (`/uploads`, proxied
in dev). Swap in S3/GCS/etc. by adding an adapter implementing
`StorageAdapter` (`apps/api/src/lib/storage/`); no controller changes needed.
Set `ASSET_PUBLIC_BASE_URL` to the bucket/CDN URL in production.

## Endpoints — Phase 3 (Wholesale accounts)

`ORDER_MANAGER` (ADMIN implicit) for all of the below.

**The gate**: a customer sees wholesale pricing / MOQ and may request quotes
**only** when their `WholesaleAccount.status === "APPROVED"`
(`unlocksWholesalePricing: true` on the payload). Phases 4 & 6 and the
storefront must all use this single rule — server helper in
`apps/api/src/lib/wholesale.ts`.

### `GET /wholesale-accounts`
Query: `q` (business / contact / email), `status` (`PENDING|APPROVED|REJECTED`),
`page`, `pageSize`, `sort` (`createdAt|-createdAt|businessName|-businessName`).
```json
{
  "data": [ Account, ... ],
  "pagination": { ... },
  "statusCounts": { "PENDING": 1, "APPROVED": 1, "REJECTED": 0 }
}
```
`Account`:
```json
{
  "id", "status", "unlocksWholesalePricing": false,
  "customer": { "id", "name", "email", "phone", "type" },
  "application": {
    "businessName", "businessRegistrationNumber", "taxId", "businessType",
    "website", "contactName", "contactEmail", "contactPhone",
    "estimatedMonthlyVolume", "applicationNotes"
  },
  "review": {
    "reviewedBy": { "id", "name" } | null,
    "reviewedAt": "ISO" | null, "reviewNotes": null, "rejectionReason": null
  },
  "createdAt", "updatedAt"
}
```

### `GET /wholesale-accounts/:id`
`Account` plus:
```json
{
  "customerActivity": { "orders": 0, "quotes": 0 },
  "auditTrail": [ { "id", "action", "summary", "actor", "at", "metadata" } ]
}
```

### `POST /wholesale-accounts`
Log an offline application. Body: `firstName`, `lastName`, `email`,
`businessName` required; `phone`, `businessType`, `website`,
`businessRegistrationNumber`, `taxId`, `estimatedMonthlyVolume`,
`applicationNotes` optional. Upserts a `WHOLESALE` customer by `email` and
creates the account as `PENDING`. `201 { "data": Account }`. Existing account
for that customer → `409`.

### `POST /wholesale-accounts/:id/approve`
Body: `{ "reviewNotes"?: string }`. Sets `APPROVED`, stamps
`review.reviewedBy` = caller and `review.reviewedAt` = now, clears any prior
`rejectionReason`. Already approved → `409`. Audit: `wholesale_account.approved`.

### `POST /wholesale-accounts/:id/reject`
Body: `{ "rejectionReason": string (required), "reviewNotes"?: string }`.
Sets `REJECTED` with reviewer + timestamp. Works from `APPROVED` too — that is
how access is revoked (audit: `wholesale_account.access_revoked`; otherwise
`wholesale_account.rejected`). Already rejected → `409`.

## Endpoints — Phase 4 (Quotes & invoicing)

`ORDER_MANAGER` (ADMIN implicit) for everything below. All mutations append to
`audit_logs`. Money fields are decimal strings (`"837.60"` / `null`) and accepted
as a number or numeric string, exactly as in Phase 2.

Document numbers (`quoteNumber`, `invoiceNumber`) are minted by this API —
`TMH-Q-####` / `TMH-INV-####` (see `docs/DATA_MODEL.md`).

**Customer target** — endpoints that create a document take a `customer` object
that is *either* `{ customerId }` for an existing customer *or*
`{ firstName, lastName, email, phone? }` to upsert a `WHOLESALE` customer by
email (same intake convention as Phase 3).

### Quotes

Lifecycle: `REQUESTED`/`DRAFT` → `SENT` → `APPROVED` → `CONVERTED`, with
`REJECTED` reachable from any open state and `EXPIRED` derived (a `SENT` quote
past `validUntil` — the stored status is left as `SENT` and the payload carries
`isExpired: true`). Header fields and line items are editable only while
`REQUESTED` or `DRAFT`.

#### `GET /quotes`
Query: `q` (quote # / customer name / email / company), `status` (enum), `page`,
`pageSize`, `sort` (`createdAt|-createdAt|quoteNumber|-quoteNumber`,
default `-createdAt`).
```json
{
  "data": [ Quote, ... ],
  "pagination": { "page": 1, "pageSize": 25, "total": 3, "pageCount": 1 },
  "statusCounts": { "REQUESTED": 0, "DRAFT": 1, "SENT": 1, "APPROVED": 0,
                    "REJECTED": 0, "EXPIRED": 0, "CONVERTED": 1 }
}
```
`Quote` shape:
```json
{
  "id", "quoteNumber", "status", "isExpired": false,
  "customer": { "id", "name", "email", "phone", "companyName",
                "wholesaleApproved": true },
  "createdBy": { "id", "name" } | null,
  "requestNote", "internalNote", "currency": "USD",
  "subtotal": "837.60" | null, "taxAmount": "0" | null,
  "discountAmount": "0" | null, "total": "837.60" | null,
  "validUntil": "ISO" | null, "sentAt", "approvedAt", "rejectedAt",
  "rejectionReason",
  "lineItems": [ { "id", "productId", "variantId", "description", "quantity",
                   "unitPrice": "7.20" | null, "lineTotal": "345.60" | null,
                   "notes", "position" } ],
  "invoice": { "id", "invoiceNumber", "status" } | null,
  "createdAt", "updatedAt"
}
```
`wholesaleApproved` reflects the single Phase 3 gate
(`WholesaleAccount.status === "APPROVED"`). Quote creation does **not** hard-block
on it — staff may quote a customer mid-application — but the UI warns.

#### `GET /quotes/:id`
`Quote` plus `"auditTrail": [ { id, action, summary, actor, at, metadata } ]`.

#### `POST /quotes`
Body: `customer` (required, see above), `currency` (default `USD`),
`validUntil?`, `requestNote?`, `internalNote?`, `taxAmount?`, `discountAmount?`,
`lineItems[]` of `{ description (required), quantity (≥1), unitPrice?,
productId?, variantId?, notes? }`. Created as `DRAFT`; totals are computed
server-side. `201 { "data": Quote }`.

#### `PATCH /quotes/:id`  — `REQUESTED`/`DRAFT` only
Header fields only: `requestNote`, `internalNote`, `currency`, `validUntil`,
`taxAmount`, `discountAmount`. Recomputes totals. `409` once the quote is sent.

#### Line items — `REQUESTED`/`DRAFT` only
- `POST   /quotes/:id/line-items` — `{ description, quantity, unitPrice?, productId?, variantId?, notes? }`
- `PATCH  /quotes/:id/line-items/:lineId` — partial
- `DELETE /quotes/:id/line-items/:lineId`

All return `{ "data": Quote }` with recomputed totals.

#### `POST /quotes/:id/send`  — `REQUESTED`/`DRAFT` → `SENT`
Body: `{ validUntil?, internalNote? }`. `400` if there are no line items or any
line is unpriced.

#### `POST /quotes/:id/approve`  — `SENT` → `APPROVED`
Body: `{ note? }`. Records the customer's approval (staff-entered). `409` from
any other state.

#### `POST /quotes/:id/reject`  — → `REJECTED`
Body: `{ rejectionReason (required) }`. Works from `REQUESTED`/`DRAFT`/`SENT`/
`APPROVED`; `409` from `CONVERTED`/`REJECTED`.

#### `POST /quotes/:id/convert`  — `APPROVED` → `CONVERTED`
Body: `{ dueDate?, notes? }`. Creates a **`DRAFT` invoice** from the quote (line
items snapshotted, totals copied), links it, and flips the quote to `CONVERTED`.
`dueDate` defaults to `issueDate + INVOICE_DUE_DAYS` (env, default 14).
`409` if the quote already has an invoice.
```json
{ "data": { "quote": Quote,
            "invoice": { "id", "invoiceNumber", "status", "total", "currency" } } }
```

### Invoices

Lifecycle: `DRAFT` → `SENT` → `PAID`, with `VOID` reachable from any non-paid
state and `OVERDUE` derived (`SENT` past `dueDate` — `isOverdue: true` in the
payload, stored status stays `SENT`). Editable only while `DRAFT`.

#### `GET /invoices`
Query: `q` (invoice # / quote # / customer name / email / company),
`status` (enum), `page`, `pageSize`,
`sort` (`createdAt|-createdAt|dueDate|-dueDate|total|-total`, default
`-createdAt`).
```json
{
  "data": [ Invoice, ... ],
  "pagination": { ... },
  "statusCounts": { "DRAFT": 0, "SENT": 1, "PAID": 1, "OVERDUE": 0, "VOID": 0 }
}
```
`Invoice` shape:
```json
{
  "id", "invoiceNumber", "status", "isOverdue": false,
  "customer": { "id", "name", "email", "phone", "companyName" },
  "quote": { "id", "quoteNumber", "status" } | null,
  "currency": "USD",
  "subtotal": "760.00", "taxAmount": "0", "discountAmount": "0", "total": "760.00",
  "issueDate": "ISO", "dueDate": "ISO" | null, "sentAt", "paidAt",
  "payment": { "provider": "manual", "reference": null, "online": false },
  "accounting": { "status": "NOT_SYNCED", "adapter": null, "ref": null,
                  "syncedAt": null, "error": null },
  "notes",
  "lineItems": [ { "id", "description", "quantity", "unitPrice", "lineTotal",
                   "position" } ],
  "createdAt", "updatedAt"
}
```
`payment.online` is `false` while `PAYMENT_PROVIDER=manual` (the default) —
collection is by manual recording only. Set `PAYMENT_PROVIDER=stripe` for live
collection.
`accounting.status` is one of `NOT_SYNCED | PENDING | SYNCED | FAILED`; it stays
`NOT_SYNCED` until an accounting adapter is configured (Phase 8).

#### `GET /invoices/:id`
`Invoice` plus `"auditTrail": [ ... ]`.

#### `POST /invoices`
A direct, quote-less invoice. Body: `customer` (required), `currency`,
`dueDate?`, `notes?`, `taxAmount?`, `discountAmount?`, `lineItems[]` of
`{ description, quantity (≥1), unitPrice (required) }` (≥1 line). Created as
`DRAFT`. `201 { "data": Invoice }`.

#### `PATCH /invoices/:id`  — `DRAFT` only
`currency`, `dueDate`, `notes`, `taxAmount`, `discountAmount`.

#### Line items — `DRAFT` only
- `POST   /invoices/:id/line-items` — `{ description, quantity, unitPrice }`
- `PATCH  /invoices/:id/line-items/:lineId` — partial
- `DELETE /invoices/:id/line-items/:lineId`

#### `POST /invoices/:id/send`  — `DRAFT` → `SENT`
Body: `{ dueDate? }`. `400` if there are no line items.

#### `POST /invoices/:id/pay`  — `DRAFT`/`SENT`/`OVERDUE` → `PAID`
Records a payment received out-of-band (bank transfer, or a Stripe payment
reconciled from the dashboard). Body: `{ reference?, paidAt?, amount?, note? }`
(`paidAt` defaults to now). Audit: `invoice.paid`. After marking paid it makes a
**best-effort** push to the accounting adapter — a sync failure is recorded on
`accounting.{status: "FAILED", error}` and never fails the request. With the
default no-op adapter nothing is pushed and `accounting.status` stays
`NOT_SYNCED`. `409` from `PAID`/`VOID`.

#### `POST /invoices/:id/void`  — → `VOID`
Body: `{ reason? }`. `409` from `PAID` (a paid invoice can't be voided) or
`VOID`.

### Adapters (interfaces only in Phase 4)

| Concern | Env | Default | Interface |
| ------- | --- | ------- | --------- |
| Payment collection | `PAYMENT_PROVIDER` | `manual` | `apps/api/src/lib/payments/types.ts` (`PaymentProvider`) |
| Accounting sync | `ACCOUNTING_ADAPTER` | `noop` | `apps/api/src/lib/accounting/types.ts` (`AccountingAdapter`) |

Both follow the same swappable-adapter pattern as `lib/storage`. Phase 8 wires
real implementations + settings; no controller changes are needed to swap one in.

## Endpoints — Phase 5 (Retail orders)

`ORDER_MANAGER` (ADMIN implicit) for everything below. All mutations append to
`audit_logs`. Money fields are decimal strings.

Orders are **created by the storefront at checkout** (see `docs/DATA_MODEL.md` —
storefront writes `Order` + `OrderItem`). This API has **no create endpoint**; it
owns every status transition and all fulfilment / refund actions.

Lifecycle:

```
PAID ──process──> PROCESSING ──ship──> SHIPPED ──deliver──> DELIVERED
  │                    │
  ├────────cancel──────┤            (CANCELLED — only before shipping)
  │                    │
  └──refund────────────┴──refund──(from SHIPPED / DELIVERED too)──> REFUNDED
```

`ship` may also run straight from `PAID` (skipping an explicit `process`). A
partial refund amount is recorded on `refund.amount` but the status still becomes
`REFUNDED` (the schema has no partial-refund status).

### `GET /orders`
Query: `q` (order # / tracking # / customer name / email), `status` (enum),
`carrier` (`USPS|UPS|FEDEX|DHL`), `page`, `pageSize`,
`sort` (`createdAt|-createdAt|total|-total|orderNumber|-orderNumber`,
default `-createdAt`).
```json
{
  "data": [ Order, ... ],
  "pagination": { ... },
  "statusCounts": { "PAID": 1, "PROCESSING": 1, "SHIPPED": 1, "DELIVERED": 1,
                    "CANCELLED": 0, "REFUNDED": 1 }
}
```
`Order` shape:
```json
{
  "id", "orderNumber", "status",
  "customer": { "id", "name", "email", "phone", "type" },
  "currency": "USD",
  "amounts": { "subtotal", "shippingFee", "taxAmount", "discountAmount", "total" },
  "payment": { "provider": "manual" | "stripe", "reference": "…" | null, "paidAt": "ISO" | null },
  "shipping": { "carrier": "UPS" | null, "trackingNumber": "…" | null,
                "processingAt": "ISO" | null, "shippedAt": "ISO" | null,
                "deliveredAt": "ISO" | null },
  "addresses": { "shipping": Address | null, "billing": Address | null },
  "customerNote", "internalNote",
  "cancellation": { "cancelledAt": "ISO", "reason": "…" } | null,
  "refund": { "refundedAt": "ISO", "amount": "30.99", "reason": "…" } | null,
  "items": [ { "id", "productId", "variantId", "sku", "name",
               "unitPrice", "quantity", "lineTotal" } ],
  "timeline": [ { "status": "PLACED" | "PAID" | "PROCESSING" | "SHIPPED"
                            | "DELIVERED" | "CANCELLED" | "REFUNDED",
                  "at": "ISO" } ],
  "createdAt", "updatedAt"
}
```
`Address`: `{ id, label, contactName, line1, line2, city, region, postalCode,
country, phone }`. `timeline` is sorted ascending and only contains events that
have actually happened — it is the canonical shape for a customer-facing tracking
view (see below).

### `GET /orders/:id`
`Order` plus `"auditTrail": [ { id, action, summary, actor, at, metadata } ]`.

### `PATCH /orders/:id`
Correct fulfilment metadata without a status change: `carrier`,
`trackingNumber`, `internalNote` (each nullable). `409` once the order is
`CANCELLED` or `REFUNDED`.

### `POST /orders/:id/process`  — `PAID` → `PROCESSING`
No body. Stamps `shipping.processingAt`.

### `POST /orders/:id/ship`  — `PAID`/`PROCESSING` → `SHIPPED`
Body: `{ carrier (required enum), trackingNumber (required), shippedAt? }`.
Stamps `shippedAt` (default now).

### `POST /orders/:id/deliver`  — `SHIPPED` → `DELIVERED`
Body: `{ deliveredAt? }` (default now).

### `POST /orders/:id/cancel`  — `PAID`/`PROCESSING` → `CANCELLED`
Body: `{ reason (required) }`. `409` once shipped — use `refund` instead.

### `POST /orders/:id/refund`  — `PAID`/`PROCESSING`/`SHIPPED`/`DELIVERED` → `REFUNDED`
Body: `{ amount?, reason (required) }`. `amount` defaults to the order total;
`400` if it is ≤ 0 or exceeds the total. Payment-gateway refund execution is
out of scope here (Phase 8 settings) — this records the decision + amount and
flips the status.

### Storefront order-tracking contract

The storefront owns its own customer-facing tracking endpoint; this is the field
set + semantics the admin app guarantees so both stay in sync:

| Field | Meaning for the customer view |
| ----- | ----------------------------- |
| `status` | One of `PAID, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED`. Show `PAID` as "Order confirmed". |
| `timeline[]` | Ordered `{ status, at }` events that have occurred — render as the progress stepper. Never contains a future step. |
| `shipping.carrier` + `shipping.trackingNumber` | Present from `SHIPPED` onward; build the carrier's tracking URL from these. `carrier` ∈ `USPS, UPS, FEDEX, DHL`. |
| `shipping.shippedAt` / `deliveredAt` | Timestamps for the "Shipped" / "Delivered" steps. |
| `cancellation.reason` / `refund.reason` + `refund.amount` | Safe to show the customer verbatim. `internalNote` is **staff-only — never expose it.** |
| `amounts.*` | Final captured amounts; do not recompute on the storefront. |

Status is admin-authoritative: the storefront should treat its local copy as a
cache and re-read on the tracking page. There is no webhook in this phase — poll
or re-fetch on view.

## Endpoints — Phase 6 (Customers)

`ORDER_MANAGER` (ADMIN implicit). **Read-only** — a unified retail + wholesale
directory. Customer records are written by the storefront (checkout) and the
Phase 3 application intake; this phase adds no write path.

### `GET /customers`
Query: `q` (first/last name, email, company), `type` (`retail` | `wholesale`),
`page`, `pageSize`, `sort` (`createdAt|-createdAt|name|-name|orders|-orders`,
default `-createdAt`).
```json
{
  "data": [ CustomerRow, ... ],
  "pagination": { ... },
  "typeCounts": { "RETAIL": 2, "WHOLESALE": 2 }
}
```
`CustomerRow`:
```json
{
  "id", "type": "RETAIL" | "WHOLESALE",
  "name", "firstName", "lastName", "email", "companyName", "phone",
  "wholesale": { "hasAccount": true, "status": "APPROVED" | null,
                 "unlocksWholesalePricing": true },
  "counts": { "orders": 5, "quotes": 0, "invoices": 0 },
  "createdAt", "updatedAt"
}
```

### `GET /customers/:id`
```json
{
  "id", "type", "name", "firstName", "lastName", "email", "companyName", "phone",
  "createdAt", "updatedAt",
  "wholesaleAccount": {
    "id", "status", "businessName", "unlocksWholesalePricing",
    "reviewedAt", "reviewedBy": { "id", "name" } | null
  } | null,
  "stats": {
    "orders", "quotes", "invoices", "openQuotes", "unpaidInvoices",
    "lifetimeSpend": "187.47",   // Σ total of PAID/PROCESSING/SHIPPED/DELIVERED orders
    "refundedTotal": "30.99", "refundedOrders": 1
  },
  "addresses": [ { "id", "label", "contactName", "line1", "line2", "city",
                   "region", "postalCode", "country", "phone",
                   "isDefaultShipping", "isDefaultBilling" } ],
  "recentOrders":   [ { "id", "orderNumber", "status", "total", "currency",
                        "placedAt", "carrier", "trackingNumber" } ],   // ≤ 10, newest first
  "recentQuotes":   [ { "id", "quoteNumber", "status", "total", "currency",
                        "createdAt", "validUntil" } ],
  "recentInvoices": [ { "id", "invoiceNumber", "status", "total", "currency",
                        "issueDate", "dueDate" } ]
}
```
`404` if the id is unknown. The `wholesaleAccount` block mirrors the Phase 3
gate; `unlocksWholesalePricing` is the single rule (`status === "APPROVED"`).

## Endpoints — Phase 7 (Content management)

Storefront-facing CMS copy staff edit without a deploy. **Reads** require any
authenticated staff member; **writes** require `CONTENT_EDITOR` (ADMIN implicit)
and append to `audit_logs`. `isPublished` gates storefront visibility (new rows
are created as **draft**); `position` orders the list on the site. The storefront
reads only `isPublished: true` rows.

### FAQs — `/content/faqs`
- `GET /content/faqs` — query: `q` (question/answer/category), `status`
  (`published` | `draft`), `page`, `pageSize`, `sort`
  (`position|-position|updatedAt|-updatedAt`, default `position`).
  ```json
  { "data": [ Faq ], "pagination": { ... }, "counts": { "published": 2, "draft": 1 } }
  ```
  `Faq`: `{ id, question, answer, category | null, position, isPublished, createdAt, updatedAt }`.
- `POST /content/faqs` — body: `question` (req), `answer` (req), `category?`,
  `position?` (default 0), `isPublished?` (default false). `201 { data: Faq }`.
- `PATCH /content/faqs/:id` — any subset of the above. `DELETE /content/faqs/:id` → `204`.

### Testimonials — `/content/testimonials`
Same list / counts / CRUD shape. `Testimonial`:
`{ id, authorName, authorTitle | null, quote, rating (1–5) | null, position, isPublished, createdAt, updatedAt }`.
Create requires `authorName` + `quote`.

### Recipes — `/content/recipes`
Same shape. `Recipe`:
```json
{ "id", "title", "slug", "summary" | null,
  "ingredients": [ "…" ], "steps": [ "…" ],
  "imageUrl" | null, "relatedProductIds": [ "<uuid>" ],
  "position", "isPublished", "createdAt", "updatedAt" }
```
`slug` is derived from `title` (unique, `-2`, `-3`… on collision) unless a `slug`
is supplied. `relatedProductIds` is a loose list the storefront resolves + links;
not an FK, so a deleted product simply drops out.

### Featured products — `/content/featured`
Ordered homepage selection — one row per featured `Product`.
- `GET /content/featured` — `{ "data": [ Featured ] }`, ordered by `position`.
  `Featured`:
  ```json
  { "id", "productId", "position", "note" | null, "createdAt", "updatedAt",
    "product": { "id", "name", "sku", "slug", "currency",
                 "retailPrice": "12.50" | null, "isPublished", "imageUrl" | null } }
  ```
- `POST /content/featured` — body: `{ productId (req), position?, note? }`.
  `position` defaults to the end. `404` if the product doesn't exist; `409` if it
  is already featured.
- `PATCH /content/featured/reorder` — body: `{ ids: [ "<featuredId>", … ] }` —
  the **full** ordered list; sets `position = index`. `400` unless `ids` lists
  every featured entry exactly once.
- `PATCH /content/featured/:id` — `{ position?, note? }`.
- `DELETE /content/featured/:id` → `204`.

`note` is an internal label (campaign / reason) and is **not** shown on the site.

## Endpoints — Phase 8 (Settings & reporting)

**ADMIN only** (403 for `ORDER_MANAGER` / `CONTENT_EDITOR`). This is where the
revenue figures Phase 1 kept out of `/overview` live. All setting writes append
to `audit_logs`.

### Settings — `/settings`
- `GET /settings` — all four groups: `{ "data": { payments, shipping, tax, accounting } }`.
- `GET /settings/:group` — one group (`payments|shipping|tax|accounting`); `404` otherwise.

**`payments`** — `{ provider, online, publicKey | null, secretKeySet, testMode }`.
The Stripe **secret is write-only**: it is stored but never returned, only
`secretKeySet: boolean`. `online` is `false` while `PAYMENT_PROVIDER=manual`
(the default — collection is manual). `publicKey` falls back to the
`STRIPE_PUBLISHABLE_KEY` env var when nothing is stored in Settings.
- `PATCH /settings/payments` — `{ publicKey?, secretKey?, testMode? }`. `secretKey: ""`
  clears the stored secret; omitting it leaves it unchanged.

**`shipping`** — `{ freeShippingThreshold: "75.00" | null, defaultFee: "8.00",
rules: [ { region, fee } ] }` (money as decimal strings).
- `PATCH /settings/shipping` — any subset; `rules` replaces the whole list.

**`tax`** — `{ defaultRate: 0.06, rules: [ { region, rate } ] }` (rate is a
fraction 0–1).
- `PATCH /settings/tax` — any subset; `rules` replaces the whole list.

**`accounting`** — `{ adapter, connected, autoSyncOnPayment, lastSyncAt,
lastSyncStatus, lastSyncSummary }`. `adapter` / `connected` reflect
`ACCOUNTING_ADAPTER` (env); the rest is stored.
- `PATCH /settings/accounting` — `{ autoSyncOnPayment? }`.

### `POST /accounting/sync`  — ADMIN
Manual trigger: pushes every `PAID` invoice not already `SYNCED` through the
configured accounting adapter (see Phase 4). Records the run on the `accounting`
settings group (`lastSyncAt` / `lastSyncStatus` = `success|partial|failed` /
`lastSyncSummary`).
```json
// no adapter configured (default):
{ "data": { "ran": false, "adapter": "noop", "reason": "…", "pending": 1, "synced": 0, "failed": 0 } }
// with an adapter:
{ "data": { "ran": true, "adapter": "…", "synced": 3, "failed": 0,
            "results": [ { "invoiceNumber", "ok", "error": null } ] } }
```
Also runs automatically after `POST /invoices/:id/pay` (best-effort, per Phase 4).

### Reports — `/reports`  — ADMIN
`from` / `to` are `YYYY-MM-DD`; default window is the last 30 days.

- `GET /reports/summary?from=&to=`
  ```json
  {
    "range": { "from", "to" },
    "revenue": { "retailOrders", "wholesaleOrders", "wholesaleInvoices", "total" },
    "byChannel": { "retail": "…",       // retail = paid retail orders
                   "wholesale": "…" },  // wholesale = paid wholesale orders + paid invoices
    "orders": { "count", "avgOrderValue" },
    "refunds": { "count", "total" },
    "invoices": { "paid", "paidTotal", "outstanding", "outstandingTotal" },
    "quotes": { "sent", "approved", "converted", "conversionRate" },
    "series": [ { "period": "2026-08", "retail", "wholesale", "total" } ]   // monthly, ascending
  }
  ```
  "Retail" revenue = `Order.total` for active-status orders (`PAID/PROCESSING/
  SHIPPED/DELIVERED`) placed by `RETAIL` customers in range; "wholesale" adds
  `WHOLESALE`-customer orders plus `PAID` invoices (by `paidAt`). `outstanding`
  invoices are a live snapshot, not range-bound.

- `GET /reports/top-products?from=&to=&limit=` (limit ≤ 50, default 10)
  ```json
  { "range": { … },
    "products": [ { "productId": "…" | null, "sku", "name", "unitsSold", "revenue" } ] }
  ```
  Aggregated from `OrderItem` only — invoice lines aren't product-linked, so
  wholesale-via-invoice sales don't appear here.

---

## Public (storefront) API — `/api/v1/public`

Unauthenticated. No bearer token, no cookies. Intended for the customer-facing
storefront (`Tarantulla-Co/tomah`), which is a pure client — it never touches
the database directly (see `docs/DATA_MODEL.md`).

- The storefront origin(s) must be added to `CORS_ORIGINS`.
- **Pricing visibility:** these endpoints only ever return `retailPrice`.
  `wholesalePrice`, `minimumOrderQuantity`, `isWholesaleAvailable` are stripped
  at the serializer and never sent to an anonymous caller.
- Only `isPublished` catalogue/CMS rows are returned; products additionally
  require `isRetailAvailable`.
- Money fields are decimal strings. The error envelope is the standard
  `{ error: { code, message, details? } }`. `RATE_LIMITED` (429) is returned
  when the per-IP throttle trips (120 req/min overall; 8 req/min on writes).
- Every write carries a hidden `botField` honeypot that must be empty (a
  non-empty value fails validation, 422).
- All writes append to `audit_logs` with `actorId = null` (system).

### Reads

#### `GET /public/products`
Query: `q`, `category` (enum), `page`, `pageSize` (≤ 48, default 24),
`sort` (`newest|name|-name|price|-price`, default `newest`).
```json
{
  "data": [ ProductSummary, ... ],
  "pagination": { "page", "pageSize", "total", "pageCount" },
  "categoryCounts": { "POULTRY": 3, "MAPLE_PRODUCTS": 8, ... }
}
```
`ProductSummary`:
```json
{ "id", "slug", "sku", "name", "category", "shortDescription", "currency",
  "retailPrice": "12.00" | null, "countryOfOrigin", "certifications": [ ... ],
  "inStock": true, "stockQuantity": 42,
  "image": { "url", "altText" } | null }
```
`stockQuantity` is advisory for display only — re-checked at checkout.

#### `GET /public/products/:slug`
`404` if the product is not published / not retail-available. Returns
`ProductSummary` plus:
```json
{ "barcode", "longDescription", "updatedAt",
  "images": [ { "url", "altText", "isPrimary", "position" } ],
  "variants": [ { "id", "name", "sku", "retailPrice": "…" | null,
                  "weightGrams", "inStock", "stockQuantity" } ] }
```
Only `isActive` variants are included; a variant with no `retailPrice` falls
back to the product's.

#### `GET /public/content/faqs`
`{ "data": [ { "id", "question", "answer", "category" } ] }` — published only,
ordered by `position`.

#### `GET /public/content/testimonials`
`{ "data": [ { "id", "authorName", "authorTitle", "quote", "rating" } ] }`.

#### `GET /public/content/recipes`
`{ "data": [ { "id", "slug", "title", "summary", "imageUrl" } ] }`.

#### `GET /public/content/recipes/:slug`
`404` if not published.
```json
{ "data": { "id", "slug", "title", "summary",
            "ingredients": [ ... ], "steps": [ ... ], "imageUrl",
            "relatedProducts": [ ProductSummary, ... ] } }
```
`relatedProducts` resolves `Recipe.relatedProductIds` against the published
retail catalogue (missing / unpublished ids just drop out).

#### `GET /public/content/featured`
`{ "data": [ { "position", "product": ProductSummary } ] }` — ordered; entries
whose product is unpublished / not retail-available are omitted. The internal
`note` is never exposed.

#### `GET /public/orders/:orderNumber?email=<email>`
Order tracking. `email` (query, required) must match the order's customer.
`404` — with the same message — whether the number is unknown or the email
does not match (existence is not confirmed to someone who cannot supply the
email). `internalNote` is never included.
```json
{ "data": {
  "orderNumber", "status", "placedAt", "updatedAt",
  "amounts": { "currency", "subtotal", "shippingFee", "taxAmount",
               "discountAmount", "total" },
  "payment": { "provider", "reference": "…" | null, "paidAt": "ISO" | null },
  "shipping": { "carrier": "UPS" | null, "trackingNumber": "…" | null,
                "processingAt", "shippedAt", "deliveredAt" },
  "shippingAddress": { "contactName", "line1", "line2", "city", "region",
                       "postalCode", "country", "phone" } | null,
  "items": [ { "sku", "name", "unitPrice", "quantity", "lineTotal" } ],
  "cancellation": { "cancelledAt", "reason" } | null,
  "refund": { "refundedAt", "amount", "reason" } | null,
  "timeline": [ { "status": "PLACED"|"PAID"|"PROCESSING"|"SHIPPED"
                            |"DELIVERED"|"CANCELLED"|"REFUNDED", "at": "ISO" } ]
} }
```
`status` is admin-authoritative; re-fetch on view. A `PENDING_PAYMENT` order
has only the `PLACED` timeline event.

### Writes

#### `POST /public/checkout`  → `201`
Body:
```json
{
  "botField": "",
  "customer": { "email", "firstName", "lastName", "phone?" },
  "shippingAddress": { "contactName", "line1", "line2?", "city", "region",
                       "postalCode", "country?"="US", "phone?" },
  "billingAddress": { ... } | omitted,
  "items": [ { "productId", "variantId?", "quantity" } ],   // 1..100
  "currency": "USD",
  "customerNote": "…" | null
}
```
The server re-validates every line against the published catalogue, re-checks
stock (`409 CONFLICT` with `{ available }` in `details` if short), computes
`subtotal` / `shippingFee` / `taxAmount` / `total` from the `shipping` + `tax`
settings groups, upserts the `Customer` (RETAIL) by email, writes the
`Address` rows, and creates the `Order` as **`PENDING_PAYMENT`** + its
`OrderItem`s (price/name/sku snapshotted). `orderNumber` is minted here.
```json
{ "data": {
  "orderNumber", "status": "PENDING_PAYMENT",
  "amounts": { "currency", "subtotal", "shippingFee", "taxAmount",
               "discountAmount", "total" },
  "payment": {
    "provider", "online": false, "reference",   // reference === orderNumber
    "publicKey": null,                          // Stripe publishable key when PAYMENT_PROVIDER=stripe
    "clientSecret": null,                       // Stripe PaymentIntent client secret
    "authorizationUrl": null,                   // unused by Stripe/manual
    "devConfirmPath": "/public/checkout/<orderNumber>/confirm-dev" | null  // manual + non-prod only
  }
} }
```
`400 BAD_REQUEST` if a line is unavailable / unpriced.

#### `POST /public/checkout/:reference/confirm-dev`
**Non-production only** (`404` when the payment provider does live collection
or `NODE_ENV=production`). Simulates payment success: decrements stock and
flips `PENDING_PAYMENT → PAID`. Returns the same shape as
`GET /public/orders/:orderNumber`. Idempotent — a second call on an
already-paid order returns `{ data, alreadyProcessed: true }`.

#### `POST /public/payments/stripe/webhook`
Stripe calls this. Verifies the `Stripe-Signature` header over the raw body
(`STRIPE_WEBHOOK_SECRET`), and on `payment_intent.succeeded` does the same
stock-decrement + `PENDING_PAYMENT → PAID` transition keyed by the
PaymentIntent's `metadata.reference` (the order number). `501` when
`PAYMENT_PROVIDER=manual`. Always answers `200 { received: true }` for events it
recognises so Stripe does not retry; a bad signature is the only `400`.

#### `POST /public/quotes`  → `201`
Body:
```json
{ "botField": "",
  "company": "…" | null,
  "contact": { "email", "firstName", "lastName", "phone?" },
  "items": [ { "productId?", "variantId?", "description?", "quantity", "note?" } ],
  "message": "…" | null }
```
Upserts a `WHOLESALE` `Customer` and creates a `Quote` in status
**`REQUESTED`** with unpriced line items (`description` falls back to the
product name). Staff pick it up in the admin quote queue.
`400` if a supplied `productId` no longer exists.
```json
{ "data": { "quoteNumber", "status": "REQUESTED" } }
```

#### `POST /public/wholesale-applications`  → `201`
Body: `botField` + the same fields as the admin intake
(`firstName`, `lastName`, `email`, `phone?`, `businessName`,
`businessRegistrationNumber?`, `taxId?`, `businessType?`, `website?`,
`estimatedMonthlyVolume?`, `applicationNotes?`).
Upserts a `WHOLESALE` `Customer` and creates a `WholesaleAccount` in status
**`PENDING`**. `409 CONFLICT` if an application for that email already exists.
```json
{ "data": { "status": "PENDING" } }
```
