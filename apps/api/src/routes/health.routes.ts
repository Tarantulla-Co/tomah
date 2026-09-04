import { Router } from "express";
import { prisma } from "@tomah/db";
import { asyncHandler } from "../lib/async-handler.js";

export const healthRouter = Router();

/** Liveness — no dependencies. */
healthRouter.get("/healthz", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

/** Readiness — verifies the database connection. */
healthRouter.get(
  "/readyz",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ready" });
  }),
);
