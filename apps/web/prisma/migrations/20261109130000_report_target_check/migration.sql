-- A report points at no more than one target, and the target must match
-- targetType. All FKs may be NULL: targets use ON DELETE SET NULL so a report
-- survives the deletion of what it reported.
ALTER TABLE "Report" ADD CONSTRAINT "Report_single_target_check" CHECK (
  num_nonnulls("targetUserId", "targetListingId", "targetRequestId", "targetMessageId") <= 1
  AND ("targetUserId"    IS NULL OR "targetType" = 'USER')
  AND ("targetListingId" IS NULL OR "targetType" = 'LISTING')
  AND ("targetRequestId" IS NULL OR "targetType" = 'REQUEST')
  AND ("targetMessageId" IS NULL OR "targetType" = 'MESSAGE')
);
