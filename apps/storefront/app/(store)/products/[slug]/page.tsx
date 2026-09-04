import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { ProductBuy } from '@/components/storefront/product-buy';
import { CATEGORY_META } from '@/lib/categories';

const site = process.env.TOMAH_PUBLIC_SITE_URL || 'https://tomah-international.tarantulla-co.chatgpt.site';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const p = await api.getProduct((await params).slug);
    return {
      title: `${p.name} | Tomah International`,
      description: p.shortDescription,
      alternates: { canonical: `${site}/products/${p.slug}` },
      openGraph: {
        title: p.name,
        description: p.shortDescription,
        images: [{ url: new URL(p.image.url, site).toString(), alt: p.image.alt }],
      },
      twitter: {
        card: 'summary_large_image',
        title: p.name,
        description: p.shortDescription,
        images: [new URL(p.image.url, site).toString()],
      },
    };
  } catch {
    return {};
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  let p;
  try {
    p = await api.getProduct((await params).slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const meta = CATEGORY_META[p.category];
  const Icon = meta.icon;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    image: p.images.map((i) => new URL(i.url, site).toString()),
    sku: p.variants[0]?.sku,
    brand: { '@type': 'Brand', name: 'Tomah' },
    offers: meta.retail
      ? p.variants
          .filter((v) => v.available)
          .map((v) => ({
            '@type': 'Offer',
            price: v.price,
            priceCurrency: v.currency,
            availability: 'https://schema.org/InStock',
            sku: v.sku,
          }))
      : undefined,
  };
  return (
    <main id="main" className="store-main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <p className="store-breadcrumb">
        <Link href="/products">Products</Link> / <Link href={`/categories/${p.category}`}>{meta.label}</Link>
      </p>
      <div className="store-detail">
        <div>
          <Image src={p.image.url} alt={p.image.alt} width={900} height={900} priority />
        </div>
        <div>
          <p className="store-kicker"><Icon size={15} /> {meta.label} · {p.countryOfOrigin}</p>
          <h1>{p.name}</h1>
          <p className="store-intro">{p.description}</p>
          <ProductBuy product={p} />
          {p.certifications.length > 0 && (
            <p className="store-notice">Certifications: {p.certifications.join(', ')}</p>
          )}
        </div>
      </div>
    </main>
  );
}
