-- A preset reason chosen by the reviewer (see lib/rejection-reasons.ts). The applicant's email
-- and /verify page show the pre-written text for this code in their language. rejectionReason
-- is now an optional internal reviewer note (and the purge job's "not reviewed in time" text).
-- Plain text, not an enum, so adding a preset needs no migration.
ALTER TABLE "IdVerification" ADD COLUMN "rejectionCode" TEXT;
