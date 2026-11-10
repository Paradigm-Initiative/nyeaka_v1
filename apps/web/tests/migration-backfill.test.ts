import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { splitSql } from "./helpers/test-db";

const dir = path.resolve(__dirname, "../prisma/migrations");
const NEW = "20261110120000_offer_donor_and_match_handoff";

it("backfills donorId/initiatedById on offers that existed before the migration", async () => {
  const db = await PGlite.create({ extensions: { pg_trgm } });
  const names = fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isDirectory()).sort();
  const run = async (n: string) => {
    for (const s of splitSql(fs.readFileSync(path.join(dir, n, "migration.sql"), "utf8"))) await db.exec(s);
  };

  for (const n of names.filter((n) => n < NEW)) await run(n);

  await db.exec(`INSERT INTO "user"(id,email,"firstName","lastName",name,"updatedAt") VALUES
    ('d','d@t.test','D','T','D T',now()),('r','r@t.test','R','T','R T',now())`);
  await db.exec(`INSERT INTO "Listing"(id,"donorId","deviceType",title,description,brand,model,condition,photos,"countryCode",city,"expiresAt","updatedAt")
    VALUES ('l','d','LAPTOP','t','d','HP','1','GOOD','{}','NG','Lagos',now()+interval '1 day',now())`);
  await db.exec(`INSERT INTO "Request"(id,"requesterId",title,description,"countryCode",city,"expiresAt","updatedAt")
    VALUES ('q','r','t','d','NG','Lagos',now()+interval '1 day',now())`);
  await db.exec(`INSERT INTO "Offer"(id,"listingId","requestId","updatedAt") VALUES ('o','l','q',now())`);

  await run(NEW);

  const { rows } = await db.query<{ donorId: string; initiatedById: string }>(
    `SELECT "donorId","initiatedById" FROM "Offer" WHERE id='o'`,
  );
  expect(rows[0]).toEqual({ donorId: "d", initiatedById: "d" });
  await db.close();
});
