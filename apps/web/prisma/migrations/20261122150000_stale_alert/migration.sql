-- When the "waiting too long" alert went out for an ID case, so it is sent once per case.
ALTER TABLE "IdVerification" ADD COLUMN "staleAlertedAt" TIMESTAMP(3);
