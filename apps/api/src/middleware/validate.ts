import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

/** Validate and coerce req.body against a Zod schema, replacing it with the
 *  parsed value. Zod errors are caught by the error middleware (422). */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    Object.assign(req.query, schema.parse(req.query));
    next();
  };
}
