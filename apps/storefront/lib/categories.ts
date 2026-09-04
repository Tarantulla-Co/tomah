import { Drumstick, Ham, Beef, Fish, Wheat, Sprout, Leaf, type LucideIcon } from 'lucide-react';
import type { Category } from './api/types';

export interface CategoryMeta {
  id: Category;
  label: string;
  icon: LucideIcon;
  /** Short line for chips / cards. */
  blurb: string;
  /** Longer line for the category hero band. */
  heroBlurb: string;
  /** Only maple products are sold direct-to-consumer today; everything else is quote-only. */
  retail: boolean;
}

/** Display order across the shop (retail first, then wholesale categories). */
export const CATEGORY_ORDER: Category[] = [
  'MAPLE_PRODUCTS',
  'POULTRY',
  'PORK',
  'MEATS',
  'SEAFOOD',
  'GRAINS',
  'VEGETABLES_AND_FRIES',
];

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  MAPLE_PRODUCTS: {
    id: 'MAPLE_PRODUCTS',
    label: 'Maple Products',
    icon: Leaf,
    blurb: 'Order online',
    heroBlurb: 'Organic maple syrup, sugar and butter — order online, no minimums, ships direct.',
    retail: true,
  },
  POULTRY: {
    id: 'POULTRY',
    label: 'Poultry',
    icon: Drumstick,
    blurb: 'Wholesale only',
    heroBlurb: 'Reliable frozen poultry supply, sold by the case for retailers and foodservice.',
    retail: false,
  },
  PORK: {
    id: 'PORK',
    label: 'Pork',
    icon: Ham,
    blurb: 'Wholesale only',
    heroBlurb: 'Quality pork cuts sourced for dependable, consistent wholesale supply.',
    retail: false,
  },
  MEATS: {
    id: 'MEATS',
    label: 'Meats',
    icon: Beef,
    blurb: 'Wholesale only',
    heroBlurb: 'A dependable range of meats for distributors and foodservice buyers.',
    retail: false,
  },
  SEAFOOD: {
    id: 'SEAFOOD',
    label: 'Seafood',
    icon: Fish,
    blurb: 'Wholesale only',
    heroBlurb: 'Cold-chain seafood selected for freshness, value and consistent supply.',
    retail: false,
  },
  GRAINS: {
    id: 'GRAINS',
    label: 'Grains',
    icon: Wheat,
    blurb: 'Wholesale only',
    heroBlurb: 'Staple grains for wholesale, foodservice and retail markets.',
    retail: false,
  },
  VEGETABLES_AND_FRIES: {
    id: 'VEGETABLES_AND_FRIES',
    label: 'Vegetables & Fries',
    icon: Sprout,
    blurb: 'Wholesale only',
    heroBlurb: 'Convenient frozen produce for consistent kitchen performance.',
    retail: false,
  },
};
