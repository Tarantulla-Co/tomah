import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@tomah/db";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error.js";
import { env } from "../config/env.js";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(HttpError.notFound(`Route not found: ${req.method} ${req.path}`));
}

/** Terminal error handler — every error path renders this JSON envelope:
 *  { error: { code, message, details? } } */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Something went wrong";
  let details: unknown;

  if (err instanceof HttpError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 422;
    code = "VALIDATION_ERROR";
    message = "Request validation failed";
    details = err.flatten();
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      status = 409;
      code = "CONFLICT";
      message = `A record with that ${(err.meta?.target as string[])?.join(", ") ?? "value"} already exists`;
    } else if (err.code === "P2025") {
      status = 404;
      code = "NOT_FOUND";
      message = "Record not found";
    }
  }

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(env.isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
    },
  });
}
