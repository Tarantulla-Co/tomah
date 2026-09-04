import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import type { UserRole } from "../lib/types";

/**
 * Gate a route on authentication and (optionally) role.
 * - While the session is restoring -> a spiner placeholder.
 * - Anonymous -> redirect to /login (remembering where we were headed).
 * - Wrong role -> redirect to the dashboard (nav already hides the link, this
 *   is defence in depth and covers deep links).
 */
export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: UserRole[];
}) {
  const { status, hasRole } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <div style={{ padding: 48, color: "var(--color-text-muted)" }}>Loading…</div>;
  }
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (roles && !hasRole(...roles)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
