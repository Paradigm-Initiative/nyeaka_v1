import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Splits Prisma-generated SQL on statement-ending semicolons (no function bodies in our migrations). */
export function splitSql(sql: string): string[] {
  const noComments = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  return noComments
    .split(/;\s*(?:\n|$)/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * An in-process Postgres (PGlite) with every real migration applied, exposed
 * over a local socket so the normal Prisma client can talk to it. Nothing here
 * touches the Neon database.
 */
export async function startTestDb() {
  const db = await PGlite.create({ extensions: { pg_trgm } });

  const dir = path.resolve(__dirname, "../../prisma/migrations");
  const names = fs
    .readdirSync(dir)
    .filter((n) => fs.statSync(path.join(dir, n)).isDirectory())
    .sort();
  for (const n of names) {
    // One statement at a time: PGlite wraps a multi-statement string in a single
    // transaction, and "ALTER TYPE ... ADD VALUE" can't be used in the same one.
    for (const stmt of splitSql(fs.readFileSync(path.join(dir, n, "migration.sql"), "utf8"))) {
      await db.exec(stmt);
    }
  }

  const server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1", maxConnections: 10 });
  await server.start();
  const addr = server.getServerConn();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: `postgres://postgres:postgres@${addr}/postgres?sslmode=disable`,
      max: 4,
    }),
  });

  return {
    prisma,
    db,
    async stop() {
      await prisma.$disconnect();
      await server.stop();
      await db.close();
    },
  };
}
