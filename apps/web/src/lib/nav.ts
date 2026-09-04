import type { UserRole } from "./types";

export interface NavItem {
  label: string;
  path: string;
  /** Roles allowed to see the item. ADMIN always allowed. Empty = all staff. */
  roles?: UserRole[];
  /** Phase that delivers the real screen — shown as a placeholder until then. */
  phase: number;
}

export interface NavSection {
  title: "Overview" | "Manage";
  items: NavItem[];
}

/** Screens up to and including this phase are built; later ones show a badge. */
export const DELIVERED_THROUGH_PHASE = 8;

/**
 * Sidebar is split into two sections per the UI Direction.
 * Role visibility mirrors the API's requireRole guards:
 *   ADMIN          — everything
 *   ORDER_MANAGER  — orders, quotes, invoices, wholesale accounts, customers
 *   CONTENT_EDITOR — catalogue + content
 */
export const NAV: NavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", path: "/", phase: 1 }],
  },
  {
    title: "Manage",
    items: [
      { label: "Products", path: "/products", roles: ["CONTENT_EDITOR"], phase: 2 },
      { label: "Wholesale Accounts", path: "/wholesale-accounts", roles: ["ORDER_MANAGER"], phase: 3 },
      { label: "Quotes", path: "/quotes", roles: ["ORDER_MANAGER"], phase: 4 },
      { label: "Invoices", path: "/invoices", roles: ["ORDER_MANAGER"], phase: 4 },
      { label: "Orders", path: "/orders", roles: ["ORDER_MANAGER"], phase: 5 },
      { label: "Customers", path: "/customers", roles: ["ORDER_MANAGER"], phase: 6 },
      { label: "Content", path: "/content", roles: ["CONTENT_EDITOR"], phase: 7 },
      { label: "Settings", path: "/settings", roles: ["ADMIN"], phase: 8 },
    ],
  },
];

export function visibleNav(hasRole: (...r: UserRole[]) => boolean): NavSection[] {
  return NAV.map((section) => ({
    ...section,
    items: section.items.filter((i) => !i.roles || hasRole(...i.roles)),
  })).filter((section) => section.items.length > 0);
}
