import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from "./api";

export const PRODUCT_CATEGORIES = [
  "POULTRY",
  "PORK",
  "MEATS",
  "SEAFOOD",
  "GRAINS",
  "VEGETABLES_AND_FRIES",
  "MAPLE_PRODUCTS",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  POULTRY: "Poultry",
  PORK: "Pork",
  MEATS: "Meats",
  SEAFOOD: "Seafood",
  GRAINS: "Grains",
  VEGETABLES_AND_FRIES: "Vegetables & Fries",
  MAPLE_PRODUCTS: "Maple Products",
};

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  retailPrice: string | null;
  wholesalePrice: string | null;
  minimumOrderQuantity: number | null;
  stockQuantity: number;
  weightGrams: number | null;
  isActive: boolean;
  position: number;
}

export interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
  position: number;
  isPrimary: boolean;
  /** true = file we host via the storage adapter; false = external URL. */
  isUploaded?: boolean;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  slug: string;
  shortDescription: string | null;
  longDescription: string | null;
  category: ProductCategory;
  countryOfOrigin: string | null;
  certifications: string[];
  currency: string;
  retailPrice: string | null;
  wholesalePrice: string | null;
  minimumOrderQuantity: number | null;
  isRetailAvailable: boolean;
  isWholesaleAvailable: boolean;
  stock: {
    quantity: number;
    source: "MANUAL" | "ACCOUNTING_SYNC";
    syncEnabled: boolean;
    updatedAt: string;
  };
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  images: ProductImage[];
  variants: ProductVariant[];
}

export interface ProductListResponse {
  data: Product[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  categoryCounts: Record<ProductCategory, number>;
}

export interface ProductListParams {
  q?: string;
  category?: ProductCategory;
  status?: "published" | "draft";
  stock?: "in" | "out";
  page?: number;
  pageSize?: number;
  sort?: string;
}

function qs(params: object): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params) as [string, unknown][]) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const listProducts = (params: ProductListParams, signal?: AbortSignal) =>
  apiGet<ProductListResponse>(`/products${qs(params)}`, signal);

export const getProduct = (id: string, signal?: AbortSignal) =>
  apiGet<{ data: Product }>(`/products/${id}`, signal).then((r) => r.data);

export type ProductWritePayload = Partial<{
  name: string;
  sku: string;
  barcode: string | null;
  category: ProductCategory;
  shortDescription: string | null;
  longDescription: string | null;
  countryOfOrigin: string | null;
  certifications: string[];
  currency: string;
  retailPrice: number | null;
  wholesalePrice: number | null;
  minimumOrderQuantity: number | null;
  isRetailAvailable: boolean;
  isWholesaleAvailable: boolean;
  stockQuantity: number;
  stockSyncEnabled: boolean;
  isPublished: boolean;
}>;

export const createProduct = (body: ProductWritePayload) =>
  apiPost<{ data: Product }>("/products", body).then((r) => r.data);

export const updateProduct = (id: string, body: ProductWritePayload) =>
  apiPatch<{ data: Product }>(`/products/${id}`, body).then((r) => r.data);

export const deleteProduct = (id: string) => apiDelete<void>(`/products/${id}`);

export const updateStock = (
  id: string,
  body: { stockQuantity: number; stockSyncEnabled?: boolean; note?: string },
) => apiPatch<{ data: Product }>(`/products/${id}/stock`, body).then((r) => r.data);

export type VariantPayload = Partial<Omit<ProductVariant, "id">> & { name?: string; sku?: string };

export const addVariant = (productId: string, body: VariantPayload) =>
  apiPost<{ data: Product }>(`/products/${productId}/variants`, body).then((r) => r.data);
export const updateVariant = (productId: string, variantId: string, body: VariantPayload) =>
  apiPatch<{ data: Product }>(`/products/${productId}/variants/${variantId}`, body).then((r) => r.data);
export const deleteVariant = (productId: string, variantId: string) =>
  apiDelete<{ data: Product }>(`/products/${productId}/variants/${variantId}`).then((r) => r.data);

export type ImagePayload = Partial<Omit<ProductImage, "id">> & { url?: string };

export const addImage = (productId: string, body: ImagePayload) =>
  apiPost<{ data: Product }>(`/products/${productId}/images`, body).then((r) => r.data);

export const uploadImage = (
  productId: string,
  file: File,
  opts: { altText?: string; isPrimary?: boolean } = {},
) => {
  const form = new FormData();
  form.append("file", file);
  if (opts.altText) form.append("altText", opts.altText);
  if (opts.isPrimary) form.append("isPrimary", "true");
  return apiUpload<{ data: Product }>(`/products/${productId}/images/upload`, form).then((r) => r.data);
};
export const updateImage = (productId: string, imageId: string, body: ImagePayload) =>
  apiPatch<{ data: Product }>(`/products/${productId}/images/${imageId}`, body).then((r) => r.data);
export const deleteImage = (productId: string, imageId: string) =>
  apiDelete<{ data: Product }>(`/products/${productId}/images/${imageId}`).then((r) => r.data);

/** Format a decimal string in the product's currency. */
export function formatMoney(value: string | null, currency = "USD"): string {
  if (value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}
