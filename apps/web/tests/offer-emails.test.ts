import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

const testDb = vi.hoisted(() => ({ stop: async () => {} }));
vi.mock("@/neon-db", async () => {
  const { startTestDb } = await import("./helpers/test-db");
  const t = await startTestDb();
  testDb.stop = t.stop;
  return { prisma: t.prisma };
});
const sendEmail = vi.hoisted(() => vi.fn<(m: { to: string; subject: string; html: string }) => Promise<string>>());
vi.mock("@/lib/email", () => ({ sendEmail }));

import { prisma as _prisma } from "@/neon-db";
import { createOffer } from "@/lib/offers";
import { acceptOffer, cancelMatch } from "@/lib/matches";
import { setPhoneShare } from "@/lib/handoff";
import { emailMatchCancelled, emailOfferAccepted, emailOfferReceived } from "@/lib/offer-emails";
import { appUrl } from "@/lib/app-url";

const prisma = _prisma as unknown as PrismaClient;
const future = () => new Date(Date.now() + 30 * 86_400_000);
const SITE = "https://nyeaka.test";

let n = 0;
const user = (tag: string, extra: Record<string, unknown> = {}) =>
  prisma.user.create({ data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T`, ...extra } });
const listing = (donorId: string, title: string) =>
  prisma.listing.create({
    data: {
      donorId, deviceType: "LAPTOP", title, description: "d", brand: "B", model: "M",
      condition: "GOOD", countryCode: "NG", city: "Lagos", expiresAt: future(),
    },
  });
const request = (requesterId: string, title: string) =>
  prisma.request.create({
    data: { requesterId, title, description: "d", countryCode: "NG", city: "Lagos", expiresAt: future() },
  });
const mails = () => sendEmail.mock.calls.map((c) => c[0]);
const to = (email: string) => mails().filter((m) => m.to === email);

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Report","Block","Message","Offer","Match","Listing","Request","user" CASCADE');
  sendEmail.mockReset();
  sendEmail.mockResolvedValue("id");
  process.env.BETTER_AUTH_URL = SITE;
});
afterAll(() => testDb.stop());

describe("appUrl", () => {
  it("joins the configured site address with a path", () => {
    process.env.BETTER_AUTH_URL = "https://x.test/";
    expect(appUrl("/dashboard")).toBe("https://x.test/dashboard");
    expect(appUrl("messages/1")).toBe("https://x.test/messages/1");
  });
});

describe("emailOfferReceived", () => {
  it("a donor's offer goes to the requester", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    const [l, r] = [await listing(donor.id, "Dell Latitude"), await request(req.id, "Laptop for school")];
    const o = await createOffer(donor.id, { listingId: l.id, requestId: r.id, message: "SECRET NOTE TEXT" });

    await emailOfferReceived(o.id);

    expect(mails()).toHaveLength(1);
    const m = mails()[0];
    expect(m.to).toBe(req.email);
    expect(m.subject).toBe("dee offered you a device on Nyeaka");
    expect(m.html).toContain("Hi rae");
    expect(m.html).toContain("Dell Latitude");
    expect(m.html).toContain("Laptop for school");
    expect(m.html).toContain(`${SITE}/dashboard`);
    expect(m.html).not.toContain("SECRET NOTE TEXT"); // message text stays in the app
  });

  it("a requester's ask goes to the donor", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    const [l, r] = [await listing(donor.id, "Dell Latitude"), await request(req.id, "Laptop for school")];
    const o = await createOffer(req.id, { listingId: l.id, requestId: r.id });

    await emailOfferReceived(o.id);

    expect(to(donor.email)).toHaveLength(1);
    expect(to(req.email)).toHaveLength(0);
    expect(mails()[0].subject).toBe("rae asked for your Dell Latitude");
    expect(mails()[0].html).toContain("would like your");
  });

  it("escapes titles written by users", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    const [l, r] = [await listing(donor.id, `<img src=x onerror=alert(1)>`), await request(req.id, `"quoted" & <b>bold</b>`)];
    const o = await createOffer(donor.id, { listingId: l.id, requestId: r.id });
    await emailOfferReceived(o.id);
    const html = mails()[0].html;
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("does nothing for an unknown offer", async () => {
    await emailOfferReceived("missing");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("emailOfferAccepted", () => {
  it("tells the sender, and tells everyone whose offer closed, with the right wording", async () => {
    const [d1, d2, q1, q2] = [await user("d1"), await user("d2"), await user("q1"), await user("q2")];
    const [l1, l2] = [await listing(d1.id, "Laptop One"), await listing(d2.id, "Laptop Two")];
    const [r1, r2] = [await request(q1.id, "Request One"), await request(q2.id, "Request Two")];
    const winning = await createOffer(d1.id, { listingId: l1.id, requestId: r1.id });
    await createOffer(d2.id, { listingId: l2.id, requestId: r1.id }); // rival donor, same request
    await createOffer(d1.id, { listingId: l1.id, requestId: r2.id }); // same device, other request

    const result = await acceptOffer(q1.id, winning.id);
    await emailOfferAccepted(q1.id, result);

    // accepted: to the sender (d1), linking straight to the chat
    const accepted = to(d1.email);
    expect(accepted).toHaveLength(1);
    expect(accepted[0].subject).toBe("q1 accepted: a chat is open");
    expect(accepted[0].html).toContain(`${SITE}/messages/${result.conversationId}`);
    expect(accepted[0].html).toContain("Laptop One");

    // the rival donor: told their offer lost out
    const rival = to(d2.email);
    expect(rival).toHaveLength(1);
    expect(rival[0].subject).toBe("Your offer wasn't selected");
    expect(rival[0].html).toContain("Request One");
    expect(rival[0].html).toContain(`${SITE}/requests`);

    // the other requester: told the device went elsewhere, and that their request is still open
    const waiting = to(q2.email);
    expect(waiting).toHaveLength(1);
    expect(waiting[0].subject).toBe("That device has gone to someone else");
    expect(waiting[0].html).toContain("Laptop One");
    expect(waiting[0].html).toContain("still open");
    expect(waiting[0].html).toContain(`${SITE}/listings`);

    // the accepter gets nothing, and nobody is emailed twice
    expect(to(q1.email)).toHaveLength(0);
    expect(mails()).toHaveLength(3);
  });

  it("never includes phone numbers", async () => {
    const [donor, req] = [await user("dee", { phone: "+2348011111111" }), await user("rae", { phone: "+2348022222222" })];
    const [l, r] = [await listing(donor.id, "Dell"), await request(req.id, "Need")];
    const o = await createOffer(donor.id, { listingId: l.id, requestId: r.id });
    const res = await acceptOffer(req.id, o.id);
    await setPhoneShare(donor.id, res.matchId, true);
    await setPhoneShare(req.id, res.matchId, true);

    await emailOfferReceived(o.id);
    await emailOfferAccepted(req.id, res);
    await cancelMatch(req.id, res.matchId);
    await emailMatchCancelled(req.id, res.matchId);

    expect(mails().length).toBeGreaterThan(0);
    for (const m of mails()) {
      expect(m.html).not.toContain("2348011111111");
      expect(m.html).not.toContain("2348022222222");
    }
  });
});

describe("emailMatchCancelled", () => {
  it("tells the other person, in terms of their own post", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    const [l, r] = [await listing(donor.id, "Dell"), await request(req.id, "Need a laptop")];
    const o = await createOffer(donor.id, { listingId: l.id, requestId: r.id });
    const { matchId } = await acceptOffer(req.id, o.id);
    await cancelMatch(donor.id, matchId);

    await emailMatchCancelled(donor.id, matchId);
    expect(mails()).toHaveLength(1);
    expect(mails()[0].to).toBe(req.email);
    expect(mails()[0].subject).toBe("dee cancelled your match");
    expect(mails()[0].html).toContain("Need a laptop");
    expect(mails()[0].html).toContain("open to new offers again");

    sendEmail.mockClear();
    await emailMatchCancelled(req.id, matchId);
    expect(mails()[0].to).toBe(donor.email);
    expect(mails()[0].html).toContain("Your device is open to new offers again");
  });
});

describe("failures", () => {
  it("a mail provider outage never throws or blocks the caller", async () => {
    const [donor, req] = [await user("dee"), await user("rae")];
    const [l, r] = [await listing(donor.id, "Dell"), await request(req.id, "Need")];
    const o = await createOffer(donor.id, { listingId: l.id, requestId: r.id });
    const res = await acceptOffer(req.id, o.id);

    sendEmail.mockRejectedValue(new Error("provider down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(emailOfferReceived(o.id)).resolves.toBeUndefined();
    await expect(emailOfferAccepted(req.id, res)).resolves.toBeUndefined();
    await expect(emailMatchCancelled(req.id, res.matchId)).resolves.toBeUndefined();
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });

  it("a failed email doesn't stop the next recipients getting theirs", async () => {
    const [d1, d2, q1, q2] = [await user("d1"), await user("d2"), await user("q1"), await user("q2")];
    const [l1, l2] = [await listing(d1.id, "L1"), await listing(d2.id, "L2")];
    const [r1, r2] = [await request(q1.id, "R1"), await request(q2.id, "R2")];
    const winning = await createOffer(d1.id, { listingId: l1.id, requestId: r1.id });
    await createOffer(d2.id, { listingId: l2.id, requestId: r1.id });
    await createOffer(d1.id, { listingId: l1.id, requestId: r2.id });
    const res = await acceptOffer(q1.id, winning.id);

    sendEmail.mockRejectedValueOnce(new Error("first one fails"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await emailOfferAccepted(q1.id, res);
    quiet.mockRestore();
    expect(sendEmail).toHaveBeenCalledTimes(3); // all three were attempted
  });
});
