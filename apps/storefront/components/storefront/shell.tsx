'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Mail, MapPin, Phone, ShoppingBag } from 'lucide-react';
import { MobileNavigation } from '../mobile-navigation';
import { CATEGORY_ORDER, CATEGORY_META } from '@/lib/categories';
import { StoreCartProvider, useStoreCart } from './cart-context';

const NAV_LINKS: [string, string][] = [
  ['Products', '/products'],
  ['Recipes', '/recipes'],
  ['Wholesale', '/wholesale'],
  ['Track order', '/orders/track'],
];

function CartLink() {
  const { count } = useStoreCart();
  return (
    <Link className="store-cart-link" href="/cart" aria-label={`Cart with ${count} items`}>
      <ShoppingBag size={19} />
      <span>Cart</span>
      <b>{count}</b>
    </Link>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="storefront">
      <a className="shop-skip" href="#main">Skip to content</a>
      <header className="store-header">
        <Link href="/" className="store-logo">
          <Image src="/images/tomah-logo-navy.jpg" alt="Tomah International" width={82} height={64} />
        </Link>
        <nav aria-label="Store navigation">
          {NAV_LINKS.map(([label, href]) => (
            <Link key={href} href={href}>{label}</Link>
          ))}
        </nav>
        <div className="store-actions">
          <a className="store-wholesale-cta" href="/quote">
            Request a wholesale quote <ArrowRight size={15} />
          </a>
          <CartLink />
          <MobileNavigation links={NAV_LINKS} actionLabel="Request a wholesale quote" actionHref="/quote" />
        </div>
      </header>
      {children}
      <footer className="store-footer">
        <div className="store-footer-brand">
          <Image src="/images/tomah-logo-navy.jpg" alt="Tomah International" width={70} height={64} />
          <p>Global food trading &amp; distribution. Quality food, trusted sources, delivered worldwide.</p>
        </div>
        <div className="store-footer-col">
          <h3>Shop</h3>
          <Link href="/products">All products</Link>
          {CATEGORY_ORDER.map((c) => (
            <Link key={c} href={`/categories/${c}`}>{CATEGORY_META[c].label}</Link>
          ))}
        </div>
        <div className="store-footer-col">
          <h3>Support</h3>
          <Link href="/faq">FAQ</Link>
          <Link href="/orders/track">Track an order</Link>
          <Link href="/quote">Request a quote</Link>
          <Link href="/wholesale/apply">Apply for a wholesale account</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/returns">Returns</Link>
        </div>
        <div className="store-footer-col">
          <h3>Contact</h3>
          <a href="mailto:info@tomahinc.com"><Mail size={15} /> info@tomahinc.com</a>
          <a href="tel:+14074055021"><Phone size={15} /> +1 407 405 5021</a>
          <span><MapPin size={15} /> 7901 4th St N, Ste 31326, St. Petersburg, FL 33702</span>
        </div>
      </footer>
    </div>
  );
}

export function StorefrontShell({ children }: { children: React.ReactNode }) {
  return (
    <StoreCartProvider>
      <Frame>{children}</Frame>
    </StoreCartProvider>
  );
}
