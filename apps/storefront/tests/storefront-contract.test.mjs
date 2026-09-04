import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
test('typed client owns every public API endpoint',async()=>{const source=await read('lib/api/index.ts');for(const path of ['/public/products','/public/content/faqs','/public/content/testimonials','/public/content/recipes','/public/content/featured','/public/orders','/public/quotes','/public/wholesale-applications'])assert.match(source,new RegExp(path.replaceAll('/','\\/')))});
test('orders send an idempotency key',async()=>assert.match(await read('lib/api/index.ts'),/'Idempotency-Key':key/));
test('live API configuration is not exposed as a NEXT_PUBLIC variable',async()=>{const env=await read('.env.example');assert.doesNotMatch(env,/NEXT_PUBLIC|SECRET|sk_live/)});
test('money helpers use integer minor units',async()=>{const source=await read('lib/money.ts');assert.match(source,/BigInt/);assert.doesNotMatch(source,/parseFloat/)});
test('wholesale catalogue cards never display bulk prices',async()=>assert.match(await read('components/storefront/catalogue.tsx'),/Individual quote/));
