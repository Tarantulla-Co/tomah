import { notFound } from 'next/navigation';
import { api, type Category } from '@/lib/api';
import { Catalogue } from '@/components/storefront/catalogue';
import { CategoryHero } from '@/components/storefront/category-hero';
import { CATEGORY_META, CATEGORY_ORDER } from '@/lib/categories';

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!CATEGORY_ORDER.includes(category as Category)) return {};
  const meta = CATEGORY_META[category as Category];
  return {
    title: `${meta.label} | Tomah International`,
    description: `Browse Tomah International ${meta.label.toLowerCase()} products.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const { category } = await params;
  if (!CATEGORY_ORDER.includes(category as Category)) notFound();
  const q = await searchParams;
  const data = await api.listProducts({
    category: category as Category,
    q: q.q,
    sort: q.sort,
    page: Number(q.page) || 1,
  });
  return (
    <main id="main" className="store-main store-main--flush">
      <CategoryHero category={category as Category} />
      <div className="shell">
        <Catalogue data={data} active={category as Category} query={q.q} sort={q.sort} />
      </div>
    </main>
  );
}
