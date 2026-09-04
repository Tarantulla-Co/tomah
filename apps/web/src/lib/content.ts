import { apiDelete, apiGet, apiPatch, apiPost } from "./api";

/* ---------------------------------- FAQ --------------------------------- */

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  position: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------ testimonial --------------------------- */

export interface Testimonial {
  id: string;
  authorName: string;
  authorTitle: string | null;
  quote: string;
  rating: number | null;
  position: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------- recipe ------------------------------ */

export interface Recipe {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  ingredients: string[];
  steps: string[];
  imageUrl: string | null;
  relatedProductIds: string[];
  position: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ---------------------------- featured product ----------------------- */

export interface FeaturedProduct {
  id: string;
  productId: string;
  position: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    slug: string;
    currency: string;
    retailPrice: string | null;
    isPublished: boolean;
    imageUrl: string | null;
  };
}

/* --------------------------------- shared ----------------------------- */

export interface ContentListResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  counts: { published: number; draft: number };
}

function qs(params: object): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params) as [string, unknown][]) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface ContentListParams {
  q?: string;
  status?: "published" | "draft";
  page?: number;
  sort?: string;
}

/* faqs */
export const listFaqs = (p: ContentListParams, signal?: AbortSignal) =>
  apiGet<ContentListResponse<Faq>>(`/content/faqs${qs(p)}`, signal);
export const createFaq = (body: Partial<Faq>) =>
  apiPost<{ data: Faq }>("/content/faqs", body).then((r) => r.data);
export const updateFaq = (id: string, body: Partial<Faq>) =>
  apiPatch<{ data: Faq }>(`/content/faqs/${id}`, body).then((r) => r.data);
export const deleteFaq = (id: string) => apiDelete<void>(`/content/faqs/${id}`);

/* testimonials */
export const listTestimonials = (p: ContentListParams, signal?: AbortSignal) =>
  apiGet<ContentListResponse<Testimonial>>(`/content/testimonials${qs(p)}`, signal);
export const createTestimonial = (body: Partial<Testimonial>) =>
  apiPost<{ data: Testimonial }>("/content/testimonials", body).then((r) => r.data);
export const updateTestimonial = (id: string, body: Partial<Testimonial>) =>
  apiPatch<{ data: Testimonial }>(`/content/testimonials/${id}`, body).then((r) => r.data);
export const deleteTestimonial = (id: string) => apiDelete<void>(`/content/testimonials/${id}`);

/* recipes */
export const listRecipes = (p: ContentListParams, signal?: AbortSignal) =>
  apiGet<ContentListResponse<Recipe>>(`/content/recipes${qs(p)}`, signal);
export const createRecipe = (body: Partial<Recipe>) =>
  apiPost<{ data: Recipe }>("/content/recipes", body).then((r) => r.data);
export const updateRecipe = (id: string, body: Partial<Recipe>) =>
  apiPatch<{ data: Recipe }>(`/content/recipes/${id}`, body).then((r) => r.data);
export const deleteRecipe = (id: string) => apiDelete<void>(`/content/recipes/${id}`);

/* featured */
export const listFeatured = (signal?: AbortSignal) =>
  apiGet<{ data: FeaturedProduct[] }>("/content/featured", signal).then((r) => r.data);
export const addFeatured = (body: { productId: string; note?: string | null }) =>
  apiPost<{ data: FeaturedProduct }>("/content/featured", body).then((r) => r.data);
export const updateFeatured = (id: string, body: { position?: number; note?: string | null }) =>
  apiPatch<{ data: FeaturedProduct }>(`/content/featured/${id}`, body).then((r) => r.data);
export const removeFeatured = (id: string) => apiDelete<void>(`/content/featured/${id}`);
export const reorderFeatured = (ids: string[]) =>
  apiPatch<{ data: FeaturedProduct[] }>("/content/featured/reorder", { ids }).then((r) => r.data);
