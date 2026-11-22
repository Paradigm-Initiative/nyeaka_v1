import "dotenv/config";
import { createFirstAdmin } from "../lib/first-admin";
import { prisma } from "../neon-db";

// Run once after the first deploy:  SEED_ADMIN_EMAIL=you@example.org pnpm admin:first
// Safe in production: does nothing if an admin already exists. Not the dev seed.
createFirstAdmin(process.env.SEED_ADMIN_EMAIL)
  .then((r) => {
    if (r.created) console.log(`First admin ready: ${r.email}. A set-password email was sent.`);
    else if (r.reason === "bad-country") console.error("SEED_ADMIN_COUNTRY must be a 2-letter African country code, e.g. NG.");
    else if (r.reason === "no-email") console.error("SEED_ADMIN_EMAIL is not set; nothing done.");
    else console.log("An admin already exists; nothing done.");
  })
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
