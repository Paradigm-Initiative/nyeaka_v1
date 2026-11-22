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
import { hashDocNumber } from "../../lib/verification";

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
        name: `${first} ${last}`, countryCode: "NG", role: "BOTH", idVerificationStatus: "VERIFIED",
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
  await listing("l-alice-3", "alice", "Acer Aspire 5", "Acer", "Aspire 5");
  await listing("l-alice-4", "alice", "Asus VivoBook 14", "Asus", "VivoBook 14");
  await listing("l-dave-1", "dave", "Lenovo ThinkPad T480", "Lenovo", "ThinkPad T480");
  await request("r-bob-1", "bob", "Laptop for coding classes");
  await request("r-bob-2", "bob", "Second laptop for my sister");
  await request("r-carol-1", "carol", "Laptop for job applications");
  await request("r-dave-1", "dave", "Laptop for my small business");

  // Staff (two-factor is NOT set up, so the first /admin visit sends them to enrolment).
  for (const [id, first, last, staffRole] of [
    ["admin", "Ada", "Admin", "ADMIN"],
    ["reviewer", "Rita", "Reviewer", "REVIEWER"],
    ["reviewer2", "Remi", "Reviewer", "REVIEWER"],
  ] as const) {
    await prisma.user.create({
      data: {
        id, email: `${id}@pin.org`, emailVerified: true, firstName: first, lastName: last, name: `${first} ${last}`,
        countryCode: "NG", role: "BOTH", staffRole,
        accounts: { create: { id: `acc-${id}`, accountId: id, providerId: "credential", password: hash } },
      },
    });
  }

  // Pending ID checks. Erin's name on the ID differs from her account; Frank and Gina used the
  // same document number (so a second reviewer is needed); Hank is clean. Images come from
  // tests/helpers/dev-images.ts when the app runs with S3_ENDPOINT=http://127.0.0.1:9100.
  process.env.ID_HASH_SECRET ??= "dev-only-id-hash-secret-0123456789";
  const applicants = [
    ["erin", "Erin", "Okafor", "Erin Okoro", "11111111111", 50],
    ["frank", "Frank", "Mensah", "Frank Mensah", "22222222222", 30],
    ["gina", "Gina", "Eze", "Gina Eze", "22222222222", 5],
    ["hank", "Hank", "Bello", "Hank Bello", "33333333333", 2],
  ] as const;
  for (const [id, first, last, nameOnId, docNumber, hoursAgo] of applicants) {
    await prisma.user.create({
      data: {
        id, email: `${id}@dev.nyeaka.test`, emailVerified: true, firstName: first, lastName: last, name: `${first} ${last}`,
        countryCode: "NG", role: "BOTH", idVerificationStatus: "PENDING",
        accounts: { create: { id: `acc-${id}`, accountId: id, providerId: "credential", password: hash } },
        idVerifications: {
          create: {
            countryCode: "NG", documentType: "NATIONAL_ID", fullNameOnId: nameOnId,
            docNumberHash: hashDocNumber("NG", "NATIONAL_ID", docNumber),
            frontKey: `id/${id}/front.jpg`, backKey: `id/${id}/back.jpg`, selfieKey: `id/${id}/selfie.jpg`,
            createdAt: new Date(Date.now() - hoursAgo * 3_600_000),
          },
        },
      },
    });
  }

  console.log(`dev db ready on port ${PORT}`);
  // Keep the process (and the in-memory database) alive.
  setInterval(() => {}, 1 << 30);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
