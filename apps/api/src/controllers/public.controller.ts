import type { Request, Response } from "express";
import { prisma, Prisma } from "@tomah/db";
import { HttpError } from "../lib/http-error.js";
import { writeAudit } from "../lib/audit.js";
import { lineTotal } from "../lib/money.js";
import { nextOrderNumber, nextQuoteNumber } from "../lib/numbering.js";
import { computeOrderTotals } from "../lib/checkout/pricing.js";
import { payments } from "../lib/payments/index.js";
import { readGroup, type PaymentsSettings } from "../lib/settings.js";
import { env } from "../config/env.js";
import { PRODUCT_CATEGORIES } from "../validators/product.schema.js";
import type {
  CheckoutInput,
  PublicAddressInput,
  PublicListProductsQuery,
  PublicQuoteInput,
  PublicWholesaleApplicationInput,
  TrackOrderQuery,
} from "../validators/public.schema.js";

/**
 * Unauthenticated storefront API. Everything here is safe for anonymous
 * callers:
 *   • reads expose only published catalogue + CMS rows, retail pricing only —
 *     wholesalePrice / minimumOrderQuantity / isWholesaleAvailable are NEVER
 *     serialized (docs/DATA_MODEL.md, "Pricing visibility").
 *   • writes create the same rows the data model reserves for the storefront
 *     (Customer, Address, Order, Quote, WholesaleAccount) and hand every status
 *     transition back to the admin API.
 */

/* ------------------------------ serialization ---------------------------- */

type Decimalish = Prisma.Decimal | null;
const dec = (v: Decimalish) => (v == null ? null : v.toString());

const imgSort = (
  a: { isPrimary: boolean; position: number },
  b: { isPrimary: boolean; position: number },
) => Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position;

const PRODUCT_SUMMARY_WITH = { include: { images: true } } satisfies Prisma.ProductDefaultArgs;
const PRODUCT_DETAIL_WITH = {
  include: { images: true, variants: true },
} satisfies Prisma.ProductDefaultArgs;
type ProductSummaryRow = Prisma.ProductGetPayload<typeof PRODUCT_SUMMARY_WITH>;
type ProductDetailRow = Prisma.ProductGetPayload<typeof PRODUCT_DETAIL_WITH>;

function publicProductSummary(p: ProductSummaryRow) {
  const primary = [...p.images].sort(imgSort)[0];
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    category: p.category,
    shortDescription: p.shortDescription,
    currency: p.currency,
    retailPrice: dec(p.retailPrice),
    countryOfOrigin: p.countryOfOrigin,
    certifications: p.certifications,
    inStock: p.stockQuantity > 0,
    // Advisory only — the storefront re-checks at checkout (docs/DATA_MODEL.md).
    stockQuantity: Math.max(0, p.stockQuantity),
    image: primary ? { url: primary.url, altText: primary.altText } : null,
  };
}

function publicProductDetail(p: ProductDetailRow) {
  return {
    ...publicProductSummary(p),
    barcode: p.barcode,
    longDescription: p.longDescription,
    updatedAt: p.updatedAt,
    images: [...p.images].sort(imgSort).map((i) => ({
      url: i.url,
      altText: i.altText,
      isPrimary: i.isPrimary,
      position: i.position,
    })),
    variants: [...p.variants]
      .filter((v) => v.isActive)
      .sort((a, b) => a.position - b.position)
      .map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        retailPrice: dec(v.retailPrice ?? p.retailPrice),
        weightGrams: v.weightGrams,
        inStock: v.stockQuantity > 0,
        stockQuantity: Math.max(0, v.stockQuantity),
      })),
  };
}

const PUBLISHED_RETAIL: Prisma.ProductWhereInput = { isPublished: true, isRetailAvailable: true };

/* --------------------------------- orders ----------------------------- */

const ORDER_WITH = {
  include: {
    customer: { select: { email: true } },
    items: { orderBy: { sku: "asc" } },
    shippingAddress: true,
    billingAddress: true,
  },
} satisfies Prisma.OrderDefaultArgs;
type OrderRow = Prisma.OrderGetPayload<typeof ORDER_WITH>;

function publicAddr(a: NonNullable<OrderRow["shippingAddress"]>) {
  return {
    contactName: a.contactName,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    region: a.region,
    postalCode: a.postalCode,
    country: a.country,
    phone: a.phone,
  };
}

function amountsOf(o: OrderRow) {
  return {
    currency: o.currency,
    subtotal: dec(o.subtotal),
    shippingFee: dec(o.shippingFee),
    taxAmount: dec(o.taxAmount),
    discountAmount: dec(o.discountAmount),
    total: dec(o.total),
  };
}

/** Chronological, "events that have happened" list — the tracking stepper. */
function buildPublicTimeline(o: OrderRow) {
  const events: Array<{ status: string; at: Date }> = [{ status: "PLACED", at: o.createdAt }];
  if (o.paidAt) events.push({ status: "PAID", at: o.paidAt });
  if (o.processingAt) events.push({ status: "PROCESSING", at: o.processingAt });
  if (o.shippedAt) events.push({ status: "SHIPPED", at: o.shippedAt });
  if (o.deliveredAt) events.push({ status: "DELIVERED", at: o.deliveredAt });
  if (o.cancelledAt) events.push({ status: "CANCELLED", at: o.cancelledAt });
  if (o.refundedAt) events.push({ status: "REFUNDED", at: o.refundedAt });
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Customer-facing order view. `internalNote` is intentionally absent. */
function publicOrderView(o: OrderRow) {
  return {
    orderNumber: o.orderNumber,
    status: o.status,
    placedAt: o.createdAt,
    updatedAt: o.updatedAt,
    amounts: amountsOf(o),
    payment: { provider: o.paymentProvider, reference: o.paymentReference, paidAt: o.paidAt },
    shipping: {
      carrier: o.carrier,
      trackingNumber: o.trackingNumber,
      processingAt: o.processingAt,
      shippedAt: o.shippedAt,
      deliveredAt: o.deliveredAt,
    },
    shippingAddress: o.shippingAddress ? publicAddr(o.shippingAddress) : null,
    items: o.items.map((it) => ({
      sku: it.sku,
      name: it.name,
      unitPrice: dec(it.unitPrice),
      quantity: it.quantity,
      lineTotal: dec(it.lineTotal),
    })),
    cancellation: o.cancelledAt ? { cancelledAt: o.cancelledAt, reason: o.cancelReason } : null,
    refund: o.refundedAt
      ? { refundedAt: o.refundedAt, amount: dec(o.refundAmount), reason: o.refundReason }
      : null,
    timeline: buildPublicTimeline(o),
  };
}

function addressCreateData(a: PublicAddressInput) {
  return {
    contactName: a.contactName,
    line1: a.line1,
    line2: a.line2 ?? null,
    city: a.city,
    region: a.region,
    postalCode: a.postalCode,
    country: a.country,
    phone: a.phone ?? null,
  };
}

/* ============================== CATALOGUE ============================= */

export async function listPublicProducts(req: Request, res: Response) {
  const q = req.query as unknown as PublicListProductsQuery;

  const where: Prisma.ProductWhereInput = { ...PUBLISHED_RETAIL };
  if (q.category) where.category = q.category;
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: "insensitive" } },
      { shortDescription: { contains: q.q, mode: "insensitive" } },
      { longDescription: { contains: q.q, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    q.sort === "name"
      ? { name: "asc" }
      : q.sort === "-name"
        ? { name: "desc" }
        : q.sort === "price"
          ? { retailPrice: "asc" }
          : q.sort === "-price"
            ? { retailPrice: "desc" }
            : { createdAt: "desc" };

  const [total, rows, categoryGroups] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      ...PRODUCT_SUMMARY_WITH,
    }),
    prisma.product.groupBy({
      by: ["category"],
      where: PUBLISHED_RETAIL,
      _count: { _all: true },
    }),
  ]);

  const categoryCounts = Object.fromEntries(
    PRODUCT_CATEGORIES.map((c) => [c, 0]),
  ) as Record<string, number>;
  for (const g of categoryGroups) categoryCounts[g.category] = g._count._all;

  res.json({
    data: rows.map(publicProductSummary),
    pagination: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      pageCount: Math.ceil(total / q.pageSize),
    },
    categoryCounts,
  });
}

export async function getPublicProduct(req: Request<{ slug: string }>, res: Response) {
  const product = await prisma.product.findFirst({
    where: { slug: req.params.slug, ...PUBLISHED_RETAIL },
    ...PRODUCT_DETAIL_WITH,
  });
  if (!product) throw HttpError.notFound("Product not found");
  res.json({ data: publicProductDetail(product) });
}

/* =============================== CONTENT ============================== */

export async function listPublicFaqs(_req: Request, res: Response) {
  const rows = await prisma.faq.findMany({
    where: { isPublished: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  res.json({
    data: rows.map((f) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      category: f.category,
    })),
  });
}

export async function listPublicTestimonials(_req: Request, res: Response) {
  const rows = await prisma.testimonial.findMany({
    where: { isPublished: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  res.json({
    data: rows.map((t) => ({
      id: t.id,
      authorName: t.authorName,
      authorTitle: t.authorTitle,
      quote: t.quote,
      rating: t.rating,
    })),
  });
}

export async function listPublicRecipes(_req: Request, res: Response) {
  const rows = await prisma.recipe.findMany({
    where: { isPublished: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  res.json({
    data: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      imageUrl: r.imageUrl,
    })),
  });
}

export async function getPublicRecipe(req: Request<{ slug: string }>, res: Response) {
  const recipe = await prisma.recipe.findFirst({
    where: { slug: req.params.slug, isPublished: true },
  });
  if (!recipe) throw HttpError.notFound("Recipe not found");

  const related = recipe.relatedProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: recipe.relatedProductIds }, ...PUBLISHED_RETAIL },
        ...PRODUCT_SUMMARY_WITH,
      })
    : [];

  res.json({
    data: {
      id: recipe.id,
      slug: recipe.slug,
      title: recipe.title,
      summary: recipe.summary,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      imageUrl: recipe.imageUrl,
      relatedProducts: related.map(publicProductSummary),
    },
  });
}

export async function listPublicFeatured(_req: Request, res: Response) {
  const rows = await prisma.featuredProduct.findMany({
    where: { product: PUBLISHED_RETAIL },
    orderBy: { position: "asc" },
    include: { product: { ...PRODUCT_SUMMARY_WITH } },
  });
  res.json({
    data: rows.map((f) => ({
      position: f.position,
      product: publicProductSummary(f.product),
    })),
  });
}

/* ============================== CHECKOUT ============================= */

interface CheckoutLine {
  productId: string;
  variantId: string | null;
  sku: string;
  name: string;
  unitPrice: Prisma.Decimal;
  quantity: number;
  lineTotalValue: Prisma.Decimal;
}

export async function createCheckout(req: Request, res: Response) {
  const b = req.body as CheckoutInput;

  const productIds = [...new Set(b.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { variants: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: CheckoutLine[] = b.items.map((item) => {
    const product = byId.get(item.productId);
    if (!product || !product.isPublished || !product.isRetailAvailable) {
      throw HttpError.badRequest("A product in your cart is no longer available", {
        productId: item.productId,
      });
    }

    let unit: Prisma.Decimal | null;
    let sku: string;
    let name: string;
    let available: number;

    if (item.variantId) {
      const variant = product.variants.find((v) => v.id === item.variantId);
      if (!variant || !variant.isActive) {
        throw HttpError.badRequest("A selected option is no longer available", {
          productId: product.id,
          variantId: item.variantId,
        });
      }
      unit = variant.retailPrice ?? product.retailPrice;
      sku = variant.sku;
      name = `${product.name} — ${variant.name}`;
      available = variant.stockQuantity;
    } else {
      unit = product.retailPrice;
      sku = product.sku;
      name = product.name;
      available = product.stockQuantity;
    }

    if (unit == null) {
      throw HttpError.badRequest(`"${product.name}" is not available for retail purchase`, {
        productId: product.id,
      });
    }
    if (available < item.quantity) {
      throw new HttpError(
        409,
        `Only ${Math.max(0, available)} of "${name}" left in stock`,
        "CONFLICT",
        { productId: product.id, variantId: item.variantId ?? null, available: Math.max(0, available) },
      );
    }

    return {
      productId: product.id,
      variantId: item.variantId ?? null,
      sku,
      name,
      unitPrice: new Prisma.Decimal(unit),
      quantity: item.quantity,
      lineTotalValue: lineTotal(unit, item.quantity),
    };
  });

  const totals = await computeOrderTotals(
    lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
    { region: b.shippingAddress.region, country: b.shippingAddress.country },
  );

  const order = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { email: b.customer.email },
      update: {
        firstName: b.customer.firstName,
        lastName: b.customer.lastName,
        ...(b.customer.phone !== undefined ? { phone: b.customer.phone ?? null } : {}),
      },
      create: {
        type: "RETAIL",
        email: b.customer.email,
        firstName: b.customer.firstName,
        lastName: b.customer.lastName,
        phone: b.customer.phone ?? null,
      },
    });

    const shippingAddress = await tx.address.create({
      data: { customerId: customer.id, label: "Shipping", ...addressCreateData(b.shippingAddress) },
    });
    const billingAddress = b.billingAddress
      ? await tx.address.create({
          data: {
            customerId: customer.id,
            label: "Billing",
            ...addressCreateData(b.billingAddress),
          },
        })
      : null;

    const orderNumber = await nextOrderNumber();

    return tx.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        status: "PENDING_PAYMENT",
        currency: b.currency,
        subtotal: totals.subtotal,
        shippingFee: totals.shippingFee,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        total: totals.total,
        paymentProvider: payments.name,
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress?.id ?? null,
        customerNote: b.customerNote ?? null,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            sku: l.sku,
            name: l.name,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            lineTotal: l.lineTotalValue,
          })),
        },
      },
      ...ORDER_WITH,
    });
  });

  await writeAudit({
    actorId: null,
    action: "order.checkout_started",
    entityType: "Order",
    entityId: order.id,
    summary: `Storefront checkout ${order.orderNumber} created (${dec(order.total)} ${order.currency}, awaiting payment)`,
    metadata: { items: order.items.length, total: dec(order.total) },
  });

  // Payment init. Stripe returns a PaymentIntent client secret for the
  // storefront to confirm with Stripe.js (Payment Element = cards + Apple Pay +
  // Google Pay). "manual" does no online collection (online === false).
  const pay = (await readGroup("payments")) as PaymentsSettings;
  let clientSecret: string | null = null;
  let authorizationUrl: string | null = null;
  if (pay.online) {
    const init = await payments.initialize({
      amount: order.total.toString(),
      currency: order.currency,
      reference: order.orderNumber,
      customerEmail: order.customer.email,
      metadata: { orderId: order.id },
    });
    clientSecret = init.clientSecret;
    authorizationUrl = init.authorizationUrl;
    if (init.providerReference) {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentReference: init.providerReference },
      });
    }
  }

  res.status(201).json({
    data: {
      orderNumber: order.orderNumber,
      status: order.status,
      amounts: amountsOf(order),
      payment: {
        provider: pay.provider,
        online: pay.online,
        reference: order.orderNumber,
        publicKey: pay.publicKey,
        clientSecret,
        authorizationUrl,
        // Non-production escape hatch while live collection is not configured.
        devConfirmPath:
          !pay.online && !env.isProd
            ? `/public/checkout/${order.orderNumber}/confirm-dev`
            : null,
      },
    },
  });
}

/**
 * Mark a PENDING_PAYMENT order PAID: decrement stock, stamp paidAt +
 * paymentReference, audit. Shared by the dev confirm endpoint and the Stripe
 * webhook. No-op (returns the row) if the order is not PENDING_PAYMENT.
 */
async function markOrderPaid(
  orderId: string,
  reference: string,
  paidAt: Date,
  opts: { dev?: boolean } = {},
): Promise<{ order: OrderRow; changed: boolean }> {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, ...ORDER_WITH });
    if (order.status !== "PENDING_PAYMENT") return { order, changed: false };

    for (const it of order.items) {
      if (it.variantId) {
        await tx.productVariant.update({
          where: { id: it.variantId },
          data: { stockQuantity: { decrement: it.quantity } },
        });
      } else if (it.productId) {
        await tx.product.update({
          where: { id: it.productId },
          data: {
            stockQuantity: { decrement: it.quantity },
            stockSource: "MANUAL",
            stockUpdatedAt: paidAt,
          },
        });
      }
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt, paymentReference: reference },
      ...ORDER_WITH,
    });
    return { order: updated, changed: true };
  });

  if (result.changed) {
    await writeAudit({
      actorId: null,
      action: "order.payment_recorded",
      entityType: "Order",
      entityId: result.order.id,
      summary: `${opts.dev ? "[dev] Simulated payment" : "Payment"} confirmed for ${result.order.orderNumber}`,
      metadata: { reference, dev: opts.dev ?? false, amount: dec(result.order.total) },
    });
  }
  return result;
}

/**
 * POST /public/checkout/:reference/confirm-dev
 * Dev/staging only (blocked when the payment provider does live collection or
 * NODE_ENV=production). Simulates "payment succeeded": decrements stock and
 * flips PENDING_PAYMENT -> PAID so the full storefront flow can be exercised
 * with PAYMENT_PROVIDER=manual. The Stripe webhook does the same steps.
 */
export async function confirmCheckoutDev(req: Request<{ reference: string }>, res: Response) {
  if (payments.online || env.isProd) throw HttpError.notFound("Not found");

  const reference = req.params.reference;
  const order = await prisma.order.findFirst({
    where: { orderNumber: reference },
    ...ORDER_WITH,
  });
  if (!order) throw HttpError.notFound("Checkout not found");

  if (order.status !== "PENDING_PAYMENT") {
    res.json({ data: publicOrderView(order), alreadyProcessed: true });
    return;
  }

  const { order: updated } = await markOrderPaid(order.id, `DEV-${reference}`, new Date(), {
    dev: true,
  });
  res.json({ data: publicOrderView(updated) });
}

/**
 * POST /public/payments/stripe/webhook
 *
 * Stripe posts events here. We verify the `Stripe-Signature` header over the
 * raw body (captured by the JSON parser's `verify` hook — see app.ts), and on
 * `payment_intent.succeeded` flip the referenced order PENDING_PAYMENT -> PAID
 * (decrement stock, stamp paidAt + the PaymentIntent id). Always answer 200
 * quickly for events we recognise so Stripe does not retry; a bad signature is
 * the only 400.
 *
 * Local testing:  stripe listen --forward-to localhost:4000/api/v1/public/payments/stripe/webhook
 */
export async function stripeWebhook(req: Request, res: Response) {
  const evt = payments.parseWebhook(req.rawBody, req.header("stripe-signature"));

  if (!evt.handled || evt.status !== "success") {
    res.json({ received: true });
    return;
  }

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        ...(evt.reference ? [{ orderNumber: evt.reference }] : []),
        ...(evt.providerReference ? [{ paymentReference: evt.providerReference }] : []),
      ],
    },
    select: { id: true, status: true },
  });

  if (order && order.status === "PENDING_PAYMENT") {
    await markOrderPaid(order.id, evt.providerReference ?? evt.reference ?? "stripe", evt.paidAt ?? new Date());
  }
  res.json({ received: true });
}

export async function trackPublicOrder(req: Request<{ orderNumber: string }>, res: Response) {
  const { email } = req.query as unknown as TrackOrderQuery;
  const order = await prisma.order.findFirst({
    where: { orderNumber: req.params.orderNumber, customer: { email } },
    ...ORDER_WITH,
  });
  // 404 (not 403) whether the number is wrong or the email does not match — do
  // not confirm an order number exists to someone who cannot supply its email.
  if (!order) throw HttpError.notFound("No order found for that number and email");
  res.json({ data: publicOrderView(order) });
}

/* ========================= WHOLESALE QUOTE REQ ===================== */

export async function createPublicQuote(req: Request, res: Response) {
  const b = req.body as PublicQuoteInput;

  const productIds = [
    ...new Set(b.items.map((i) => i.productId).filter((v): v is string => Boolean(v))),
  ];
  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
    : [];
  if (products.length !== productIds.length) {
    throw HttpError.badRequest("One or more products in the request no longer exist");
  }
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  const quote = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { email: b.contact.email },
      update: {
        firstName: b.contact.firstName,
        lastName: b.contact.lastName,
        ...(b.company !== undefined ? { companyName: b.company ?? null } : {}),
        ...(b.contact.phone !== undefined ? { phone: b.contact.phone ?? null } : {}),
      },
      create: {
        type: "WHOLESALE",
        email: b.contact.email,
        firstName: b.contact.firstName,
        lastName: b.contact.lastName,
        companyName: b.company ?? null,
        phone: b.contact.phone ?? null,
      },
      select: { id: true },
    });

    const quoteNumber = await nextQuoteNumber();

    return tx.quote.create({
      data: {
        quoteNumber,
        customerId: customer.id,
        status: "REQUESTED",
        requestNote: b.message ?? null,
        currency: "USD",
        lineItems: {
          create: b.items.map((it, i) => ({
            ...(it.productId ? { product: { connect: { id: it.productId } } } : {}),
            ...(it.variantId ? { variant: { connect: { id: it.variantId } } } : {}),
            description:
              it.description ??
              (it.productId ? (nameById.get(it.productId) ?? "Requested item") : "Requested item"),
            quantity: it.quantity,
            unitPrice: null,
            lineTotal: null,
            notes: it.note ?? null,
            position: i,
          })),
        },
      },
      select: { id: true, quoteNumber: true, status: true },
    });
  });

  await writeAudit({
    actorId: null,
    action: "quote.requested",
    entityType: "Quote",
    entityId: quote.id,
    summary: `Storefront quote request ${quote.quoteNumber} from ${b.contact.email}`,
    metadata: { items: b.items.length, company: b.company ?? null },
  });

  res.status(201).json({ data: { quoteNumber: quote.quoteNumber, status: quote.status } });
}

/* ======================= WHOLESALE APPLICATION =================== */

export async function createPublicWholesaleApplication(req: Request, res: Response) {
  const b = req.body as PublicWholesaleApplicationInput;

  const account = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { email: b.email },
      update: {
        type: "WHOLESALE",
        firstName: b.firstName,
        lastName: b.lastName,
        companyName: b.businessName,
        ...(b.phone !== undefined ? { phone: b.phone ?? null } : {}),
      },
      create: {
        type: "WHOLESALE",
        email: b.email,
        firstName: b.firstName,
        lastName: b.lastName,
        companyName: b.businessName,
        phone: b.phone ?? null,
      },
    });

    const existing = await tx.wholesaleAccount.findUnique({
      where: { customerId: customer.id },
      select: { id: true },
    });
    if (existing) {
      throw HttpError.conflict(
        "An application for this email already exists — our team will be in touch.",
      );
    }

    return tx.wholesaleAccount.create({
      data: {
        customerId: customer.id,
        status: "PENDING",
        businessName: b.businessName,
        businessRegistrationNumber: b.businessRegistrationNumber ?? null,
        taxId: b.taxId ?? null,
        businessType: b.businessType ?? null,
        website: b.website ?? null,
        contactName: `${b.firstName} ${b.lastName}`.trim(),
        contactEmail: b.email,
        contactPhone: b.phone ?? null,
        estimatedMonthlyVolume: b.estimatedMonthlyVolume ?? null,
        applicationNotes: b.applicationNotes ?? null,
      },
      select: { id: true, status: true },
    });
  });

  await writeAudit({
    actorId: null,
    action: "wholesale_account.application_submitted",
    entityType: "WholesaleAccount",
    entityId: account.id,
    summary: `Storefront wholesale application from "${b.businessName}" (${b.email})`,
  });

  res.status(201).json({ data: { status: account.status } });
}
