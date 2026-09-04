import Image from 'next/image';
import { MobileNavigation } from '@/components/mobile-navigation';
import { ArrowRight, BadgeCheck, Beef, Boxes, ChevronRight, Fish, Globe2, Leaf, Mail, MapPin, PackageCheck, Phone, ShieldCheck, Snowflake, Sprout, Wheat } from 'lucide-react';
import { api } from '@/lib/api';

const categories = [
  ['Poultry', 'Reliable frozen poultry supply for retailers and distributors.', Snowflake, 'navy'],
  ['Meat & pork', 'Quality cuts sourced for dependable international supply.', Beef, 'cream'],
  ['Seafood', 'Cold-chain seafood solutions selected for freshness and value.', Fish, 'steel'],
  ['Grains', 'Staple grains for wholesale, foodservice and retail markets.', Wheat, 'gold'],
  ['Vegetables & fries', 'Convenient frozen produce for consistent kitchen performance.', Sprout, 'cream'],
  ['Maple products', 'Premium organic maple products for the everyday table.', Leaf, 'navy'],
] as const;

const steps = [
  ['01', 'Tell us what you need', 'Share your product, volume and destination requirements.'],
  ['02', 'We source and confirm', 'Our team aligns supply, specifications and commercial terms.'],
  ['03', 'We coordinate delivery', 'From documentation to shipment, we keep the process moving.'],
];

export default async function Home() {
  const featured = await api.getFeatured();
  return <main className="landing-grid">
    <header className="site-header">
      <a href="#top" className="brand" aria-label="Tomah International home"><Image src="/images/tomah-logo-navy.jpg" alt="Tomah International" width={220} height={245} priority /></a>
      <nav aria-label="Primary navigation"><a href="/products">Products</a><a href="#about">About us</a><a href="#how-it-works">How it works</a><a href="/categories/MAPLE_PRODUCTS">Maple shop</a></nav>
      <a className="button button-gold header-cta" href="/quote">Request a quote <ArrowRight size={17} /></a>
      <MobileNavigation />
    </header>

    <section className="hero" id="top">
      <Image className="hero-image" src="/images/tomah-global-food-sourcing.png" alt="A refrigerated food shipment with poultry, seafood, grains and vegetables prepared for distribution" fill sizes="100vw" priority />
      <div className="hero-overlay" />
      <div className="hero-content shell">
        <p className="eyebrow light">Global food trading & distribution</p>
        <h1>Quality food.<br />Trusted sources.<br /><em>Delivered worldwide.</em></h1>
        <p className="hero-copy">Tomah International connects retailers, distributors and customers with dependable frozen, dry and premium maple products from trusted producers around the globe.</p>
        <div className="hero-actions">
          <a className="button button-gold" href="/quote">Request a wholesale quote <ArrowRight size={18} /></a>
          <a className="text-link light-link" href="#products">Explore our products <ChevronRight size={18} /></a>
        </div>
      </div>
      <div className="hero-proof shell"><span><Globe2 size={18} /> Worldwide supply</span><span><ShieldCheck size={18} /> Responsible sourcing</span><span><PackageCheck size={18} /> Dependable fulfilment</span></div>
    </section>

    <section className="intro section shell" id="about">
      <div><p className="eyebrow">From source to market</p><h2>A dependable link in the global food supply chain.</h2></div>
      <div className="intro-copy"><p>We source and supply high-quality food products for markets around the world. Our network brings together reputable producers, practical logistics and responsive service—so customers can buy with confidence.</p><a className="text-link" href="#how-it-works">Discover how we work <ArrowRight size={18} /></a></div>
    </section>

    <section className="products section" id="products"><div className="shell">
      <div className="section-heading"><div><p className="eyebrow">Our product range</p><h2>Products for businesses.<br />Quality for every table.</h2></div><p>From cold-chain essentials to pantry staples, our portfolio is built around consistency, value and reliable supply.</p></div>
      <div className="category-grid">{categories.map(([name, detail, Icon, tone]) => <article className={`category-card ${tone}`} key={name}><Icon size={28} strokeWidth={1.6} /><div><h3>{name}</h3><p>{detail}</p></div><a href={name==='Maple products'?'/categories/MAPLE_PRODUCTS':'/quote'}>{name==='Maple products'?'Shop retail':'Request quote'} <ArrowRight size={17} /></a></article>)}</div>
    </div></section>

    <section className="values section shell">
      <div className="values-visual"><div className="stat-card"><Globe2 size={31} strokeWidth={1.5} /><strong>Global reach</strong><span>Supplying customers and markets worldwide</span></div><div className="quality-card"><BadgeCheck size={26} /><span>Quality-led sourcing</span></div></div>
      <div className="values-copy"><p className="eyebrow">Why Tomah</p><h2>International capability. Personal commitment.</h2><p>We build lasting relationships with producers, suppliers, distributors and customers. Every enquiry is handled with the integrity, reliability and care that dependable trade requires.</p><ul><li><ShieldCheck /> Reputable global supplier network</li><li><Boxes /> Retail and wholesale fulfilment</li><li><PackageCheck /> Clear coordination from order to delivery</li></ul></div>
    </section>

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
      <div><h3>Explore</h3><a href="/products">Products</a><a href="/about">About us</a><a href="#how-it-works">How it works</a><a href="/categories/MAPLE_PRODUCTS">Maple shop</a></div>
      <div><h3>Contact</h3><a href="mailto:info@tomahinc.com"><Mail size={16} /> info@tomahinc.com</a><a href="tel:+14074055021"><Phone size={16} /> +1 407 405 5021</a><p><MapPin size={16} /> 7901 4th St N, Ste 31326<br />St. Petersburg, FL 33702</p></div>
    </div><div className="footer-bottom shell"><span>© 2026 Tomah International. All rights reserved.</span><span>Integrity · Quality · Reliability</span></div></footer>
  </main>;
}
