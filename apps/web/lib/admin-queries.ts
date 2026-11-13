import { prisma } from "@/neon-db";
import { assertAdmin } from "./admin";
import { getCountryConfig } from "./countries";
import { ServiceError } from "./errors";

// Read side of the admin area. English only. Every function asserts the caller is an
// admin itself; the layout's 404 is not the only guard. None of these sign image URLs
// (that is revealVerificationImages in lib/verification.ts, which logs each view).

export const PAGE_SIZE = 50;

export async function getAdminOverview(adminId: string) {
  await assertAdmin(adminId);
  const [pending, oldest, enabledCountries, recent] = await Promise.all([
    prisma.idVerification.count({ where: { status: "PENDING" } }),
    prisma.idVerification.findFirst({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.enabledCountry.count(),
    prisma.adminAction.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, action: true, targetType: true, targetId: true, createdAt: true, actor: { select: { name: true } } },
    }),
  ]);
  return { pending, oldestPendingAt: oldest?.createdAt ?? null, enabledCountries, recent };
}

/** Pending ID submissions, oldest first so nobody waits behind newer ones. */
export async function listPendingVerifications(adminId: string, opts: { country?: string } = {}) {
  await assertAdmin(adminId);
  const country = opts.country?.toUpperCase();
  const [byCountry, rows] = await Promise.all([
    prisma.idVerification.groupBy({ by: ["countryCode"], where: { status: "PENDING" }, _count: { _all: true }, orderBy: { countryCode: "asc" } }),
    prisma.idVerification.findMany({
      where: { status: "PENDING", ...(country ? { countryCode: country } : {}) },
      orderBy: { createdAt: "asc" },
      take: PAGE_SIZE,
      select: {
        id: true, countryCode: true, documentType: true, createdAt: true, docNumberHash: true, userId: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  // Which of these documents has been used on another account?
  const hashes = rows.map((r) => r.docNumberHash).filter((h): h is string => !!h);
  const others = hashes.length
    ? await prisma.idVerification.findMany({ where: { docNumberHash: { in: hashes } }, select: { docNumberHash: true, userId: true } })
    : [];
  return {
    countries: byCountry.map((c) => ({ code: c.countryCode, count: c._count._all })),
    rows: rows.map((r) => ({
      ...r,
      duplicate: !!r.docNumberHash && others.some((o) => o.docNumberHash === r.docNumberHash && o.userId !== r.userId),
    })),
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Everything a reviewer needs except the images themselves. */
export async function getVerificationForReview(adminId: string, id: string) {
  await assertAdmin(adminId);
  const row = await prisma.idVerification.findUnique({
    where: { id },
    select: {
      id: true, userId: true, countryCode: true, documentType: true, fullNameOnId: true, docExpiry: true, docNumberHash: true,
      status: true, rejectionReason: true, decidedAt: true, imagesPurgeAt: true, imagesPurgedAt: true, createdAt: true,
      backKey: true,
      reviewedBy: { select: { name: true } },
      user: { select: { name: true, email: true, countryCode: true, createdAt: true } },
    },
  });
  if (!row) throw new ServiceError("NOT_FOUND", "Verification not found.");

  // The same document number (by hash) on another account is a strong warning sign.
  const duplicates = row.docNumberHash
    ? await prisma.idVerification.findMany({
        where: { docNumberHash: row.docNumberHash, userId: { not: row.userId } },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true, user: { select: { name: true } } },
      })
    : [];

  // Neither the hash nor the object keys are needed by the page, so they don't leave here.
  const { docNumberHash: _hash, backKey, ...safe } = row;
  void _hash;
  return {
    ...safe,
    hasBack: !!backKey,
    nameMatches: norm(row.fullNameOnId) === norm(row.user.name),
    countryMatches: row.countryCode === row.user.countryCode,
    checklist: getCountryConfig(row.countryCode)?.reviewerChecklist ?? [],
    duplicates,
    isOwn: row.userId === adminId,
  };
}

/** The audit log, newest first. */
export async function listAdminActions(adminId: string, opts: { page?: number; action?: string } = {}) {
  await assertAdmin(adminId);
  const page = Math.max(1, opts.page ?? 1);
  const where = opts.action ? { action: opts.action } : {};
  const [total, rows, actions] = await Promise.all([
    prisma.adminAction.count({ where }),
    prisma.adminAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, action: true, targetType: true, targetId: true, reason: true, meta: true, createdAt: true, actor: { select: { name: true } } },
    }),
    prisma.adminAction.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), actions: actions.map((a) => a.action) };
}
