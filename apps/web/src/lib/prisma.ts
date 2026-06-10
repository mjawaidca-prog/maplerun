/**
 * Prisma client singleton.
 *
 * Prisma v7 requires an explicit adapter — uses @prisma/adapter-pg for
 * direct PostgreSQL connections (Neon serverless, ca-central-1).
 *
 * Multi-tenant scoping (companyId injection) will be wired via a Prisma client
 * extension in Phase 3 when the employee management API routes are built.
 *
 * Usage:
 *   import { prisma } from "@/lib/prisma";
 */

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provision a Neon PostgreSQL database and add the connection string to .env."
    );
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
}

/**
 * Lazy singleton — avoids crashing the build when DATABASE_URL is absent
 * (e.g. CI, or initial scaffold before DB provisioning). Only initializes
 * on first access.
 */
let _prisma: PrismaClient | undefined;

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!_prisma) {
      _prisma = globalForPrisma.prisma ?? createPrisma();
      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = _prisma;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (_prisma as any)[prop];
    if (typeof val === "function") {
      return val.bind(_prisma);
    }
    return val;
  },
});
