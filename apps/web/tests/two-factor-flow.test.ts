import { afterAll, describe, expect, it, vi } from "vitest";
const testDb = vi.hoisted(() => ({ stop: async () => {} }));
vi.mock("@/neon-db", async () => {
  const { startTestDb } = await import("./helpers/test-db");
  const t = await startTestDb();
  testDb.stop = t.stop;
  return { prisma: t.prisma };
});
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/neon-db";
import { auth } from "@/lib/auth";
import { acceptInvite, inviteStaff } from "@/lib/staff-invites";
import { createHmac } from "node:crypto";
function totp(secret: string) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = ""; for (const ch of secret.replace(/=+$/, "").toUpperCase()) bits += A.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(ctr).digest(); const o = h[19] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0");
}
afterAll(() => testDb.stop());

describe("staff two-factor, end to end with better-auth", () => {
  it("an invited account signs in, enrols a TOTP app, and is challenged next time", async () => {
    process.env.STAFF_EMAIL_DOMAINS = "pin.org";
    const p = prisma as unknown as PrismaClient;
    const admin = await p.user.create({ data: { email: "a@pin.org", firstName: "A", lastName: "B", name: "A B", countryCode: "GH", staffRole: "ADMIN", twoFactorEnabled: true } });
    const inv = await inviteStaff(admin.id, "n@pin.org", "REVIEWER");
    await acceptInvite(new URL(inv.url).searchParams.get("token")!, { firstName: "Nia", lastName: "Ok", password: "Passw0rd!long" });
    const signin = await auth.api.signInEmail({ body: { email: "n@pin.org", password: "Passw0rd!long" }, returnHeaders: true });
    const cookie = signin.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const headers = new Headers({ cookie });
    const en = await auth.api.enableTwoFactor({ body: { password: "Passw0rd!long", method: "totp" }, headers });
    const uri = (en as { totpURI: string }).totpURI;
    expect(uri).toContain("otpauth://");
    const secret = new URL(uri).searchParams.get("secret")!;
    const code = totp(secret);
    // better-auth stores the secret encrypted; the URI secret is plaintext
    await auth.api.verifyTOTP({ body: { code }, headers });
    expect((await p.user.findUnique({ where: { email: "n@pin.org" } }))?.twoFactorEnabled).toBe(true);
    // next sign-in demands the second factor
    const again = (await auth.api.signInEmail({ body: { email: "n@pin.org", password: "Passw0rd!long" } })) as { twoFactorRedirect?: boolean };
    expect(again.twoFactorRedirect).toBe(true);
  });
});
