import { mockApi } from './mock';
import type { CatalogueResponse, Category, Faq, OrderCreateRequest, OrderCreateResponse, OrderTrackingResponse, ProductDetail, QuoteCreateRequest, QuoteCreateResponse, RecipeDetail, RecipeSummary, Testimonial, WholesaleApplicationRequest, WholesaleApplicationResponse } from './types';
export * from './types';

export class ApiError extends Error { constructor(public code:string,message:string,public status:number,public details?:unknown){super(message);this.name='ApiError'} }
const mode=()=>typeof document!=='undefined'?(document.documentElement.dataset.apiMode==='live'?'live':'mock'):(process.env.TOMAH_API_MODE==='live'?'live':'mock');
const base=()=>{const value=process.env.TOMAH_API_BASE_URL?.replace(/\/$/,'');if(!value)throw new ApiError('CONFIG_ERROR','TOMAH_API_BASE_URL is required in live mode.',500);return value};
async function request<T>(path:string,init?:RequestInit):Promise<T>{
  const target=typeof window==='undefined'?`${base()}${path}`:`/api/storefront${path}`;
  const response=await fetch(target,{...init,headers:{'Content-Type':'application/json',...(init?.headers||{})},cache:init?.method&&init.method!=='GET'?'no-store':'default'});
  if(!response.ok){let body:any={};try{body=await response.json()}catch{};throw new ApiError(body.error?.code||'INTERNAL_ERROR',body.error?.message||'The request failed.',response.status,body.error?.details)}
  return response.json() as Promise<T>;
}
export async function forwardPublicRequest(request:Request,path:string[]){const target=`${base()}/public/${path.map(encodeURIComponent).join('/')}${new URL(request.url).search}`;const headers=new Headers();headers.set('Content-Type',request.headers.get('Content-Type')||'application/json');const key=request.headers.get('Idempotency-Key');if(key)headers.set('Idempotency-Key',key);return fetch(target,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:await request.text(),cache:'no-store'})}
export const api={
  listProducts:(params:{category?:Category;q?:string;page?:number;pageSize?:number;sort?:string}={}):Promise<CatalogueResponse>=>mode()==='mock'?mockApi.listProducts(params):request(`/public/products?${new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)]))}`),
  getProduct:(slug:string):Promise<ProductDetail>=>mode()==='mock'?mockApi.getProduct(slug):request(`/public/products/${encodeURIComponent(slug)}`),
  getFaqs:():Promise<{items:Faq[]}>=>mode()==='mock'?mockApi.getFaqs():request('/public/content/faqs'),
  getTestimonials:():Promise<{items:Testimonial[]}>=>mode()==='mock'?mockApi.getTestimonials():request('/public/content/testimonials'),
  getRecipes:():Promise<{items:RecipeSummary[]}>=>mode()==='mock'?mockApi.getRecipes():request('/public/content/recipes'),
  getRecipe:(slug:string):Promise<RecipeDetail>=>mode()==='mock'?mockApi.getRecipe(slug):request(`/public/content/recipes/${encodeURIComponent(slug)}`),
  getFeatured:()=>mode()==='mock'?mockApi.getFeatured():request<{items:any[]}>('/public/content/featured'),
  createOrder:(body:OrderCreateRequest,key=crypto.randomUUID()):Promise<OrderCreateResponse>=>mode()==='mock'?mockApi.createOrder(body):request('/public/orders',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(body)}),
  trackOrder:(number:string,email:string):Promise<OrderTrackingResponse>=>mode()==='mock'?mockApi.trackOrder(number,email):request(`/public/orders/${encodeURIComponent(number)}?email=${encodeURIComponent(email)}`,{cache:'no-store'}),
  createQuote:(body:QuoteCreateRequest):Promise<QuoteCreateResponse>=>mode()==='mock'?mockApi.createQuote(body):request('/public/quotes',{method:'POST',body:JSON.stringify(body)}),
  createWholesaleApplication:(body:WholesaleApplicationRequest):Promise<WholesaleApplicationResponse>=>mode()==='mock'?mockApi.createWholesaleApplication(body):request('/public/wholesale-applications',{method:'POST',body:JSON.stringify(body)}),
};
