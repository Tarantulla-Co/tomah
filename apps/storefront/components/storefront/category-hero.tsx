import Image from 'next/image';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { CATEGORY_META } from '@/lib/categories';
import type { Category } from '@/lib/api/types';

/**
 * Full-width band at the top of the products page. One per category (an icon
 * treatment for the six wholesale-only categories — no product photography
 * exists for them yet — and the real maple photo for the one retail
 * category), or a generic "shop everything" band when no category is picked.
 *
 * Swapping a category onto real photography later is a one-line change: give
 * that category an `image` field in lib/categories.ts and render it here
 * instead of the icon watermark.
 */
export function CategoryHero({ category }: { category?: Category }) {
  const meta = category ? CATEGORY_META[category] : null;

  if (meta?.retail) {
    const Icon = meta.icon;
    return (
      <section className="category-hero category-hero--photo">
        <Image
          className="category-hero-photo"
          src="/images/maple-syrup-lifestyle.jpg"
          alt="Tomah organic maple syrup bottle beside pancakes"
          fill
          sizes="100vw"
          priority
        />
        <div className="category-hero-scrim" />
        <div className="category-hero-content shell">
          <p className="store-kicker light"><Icon size={15} /> {meta.label}</p>
          <h1>{meta.heroBlurb}</h1>
          <span className="category-hero-badge">
            <ShoppingBag size={16} /> Ships direct — order online, no minimums
          </span>
        </div>
      </section>
    );
  }

  if (meta) {
    const Icon = meta.icon;
    return (
      <section className="category-hero category-hero--icon">
        <Icon className="category-hero-glyph" strokeWidth={0.65} aria-hidden />
        <div className="category-hero-content shell">
          <p className="store-kicker light"><Icon size={15} /> {meta.label}</p>
          <h1>{meta.heroBlurb}</h1>
          <a className="store-button gold" href="/quote">
            Request a wholesale quote <ArrowRight size={18} />
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="category-hero category-hero--icon category-hero--all">
      <ShoppingBag className="category-hero-glyph" strokeWidth={0.55} aria-hidden />
      <div className="category-hero-content shell">
        <p className="store-kicker light">Our product range</p>
        <h1>Quality for every table.</h1>
        <p className="category-hero-copy">
          Maple products ship direct — order online below. Everything else we
          supply (poultry, pork, meats, seafood, grains, vegetables) is sold
          wholesale by the case.
        </p>
        <a className="store-button gold" href="/quote">
          Request a wholesale quote <ArrowRight size={18} />
        </a>
      </div>
    </section>
  );
}
