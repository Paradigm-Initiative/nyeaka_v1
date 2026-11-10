/**
 * Throwaway local database for trying the app in a browser without touching Neon.
 *
 *   pnpm exec tsx tests/helpers/dev-db.ts
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5544/postgres?sslmode=disable pnpm dev
 *
 * Applies every migration to an in-memory Postgres and seeds a few verified
 * users (password "Passw0rd!x1") with posts. Everything is lost on exit.
 */
import { hashPassword } from "better-auth/crypto";
import { startTestDb } from "./test-db";

const PORT = Number(process.env.DEV_DB_PORT ?? 5544);
const PASSWORD = "Passw0rd!x1";
const future = new Date(Date.now() + 45 * 86_400_000);

async function main() {
  const { prisma } = await startTestDb({ port: PORT });
  const hash = await hashPassword(PASSWORD);

  const people = [
    ["alice", "Alice", "Donor"],
    ["bob", "Bob", "Asker"],
    ["carol", "Carol", "Asker"],
    ["dave", "Dave", "Donor"],
  ] as const;
  for (const [id, first, last] of people) {
    await prisma.user.create({
      data: {
        id, email: `${id}@dev.nyeaka.test`, emailVerified: true, firstName: first, lastName: last,
        name: `${first} ${last}`, countryCode: "NG", country: "Nigeria", role: "BOTH",
        accounts: { create: { id: `acc-${id}`, accountId: id, providerId: "credential", password: hash } },
      },
    });
  }
  const listing = (id: string, donorId: string, title: string, brand: string, model: string) =>
    prisma.listing.create({
      data: {
        id, donorId, title, brand, model, deviceType: "LAPTOP", condition: "GOOD", description: `${title} in good condition.`,
        countryCode: "NG", city: "Lagos", area: "Yaba", expiresAt: future,
      },
    });
  const request = (id: string, requesterId: string, title: string) =>
    prisma.request.create({
      data: { id, requesterId, title, description: `${title}, for study.`, deviceType: "LAPTOP", countryCode: "NG", city: "Lagos", area: "Ikeja", expiresAt: future },
    });

  await listing("l-alice-1", "alice", "Dell Latitude 5490", "Dell", "Latitude 5490");
  await listing("l-alice-2", "alice", "HP ProBook 450", "HP", "ProBook 450");
  await listing("l-dave-1", "dave", "Lenovo ThinkPad T480", "Lenovo", "ThinkPad T480");
  await request("r-bob-1", "bob", "Laptop for coding classes");
  await request("r-bob-2", "bob", "Second laptop for my sister");
  await request("r-carol-1", "carol", "Laptop for job applications");

  console.log(`dev db ready on port ${PORT}`);
  // Keep the process (and the in-memory database) alive.
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
