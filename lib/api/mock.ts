import { faqs, products, recipes, testimonials } from './fixtures';
import type { CatalogueResponse, Category, OrderCreateRequest, OrderCreateResponse, OrderTrackingResponse, ProductDetail, QuoteCreateRequest, QuoteCreateResponse, WholesaleApplicationRequest, WholesaleApplicationResponse } from './types';

const cents = (value:string) => BigInt(value.replace('.', '').padEnd(value.includes('.') ? value.split('.')[0].length + 2 : value.length + 2, '0'));
const decimal = (value:bigint) => `${value / BigInt(100)}.${(value % BigInt(100)).toString().padStart(2,'0')}`;
export const mockApi = {
  async listProducts(params: {category?:Category;q?:string;page?:number;pageSize?:number;sort?:string}={}): Promise<CatalogueResponse> {
    const page=Math.max(1,params.page||1), pageSize=Math.min(24,Math.max(1,params.pageSize||9));
    let rows=products.filter(p=>(!params.category||p.category===params.category)&&(!params.q||`${p.name} ${p.shortDescription}`.toLowerCase().includes(params.q.toLowerCase())));
    if(params.sort==='name') rows=[...rows].sort((a,b)=>a.name.localeCompare(b.name));
    if(params.sort==='price-asc') rows=[...rows].sort((a,b)=>cents(a.priceFrom)<cents(b.priceFrom)?-1:1);
    const categories=['POULTRY','PORK','MEATS','SEAFOOD','GRAINS','VEGETABLES_AND_FRIES','MAPLE_PRODUCTS'] as Category[];
    return {items:rows.slice((page-1)*pageSize,page*pageSize),page,pageSize,total:rows.length,categoryCounts:Object.fromEntries(categories.map(c=>[c,products.filter(p=>p.category===c).length])) as Record<Category,number>};
  },
  async getProduct(slug:string):Promise<ProductDetail>{ const p=products.find(x=>x.slug===slug); if(!p) throw Object.assign(new Error('Product not found'),{status:404,code:'NOT_FOUND'}); return p; },
  async getFaqs(){return {items:faqs}}, async getTestimonials(){return {items:testimonials}}, async getRecipes(){return {items:recipes.map(({ingredients,instructions,relatedProductIds,...r})=>r)}},
  async getRecipe(slug:string){const r=recipes.find(x=>x.slug===slug);if(!r)throw Object.assign(new Error('Recipe not found'),{status:404,code:'NOT_FOUND'});return r},
  async getFeatured(){return {items:products.slice(0,3).map((product,position)=>({id:`featured-${position}`,position,product}))}},
  async createOrder(body:OrderCreateRequest):Promise<OrderCreateResponse>{
    let subtotal=BigInt(0); for(const item of body.items){const product=products.find(p=>p.id===item.productId);const variant=product?.variants.find(v=>v.id===item.variantId);if(!product||!variant||!variant.available)throw Object.assign(new Error('An item is unavailable'),{status:409,code:'CONFLICT'});subtotal+=cents(variant.price)*BigInt(item.quantity)}
    const shipping=subtotal>=BigInt(5000)?BigInt(0):BigInt(895),tax=BigInt(0),total=subtotal+shipping+tax,token=crypto.randomUUID().slice(0,8).toUpperCase();
    return {orderNumber:`TOM-MOCK-${token}`,status:'PENDING_PAYMENT',amounts:{subtotal:decimal(subtotal),shipping:decimal(shipping),tax:decimal(tax),total:decimal(total),currency:body.currency},payment:{provider:'paystack',reference:`mock_${token}`,publicKey:'pk_test_mock_only',authorizationUrl:`/checkout/callback?reference=mock_${token}&orderNumber=TOM-MOCK-${token}&email=${encodeURIComponent(body.customer.email)}`}};
  },
  async trackOrder(orderNumber:string,email:string):Promise<OrderTrackingResponse>{if(!orderNumber||!email)throw Object.assign(new Error('Order number and email are required'),{status:422,code:'VALIDATION_ERROR'});return {orderNumber,status:'PENDING_PAYMENT',placedAt:new Date().toISOString(),items:[{productName:'Tomah maple order',quantity:1}],amounts:{subtotal:'11.00',shipping:'8.95',tax:'0.00',total:'19.95',currency:'USD'}}},
  async createQuote(_body:QuoteCreateRequest):Promise<QuoteCreateResponse>{return {quoteNumber:`Q-MOCK-${crypto.randomUUID().slice(0,8).toUpperCase()}`,status:'REQUESTED'}},
  async createWholesaleApplication(_body:WholesaleApplicationRequest):Promise<WholesaleApplicationResponse>{return {status:'PENDING'}},
};
