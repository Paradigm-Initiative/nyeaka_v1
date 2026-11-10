import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { ServiceError } from "@/lib/errors";

const testDb = vi.hoisted(() => ({ stop: async () => {} }));
vi.mock("@/neon-db", async () => {
  const { startTestDb } = await import("./helpers/test-db");
  const t = await startTestDb();
  testDb.stop = t.stop;
  return { prisma: t.prisma };
});

import { prisma as _prisma } from "@/neon-db";
import { createOffer } from "@/lib/offers";
import { acceptOffer, cancelMatch } from "@/lib/matches";
import { getThread, markThreadRead, sendMessage, THREAD_PAGE_SIZE } from "@/lib/messages";

const prisma = _prisma as unknown as PrismaClient;
const future = () => new Date(Date.now() + 30 * 86_400_000);

let n = 0;
const user = (tag: string) =>
  prisma.user.create({ data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T` } });

/** A donor, a requester and an accepted match (so a real conversation exists). */
async function matched() {
  const [donor, req] = [await user("dee"), await user("rae")];
  const l = await prisma.listing.create({
    data: {
      donorId: donor.id, deviceType: "LAPTOP", title: "Dell", description: "d", brand: "Dell", model: "5490",
      condition: "GOOD", countryCode: "NG", city: "Lagos", area: "Yaba", expiresAt: future(),
    },
  });
  const r = await prisma.request.create({
    data: { requesterId: req.id, title: "Need laptop", description: "d", countryCode: "NG", city: "Lagos", expiresAt: future() },
  });
  const o = await createOffer(donor.id, { listingId: l.id, requestId: r.id });
  const { conversationId, matchId } = await acceptOffer(req.id, o.id);
  return { donor, req, conversationId, matchId };
}

async function rejects(p: Promise<unknown>, code: string, msg?: RegExp) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).code).toBe(code);
  if (msg) expect((err as ServiceError).message).toMatch(msg);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Message","Offer","Match","Listing","Request","user" CASCADE');
});
afterAll(() => testDb.stop());

describe("sendMessage", () => {
  it("either participant can write; messages are trimmed", async () => {
    const { donor, req, conversationId } = await matched();
    await sendMessage(donor.id, conversationId, { body: "  Hello!  " });
    await sendMessage(req.id, conversationId, { body: "Hi, Saturday?" });
    const rows = await prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => [r.senderId, r.body])).toEqual([[donor.id, "Hello!"], [req.id, "Hi, Saturday?"]]);
  });

  it("rejects empty, whitespace-only and over-long messages", async () => {
    const { donor, conversationId } = await matched();
    await expect(sendMessage(donor.id, conversationId, { body: "" })).rejects.toThrow();
    await expect(sendMessage(donor.id, conversationId, { body: "   \n " })).rejects.toThrow();
    await expect(sendMessage(donor.id, conversationId, { body: "x".repeat(2001) })).rejects.toThrow();
    await sendMessage(donor.id, conversationId, { body: "x".repeat(2000) });
    expect(await prisma.message.count()).toBe(1);
  });

  it("strangers cannot write, unknown conversations 404", async () => {
    const { conversationId } = await matched();
    const stranger = await user("eve");
    await rejects(sendMessage(stranger.id, conversationId, { body: "hi" }), "FORBIDDEN");
    await rejects(sendMessage(stranger.id, "missing", { body: "hi" }), "NOT_FOUND");
    expect(await prisma.message.count()).toBe(0);
  });

  it("is closed after the match is cancelled, but stays open after handover", async () => {
    const { donor, conversationId, matchId } = await matched();
    await prisma.match.update({ where: { id: matchId }, data: { status: "HANDED_OVER" } });
    await sendMessage(donor.id, conversationId, { body: "Thanks again" });

    await prisma.match.update({ where: { id: matchId }, data: { status: "ACTIVE" } });
    await cancelMatch(donor.id, matchId);
    await rejects(sendMessage(donor.id, conversationId, { body: "still there?" }), "INVALID", /chat is closed/);
    expect(await prisma.message.count()).toBe(1);
  });
});

describe("getThread", () => {
  it("returns chronological messages with a per-viewer 'mine' flag and the other person's details", async () => {
    const { donor, req, conversationId, matchId } = await matched();
    await prisma.user.update({ where: { id: req.id }, data: { idVerified: true } });
    const base = Date.now() - 60_000;
    for (const [i, [sender, body]] of ([[donor.id, "one"], [req.id, "two"], [donor.id, "three"]] as const).entries())
      await prisma.message.create({ data: { conversationId, senderId: sender, body, createdAt: new Date(base + i * 1000) } });

    const asDonor = await getThread(donor.id, conversationId);
    expect(asDonor).toMatchObject({
      id: conversationId, matchId, matchStatus: "ACTIVE", role: "donor",
      other: { firstName: "rae", idVerified: true }, listingTitle: "Dell", requestTitle: "Need laptop", place: "Yaba, Lagos",
    });
    expect(asDonor.messages.map((m) => [m.body, m.mine])).toEqual([["one", true], ["two", false], ["three", true]]);

    const asReq = await getThread(req.id, conversationId);
    expect(asReq.role).toBe("requester");
    expect(asReq.other.firstName).toBe("dee");
    expect(asReq.messages.map((m) => m.mine)).toEqual([false, true, false]);
  });

  it("is participants-only", async () => {
    const { conversationId } = await matched();
    const stranger = await user("eve");
    await rejects(getThread(stranger.id, conversationId), "FORBIDDEN");
    await rejects(getThread(stranger.id, "missing"), "NOT_FOUND");
  });

  it("reports a cancelled match so the UI can close the chat", async () => {
    const { donor, conversationId, matchId } = await matched();
    await cancelMatch(donor.id, matchId);
    expect((await getThread(donor.id, conversationId)).matchStatus).toBe("CANCELLED");
  });

  it("returns only the latest page of messages, oldest first", async () => {
    const { donor, conversationId } = await matched();
    const total = THREAD_PAGE_SIZE + 5;
    const t0 = Date.now() - total * 1000;
    await prisma.message.createMany({
      data: Array.from({ length: total }, (_, i) => ({
        conversationId, senderId: donor.id, body: `m${i}`, createdAt: new Date(t0 + i * 1000),
      })),
    });
    const { messages } = await getThread(donor.id, conversationId);
    expect(messages).toHaveLength(THREAD_PAGE_SIZE);
    expect(messages[0].body).toBe("m5");
    expect(messages.at(-1)?.body).toBe(`m${total - 1}`);
  });

  it("does not leak other conversations' messages", async () => {
    const a = await matched();
    const b = await matched();
    await sendMessage(a.donor.id, a.conversationId, { body: "secret A" });
    await sendMessage(b.donor.id, b.conversationId, { body: "secret B" });
    expect((await getThread(a.donor.id, a.conversationId)).messages.map((m) => m.body)).toEqual(["secret A"]);
  });
});

describe("markThreadRead", () => {
  it("marks only the other person's unread messages", async () => {
    const { donor, req, conversationId } = await matched();
    const mine = await sendMessage(donor.id, conversationId, { body: "from donor" });
    const theirs = await sendMessage(req.id, conversationId, { body: "from requester" });

    await markThreadRead(donor.id, conversationId);

    const read = async (id: string) => (await prisma.message.findUniqueOrThrow({ where: { id } })).readAt;
    expect(await read(mine.id)).toBeNull();
    expect(await read(theirs.id)).toBeInstanceOf(Date);
  });

  it("keeps the original read time on later calls", async () => {
    const { donor, req, conversationId } = await matched();
    const m = await sendMessage(req.id, conversationId, { body: "hi" });
    await markThreadRead(donor.id, conversationId);
    const first = (await prisma.message.findUniqueOrThrow({ where: { id: m.id } })).readAt;
    await new Promise((r) => setTimeout(r, 20));
    await markThreadRead(donor.id, conversationId);
    expect((await prisma.message.findUniqueOrThrow({ where: { id: m.id } })).readAt).toEqual(first);
  });
});
