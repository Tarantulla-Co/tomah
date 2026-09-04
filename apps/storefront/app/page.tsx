import Image from 'next/image';
import { MobileNavigation } from '@/components/mobile-navigation';
import { FaqAccordion } from '@/components/storefront/faq-accordion';
import { ArrowRight, ArrowUpRight, BadgeCheck, Boxes, Globe2, MapPin, Mail, PackageCheck, Phone, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { CATEGORY_META } from '@/lib/categories';
import { formatMoney } from '@/lib/money';
import type { Category } from '@/lib/api/types';

const NAV_LINKS: [string, string][] = [
  ['Home', '#top'],
  ['Retail', '/categories/MAPLE_PRODUCTS'],
  ['Wholesale', '/wholesale'],
  ['Track order', '/orders/track'],
];

// The three quick picks under the hero: the one retail category (real product
// + price, pulled from the featured list below) plus the two proteins buyers
// ask about most. Full 7-category grid still follows further down the page.
const TOP_PICKS: Category[] = ['MAPLE_PRODUCTS', 'POULTRY', 'SEAFOOD'];

// Wholesale categories first, the one retail category (maple) last, as a
// closing highlight. Kept separate from CATEGORY_ORDER (retail-first, used by
// the shop's own category selector) since the two lists serve different UX.
const HOME_CATEGORY_ORDER: Category[] = [
  'POULTRY', 'PORK', 'MEATS', 'SEAFOOD', 'GRAINS', 'VEGETABLES_AND_FRIES', 'MAPLE_PRODUCTS',
];
const CARD_TONE = ['navy', 'cream', 'steel', 'gold', 'cream', 'steel', 'navy'] as const;

const steps = [
  ['01', 'Tell us what you need', 'Share your product, volume and destination requirements.'],
  ['02', 'We source and confirm', 'Our team aligns supply, specifications and commercial terms.'],
  ['03', 'We coordinate delivery', 'From documentation to shipment, we keep the process moving.'],
];

export default async function Home() {
  const [featured, faqs] = await Promise.all([api.getFeatured(), api.getFaqs()]);
  const mapleProduct = featured.items.find((f) => f.product.category === 'MAPLE_PRODUCTS')?.product;

  return <main className="landing-grid">
    <header className="site-header">
      <a href="#top" className="brand" aria-label="Tomah International home"><Image src="/images/tomah-logo-navy.jpg" alt="Tomah International" width={220} height={245} priority /></a>
      <nav aria-label="Primary navigation">{NAV_LINKS.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>
      <a className="button button-gold header-cta" href="/quote">Request a quote <ArrowRight size={17} /></a>
      <MobileNavigation links={NAV_LINKS} actionLabel="Request a quote" actionHref="/quote" />
    </header>

    <section className="home-hero" id="top">
      <div className="shell home-hero-grid">
        <div className="home-hero-copy">
          <p className="home-hero-eyebrow"><ArrowUpRight size={15} /> Global food trading &amp; distribution</p>
          <h1 className="home-hero-title">Quality food.<br />Trusted sources.<br /><em>Delivered worldwide.</em></h1>
          <p className="home-hero-lede">Tomah International connects retailers, distributors and customers with dependable frozen, dry and premium maple products from trusted producers around the globe.</p>
          <div className="home-hero-actions">
            <a className="pill pill-solid" href="/quote">Request a quote</a>
            <a className="pill pill-outline" href="#categories">Browse categories</a>
          </div>
        </div>
        <div className="home-hero-visual">
          <Image src="/images/tomah-global-food-sourcing.png" alt="A refrigerated food shipment with poultry, seafood, grains and vegetables prepared for distribution" fill sizes="(max-width: 900px) 100vw, 46vw" priority />
          <div className="home-hero-badge">
            <MapPin size={18} />
            <div><strong>7901 4th St N, Ste 31326</strong><span>St. Petersburg, FL, USA</span></div>
            <a href="/quote">Get in touch</a>
          </div>
        </div>
      </div>

      <div className="shell home-picks" id="categories">
        {TOP_PICKS.map((id) => {
          const meta = CATEGORY_META[id];
          const Icon = meta.icon;
          const product = id === 'MAPLE_PRODUCTS' ? mapleProduct : undefined;
          return (
            <a className="pick-card" href={`/categories/${id}`} key={id}>
              <span className="pick-card-media">
                {product ? (
                  <Image src={product.image.url} alt={product.image.alt} width={64} height={64} />
                ) : (
                  <Icon size={26} strokeWidth={1.6} />
                )}
              </span>
              <span className="pick-card-body">
                <b>{meta.label}</b>
                <span>{product ? `From ${formatMoney(product.priceFrom, product.currency)}` : 'Wholesale · request quote'}</span>
              </span>
              <span className="pick-arrow" aria-hidden><ArrowUpRight size={16} /></span>
            </a>
          );
        })}
      </div>
    </section>

    <section className="intro section shell" id="about">
      <div><p className="eyebrow">From source to market</p><h2>A dependable link in the global food supply chain.</h2></div>
      <div className="intro-copy"><p>We source and supply high-quality food products for markets around the world. Our network brings together reputable producers, practical logistics and responsive service—so customers can buy with confidence.</p><a className="text-link" href="#how-it-works">Discover how we work <ArrowRight size={18} /></a></div>
    </section>

    <section className="products section" id="products"><div className="shell">
      <div className="section-heading"><div><p className="eyebrow">Our product range</p><h2>Products for businesses.<br />Quality for every table.</h2></div><p>From cold-chain essentials to pantry staples, our portfolio is built around consistency, value and reliable supply.</p></div>
      <div className="category-grid">{HOME_CATEGORY_ORDER.map((id, i) => { const meta = CATEGORY_META[id]; const Icon = meta.icon; return <article className={`category-card ${CARD_TONE[i]}`} key={id}><Icon size={28} strokeWidth={1.6} /><div><h3>{meta.label}</h3><p>{meta.heroBlurb}</p></div><a href={`/categories/${id}`}>{meta.retail ? 'Shop retail' : 'Browse & request quote'} <ArrowRight size={17} /></a></article>; })}</div>
    </div></section>

    <section className="values section shell">
      <div className="values-visual"><div className="stat-card"><Globe2 size={31} strokeWidth={1.5} /><strong>Global reach</strong><span>Supplying customers and markets worldwide</span></div><div className="quality-card"><BadgeCheck size={26} /><span>Quality-led sourcing</span></div></div>
      <div className="values-copy"><p className="eyebrow">Why Tomah</p><h2>International capability. Personal commitment.</h2><p>We build lasting relationships with producers, suppliers, distributors and customers. Every enquiry is handled with the integrity, reliability and care that dependable trade requires.</p><ul><li><ShieldCheck /> Reputable global supplier network</li><li><Boxes /> Retail and wholesale fulfilment</li><li><PackageCheck /> Clear coordination from order to delivery</li></ul></div>
    </section>

    {faqs.items.length > 0 && (
      <section className="faq-home section shell" id="faq">
        <div className="section-heading">
          <div><p className="eyebrow">Answers first</p><h2>Frequently asked questions.</h2></div>
          <p>The most common questions from retailers and distributors before they order.</p>
        </div>
        <FaqAccordion items={faqs.items.slice(0, 6)} />
        <a className="text-link" href="/faq">See all FAQs <ArrowRight size={18} /></a>
      </section>
    )}

    <section className="process section" id="how-it-works"><div className="shell">
      <p className="eyebrow light">A clear path to supply</p><div className="process-heading"><h2>Trade made straightforward.</h2><p>Our team keeps you informed from the first conversation through to delivery.</p></div>
      <div className="steps">{steps.map(([number, title, body]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
    </div></section>

    <section className="maple section shell" id="maple-shop">
      <div className="maple-image-wrap"><Image src="/images/maple-syrup-lifestyle.jpg" alt="Tomah organic maple syrup bottle beside pancakes and a serving jar" fill sizes="(max-width: 800px) 100vw, 50vw" /><span>100% organic maple products</span></div>
      <div className="maple-copy"><p className="eyebrow">The Tomah maple shop</p><h2>Pure maple goodness, crafted naturally.</h2><p>Discover premium maple syrup, maple sugar and maple butter selected for authentic flavour and everyday moments worth savouring.</p><p>{featured.items.length} featured retail products are available in the catalogue.</p><a className="button button-navy" href="/categories/MAPLE_PRODUCTS">Explore maple products <ArrowRight size={18} /></a></div>
    </section>

    <section className="quote section shell"><div><p className="eyebrow light">Let’s talk supply</p><h2>Looking for a reliable food supply partner?</h2></div><div><p>Tell us what you need and where it needs to go. Our team will help you take the next step.</p><a className="button button-gold" href="/quote">Start your enquiry <ArrowRight size={18} /></a></div></section>

    <footer><div className="shell footer-grid">
      <div className="footer-brand"><Image src="/images/tomah-logo-navy.jpg" alt="Tomah International" width={180} height={200} /><p>Quality food products from trusted sources to markets around the world.</p></div>
      <div><h3>Explore</h3>{NAV_LINKS.map(([label, href]) => <a key={href} href={href}>{label}</a>)}<a href="/faq">FAQ</a></div>
      <div><h3>Contact</h3><a href="mailto:info@tomahinc.com"><Mail size={16} /> info@tomahinc.com</a><a href="tel:+14074055021"><Phone size={16} /> +1 407 405 5021</a><p><MapPin size={16} /> 7901 4th St N, Ste 31326<br />St. Petersburg, FL 33702</p></div>
    </div><div className="footer-bottom shell"><span>© 2026 Tomah International. All rights reserved.</span><span>Integrity · Quality · Reliability</span></div></footer>
  </main>;
}
