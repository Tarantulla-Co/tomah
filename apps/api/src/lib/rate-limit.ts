import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./http-error.js";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Minimal fixed-window, in-memory rate limiter for the unauthenticated
 * storefront endpoints. Good enough for a single API instance; if the API is
 * scaled horizontally, swap the Map for a shared store (Redis) — the middleware
 * shape stays the same.
 *
 * `app.set("trust proxy", 1)` is already configured (see app.ts) so `req.ip`
 * reflects the real client behind the reverse proxy.
 */
export function rateLimit(opts: {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
}) {
  const hits = new Map<string, Bucket>();
  const keyOf = opts.key ?? ((req: Request) => req.ip ?? "unknown");

  // Periodic sweep so the map does not grow unbounded.
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of hits) if (b.resetAt <= now) hits.delete(k);
  }, opts.windowMs);
  timer.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const k = keyOf(req);
    const bucket = hits.get(k);

    if (!bucket || bucket.resetAt <= now) {
      hits.set(k, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > opts.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return next(
        new HttpError(429, "Too many requests — slow down and try again shortly.", "RATE_LIMITED"),
      );
    }
    next();
  };
}
