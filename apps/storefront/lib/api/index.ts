import { mockApi } from './mock';
import type {
  CatalogueResponse, Category, Faq, FeaturedProduct, ImageAsset, OrderCreateRequest,
  OrderCreateResponse, OrderTrackingResponse, ProductDetail, ProductSummary, ProductVariant,
  QuoteCreateRequest, QuoteCreateResponse, RecipeDetail, RecipeSummary, Testimonial,
  WholesaleApplicationRequest, WholesaleApplicationResponse,
} from './types';
export * from './types';

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

const mode = () =>
  typeof document !== 'undefined'
    ? (document.documentElement.dataset.apiMode === 'live' ? 'live' : 'mock')
    : (process.env.TOMAH_API_MODE === 'live' ? 'live' : 'mock');

const base = () => {
  const value = process.env.TOMAH_API_BASE_URL?.replace(/\/$/, '');
  if (!value) throw new ApiError('CONFIG_ERROR', 'TOMAH_API_BASE_URL is required in live mode.', 500);
  return value;
};

/** Low-level fetch. Server-side hits the API directly; in the browser it goes
 *  through the same-origin proxy (app/api/storefront/public/[...path]). */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const target = typeof window === 'undefined' ? `${base()}${path}` : `/api/storefront${path}`;
  const response = await fetch(target, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    // Only set `cache` for non-GET (no-store). The Workers/vinext runtime this
    // app deploys to rejects the literal "default" cache mode Next accepts, so
    // GETs must omit the option entirely rather than spell out the default.
    ...(init?.method && init.method !== 'GET' ? { cache: 'no-store' as const } : {}),
  });
  if (!response.ok) {
    let body: any = {};
    try { body = await response.json(); } catch {}
    throw new ApiError(
      body.error?.code || 'INTERNAL_ERROR',
      body.error?.message || 'The request failed.',
      response.status,
      body.error?.details,
    );
  }
  return response.json() as Promise<T>;
}

export async function forwardPublicRequest(request: Request, path: string[]) {
  const target = `${base()}/public/${path.map(encodeURIComponent).join('/')}${new URL(request.url).search}`;
  const headers = new Headers();
  headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');
  const key = request.headers.get('Idempotency-Key');
  if (key) headers.set('Idempotency-Key', key);
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
    cache: 'no-store',
  });
  // Re-wrap: a raw fetch() Response carries immutable Headers in this runtime,
  // and vinext's RSC route finalizer mutates response headers (e.g. Vary),
  // which throws ("Can't modify immutable headers") if we return it directly.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: new Headers(upstream.headers),
  });
}

/* ------------------------- admin API -> storefront types ------------------- */
// The admin API (apps/api /api/v1/public/*) is authoritative. These map its
// responses onto the shapes the storefront components consume (see ./types).

// Falls back for a product with no image row yet — an existing local asset, so
// no next/image remote-pattern or SVG allowance is needed.
const PLACEHOLDER_IMAGE = '/images/maple/syrup.png';
const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] || full, lastName: parts.slice(1).join(' ') || parts[0] || full };
};
const img = (i: { url: string; altText?: string | null } | null | undefined, alt: string, position = 0): ImageAsset =>
  ({ url: i?.url || PLACEHOLDER_IMAGE, alt: i?.altText || alt, position });

function mapSummary(p: any): ProductSummary {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription ?? '',
    category: p.category as Category,
    image: img(p.image, p.name),
    priceFrom: p.retailPrice ?? '0.00',
    currency: p.currency ?? 'USD',
    inStock: Boolean(p.inStock),
  };
}

function mapDetail(p: any): ProductDetail {
  const currency = p.currency ?? 'USD';
  const variants: ProductVariant[] = Array.isArray(p.variants) && p.variants.length
    ? p.variants.map((v: any) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        price: v.retailPrice ?? p.retailPrice ?? '0.00',
        currency,
        stockQuantity: v.stockQuantity ?? 0,
        available: Boolean(v.inStock),
      }))
    // No variants on the product -> synthesize one so the buy flow works. Its id
    // equals the product id, which createOrder() detects and sends as a bare
    // productId (no variantId) to the API.
    : [{
        id: p.id,
        name: 'Standard',
        sku: p.sku ?? p.slug,
        price: p.retailPrice ?? '0.00',
        currency,
        stockQuantity: p.stockQuantity ?? 0,
        available: Boolean(p.inStock),
      }];
  return {
    ...mapSummary(p),
    description: p.longDescription ?? p.shortDescription ?? '',
    countryOfOrigin: p.countryOfOrigin ?? '',
    certifications: p.certifications ?? [],
    images: Array.isArray(p.images) && p.images.length
      ? p.images.map((i: any, n: number) => img(i, p.name, i.position ?? n))
      : [img(p.image, p.name)],
    variants,
  };
}

const liveApi = {
  async listProducts(params: { category?: Category; q?: string; page?: number; pageSize?: number; sort?: string } = {}): Promise<CatalogueResponse> {
    const sortMap: Record<string, string> = { name: 'name', 'price-asc': 'price', 'price-desc': '-price' };
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.q) qs.set('q', params.q);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params.sort && sortMap[params.sort]) qs.set('sort', sortMap[params.sort]);
    const r = await request<{ data: any[]; pagination: { page: number; pageSize: number; total: number }; categoryCounts: Record<string, number> }>(`/public/products?${qs}`);
    return {
      items: r.data.map(mapSummary),
      page: r.pagination.page,
      pageSize: r.pagination.pageSize,
      total: r.pagination.total,
      categoryCounts: r.categoryCounts as Record<Category, number>,
    };
  },
  async getProduct(slug: string): Promise<ProductDetail> {
    const r = await request<{ data: any }>(`/public/products/${encodeURIComponent(slug)}`);
    return mapDetail(r.data);
  },
  async getFaqs(): Promise<{ items: Faq[] }> {
    const r = await request<{ data: any[] }>('/public/content/faqs');
    return { items: r.data.map((f, n) => ({ id: f.id, question: f.question, answer: f.answer, position: n })) };
  },
  async getTestimonials(): Promise<{ items: Testimonial[] }> {
    const r = await request<{ data: any[] }>('/public/content/testimonials');
    return { items: r.data.map((t) => ({ id: t.id, quote: t.quote, name: t.authorName, company: t.authorTitle ?? '' })) };
  },
  async getRecipes(): Promise<{ items: RecipeSummary[] }> {
    const r = await request<{ data: any[] }>('/public/content/recipes');
    return { items: r.data.map((x) => ({ id: x.id, slug: x.slug, title: x.title, excerpt: x.summary ?? '', image: img(x.imageUrl ? { url: x.imageUrl } : null, x.title) })) };
  },
  async getRecipe(slug: string): Promise<RecipeDetail> {
    const r = await request<{ data: any }>(`/public/content/recipes/${encodeURIComponent(slug)}`);
    const x = r.data;
    return {
      id: x.id, slug: x.slug, title: x.title, excerpt: x.summary ?? '',
      image: img(x.imageUrl ? { url: x.imageUrl } : null, x.title),
      ingredients: x.ingredients ?? [], instructions: x.steps ?? [],
      relatedProductIds: (x.relatedProducts ?? []).map((p: any) => p.id),
    };
  },
  async getFeatured(): Promise<{ items: FeaturedProduct[] }> {
    const r = await request<{ data: any[] }>('/public/content/featured');
    return { items: r.data.map((f, n) => ({ id: `featured-${f.position ?? n}`, position: f.position ?? n, product: mapSummary(f.product) })) };
  },
  async createOrder(body: OrderCreateRequest, key = crypto.randomUUID()): Promise<OrderCreateResponse> {
    const name = splitName(body.customer.name);
    const addr = (a: OrderCreateRequest['shippingAddress']) => ({
      contactName: body.customer.name, line1: a.line1, line2: a.line2 || null,
      city: a.city, region: a.region, postalCode: a.postalCode,
      country: (a.country || 'US').length === 2 ? a.country : 'US',
    });
    const payload = {
      customer: { email: body.customer.email, firstName: name.firstName, lastName: name.lastName, phone: body.customer.phone || null },
      shippingAddress: addr(body.shippingAddress),
      ...(body.billingAddress ? { billingAddress: addr(body.billingAddress) } : {}),
      items: body.items.map((i) => ({
        productId: i.productId,
        ...(i.variantId && i.variantId !== i.productId ? { variantId: i.variantId } : {}),
        quantity: i.quantity,
      })),
      currency: body.currency,
    };
    const r = await request<{ data: any }>('/public/checkout', {
      method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(payload),
    });
    const d = r.data;
    return {
      orderNumber: d.orderNumber,
      status: 'PENDING_PAYMENT',
      amounts: {
        subtotal: d.amounts.subtotal, shipping: d.amounts.shippingFee ?? d.amounts.shipping ?? '0.00',
        tax: d.amounts.taxAmount ?? d.amounts.tax ?? '0.00', total: d.amounts.total, currency: d.amounts.currency,
      },
      payment: {
        provider: d.payment.provider, online: Boolean(d.payment.online), reference: d.payment.reference,
        publicKey: d.payment.publicKey ?? null, clientSecret: d.payment.clientSecret ?? null,
        authorizationUrl: d.payment.authorizationUrl ?? null, devConfirmPath: d.payment.devConfirmPath ?? null,
      },
    };
  },
  async trackOrder(number: string, email: string): Promise<OrderTrackingResponse> {
    const r = await request<{ data: any }>(`/public/orders/${encodeURIComponent(number)}?email=${encodeURIComponent(email)}`, { cache: 'no-store' });
    const o = r.data;
    return {
      orderNumber: o.orderNumber, status: o.status, placedAt: o.placedAt,
      paidAt: o.payment?.paidAt ?? undefined, processingAt: o.shipping?.processingAt ?? undefined,
      shippedAt: o.shipping?.shippedAt ?? undefined, deliveredAt: o.shipping?.deliveredAt ?? undefined,
      cancelledAt: o.cancellation?.cancelledAt ?? undefined, refundedAt: o.refund?.refundedAt ?? undefined,
      carrier: o.shipping?.carrier ?? undefined, trackingNumber: o.shipping?.trackingNumber ?? undefined,
      items: (o.items ?? []).map((it: any) => ({ productName: it.name, quantity: it.quantity })),
      amounts: {
        subtotal: o.amounts.subtotal, shipping: o.amounts.shippingFee ?? '0.00',
        tax: o.amounts.taxAmount ?? '0.00', total: o.amounts.total, currency: o.amounts.currency,
      },
    };
  },
  async createQuote(body: QuoteCreateRequest): Promise<QuoteCreateResponse> {
    const name = splitName(body.contact.name);
    const payload = {
      company: body.company || null,
      contact: { email: body.contact.email, firstName: name.firstName, lastName: name.lastName, phone: body.contact.phone || null },
      items: body.items.map((i) => ({
        ...(i.productId && /^[0-9a-f-]{36}$/i.test(i.productId) ? { productId: i.productId } : { description: i.productId || 'Requested item' }),
        quantity: i.quantity,
        ...(i.note ? { note: i.note } : {}),
      })),
      ...(body.message ? { message: body.message } : {}),
    };
    const r = await request<{ data: { quoteNumber: string; status: 'REQUESTED' } }>('/public/quotes', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },
  async createWholesaleApplication(body: WholesaleApplicationRequest): Promise<WholesaleApplicationResponse> {
    const name = splitName(body.contact.name);
    const payload = {
      firstName: name.firstName, lastName: name.lastName, email: body.contact.email,
      phone: body.contact.phone || null, businessName: body.businessName,
      taxId: body.taxId || null, website: body.website || null,
      businessType: body.businessType || null,
      estimatedMonthlyVolume: body.estimatedMonthlyVolume || null,
      applicationNotes: [body.message, body.address ? `Address: ${[body.address.line1, body.address.city, body.address.region, body.address.postalCode, body.address.country].filter(Boolean).join(', ')}` : '']
        .filter(Boolean).join('\n') || null,
    };
    const r = await request<{ data: { status: 'PENDING' } }>('/public/wholesale-applications', { method: 'POST', body: JSON.stringify(payload) });
    return r.data;
  },
};

/** Confirm a PENDING_PAYMENT order when PAYMENT_PROVIDER=manual (non-prod only).
 *  Stripe orders are confirmed by the webhook after Stripe.js confirmPayment. */
export async function devConfirmOrder(devConfirmPath: string): Promise<void> {
  await request(devConfirmPath, { method: 'POST' });
}

// Dispatch per call so SSR (default mock) and the browser (data-api-mode) agree
// with whatever the runtime is configured for.
const pick = <K extends keyof typeof liveApi>(k: K): (typeof liveApi)[K] =>
  (mode() === 'live' ? liveApi[k] : (mockApi as any)[k]);

export const api = {
  listProducts: ((p: any) => pick('listProducts')(p)) as (typeof liveApi)['listProducts'],
  getProduct: ((s: string) => pick('getProduct')(s)) as (typeof liveApi)['getProduct'],
  getFaqs: (() => pick('getFaqs')()) as (typeof liveApi)['getFaqs'],
  getTestimonials: (() => pick('getTestimonials')()) as (typeof liveApi)['getTestimonials'],
  getRecipes: (() => pick('getRecipes')()) as (typeof liveApi)['getRecipes'],
  getRecipe: ((s: string) => pick('getRecipe')(s)) as (typeof liveApi)['getRecipe'],
  getFeatured: (() => pick('getFeatured')()) as (typeof liveApi)['getFeatured'],
  createOrder: ((b: OrderCreateRequest, k?: string) => pick('createOrder')(b, k as string)) as (typeof liveApi)['createOrder'],
  trackOrder: ((n: string, e: string) => pick('trackOrder')(n, e)) as (typeof liveApi)['trackOrder'],
  createQuote: ((b: QuoteCreateRequest) => pick('createQuote')(b)) as (typeof liveApi)['createQuote'],
  createWholesaleApplication: ((b: WholesaleApplicationRequest) => pick('createWholesaleApplication')(b)) as (typeof liveApi)['createWholesaleApplication'],
};
