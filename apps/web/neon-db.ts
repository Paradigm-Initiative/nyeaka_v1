import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

// The Neon driver speaks Neon's websocket protocol, so it can't reach a plain
// local Postgres. A localhost URL uses the standard pg driver instead.
const isLocalUrl = (url: string) => /@(localhost|127\.0\.0\.1)[:/]/.test(url);

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL!;
  return new PrismaClient({
    adapter: isLocalUrl(connectionString)
      ? new PrismaPg({ connectionString })
      : new PrismaNeon({ connectionString }),
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
