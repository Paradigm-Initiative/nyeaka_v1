import { prisma } from "../neon-db";

// Idempotent: every row has a fixed id and is upserted. Seed users use the
// reserved, non-routable @seed.nyeaka.test domain and have no credentials.
const id = (n: string) => `seed-${n}`;
const future = new Date("2027-06-01");

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_SEED !== "true") {
    throw new Error(
      "Refusing to seed: set ALLOW_SEED=true (and not NODE_ENV=production) to run the seed.",
    );
  }

  const users = [
    { n: "amara", first: "Amara", last: "Osei", role: "DONOR", cc: "GH", country: "Ghana", idv: true },
    { n: "chidi", first: "Chidinma", last: "Eze", role: "REQUESTER", cc: "NG", country: "Nigeria", idv: false },
    { n: "kwame", first: "Kwame", last: "Mensah", role: "DONOR", cc: "GH", country: "Ghana", idv: false },
    { n: "zanele", first: "Zanele", last: "Dlamini", role: "BOTH", cc: "ZA", country: "South Africa", idv: false },
  ] as const;

  for (const u of users) {
    const data = {
      email: `${u.n}@seed.nyeaka.test`,
      emailVerified: true,
      firstName: u.first,
      lastName: u.last,
      name: `${u.first} ${u.last}`,
      role: u.role,
      country: u.country,
      countryCode: u.cc,
      idVerified: u.idv,
      idVerificationStatus: u.idv ? ("VERIFIED" as const) : ("NONE" as const),
    };
    await prisma.user.upsert({ where: { id: id(u.n) }, update: data, create: { id: id(u.n), ...data } });
  }

  const listings = [
    { n: "l1", donor: "amara", type: "LAPTOP", title: "Dell Latitude 5490", brand: "Dell", model: "Latitude 5490", condition: "GOOD", cc: "GH", spec: { ram: 8, storage: 256, year: 2018, os: "WINDOWS", screenSize: 14, hasCharger: true } },
    { n: "l2", donor: "kwame", type: "TABLET", title: "Samsung Galaxy Tab A7", brand: "Samsung", model: "Galaxy Tab A7", condition: "LIKE_NEW", cc: "GH", spec: { ram: 3, storage: 32, year: 2020, os: "ANDROID", screenSize: 10.4, hasCharger: true } },
    { n: "l3", donor: "amara", type: "SMARTPHONE", title: "iPhone 8", brand: "Apple", model: "iPhone 8", condition: "FAIR", cc: "GH", spec: { ram: 2, storage: 64, year: 2017, os: "IOS", hasCharger: false } },
    { n: "l4", donor: "zanele", type: "LAPTOP", title: "HP EliteBook 840 G5", brand: "HP", model: "EliteBook 840 G5", condition: "NEW", cc: "ZA", spec: { ram: 16, storage: 512, year: 2019, os: "WINDOWS", screenSize: 14, hasCharger: true } },
  ] as const;

  for (const l of listings) {
    const { spec, n, donor, type, cc, ...rest } = l;
    const data = { donorId: id(donor), deviceType: type, countryCode: cc, description: `${l.title} in ${l.condition.toLowerCase().replace("_", " ")} condition.`, photos: [], expiresAt: future, ...rest };
    await prisma.listing.upsert({ where: { id: id(n) }, update: data, create: { id: id(n), ...data } });
    await prisma.deviceSpec.upsert({ where: { listingId: id(n) }, update: spec, create: { id: id(`${n}-spec`), listingId: id(n), ...spec } });
  }

  const requests = [
    { n: "r1", by: "chidi", type: "LAPTOP", title: "Laptop for coding classes", cc: "NG", urgent: true },
    { n: "r2", by: "chidi", type: "TABLET", title: "Tablet for my daughter's schoolwork", cc: "NG", urgent: false },
    { n: "r3", by: "zanele", type: "SMARTPHONE", title: "Phone for job applications", cc: "ZA", urgent: false },
  ] as const;

  for (const r of requests) {
    const data = { requesterId: id(r.by), deviceType: r.type, title: r.title, description: r.title, countryCode: r.cc, isUrgent: r.urgent, expiresAt: future };
    await prisma.request.upsert({ where: { id: id(r.n) }, update: data, create: { id: id(r.n), ...data } });
  }

  // Offers: accepted (l1->r1), pending (l2->r2), declined (l3->r2)
  const offers = [
    { n: "o1", l: "l1", r: "r1", status: "ACCEPTED", message: "This Latitude should be great for coding." },
    { n: "o2", l: "l2", r: "r2", status: "PENDING", message: null },
    { n: "o3", l: "l3", r: "r2", status: "DECLINED", message: null },
  ] as const;
  for (const o of offers) {
    const data = { listingId: id(o.l), requestId: id(o.r), status: o.status, message: o.message };
    await prisma.offer.upsert({ where: { id: id(o.n) }, update: data, create: { id: id(o.n), ...data } });
  }

  // Match, conversation and messages for the accepted offer
  const match = { offerId: id("o1"), donorId: id("amara"), requesterId: id("chidi"), listingId: id("l1"), requestId: id("r1"), status: "HANDED_OVER" as const, handedOverAt: new Date("2026-11-01") };
  await prisma.match.upsert({ where: { id: id("m1") }, update: match, create: { id: id("m1"), ...match } });
  await prisma.conversation.upsert({ where: { id: id("c1") }, update: {}, create: { id: id("c1"), matchId: id("m1") } });

  const messages = [
    { n: "msg1", from: "amara", body: "Hi Chidinma, the laptop is yours. Where would suit you for pickup?", at: "2026-10-28T10:00:00Z" },
    { n: "msg2", from: "chidi", body: "Thank you so much! Is Saturday morning okay?", at: "2026-10-28T10:15:00Z" },
    { n: "msg3", from: "amara", body: "Saturday works. See you at 10am.", at: "2026-10-28T10:20:00Z" },
  ];
  for (const m of messages) {
    const data = { conversationId: id("c1"), senderId: id(m.from), body: m.body, createdAt: new Date(m.at), readAt: new Date(m.at) };
    await prisma.message.upsert({ where: { id: id(m.n) }, update: data, create: { id: id(m.n), ...data } });
  }

  const rating = { matchId: id("m1"), raterId: id("chidi"), rateeId: id("amara"), score: 5, comment: "Smooth handover, laptop as described." };
  await prisma.rating.upsert({ where: { matchId_raterId: { matchId: id("m1"), raterId: id("chidi") } }, update: rating, create: { id: id("rt1"), ...rating } });

  await prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: id("zanele"), blockedId: id("kwame") } }, update: {}, create: { id: id("b1"), blockerId: id("zanele"), blockedId: id("kwame") } });

  const report = { reporterId: id("chidi"), targetType: "LISTING" as const, targetListingId: id("l3"), reason: "MISREPRESENTED_DEVICE" as const, details: "Listed as iPhone 8 but photos show a different model." };
  await prisma.report.upsert({ where: { id: id("rp1") }, update: report, create: { id: id("rp1"), ...report } });

  const idv = { userId: id("amara"), documentType: "NATIONAL_ID" as const, status: "VERIFIED" as const, providerRef: "seed-ref-001", submittedAt: new Date("2026-10-01"), reviewedAt: new Date("2026-10-02") };
  await prisma.idVerification.upsert({ where: { id: id("idv1") }, update: idv, create: { id: id("idv1"), ...idv } });
}

main()
  .then(async () => {
    console.log("Seed complete");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
