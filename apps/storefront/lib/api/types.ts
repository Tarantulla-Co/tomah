export type Category = 'POULTRY' | 'PORK' | 'MEATS' | 'SEAFOOD' | 'GRAINS' | 'VEGETABLES_AND_FRIES' | 'MAPLE_PRODUCTS';
export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
export type ShippingCarrier = 'USPS' | 'UPS' | 'FEDEX' | 'DHL';
export type QuoteStatus = 'REQUESTED' | 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';
export type Money = { amount: string; currency: string };
export type ImageAsset = { url: string; alt: string; position: number };
export type ProductVariant = { id: string; name: string; sku: string; price: string; currency: string; stockQuantity: number; available: boolean };
export type ProductSummary = { id: string; slug: string; name: string; shortDescription: string; category: Category; image: ImageAsset; priceFrom: string; currency: string; inStock: boolean };
export type ProductDetail = ProductSummary & { description: string; countryOfOrigin: string; certifications: string[]; images: ImageAsset[]; variants: ProductVariant[] };
export type CatalogueResponse = { items: ProductSummary[]; page: number; pageSize: number; total: number; categoryCounts: Record<Category, number> };
export type Faq = { id: string; question: string; answer: string; category: string | null; position: number };
export type Testimonial = { id: string; quote: string; name: string; company: string; rating: number | null };
export type RecipeSummary = { id: string; slug: string; title: string; excerpt: string; image: ImageAsset };
export type RecipeDetail = RecipeSummary & { ingredients: string[]; instructions: string[]; relatedProducts: ProductSummary[] };
export type FeaturedProduct = { id: string; position: number; product: ProductSummary };
export type Address = { line1: string; line2?: string; city: string; region: string; postalCode: string; country: string };
export type OrderCreateRequest = { customer: { email: string; name: string; phone: string }; shippingAddress: Address; billingAddress?: Address; items: { productId: string; variantId?: string; quantity: number }[]; currency: string };
export type Amounts = { subtotal: string; shipping: string; tax: string; total: string; currency: string };
export type OrderPayment = {
  provider: string; // 'stripe' | 'manual'
  online: boolean;
  reference: string;
  publicKey: string | null;
  clientSecret: string | null; // Stripe PaymentIntent client secret
  authorizationUrl: string | null; // redirect-style providers (unused by Stripe)
  devConfirmPath: string | null; // non-prod, PAYMENT_PROVIDER=manual only
};
export type OrderCreateResponse = { orderNumber: string; status: 'PENDING_PAYMENT'; amounts: Amounts; payment: OrderPayment };
export type OrderTrackingResponse = { orderNumber: string; status: OrderStatus; placedAt: string; paidAt?: string; processingAt?: string; shippedAt?: string; deliveredAt?: string; cancelledAt?: string; refundedAt?: string; carrier?: ShippingCarrier; trackingNumber?: string; items: { productName: string; variantName?: string; quantity: number }[]; amounts: Amounts };
export type QuoteCreateRequest = { company: string; contact: { email: string; name: string; phone: string }; items: { productId: string; variantId?: string; quantity: number; note?: string }[]; message?: string };
export type QuoteCreateResponse = { quoteNumber: string; status: 'REQUESTED' };
export type WholesaleApplicationRequest = { businessName: string; businessType: string; taxId?: string; website?: string; estimatedMonthlyVolume: string; contact: { email: string; name: string; phone: string }; address: Address; message?: string };
export type WholesaleApplicationResponse = { status: 'PENDING' };
export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };
