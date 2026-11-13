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
import { createListing, updateListing } from "@/lib/listings";
import { createRequest } from "@/lib/requests";
import { createOffer } from "@/lib/offers";
import { getCities, getLiveListings, getLiveRequests, getRecentListings } from "@/lib/queries";
import {
  assertSameCountry,
  COUNTRY_UNAVAILABLE,
  DIFFERENT_COUNTRY,
  prepareNewUser,
  requirePostingCountry,
} from "@/lib/country-rules";
import { errorKey } from "@/lib/error-keys";
import { parseBrowseParams, browseHref } from "@/lib/browse-params";
import { signUpSchema } from "@/validations/auth-validation";
import type { CreateListingInput, CreateRequestInput } from "@/validations/post-validation";

const prisma = _prisma as unknown as PrismaClient;
const future = () => new Date(Date.now() + 30 * 86_400_000);

let n = 0;
const user = (tag: string, countryCode = "NG") =>
  prisma.user.create({ data: { email: `${tag}${++n}@t.test`, firstName: tag, lastName: "T", name: `${tag} T`, idVerificationStatus: "VERIFIED", countryCode } });
const listing = (donorId: string, countryCode = "NG", city = "Lagos") =>
  prisma.listing.create({
    data: { donorId, deviceType: "LAPTOP", title: `HP ${countryCode} ${city}`, description: "d", brand: "HP", model: "450", condition: "GOOD", countryCode, city, expiresAt: future() },
  });
const request = (requesterId: string, countryCode = "NG", city = "Lagos") =>
  prisma.request.create({
    data: { requesterId, title: `Need ${countryCode} ${city}`, description: "d", countryCode, city, expiresAt: future() },
  });

async function rejects(p: Promise<unknown>, code: string, msg?: string) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).code).toBe(code);
  if (msg) expect((err as ServiceError).message).toBe(msg);
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Rating","Report","Block","Message","Offer","Match","Listing","Request","user" CASCADE');
});
afterAll(() => testDb.stop());

const listingInput: CreateListingInput = { deviceType: "LAPTOP", brand: "HP", model: "1", condition: "GOOD", city: "Lagos", photos: [] };
const requestInput: CreateRequestInput = { deviceType: "LAPTOP", title: "Need a laptop", description: "For my studies this term", city: "Lagos", pledge: true };

describe("posting country", () => {
  it("is the account's country: an enabled one is returned, anything else is refused", async () => {
    expect(await requirePostingCountry((await user("ng")).id)).toBe("NG");
    expect(await requirePostingCountry((await user("gh", "GH")).id)).toBe("GH"); // enabled by the seed migration
    await rejects(requirePostingCountry((await user("eg", "EG")).id), "INVALID", COUNTRY_UNAVAILABLE);
    await rejects(requirePostingCountry("missing"), "INVALID", COUNTRY_UNAVAILABLE);
  });

  it("listings and requests take the poster's country, whatever the client sends", async () => {
    const u = await user("ng");
    const sneaky = { countryCode: "GH" };
    const l = await createListing(u.id, { ...listingInput, ...sneaky } as never);
    const r = await createRequest(u.id, { ...requestInput, ...sneaky } as never);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).countryCode).toBe("NG");
    expect((await prisma.request.findUniqueOrThrow({ where: { id: r.id } })).countryCode).toBe("NG");
  });

  it("someone in a country that isn't enabled can't post", async () => {
    const eg = await user("eg", "EG");
    await rejects(createListing(eg.id, listingInput), "INVALID", COUNTRY_UNAVAILABLE);
    await rejects(createRequest(eg.id, requestInput), "INVALID", COUNTRY_UNAVAILABLE);
    expect(await prisma.listing.count()).toBe(0);
  });

  it("editing a listing never changes its country", async () => {
    const u = await user("ng");
    const { id } = await createListing(u.id, listingInput);
    await updateListing(u.id, id, { ...listingInput, city: "Abuja", countryCode: "GH" } as never);
    expect(await prisma.listing.findUniqueOrThrow({ where: { id } })).toMatchObject({ city: "Abuja", countryCode: "NG" });
  });
});

describe("same-country offers", () => {
  it("assertSameCountry compares codes", () => {
    expect(() => assertSameCountry("NG", "NG")).not.toThrow();
    expect(() => assertSameCountry("NG", "GH")).toThrow(DIFFERENT_COUNTRY);
  });

  it("an offer between a listing and a request in different countries is refused", async () => {
    const [donor, req] = [await user("donor"), await user("req")];
    const [l, r] = [await listing(donor.id, "NG"), await request(req.id, "GH")];
    await rejects(createOffer(donor.id, { listingId: l.id, requestId: r.id }), "INVALID", DIFFERENT_COUNTRY);
    await rejects(createOffer(req.id, { listingId: l.id, requestId: r.id }), "INVALID", DIFFERENT_COUNTRY);
    expect(await prisma.offer.count()).toBe(0);
  });

  it("an offer within one country still works", async () => {
    const [donor, req] = [await user("donor"), await user("req")];
    const [l, r] = [await listing(donor.id), await request(req.id)];
    await createOffer(donor.id, { listingId: l.id, requestId: r.id });
    expect(await prisma.offer.count()).toBe(1);
  });

  it("both refusals map to a translation key, so nobody sees raw English", () => {
    expect(errorKey(COUNTRY_UNAVAILABLE, "INVALID")).toBe("countryUnavailable");
    expect(errorKey(DIFFERENT_COUNTRY, "INVALID")).toBe("differentCountry");
  });
});

describe("browse by country", () => {
  async function seed() {
    const [a, b, c] = [await user("a"), await user("b"), await user("c", "GH")];
    await listing(a.id, "NG", "Lagos");
    await listing(b.id, "NG", "Abuja");
    await listing(c.id, "GH", "Accra");
    await request(a.id, "NG", "Lagos");
    await request(c.id, "GH", "Accra");
    return { a };
  }
  const titles = (r: { items: { title: string }[] }) => r.items.map((i) => i.title).sort();

  it("a viewer's own country is the default, a guest sees every country", async () => {
    const { a } = await seed();
    const f = parseBrowseParams({});
    expect(titles(await getLiveListings(f, a.id, "NG"))).toEqual(["HP NG Abuja", "HP NG Lagos"]);
    expect(titles(await getLiveListings(f))).toEqual(["HP GH Accra", "HP NG Abuja", "HP NG Lagos"]);
    expect(titles(await getLiveRequests(f, a.id, "NG"))).toEqual(["Need NG Lagos"]);
    expect(titles(await getLiveRequests(f))).toEqual(["Need GH Accra", "Need NG Lagos"]);
  });

  it("an explicit ?country= wins over the default", async () => {
    const { a } = await seed();
    const f = parseBrowseParams({ country: "gh" });
    expect(f.country).toBe("GH");
    expect(titles(await getLiveListings(f, a.id, "NG"))).toEqual(["HP GH Accra"]);
    expect(browseHref("/listings", f)).toBe("/listings?country=GH");
  });

  it("ignores a country that isn't one we know", () => {
    expect(parseBrowseParams({ country: "ZZ" }).country).toBeUndefined();
    expect(parseBrowseParams({ country: "nigeria" }).country).toBeUndefined();
    expect(parseBrowseParams({}).country).toBeUndefined();
  });

  it("city filter options and the home feed follow the country too", async () => {
    const { a } = await seed();
    expect(await getCities("listing", "NG")).toEqual(["Abuja", "Lagos"]);
    expect(await getCities("listing", "GH")).toEqual(["Accra"]);
    expect((await getCities("listing")).sort()).toEqual(["Abuja", "Accra", "Lagos"]);
    expect((await getRecentListings(10, a.id, "NG")).map((l) => l.title).sort()).toEqual(["HP NG Abuja", "HP NG Lagos"]);
  });
});

describe("new accounts", () => {
  it("prepareNewUser accepts an enabled country (any case) and normalises it", async () => {
    expect(await prepareNewUser({ countryCode: " ng ", locale: "fr" })).toEqual({ ok: true, countryCode: "NG", locale: "fr" });
    expect(await prepareNewUser({ countryCode: "gh" })).toMatchObject({ ok: true, countryCode: "GH" });
  });

  it("falls back to English for a language we don't have", async () => {
    expect(await prepareNewUser({ countryCode: "NG", locale: "xx" })).toMatchObject({ ok: true, locale: "en" });
    expect(await prepareNewUser({ countryCode: "NG" })).toMatchObject({ ok: true, locale: "en" });
  });

  it("refuses a missing, malformed or not-enabled country", async () => {
    for (const countryCode of [undefined, null, "", "EG", "GB", "Nigeria", 234])
      expect(await prepareNewUser({ countryCode })).toEqual({ ok: false, code: "COUNTRY_NOT_AVAILABLE" });
  });

  it("the sign-up form schema needs a country to be chosen (the server checks it is enabled)", () => {
    const base = { email: "a@b.co", firstName: "Ada", lastName: "Eze", password: "Str0ng!Passw0rd", confirmPassword: "Str0ng!Passw0rd", acceptedTerms: true };
    expect(signUpSchema.safeParse({ ...base, countryCode: "NG" }).success).toBe(true);
    for (const countryCode of [undefined, "", "N"]) {
      const r = signUpSchema.safeParse({ ...base, countryCode });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe("countryCode"); // translated by the UI
    }
  });
});
