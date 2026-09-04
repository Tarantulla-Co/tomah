import { apiGet, apiPatch, apiPost } from "./api";

export type OrderStatus =
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export const ORDER_STATUSES: OrderStatus[] = [
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export type ShippingCarrier = "USPS" | "UPS" | "FEDEX" | "DHL";

export const SHIPPING_CARRIERS: ShippingCarrier[] = ["USPS", "UPS", "FEDEX", "DHL"];

export const CARRIER_LABELS: Record<ShippingCarrier, string> = {
  USPS: "USPS",
  UPS: "UPS",
  FEDEX: "FedEx",
  DHL: "DHL",
};

export interface OrderAddress {
  id: string;
  label: string | null;
  contactName: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string | null;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  variantId: string | null;
  sku: string;
  name: string;
  unitPrice: string | null;
  quantity: number;
  lineTotal: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    type: "RETAIL" | "WHOLESALE";
  };
  currency: string;
  amounts: {
    subtotal: string | null;
    shippingFee: string | null;
    taxAmount: string | null;
    discountAmount: string | null;
    total: string | null;
  };
  payment: { provider: string; reference: string | null; paidAt: string | null };
  shipping: {
    carrier: ShippingCarrier | null;
    trackingNumber: string | null;
    processingAt: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  };
  addresses: { shipping: OrderAddress | null; billing: OrderAddress | null };
  customerNote: string | null;
  internalNote: string | null;
  cancellation: { cancelledAt: string; reason: string | null } | null;
  refund: { refundedAt: string; amount: string | null; reason: string | null } | null;
  items: OrderItem[];
  timeline: Array<{ status: string; at: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetail extends Order {
  auditTrail: Array<{
    id: string;
    action: string;
    summary: string | null;
    actor: string;
    at: string;
    metadata: unknown;
  }>;
}

export interface OrderListResponse {
  data: Order[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  statusCounts: Record<OrderStatus, number>;
}

function qs(params: object): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params) as [string, unknown][]) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface OrderListParams {
  q?: string;
  status?: OrderStatus;
  carrier?: ShippingCarrier;
  page?: number;
}

export const listOrders = (params: OrderListParams, signal?: AbortSignal) =>
  apiGet<OrderListResponse>(`/orders${qs(params)}`, signal);

export const getOrder = (id: string, signal?: AbortSignal) =>
  apiGet<{ data: OrderDetail }>(`/orders/${id}`, signal).then((r) => r.data);

export const updateOrder = (
  id: string,
  body: Partial<{ carrier: ShippingCarrier | null; trackingNumber: string | null; internalNote: string | null }>,
) => apiPatch<{ data: Order }>(`/orders/${id}`, body).then((r) => r.data);

export const processOrder = (id: string) =>
  apiPost<{ data: Order }>(`/orders/${id}/process`, {}).then((r) => r.data);

export const shipOrder = (
  id: string,
  body: { carrier: ShippingCarrier; trackingNumber: string; shippedAt?: string | null },
) => apiPost<{ data: Order }>(`/orders/${id}/ship`, body).then((r) => r.data);

export const deliverOrder = (id: string, body: { deliveredAt?: string | null } = {}) =>
  apiPost<{ data: Order }>(`/orders/${id}/deliver`, body).then((r) => r.data);

export const cancelOrder = (id: string, reason: string) =>
  apiPost<{ data: Order }>(`/orders/${id}/cancel`, { reason }).then((r) => r.data);

export const refundOrder = (id: string, reason: string, amount?: number | null) =>
  apiPost<{ data: Order }>(`/orders/${id}/refund`, { reason, amount }).then((r) => r.data);
