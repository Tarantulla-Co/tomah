-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ORDER_MANAGER', 'CONTENT_EDITOR');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('RETAIL', 'WHOLESALE');

-- CreateEnum
CREATE TYPE "WholesaleAccountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('POULTRY', 'PORK', 'MEATS', 'SEAFOOD', 'GRAINS', 'VEGETABLES_AND_FRIES', 'MAPLE_PRODUCTS');

-- CreateEnum
CREATE TYPE "StockSource" AS ENUM ('MANUAL', 'ACCOUNTING_SYNC');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ShippingCarrier" AS ENUM ('USPS', 'UPS', 'FEDEX', 'DHL');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('REQUESTED', 'DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "AccountingSyncStatus" AS ENUM ('NOT_SYNCED', 'PENDING', 'SYNCED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'RETAIL',
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "companyName" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "contactName" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "phone" TEXT,
    "isDefaultShipping" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultBilling" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wholesale_accounts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "WholesaleAccountStatus" NOT NULL DEFAULT 'PENDING',
    "businessName" TEXT NOT NULL,
    "businessRegistrationNumber" TEXT,
    "taxId" TEXT,
    "businessType" TEXT,
    "website" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "estimatedMonthlyVolume" TEXT,
    "applicationNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "category" "ProductCategory" NOT NULL,
    "countryOfOrigin" TEXT,
    "certifications" TEXT[],
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "retailPrice" DECIMAL(12,2),
    "wholesalePrice" DECIMAL(12,2),
    "minimumOrderQuantity" INTEGER,
    "isRetailAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isWholesaleAvailable" BOOLEAN NOT NULL DEFAULT false,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "stockSource" "StockSource" NOT NULL DEFAULT 'MANUAL',
    "stockSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "stockUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "retailPrice" DECIMAL(12,2),
    "wholesalePrice" DECIMAL(12,2),
    "minimumOrderQuantity" INTEGER,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "weightGrams" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PAID',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "shippingFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "paymentProvider" TEXT NOT NULL DEFAULT 'paystack',
    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "carrier" "ShippingCarrier",
    "trackingNumber" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "shippingAddressId" TEXT,
    "billingAddressId" TEXT,
    "customerNote" TEXT,
    "internalNote" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "refundedAt" TIMESTAMP(3),
    "refundAmount" DECIMAL(12,2),
    "refundReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestNote" TEXT,
    "internalNote" TEXT,
    "createdById" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(12,2),
    "taxAmount" DECIMAL(12,2),
    "discountAmount" DECIMAL(12,2),
    "total" DECIMAL(12,2),
    "validUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_items" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2),
    "lineTotal" DECIMAL(12,2),
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quoteId" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentProvider" TEXT NOT NULL DEFAULT 'paystack',
    "paymentReference" TEXT,
    "paystackAccessCode" TEXT,
    "accountingSyncStatus" "AccountingSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
    "accountingSyncedAt" TIMESTAMP(3),
    "accountingAdapter" TEXT,
    "accountingRef" TEXT,
    "accountingError" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_type_idx" ON "customers"("type");

-- CreateIndex
CREATE INDEX "addresses_customerId_idx" ON "addresses"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "wholesale_accounts_customerId_key" ON "wholesale_accounts"("customerId");

-- CreateIndex
CREATE INDEX "wholesale_accounts_status_idx" ON "wholesale_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "products_isPublished_idx" ON "products"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");

-- CreateIndex
CREATE INDEX "product_images_productId_idx" ON "product_images"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_quoteNumber_key" ON "quotes"("quoteNumber");

-- CreateIndex
CREATE INDEX "quotes_customerId_idx" ON "quotes"("customerId");

-- CreateIndex
CREATE INDEX "quotes_status_idx" ON "quotes"("status");

-- CreateIndex
CREATE INDEX "quote_line_items_quoteId_idx" ON "quote_line_items"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_quoteId_key" ON "invoices"("quoteId");

-- CreateIndex
CREATE INDEX "invoices_customerId_idx" ON "invoices"("customerId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoiceId_idx" ON "invoice_line_items"("invoiceId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_accounts" ADD CONSTRAINT "wholesale_accounts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_accounts" ADD CONSTRAINT "wholesale_accounts_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_billingAddressId_fkey" FOREIGN KEY ("billingAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
