-- Who cancelled a match and when, so the app can tell the other person and
-- decide whether ratings are open. Matches cancelled before this migration have no record.
ALTER TABLE "Match" ADD COLUMN "cancelledById" TEXT;
ALTER TABLE "Match" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Match" ADD CONSTRAINT "Match_cancelledById_fkey"
  FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
