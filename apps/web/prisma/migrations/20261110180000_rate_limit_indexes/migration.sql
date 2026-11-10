-- Rate limits count a user's recent rows (see lib/rate-limit.ts), so these
-- lookups need to be by user and time. The new Message index also serves the
-- old senderId-only lookups.
DROP INDEX "Message_senderId_idx";
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

CREATE INDEX "Offer_initiatedById_createdAt_idx" ON "Offer"("initiatedById", "createdAt");
