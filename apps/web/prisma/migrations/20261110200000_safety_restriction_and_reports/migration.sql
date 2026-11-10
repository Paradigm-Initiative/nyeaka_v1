-- User: automatic restriction state.
ALTER TABLE "user" ADD COLUMN "restrictedAt" TIMESTAMP(3);
ALTER TABLE "user" ADD COLUMN "restrictedReason" TEXT;

-- Report: always record who the report is about, so reports can be counted per user.
-- Backfilled from whichever target the report points at. A report whose target was
-- already deleted can't be attributed, and the NOT NULL below will fail loudly
-- instead of silently dropping it. Check with:
--   SELECT id FROM "Report" WHERE num_nonnulls("targetUserId","targetListingId","targetRequestId","targetMessageId") = 0;
ALTER TABLE "Report" ADD COLUMN "reportedUserId" TEXT;

UPDATE "Report" r SET "reportedUserId" = COALESCE(
  r."targetUserId",
  (SELECT "donorId"     FROM "Listing" WHERE "id" = r."targetListingId"),
  (SELECT "requesterId" FROM "Request" WHERE "id" = r."targetRequestId"),
  (SELECT "senderId"    FROM "Message" WHERE "id" = r."targetMessageId")
);

ALTER TABLE "Report" ALTER COLUMN "reportedUserId" SET NOT NULL;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey"
  FOREIGN KEY ("reportedUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Report_reportedUserId_status_idx" ON "Report"("reportedUserId", "status");

-- One open report per reporter and person, so one angry user can't reach the
-- restriction threshold alone. Prisma can't express partial indexes.
CREATE UNIQUE INDEX "Report_one_open_per_reporter_and_user"
  ON "Report"("reporterId", "reportedUserId")
  WHERE "status" = 'OPEN';
