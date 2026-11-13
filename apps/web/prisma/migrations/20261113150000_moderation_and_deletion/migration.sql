-- Admin suspension, account deletion (anonymise in place) and the 12-month hash
-- retention for suspended people. All additive: nullable columns and one new table.

ALTER TABLE "user"
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspendedReason" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- ID-document hashes of suspended people, kept for 12 months so the same document can't
-- be used to verify a new account. Only a one-way hash and the country; no person link.
-- Expired rows are deleted by the purge job.
CREATE TABLE "BlockedDocument" (
  "id" TEXT NOT NULL,
  "docNumberHash" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BlockedDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BlockedDocument_countryCode_format_check" CHECK ("countryCode" ~ '^[A-Z]{2}$')
);

CREATE UNIQUE INDEX "BlockedDocument_docNumberHash_key" ON "BlockedDocument"("docNumberHash");
CREATE INDEX "BlockedDocument_expiresAt_idx" ON "BlockedDocument"("expiresAt");
