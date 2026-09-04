/**
 * @tomah/db — shared Prisma client + re-exported types.
 *
 * Import from this package rather than instantiating PrismaClient directly so
 * every consumer shares one connection pool and one set of generated types:
 *
 *   import { prisma, UserRole } from "@tomah/db";
 */
import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { Prisma, PrismaClient };
export * from "@prisma/client";
