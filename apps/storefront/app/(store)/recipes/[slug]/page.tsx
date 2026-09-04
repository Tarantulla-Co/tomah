import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { CATEGORY_META } from '@/lib/categories';
import { formatMoney } from '@/lib/money';

const site = process.env.TOMAH_PUBLIC_SITE_URL || 'https://tomah-international.tarantulla-co.chatgpt.site';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const r = await api.getRecipe((await params).slug);
    return {
      title: `${r.title} | Tomah International`,
      description: r.excerpt,
      alternates: { canonical: `${site}/recipes/${r.slug}` },
      openGraph: { title: r.title, description: r.excerpt, images: [new URL(r.image.url, site).toString()] },
    };
  } catch {
    return {};
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  let r;
  try {
    r = await api.getRecipe((await params).slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  return (
    <main id="main" className="store-main">
      <div className="store-detail">
        <Image src={r.image.url} alt={r.image.alt} width={900} height={700} />
        <article>
          <p className="store-kicker">Tomah recipe</p>
          <h1>{r.title}</h1>
          <p className="store-intro">{r.excerpt}</p>
          <h2>Ingredients</h2>
          <ul>{r.ingredients.map((x) => <li key={x}>{x}</li>)}</ul>
          <h2>Method</h2>
          <ol>{r.instructions.map((x) => <li key={x}>{x}</li>)}</ol>
        </article>
      </div>

      {r.relatedProducts.length > 0 && (
        <section style={{ marginTop: 64 }}>
          <h2 style={{ marginBottom: 24 }}>Made with</h2>
          <div className="store-grid" style={{ gridTemplateColumns: `repeat(${Math.min(r.relatedProducts.length, 3)}, minmax(0,1fr))` }}>
            {r.relatedProducts.map((p) => {
              const meta = CATEGORY_META[p.category];
              return (
                <article className="store-card" key={p.id}>
                  <Link className="store-card-media" href={`/products/${p.slug}`}>
                    <Image src={p.image.url} alt={p.image.alt} width={700} height={700} />
                  </Link>
                  <div className="store-card-body">
                    <p className="store-kicker">{meta.label}</p>
                    <h2><Link href={`/products/${p.slug}`}>{p.name}</Link></h2>
                    <p>{p.shortDescription}</p>
                    <div className="store-card-bottom">
                      <span>{meta.retail ? `From ${formatMoney(p.priceFrom, p.currency)}` : 'Wholesale · request quote'}</span>
                      <Link href={meta.retail ? `/products/${p.slug}` : '/quote'}>
                        {meta.retail ? 'View product' : 'Request quote'} →
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
