import Image from 'next/image';
import Link from 'next/link';
import type { CatalogueResponse, Category } from '@/lib/api/types';
import { CATEGORY_META, CATEGORY_ORDER } from '@/lib/categories';
import { formatMoney } from '@/lib/money';

export function Catalogue({
  data,
  active,
  query = '',
  sort = '',
}: {
  data: CatalogueResponse;
  active?: Category;
  query?: string;
  sort?: string;
}) {
  const base = active ? `/categories/${active}` : '/products';
  const href = (page: number) =>
    `${base}?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(sort ? { sort } : {}),
      page: String(page),
    })}`;

  return (
    <>
      <nav className="store-categories" aria-label="Product categories">
        <Link className={`store-chip ${!active ? 'active' : ''}`} href="/products">
          All
        </Link>
        {CATEGORY_ORDER.map((key) => {
          const meta = CATEGORY_META[key];
          const Icon = meta.icon;
          return (
            <Link
              key={key}
              className={`store-chip ${active === key ? 'active' : ''}`}
              href={`/categories/${key}`}
            >
              <Icon size={15} /> {meta.label} ({data.categoryCounts[key] ?? 0})
            </Link>
          );
        })}
      </nav>

      <form className="store-tools">
        <input
          className="store-input"
          name="q"
          defaultValue={query}
          placeholder="Search products"
          aria-label="Search products"
        />
        <select className="store-select" name="sort" defaultValue={sort} aria-label="Sort products">
          <option value="">Featured</option>
          <option value="name">Name</option>
          <option value="price-asc">Price: low to high</option>
        </select>
      </form>

      {data.items.length ? (
        <>
          <div className="store-grid">
            {data.items.map((p) => {
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
                      <span>
                        {meta.retail ? `From ${formatMoney(p.priceFrom, p.currency)}` : 'Wholesale · request quote'}
                      </span>
                      <Link href={meta.retail ? `/products/${p.slug}` : '/quote'}>
                        {meta.retail ? 'View product' : 'Request quote'} →
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {data.total > data.pageSize && (
            <nav className="store-pagination" aria-label="Catalogue pages">
              {data.page > 1 && (
                <Link className="store-button secondary" href={href(data.page - 1)}>
                  Previous
                </Link>
              )}
              <span>Page {data.page} of {Math.ceil(data.total / data.pageSize)}</span>
              {data.page * data.pageSize < data.total && (
                <Link className="store-button secondary" href={href(data.page + 1)}>
                  Next
                </Link>
              )}
            </nav>
          )}
        </>
      ) : (
        <div className="store-empty">
          <h2>No products found</h2>
          <p>Try another search, or request a wholesale quote for this category.</p>
          <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 18 }}>
            <Link className="store-button" href="/products">View all products</Link>
            <Link className="store-button secondary" href="/quote">Request a quote</Link>
          </div>
        </div>
      )}
    </>
  );
}
