# Tomah storefront handover

The storefront is a pure API client. It has no database, ORM, identifier generator, payment secret, or authoritative total calculation. `TOMAH_API_MODE=mock` is the safe default.

## Public endpoints called

All live calls use `TOMAH_API_BASE_URL` and the types in `lib/api/types.ts`.

| Call | Implemented request / response |
|---|---|
| `GET /public/products` | Query `{ category?, q?, page?, pageSize?, sort? }`; `CatalogueResponse` |
| `GET /public/products/:slug` | `ProductDetail` |
| `GET /public/content/faqs` | `{ items: Faq[] }` |
| `GET /public/content/testimonials` | `{ items: Testimonial[] }` |
| `GET /public/content/recipes` | `{ items: RecipeSummary[] }` |
| `GET /public/content/recipes/:slug` | `RecipeDetail` |
| `GET /public/content/featured` | `{ items: FeaturedProduct[] }` |
| `POST /public/orders` | `OrderCreateRequest` → `OrderCreateResponse`; includes `Idempotency-Key` |
| `GET /public/orders/:orderNumber?email=` | `OrderTrackingResponse` |
| `POST /public/quotes` | `QuoteCreateRequest` → `QuoteCreateResponse` |
| `POST /public/wholesale-applications` | `WholesaleApplicationRequest` → `WholesaleApplicationResponse` |

There are no intentional endpoint deviations. Exact fields live in `lib/api/types.ts`. Live browser writes and tracking reads pass through `/api/storefront/public/*`, a transparent Worker-compatible fetch proxy that adds no business logic and keeps deployment configuration out of the client bundle.

## Environment

- `TOMAH_API_BASE_URL`: admin API root including `/api/v1`; required in live mode.
- `TOMAH_API_MODE`: `mock` or `live`; defaults to `mock`.
- `TOMAH_PUBLIC_SITE_URL`: canonical storefront origin for metadata, sitemap and callbacks.

Run the demo with `TOMAH_API_MODE=mock npm run dev`. Flip to live by setting `TOMAH_API_MODE=live` and `TOMAH_API_BASE_URL` in the Worker environment.

## Build and deployment

- Node: `>=22.13.0`
- Build: `npm run build`
- Worker entry: `dist/server/index.js`
- Worker config: `dist/server/wrangler.json`
- Client assets: `dist/client`

The Worker needs outbound HTTPS access to the API. There are no D1 or R2 bindings and no raw TCP access.

## Origins and payments

Current intended origin: `https://tomah-international.tarantulla-co.chatgpt.site`. Add the final custom production origin when known. The browser integration uses a same-origin proxy.

Paystack callback path: `/checkout/callback`. Whitelist `${TOMAH_PUBLIC_SITE_URL}/checkout/callback`. The browser never marks an order paid; it re-fetches order status after the API receives Paystack's webhook.

## Secret check

The source and client assets contain no Paystack secret key. The only payment key accepted by storefront types is `payment.publicKey` from `POST /public/orders`. `TOMAH_API_BASE_URL` is not a `NEXT_PUBLIC_*` variable.

## Open contract questions

1. Confirm real retail prices, stock, product IDs, SKUs and image URLs to replace mock fixtures.
2. Confirm the exact wholesale-application body; the brief says “business details + contact” but does not define every field.
3. Confirm whether Paystack's `authorizationUrl` includes the callback URL, and how the callback receives `orderNumber` plus email for status lookup.
4. Confirm production delivery/returns language, tax display, supported checkout countries and currencies.
5. Confirm whether public stock should be an exact quantity or a boolean/label.
