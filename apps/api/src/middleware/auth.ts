import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@tomah/db";
import { HttpError } from "../lib/http-error.js";
import { verifyAccessToken } from "../lib/tokens.js";

/** Require a valid access token. Populates req.auth. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return next(HttpError.unauthorized("Missing bearer token"));
  }
  try {
    const claims = verifyAccessToken(header.slice(7));
    req.auth = {
      userId: claims.sub,
      role: claims.role,
      name: claims.name,
      email: claims.email,
    };
    next();
  } catch {
    next(HttpError.unauthorized("Invalid or expired token"));
  }
}

/**
 * Require the authenticated user to hold one of the given roles.
 * ADMIN passes every check implicitly.
 *
 *   router.post("/products", requireAuth, requireRole("CONTENT_EDITOR"), handler)
 */
export function requireRole(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(HttpError.unauthorized());
    if (req.auth.role === "ADMIN" || allowed.includes(req.auth.role)) return next();
    return next(HttpError.forbidden("Your role does not have access to this resource"));
  };
}
