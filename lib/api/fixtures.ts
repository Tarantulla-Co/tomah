import type { Category, Faq, ProductDetail, RecipeDetail, Testimonial } from './types';

const maple = '/images/maple/';
export const products: ProductDetail[] = [
  { id:'prod-maple-syrup',slug:'maple-syrup',name:'Pure Maple Syrup',shortDescription:'Organic Canadian maple syrup in Amber and Dark grades.',description:'A pure Canadian maple syrup for breakfasts, baking, marinades and everyday sweetness.',category:'MAPLE_PRODUCTS',image:{url:maple+'syrup.png',alt:'Tomah pure maple syrup bottle',position:0},priceFrom:'11.00',currency:'USD',inStock:true,countryOfOrigin:'Canada',certifications:['Organic'],images:[{url:maple+'syrup.png',alt:'Tomah pure maple syrup bottle',position:0}],variants:[
    {id:'Tomah_Amber_8oz_Syrup-V2',name:'Amber · 8 fl oz',sku:'TOM-A8-V2',price:'11.00',currency:'USD',stockQuantity:38,available:true},
    {id:'Tomah_Amber_12oz_Syrup-V2',name:'Amber · 12 fl oz',sku:'TOM-A12-V2',price:'15.00',currency:'USD',stockQuantity:24,available:true},
    {id:'Tomah_Dark_8oz_Syrup-V2',name:'Dark · 8 fl oz',sku:'TOM-D8-V2',price:'11.00',currency:'USD',stockQuantity:31,available:true},
    {id:'Tomah_Dark_12oz_Syrup-V2',name:'Dark · 12 fl oz',sku:'TOM-D12-V2',price:'15.00',currency:'USD',stockQuantity:18,available:true}] },
  { id:'prod-maple-butter',slug:'maple-butter',name:'Maple Butter',shortDescription:'Smooth, spreadable maple goodness.',description:'A silky maple spread made from 100% pure maple syrup.',category:'MAPLE_PRODUCTS',image:{url:maple+'butter.png',alt:'Tomah maple butter jar',position:0},priceFrom:'14.00',currency:'USD',inStock:true,countryOfOrigin:'Canada',certifications:['Organic'],images:[{url:maple+'butter.png',alt:'Tomah maple butter jar',position:0}],variants:[{id:'maple-butter-160g',name:'5.6 oz · 160 g',sku:'TOM-MB160',price:'14.00',currency:'USD',stockQuantity:16,available:true}] },
  { id:'prod-maple-sugar',slug:'maple-sugar',name:'Maple Sugar',shortDescription:'Pure maple sweetness for stirring, sprinkling and baking.',description:'Organic granulated maple sugar with a warm, rounded flavour.',category:'MAPLE_PRODUCTS',image:{url:maple+'sugar.png',alt:'Tomah organic maple sugar pouch',position:0},priceFrom:'12.00',currency:'USD',inStock:true,countryOfOrigin:'Canada',certifications:['Organic'],images:[{url:maple+'sugar.png',alt:'Tomah organic maple sugar pouch',position:0}],variants:[{id:'maple-sugar-227g',name:'8 oz · 227 g',sku:'TOM-MS227',price:'12.00',currency:'USD',stockQuantity:22,available:true}] },
  ...([
    ['poultry-selection','Poultry Selection','POULTRY','Dependable frozen poultry for food-service and retail programmes.'],
    ['pork-selection','Pork Selection','PORK','Consistent pork cuts sourced for commercial buyers.'],
    ['meat-selection','Meat Selection','MEATS','Quality meat programmes backed by responsive sourcing.'],
    ['seafood-selection','Seafood Selection','SEAFOOD','Cold-chain seafood supplied to specification.'],
    ['grain-selection','Grain Selection','GRAINS','Staple grains for distributors and food businesses.'],
    ['vegetables-fries','Vegetables & Fries','VEGETABLES_AND_FRIES','Frozen vegetables and fries for dependable service.'],
  ] as [string,string,Category,string][]).map(([slug,name,category,shortDescription],i)=>({id:`prod-${slug}`,slug,name,shortDescription,description:`${shortDescription} Available through an individual commercial quote.`,category,image:{url:'/images/tomah-global-food-sourcing.png',alt:`${name} supplied by Tomah International`,position:0},priceFrom:'0.00',currency:'USD',inStock:true,countryOfOrigin:'Varies by programme',certifications:[],images:[{url:'/images/tomah-global-food-sourcing.png',alt:`${name} supplied by Tomah International`,position:0}],variants:[{id:`variant-${slug}`,name:'Quote by specification',sku:`BULK-${i+1}`,price:'0.00',currency:'USD',stockQuantity:0,available:false}]})),
];

export const faqs: Faq[] = [
  {id:'faq-1',question:'How are retail orders shipped?',answer:'Available services and the exact shipping amount are returned by the checkout service before payment.',position:1},
  {id:'faq-2',question:'How should maple products be stored?',answer:'Follow the storage directions on each package. Refrigerate maple butter after opening.',position:2},
  {id:'faq-3',question:'How do wholesale prices work?',answer:'Wholesale and bulk food prices are provided through individual quotes based on product, volume and destination.',position:3},
];
export const testimonials: Testimonial[] = [{id:'test-1',quote:'Responsive sourcing and clear communication from enquiry through delivery.',name:'Wholesale customer',company:'Food distribution'}];
export const recipes: RecipeDetail[] = [
  {id:'recipe-1',slug:'maple-breakfast-bowl',title:'Maple breakfast bowl',excerpt:'A simple warm breakfast finished with pure maple syrup.',image:{url:'/images/maple-pancakes.jpg',alt:'Breakfast served with maple syrup',position:0},ingredients:['1 bowl cooked oats','Fresh fruit','1–2 tbsp Tomah maple syrup'],instructions:['Prepare the oats.','Top with fruit.','Finish with maple syrup and serve warm.'],relatedProductIds:['prod-maple-syrup']},
  {id:'recipe-2',slug:'maple-glaze',title:'Everyday maple glaze',excerpt:'A balanced sweet glaze for roasted vegetables or proteins.',image:{url:'/images/maple-syrup-lifestyle.jpg',alt:'Pure maple syrup ready for cooking',position:0},ingredients:['2 tbsp maple syrup','1 tbsp mustard','Pinch of salt'],instructions:['Whisk all ingredients together.','Brush onto food during the final minutes of cooking.'],relatedProductIds:['prod-maple-syrup']},
];
