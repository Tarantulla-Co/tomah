import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { Catalogue } from '@/components/storefront/catalogue';
import { CategoryHero } from '@/components/storefront/category-hero';

export const metadata: Metadata = {
  title: 'Products | Tomah International',
  description: 'Explore Tomah International retail maple products and global food categories.',
};

export default async function Products({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const p = await searchParams;
  const data = await api.listProducts({ q: p.q, sort: p.sort, page: Number(p.page) || 1 });
  return (
    <main id="main" className="store-main store-main--flush">
      <CategoryHero />
      <div className="shell">
        <Catalogue data={data} query={p.q} sort={p.sort} />
      </div>
    </main>
  );
}
