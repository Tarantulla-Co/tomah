import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { FaqAccordion } from '@/components/storefront/faq-accordion';

export const metadata: Metadata = { title: 'Frequently asked questions | Tomah International' };

export default async function Page() {
  const { items } = await api.getFaqs();

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.category ?? 'General';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <main id="main" className="store-main">
      <div style={{ maxWidth: 820 }}>
        <p className="store-kicker">Help</p>
        <h1 className="store-title">Frequently asked questions.</h1>
        <p className="store-intro" style={{ marginBottom: 40 }}>
          Can't find what you're looking for?{' '}
          <a className="text-link" href="/quote" style={{ display: 'inline-flex' }}>Request a quote</a> and ask us directly.
        </p>
        {[...groups.entries()].map(([category, groupItems]) => (
          <section key={category} style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 24, marginBottom: 8 }}>{category}</h2>
            <FaqAccordion items={groupItems} />
          </section>
        ))}
      </div>
    </main>
  );
}
