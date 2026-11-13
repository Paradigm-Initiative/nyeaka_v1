import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { splitSql } from "./helpers/test-db";

const dir = path.resolve(__dirname, "../prisma/migrations");
const NEW = "20261113120000_country_required_and_locale";

async function dbBefore() {
  const db = await PGlite.create({ extensions: { pg_trgm } });
  const names = fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isDirectory()).sort();
  const run = async (n: string) => {
    for (const s of splitSql(fs.readFileSync(path.join(dir, n, "migration.sql"), "utf8"))) await db.exec(s);
  };
  for (const n of names.filter((n) => n < NEW)) await run(n);
  return { db, runNew: () => run(NEW) };
}

const insert = (db: PGlite, rows: [id: string, code: string | null, country: string | null][]) =>
  db.exec(
    `INSERT INTO "user"(id,email,"firstName","lastName",name,"countryCode",country,"updatedAt") VALUES ` +
      rows
        .map(([id, c, n]) => `('${id}','${id}@t.test','F','L','F L',${c === null ? "NULL" : `'${c}'`},${n === null ? "NULL" : `'${n}'`},now())`)
        .join(","),
  );

describe("country_required_and_locale migration", () => {
  it("fills a missing country with NG, keeps and upper-cases the rest, and defaults the language", async () => {
    const { db, runNew } = await dbBefore();
    await insert(db, [["none", null, null], ["named", null, "Nigeria"], ["gh", " gh", "Ghana"], ["za", "ZA", "South Africa"]]);
    await runNew();

    const { rows } = await db.query<{ id: string; countryCode: string; locale: string }>(
      `SELECT id,"countryCode",locale FROM "user" ORDER BY id`,
    );
    expect(rows).toEqual([
      { id: "gh", countryCode: "GH", locale: "en" },
      { id: "named", countryCode: "NG", locale: "en" },
      { id: "none", countryCode: "NG", locale: "en" },
      { id: "za", countryCode: "ZA", locale: "en" },
    ]);
    await db.close();
  });

  it("drops the country-name column and makes the code required", async () => {
    const { db, runNew } = await dbBefore();
    await runNew();
    const cols = await db.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name,is_nullable FROM information_schema.columns WHERE table_name='user' AND column_name IN ('country','countryCode','locale')`,
    );
    const by = Object.fromEntries(cols.rows.map((c) => [c.column_name, c.is_nullable]));
    expect(by).toEqual({ countryCode: "NO", locale: "NO" });
    await expect(
      db.exec(`INSERT INTO "user"(id,email,"firstName","lastName",name,"updatedAt") VALUES ('x','x@t.test','F','L','F L',now())`),
    ).rejects.toThrow();
    await db.close();
  });

  it("stops (instead of guessing) when an existing country code is malformed", async () => {
    const { db, runNew } = await dbBefore();
    await insert(db, [["bad", "Ghana", null]]);
    await expect(runNew()).rejects.toThrow(/user_countryCode_format_check/);
    await db.close();
  });
});
