-- Queue claiming (lapses after 15 minutes idle, checked on read) and the second-reviewer rule
-- for documents whose number matches another account's submission.
ALTER TABLE "IdVerification"
  ADD COLUMN "claimedById" TEXT,
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "firstDecisionById" TEXT,
  ADD COLUMN "firstDecisionAt" TIMESTAMP(3),
  ADD COLUMN "firstOutcome" "VerificationStatus",
  ADD COLUMN "firstRejectionCode" TEXT;

ALTER TABLE "IdVerification" ADD CONSTRAINT "IdVerification_claimedById_fkey"
  FOREIGN KEY ("claimedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IdVerification" ADD CONSTRAINT "IdVerification_firstDecisionById_fkey"
  FOREIGN KEY ("firstDecisionById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
