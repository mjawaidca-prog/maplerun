/**
 * Prisma client singleton.
 *
 * Uses @prisma/adapter-pg for direct PostgreSQL connections (Neon).
 * Initialized eagerly — the proxy pattern was causing overhead on every call.
 */

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Provision a Neon PostgreSQL database and add the connection string to .env."
  );
}

function createPrisma(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
