export type UserRole = "ADMIN" | "ORDER_MANAGER" | "CONTENT_EDITOR";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  lastLoginAt: string | null;
}

export interface OverviewResponse {
  staffCount: number;
  customers: { retail: number; wholesale: number };
  products: { published: number; draft: number };
  actionQueue: {
    pendingWholesaleApplications: number;
    openQuotes: number;
    unpaidInvoices: number;
    ordersToShip: number;
  };
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  ORDER_MANAGER: "Order Manager",
  CONTENT_EDITOR: "Content Editor",
};
