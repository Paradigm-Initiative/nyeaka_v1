-- Verification schema for manual KYC review (see CLAUDE.md "KYC is manual review").
-- user.idVerificationStatus becomes the single source of truth; user.idVerified goes.
-- Legacy IdVerification rows hold no images and no ID hash, so they cannot be reviewed:
-- they are removed, and anyone left waiting on one goes back to NONE.

-- 1. Collapse SUBMITTED into PENDING, and fold the old boolean into the status.
UPDATE "IdVerification" SET "status" = 'PENDING' WHERE "status" = 'SUBMITTED';
UPDATE "user" SET "idVerificationStatus" = 'PENDING' WHERE "idVerificationStatus" = 'SUBMITTED';
UPDATE "user" SET "idVerificationStatus" = 'VERIFIED' WHERE "idVerified" = true;
-- VERIFIED without the boolean never showed a badge, so it was never really granted.
UPDATE "user" SET "idVerificationStatus" = 'NONE'
  WHERE "idVerified" = false AND "idVerificationStatus" = 'VERIFIED';

DELETE FROM "IdVerification";
UPDATE "user" SET "idVerificationStatus" = 'NONE' WHERE "idVerificationStatus" = 'PENDING';

-- Assertion: fails the whole migration if any row still disagrees. Dropping the column
-- below removes this constraint with it.
ALTER TABLE "user" ADD CONSTRAINT "user_idVerified_consistent_tmp"
  CHECK (("idVerified" = true) = ("idVerificationStatus" = 'VERIFIED'));

ALTER TABLE "user" DROP COLUMN "idVerified";

-- 2. Recreate VerificationStatus without SUBMITTED (Postgres cannot drop an enum value).
ALTER TYPE "VerificationStatus" RENAME TO "VerificationStatus_old";
CREATE TYPE "VerificationStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'FAILED');
ALTER TABLE "user" ALTER COLUMN "idVerificationStatus" DROP DEFAULT;
ALTER TABLE "user" ALTER COLUMN "idVerificationStatus" TYPE "VerificationStatus"
  USING ("idVerificationStatus"::text::"VerificationStatus");
ALTER TABLE "user" ALTER COLUMN "idVerificationStatus" SET DEFAULT 'NONE';
ALTER TABLE "IdVerification" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "IdVerification" ALTER COLUMN "status" TYPE "VerificationStatus"
  USING ("status"::text::"VerificationStatus");
ALTER TABLE "IdVerification" ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "VerificationStatus_old";

-- 3. Residence permits are an accepted document.
ALTER TYPE "IdDocumentType" ADD VALUE 'RESIDENCE_PERMIT';

-- 4. IdVerification: provider columns out, review data in.
ALTER TABLE "IdVerification" DROP COLUMN "providerRef";
ALTER TABLE "IdVerification" DROP COLUMN "submittedAt";
ALTER TABLE "IdVerification" RENAME COLUMN "reviewedAt" TO "decidedAt";

ALTER TABLE "IdVerification"
  ADD COLUMN "countryCode" TEXT NOT NULL,
  ADD COLUMN "fullNameOnId" TEXT NOT NULL,
  ADD COLUMN "docExpiry" TIMESTAMP(3),
  -- HMAC of the document number (ID_HASH_SECRET). The number itself is never stored.
  ADD COLUMN "docNumberHash" TEXT,
  -- Private R2 object keys. Nulled once the images are purged (30 days after the decision).
  ADD COLUMN "frontKey" TEXT,
  ADD COLUMN "backKey" TEXT,
  ADD COLUMN "selfieKey" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "imagesPurgeAt" TIMESTAMP(3),
  ADD COLUMN "imagesPurgedAt" TIMESTAMP(3);

ALTER TABLE "IdVerification" ADD CONSTRAINT "IdVerification_countryCode_format_check"
  CHECK ("countryCode" ~ '^[A-Z]{2}$');
-- Front and selfie are mandatory until the images have been purged.
ALTER TABLE "IdVerification" ADD CONSTRAINT "IdVerification_images_check"
  CHECK ("imagesPurgedAt" IS NOT NULL OR ("frontKey" IS NOT NULL AND "selfieKey" IS NOT NULL));

ALTER TABLE "IdVerification" ADD CONSTRAINT "IdVerification_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- At most one submission awaiting review per person.
CREATE UNIQUE INDEX "IdVerification_one_pending_per_user"
  ON "IdVerification"("userId") WHERE "status" = 'PENDING';
CREATE INDEX "IdVerification_docNumberHash_idx" ON "IdVerification"("docNumberHash");
CREATE INDEX "IdVerification_imagesPurgeAt_idx" ON "IdVerification"("imagesPurgeAt");

-- 5. Audit log of everything an admin does (decisions, ID image views, country changes).
CREATE TABLE "AdminAction" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "reason" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");
CREATE INDEX "AdminAction_actorId_idx" ON "AdminAction"("actorId");
CREATE INDEX "AdminAction_targetType_targetId_idx" ON "AdminAction"("targetType", "targetId");
