import type { Metadata } from 'next';
import { DM_Sans, Manrope } from 'next/font/google';
import './globals.css';

const heading = Manrope({ variable: '--font-heading', subsets: ['latin'], weight: ['400', '700'] });
const body = DM_Sans({ variable: '--font-body', subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'Tomah International | Global Food Trading & Distribution',
  description: 'Tomah International sources and supplies quality frozen, dry and premium maple products to customers and markets worldwide.',
  openGraph: { title: 'Tomah International | Quality food. Trusted sources.', description: 'Global food trading and distribution, connecting dependable products with markets worldwide.', images: ['/images/tomah-global-food-sourcing.png'] },
  twitter: { card: 'summary_large_image', title: 'Tomah International | Quality food. Trusted sources.', description: 'Global food trading and distribution, connecting dependable products with markets worldwide.', images: ['/images/tomah-global-food-sourcing.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${heading.variable} ${body.variable}`}>{children}</body></html>;
}
