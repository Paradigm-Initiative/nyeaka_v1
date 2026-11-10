-- Offer: record who the donor is and who initiated the offer.
-- Added nullable, backfilled, then made required. Offers made before this
-- migration were always donor-initiated.
ALTER TABLE "Offer" ADD COLUMN "donorId" TEXT;
ALTER TABLE "Offer" ADD COLUMN "initiatedById" TEXT;

UPDATE "Offer" o
SET "donorId" = l."donorId", "initiatedById" = l."donorId"
FROM "Listing" l
WHERE l."id" = o."listingId";

ALTER TABLE "Offer" ALTER COLUMN "donorId" SET NOT NULL;
ALTER TABLE "Offer" ALTER COLUMN "initiatedById" SET NOT NULL;

ALTER TABLE "Offer" ADD CONSTRAINT "Offer_donorId_fkey"
  FOREIGN KEY ("donorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_initiatedById_fkey"
  FOREIGN KEY ("initiatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Offer_donorId_idx" ON "Offer"("donorId");

-- A donor can have at most one PENDING offer on a given request. Prisma cannot
-- express partial indexes, so this lives only in SQL.
CREATE UNIQUE INDEX "Offer_one_pending_per_donor_request"
  ON "Offer"("requestId", "donorId")
  WHERE "status" = 'PENDING';

-- Match: contact sharing and two-sided handoff confirmation.
ALTER TABLE "Match" ADD COLUMN "donorSharedPhone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Match" ADD COLUMN "requesterSharedPhone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Match" ADD COLUMN "donorConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Match" ADD COLUMN "requesterConfirmedAt" TIMESTAMP(3);
