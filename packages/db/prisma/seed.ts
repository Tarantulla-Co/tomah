/**
 * Seed script — idempotent (uses upserts on natural keys).
 * Run: npm run db:seed   (from repo root)
 *
 * Phase 1 requires "a couple of test users per role". We also seed a small set
 * of customers / products so the dashboard isn't empty during review; later
 * phases will expand this.
 *
 * Default password for every seeded user:  Tomah!2026
 */
import "dotenv/config"; // loads packages/db/.env when run via `npm run db:seed`
import {
  PrismaClient,
  UserRole,
  CustomerType,
  ProductCategory,
  WholesaleAccountStatus,
  QuoteStatus,
  InvoiceStatus,
  OrderStatus,
  ShippingCarrier,
} from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "Tomah!2026";

const USERS: Array<{ email: string; name: string; role: UserRole }> = [
  { email: "owner@tomah.test", name: "Ama Boateng (Owner)", role: UserRole.ADMIN },
  { email: "admin2@tomah.test", name: "Kwesi Mensah", role: UserRole.ADMIN },
  { email: "orders1@tomah.test", name: "Linda Osei", role: UserRole.ORDER_MANAGER },
  { email: "orders2@tomah.test", name: "Daniel Owusu", role: UserRole.ORDER_MANAGER },
  { email: "content1@tomah.test", name: "Priya Sharma", role: UserRole.CONTENT_EDITOR },
  { email: "content2@tomah.test", name: "Marcus Bell", role: UserRole.CONTENT_EDITOR },
];

async function seedUsers() {
  const passwordHash = await argon2.hash(DEFAULT_PASSWORD);
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, isActive: true },
      create: { ...u, passwordHash },
    });
  }
  console.log(`✓ ${USERS.length} users (password: ${DEFAULT_PASSWORD})`);
}

async function seedCustomers() {
  const retail = await prisma.customer.upsert({
    where: { email: "jane.retail@example.com" },
    update: {},
    create: {
      type: CustomerType.RETAIL,
      email: "jane.retail@example.com",
      firstName: "Jane",
      lastName: "Carter",
      phone: "+1 202 555 0141",
      addresses: {
        create: {
          label: "Home",
          line1: "88 Maple Row",
          city: "Burlington",
          region: "VT",
          postalCode: "05401",
          country: "US",
          isDefaultShipping: true,
          isDefaultBilling: true,
        },
      },
    },
  });

  const wholesale = await prisma.customer.upsert({
    where: { email: "buyer@harvestgrocers.example" },
    update: {},
    create: {
      type: CustomerType.WHOLESALE,
      email: "buyer@harvestgrocers.example",
      firstName: "Sam",
      lastName: "Nguyen",
      companyName: "Harvest Grocers Co.",
      phone: "+1 312 555 0199",
      addresses: {
        create: {
          label: "Distribution Center",
          line1: "2400 Warehouse Blvd",
          city: "Chicago",
          region: "IL",
          postalCode: "60616",
          country: "US",
          isDefaultShipping: true,
        },
      },
      wholesaleAccount: {
        create: {
          status: WholesaleAccountStatus.APPROVED,
          businessName: "Harvest Grocers Co.",
          businessType: "Grocery Chain",
          contactName: "Sam Nguyen",
          contactEmail: "buyer@harvestgrocers.example",
          contactPhone: "+1 312 555 0199",
          estimatedMonthlyVolume: "$10k–$25k",
          reviewedAt: new Date(),
          reviewNotes: "Established account, seeded as pre-approved.",
        },
      },
    },
  });

  // Attach the reviewer to the approved account (owner).
  const owner = await prisma.user.findUnique({ where: { email: "owner@tomah.test" } });
  if (owner) {
    await prisma.wholesaleAccount.updateMany({
      where: { customerId: wholesale.id, reviewedById: null },
      data: { reviewedById: owner.id },
    });
  }

  // A pending application for the Phase 3 queue.
  await prisma.customer.upsert({
    where: { email: "procurement@northbay.example" },
    update: {},
    create: {
      type: CustomerType.WHOLESALE,
      email: "procurement@northbay.example",
      firstName: "Rita",
      lastName: "Alvarez",
      companyName: "Northbay Restaurant Group",
      wholesaleAccount: {
        create: {
          status: WholesaleAccountStatus.PENDING,
          businessName: "Northbay Restaurant Group",
          businessType: "Restaurant Group",
          contactName: "Rita Alvarez",
          contactEmail: "procurement@northbay.example",
          estimatedMonthlyVolume: "$5k–$10k",
          applicationNotes: "12 locations across the Bay Area. Interested in poultry + seafood.",
        },
      },
    },
  });

  // A second retail customer with a saved address but no orders yet — the
  // zero-activity case for the Phase 6 customer directory.
  await prisma.customer.upsert({
    where: { email: "leo.parker@example.com" },
    update: {},
    create: {
      type: CustomerType.RETAIL,
      email: "leo.parker@example.com",
      firstName: "Leo",
      lastName: "Parker",
      phone: "+1 415 555 0173",
      addresses: {
        create: {
          label: "Home",
          line1: "17 Cedar Lane",
          city: "Portland",
          region: "OR",
          postalCode: "97201",
          country: "US",
          isDefaultShipping: true,
          isDefaultBilling: true,
        },
      },
    },
  });

  console.log(`✓ 4 customers (2 retail, 1 approved wholesale, 1 pending wholesale)`);
  return { retail, wholesale };
}

async function seedProducts() {
  const products = [
    {
      sku: "MPL-SYRUP-8OZ",
      name: "Pure Maple Syrup — Dark, 8 fl oz",
      slug: "pure-maple-syrup-dark-8oz",
      category: ProductCategory.MAPLE_PRODUCTS,
      countryOfOrigin: "CA",
      certifications: ["Canada Grade A", "USDA Organic"],
      retailPrice: "12.50",
      isRetailAvailable: true,
      isWholesaleAvailable: true,
      wholesalePrice: "7.20",
      minimumOrderQuantity: 48,
      stockQuantity: 320,
      isPublished: true,
    },
    {
      sku: "PLT-CHICKEN-CASE",
      name: "Frozen Chicken Leg Quarters — 40 lb case",
      slug: "frozen-chicken-leg-quarters-40lb",
      category: ProductCategory.POULTRY,
      countryOfOrigin: "US",
      certifications: ["USDA Inspected"],
      retailPrice: null,
      isRetailAvailable: false,
      isWholesaleAvailable: true,
      wholesalePrice: "38.00",
      minimumOrderQuantity: 20,
      stockQuantity: 140,
      isPublished: true,
    },
    {
      sku: "SEA-SHRIMP-2LB",
      name: "Wild-Caught Shrimp 16/20 — 2 lb bag",
      slug: "wild-caught-shrimp-16-20-2lb",
      category: ProductCategory.SEAFOOD,
      countryOfOrigin: "EC",
      certifications: ["BAP Certified"],
      retailPrice: "24.99",
      isRetailAvailable: true,
      isWholesaleAvailable: true,
      wholesalePrice: "16.40",
      minimumOrderQuantity: 30,
      stockQuantity: 75,
      isPublished: true,
    },
    {
      sku: "VEG-FRIES-6X5LB",
      name: "Straight-Cut Fries — 6 x 5 lb case",
      slug: "straight-cut-fries-6x5lb",
      category: ProductCategory.VEGETABLES_AND_FRIES,
      countryOfOrigin: "BE",
      certifications: [],
      retailPrice: null,
      isRetailAvailable: false,
      isWholesaleAvailable: true,
      wholesalePrice: "21.75",
      minimumOrderQuantity: 40,
      stockQuantity: 0,
      isPublished: false,
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p as never,
    });
  }
  console.log(`✓ ${products.length} products across categories`);
}

/**
 * Phase 4 — a few quotes + invoices for the approved wholesale customer so the
 * Quotes / Invoices screens aren't empty during review. Idempotent: keyed on the
 * unique quote/invoice numbers, `update: {}` leaves existing rows untouched.
 */
async function seedQuotesAndInvoices(wholesaleCustomerId: string) {
  const owner = await prisma.user.findUnique({ where: { email: "orders1@tomah.test" } });
  const bySku = Object.fromEntries(
    (await prisma.product.findMany({ select: { id: true, sku: true } })).map((p) => [p.sku, p.id]),
  );
  const in14Days = new Date(Date.now() + 14 * 86_400_000);

  // 1) A sent quote awaiting customer approval.
  await prisma.quote.upsert({
    where: { quoteNumber: "TMH-Q-4001" },
    update: {},
    create: {
      quoteNumber: "TMH-Q-4001",
      customerId: wholesaleCustomerId,
      createdById: owner?.id ?? null,
      status: QuoteStatus.SENT,
      currency: "USD",
      requestNote: "Monthly restock — maple + shrimp.",
      subtotal: "837.60",
      taxAmount: "0",
      discountAmount: "0",
      total: "837.60",
      validUntil: in14Days,
      sentAt: new Date(),
      lineItems: {
        create: [
          {
            productId: bySku["MPL-SYRUP-8OZ"] ?? null,
            description: "Pure Maple Syrup — Dark, 8 fl oz",
            quantity: 48,
            unitPrice: "7.20",
            lineTotal: "345.60",
            position: 0,
          },
          {
            productId: bySku["SEA-SHRIMP-2LB"] ?? null,
            description: "Wild-Caught Shrimp 16/20 — 2 lb bag",
            quantity: 30,
            unitPrice: "16.40",
            lineTotal: "492.00",
            position: 1,
          },
        ],
      },
    },
  });

  // 2) An approved quote already converted to a (sent) invoice.
  const convertedQuote = await prisma.quote.upsert({
    where: { quoteNumber: "TMH-Q-4002" },
    update: {},
    create: {
      quoteNumber: "TMH-Q-4002",
      customerId: wholesaleCustomerId,
      createdById: owner?.id ?? null,
      status: QuoteStatus.CONVERTED,
      currency: "USD",
      subtotal: "760.00",
      taxAmount: "0",
      discountAmount: "0",
      total: "760.00",
      sentAt: new Date(Date.now() - 5 * 86_400_000),
      approvedAt: new Date(Date.now() - 3 * 86_400_000),
      lineItems: {
        create: [
          {
            productId: bySku["PLT-CHICKEN-CASE"] ?? null,
            description: "Frozen Chicken Leg Quarters — 40 lb case",
            quantity: 20,
            unitPrice: "38.00",
            lineTotal: "760.00",
            position: 0,
          },
        ],
      },
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: "TMH-INV-4001" },
    update: {},
    create: {
      invoiceNumber: "TMH-INV-4001",
      customerId: wholesaleCustomerId,
      quoteId: convertedQuote.id,
      status: InvoiceStatus.SENT,
      currency: "USD",
      subtotal: "760.00",
      taxAmount: "0",
      discountAmount: "0",
      total: "760.00",
      issueDate: new Date(Date.now() - 3 * 86_400_000),
      dueDate: new Date(Date.now() + 11 * 86_400_000),
      sentAt: new Date(Date.now() - 3 * 86_400_000),
      lineItems: {
        create: [
          {
            description: "Frozen Chicken Leg Quarters — 40 lb case",
            quantity: 20,
            unitPrice: "38.00",
            lineTotal: "760.00",
            position: 0,
          },
        ],
      },
    },
  });

  // 3) A draft quote still being priced.
  await prisma.quote.upsert({
    where: { quoteNumber: "TMH-Q-4003" },
    update: {},
    create: {
      quoteNumber: "TMH-Q-4003",
      customerId: wholesaleCustomerId,
      createdById: owner?.id ?? null,
      status: QuoteStatus.DRAFT,
      currency: "USD",
      requestNote: "Need pricing on a pallet of fries.",
      lineItems: {
        create: [
          {
            productId: bySku["VEG-FRIES-6X5LB"] ?? null,
            description: "Straight-Cut Fries — 6 x 5 lb case",
            quantity: 40,
            position: 0,
          },
        ],
      },
    },
  });

  // 4) A standalone paid invoice.
  await prisma.invoice.upsert({
    where: { invoiceNumber: "TMH-INV-4002" },
    update: {},
    create: {
      invoiceNumber: "TMH-INV-4002",
      customerId: wholesaleCustomerId,
      status: InvoiceStatus.PAID,
      currency: "USD",
      subtotal: "250.00",
      taxAmount: "0",
      discountAmount: "0",
      total: "250.00",
      issueDate: new Date(Date.now() - 20 * 86_400_000),
      dueDate: new Date(Date.now() - 6 * 86_400_000),
      sentAt: new Date(Date.now() - 20 * 86_400_000),
      paidAt: new Date(Date.now() - 8 * 86_400_000),
      paymentReference: "manual-2026-0007",
      lineItems: {
        create: [
          {
            description: "Account setup / onboarding fee",
            quantity: 1,
            unitPrice: "250.00",
            lineTotal: "250.00",
            position: 0,
          },
        ],
      },
    },
  });

  console.log("✓ 3 quotes (sent / converted / draft) + 2 invoices (sent / paid)");
}

/**
 * Phase 5 — retail orders for the seeded retail customer, one in each fulfilment
 * state so the Orders screen has something to act on. Idempotent (keyed on
 * `orderNumber`, `update: {}`).
 */
async function seedOrders(retailCustomerId: string) {
  const addr = await prisma.address.findFirst({ where: { customerId: retailCustomerId } });
  const bySku = Object.fromEntries(
    (await prisma.product.findMany({ select: { id: true, sku: true, name: true } })).map((p) => [
      p.sku,
      p,
    ]),
  );
  const item = (sku: string, unitPrice: string, quantity: number) => {
    const p = bySku[sku];
    return {
      productId: p?.id ?? null,
      sku,
      name: p?.name ?? sku,
      unitPrice,
      quantity,
      lineTotal: (Number(unitPrice) * quantity).toFixed(2),
    };
  };
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  const addrIds = addr
    ? { shippingAddressId: addr.id, billingAddressId: addr.id }
    : { shippingAddressId: null, billingAddressId: null };

  const orders = [
    {
      orderNumber: "TMH-10001",
      status: OrderStatus.PAID,
      subtotal: "49.99",
      shippingFee: "6.00",
      total: "55.99",
      paidAt: daysAgo(1),
      paymentReference: "pstk_ref_10001",
      items: [item("MPL-SYRUP-8OZ", "12.50", 2), item("SEA-SHRIMP-2LB", "24.99", 1)],
    },
    {
      orderNumber: "TMH-10002",
      status: OrderStatus.PROCESSING,
      subtotal: "49.98",
      shippingFee: "6.00",
      total: "55.98",
      paidAt: daysAgo(3),
      paymentReference: "pstk_ref_10002",
      processingAt: daysAgo(2),
      items: [item("SEA-SHRIMP-2LB", "24.99", 2)],
    },
    {
      orderNumber: "TMH-10003",
      status: OrderStatus.SHIPPED,
      subtotal: "50.00",
      shippingFee: "8.00",
      total: "58.00",
      paidAt: daysAgo(6),
      paymentReference: "pstk_ref_10003",
      processingAt: daysAgo(5),
      shippedAt: daysAgo(4),
      carrier: ShippingCarrier.UPS,
      trackingNumber: "1Z999AA10123456784",
      items: [item("MPL-SYRUP-8OZ", "12.50", 4)],
    },
    {
      orderNumber: "TMH-10004",
      status: OrderStatus.DELIVERED,
      subtotal: "12.50",
      shippingFee: "5.00",
      total: "17.50",
      paidAt: daysAgo(12),
      paymentReference: "pstk_ref_10004",
      processingAt: daysAgo(11),
      shippedAt: daysAgo(10),
      deliveredAt: daysAgo(8),
      carrier: ShippingCarrier.FEDEX,
      trackingNumber: "7712 3456 7890",
      items: [item("MPL-SYRUP-8OZ", "12.50", 1)],
    },
    {
      orderNumber: "TMH-10005",
      status: OrderStatus.REFUNDED,
      subtotal: "24.99",
      shippingFee: "6.00",
      total: "30.99",
      paidAt: daysAgo(15),
      paymentReference: "pstk_ref_10005",
      refundedAt: daysAgo(13),
      refundAmount: "30.99",
      refundReason: "Customer reported the cold pack failed in transit.",
      items: [item("SEA-SHRIMP-2LB", "24.99", 1)],
    },
  ];

  for (const o of orders) {
    const { items, ...rest } = o;
    await prisma.order.upsert({
      where: { orderNumber: o.orderNumber },
      update: {},
      create: {
        ...rest,
        customerId: retailCustomerId,
        currency: "USD",
        taxAmount: "0",
        discountAmount: "0",
        // Placed an hour before payment so the tracking timeline reads in order.
        createdAt: new Date(o.paidAt.getTime() - 3_600_000),
        ...addrIds,
        items: { create: items },
      },
    });
  }
  console.log(`✓ ${orders.length} orders (paid / processing / shipped / delivered / refunded)`);
}

/**
 * Phase 7 — a little CMS content so the storefront and the Content screen aren't
 * empty. Count-guarded per type (this is sample data, not idempotent keyed rows):
 * an existing row of a type means "leave it alone".
 */
async function seedContent() {
  if ((await prisma.faq.count()) === 0) {
    await prisma.faq.createMany({
      data: [
        {
          question: "Do you ship wholesale orders internationally?",
          answer:
            "Wholesale shipping is currently US domestic only (USPS, UPS, FedEx). International freight is quoted case by case — mention it in your quote request.",
          category: "Shipping",
          position: 0,
          isPublished: true,
        },
        {
          question: "How do I get wholesale pricing?",
          answer:
            "Apply for a wholesale account from the storefront. Once approved you'll see wholesale prices and minimum order quantities, and you can request quotes.",
          category: "Wholesale",
          position: 1,
          isPublished: true,
        },
        {
          question: "Is your maple syrup certified organic?",
          answer: "Our Dark and Amber grades are USDA Organic and Canada Grade A certified.",
          category: "Products",
          position: 2,
          isPublished: false,
        },
      ],
    });
  }

  if ((await prisma.testimonial.count()) === 0) {
    await prisma.testimonial.createMany({
      data: [
        {
          authorName: "Rita Alvarez",
          authorTitle: "Procurement Lead, Northbay Restaurant Group",
          quote:
            "Tomah has been our most reliable poultry and seafood supplier across 12 locations. Quotes turn around fast and the cold chain has never let us down.",
          rating: 5,
          position: 0,
          isPublished: true,
        },
        {
          authorName: "Sam Nguyen",
          authorTitle: "Buyer, Harvest Grocers Co.",
          quote: "The maple program alone moves serious volume for us every fall. Great margins, great story.",
          rating: 5,
          position: 1,
          isPublished: true,
        },
      ],
    });
  }

  if ((await prisma.recipe.count()) === 0) {
    await prisma.recipe.createMany({
      data: [
        {
          title: "Maple-Glazed Roast Chicken",
          slug: "maple-glazed-roast-chicken",
          summary: "A weeknight roast with a sticky dark-maple glaze.",
          ingredients: [
            "1 whole chicken (3–4 lb)",
            "3 tbsp Tomah Dark Maple Syrup",
            "1 tbsp Dijon mustard",
            "2 tbsp butter, melted",
            "Salt and pepper",
          ],
          steps: [
            "Heat oven to 425°F.",
            "Whisk maple syrup, mustard and butter.",
            "Pat the chicken dry, season, and brush with half the glaze.",
            "Roast 50–60 min, brushing with the rest of the glaze twice, until 165°F at the thigh.",
            "Rest 10 minutes before carving.",
          ],
          position: 0,
          isPublished: true,
        },
        {
          title: "Sheet-Pan Shrimp & Fries",
          slug: "sheet-pan-shrimp-and-fries",
          summary: "Straight-cut fries and garlic shrimp on one pan.",
          ingredients: [
            "1 bag Tomah Straight-Cut Fries",
            "1 lb Tomah Wild-Caught Shrimp, peeled",
            "3 cloves garlic, minced",
            "2 tbsp olive oil",
            "Lemon and parsley to finish",
          ],
          steps: [
            "Bake fries per the package for 15 minutes at 450°F.",
            "Toss shrimp with garlic and oil.",
            "Add shrimp to the pan and roast 6–8 min more until pink.",
            "Finish with lemon and parsley.",
          ],
          position: 1,
          isPublished: false,
        },
      ],
    });
  }

  if ((await prisma.featuredProduct.count()) === 0) {
    const featured = await prisma.product.findMany({
      where: { sku: { in: ["MPL-SYRUP-8OZ", "SEA-SHRIMP-2LB"] } },
      select: { id: true, sku: true },
    });
    await prisma.featuredProduct.createMany({
      data: featured.map((p, i) => ({
        productId: p.id,
        position: i,
        note: p.sku === "MPL-SYRUP-8OZ" ? "Fall maple push" : null,
      })),
    });
  }

  console.log("✓ content: 3 FAQs, 2 testimonials, 2 recipes, 2 featured products");
}

/** Phase 8 — starter config so Settings isn't blank. Idempotent (upsert by key). */
async function seedSettings() {
  const rows: Array<{ key: string; value: Record<string, unknown> }> = [
    {
      key: "payments",
      value: { publicKey: "pk_test_seedplaceholder", secretKey: null, testMode: true },
    },
    {
      key: "shipping",
      value: {
        freeShippingThreshold: "75.00",
        defaultFee: "8.00",
        rules: [
          { region: "AK", fee: "18.00" },
          { region: "HI", fee: "18.00" },
        ],
      },
    },
    {
      key: "tax",
      value: {
        defaultRate: 0,
        rules: [
          { region: "VT", rate: 0.06 },
          { region: "IL", rate: 0.0625 },
        ],
      },
    },
    { key: "accounting", value: { autoSyncOnPayment: false, lastSyncAt: null, lastSyncStatus: null, lastSyncSummary: null } },
  ];
  for (const r of rows) {
    await prisma.setting.upsert({
      where: { key: r.key },
      update: {},
      create: { key: r.key, value: r.value as never },
    });
  }
  console.log("✓ settings: payments / shipping / tax / accounting");
}

async function main() {
  console.log("Seeding Tomah admin database…");
  await seedUsers();
  const { retail, wholesale } = await seedCustomers();
  await seedProducts();
  await seedQuotesAndInvoices(wholesale.id);
  await seedOrders(retail.id);
  await seedContent();
  await seedSettings();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
