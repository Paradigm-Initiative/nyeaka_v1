-- When a person accepted the terms and privacy policy at sign-up, and which version of
-- the text (lib/legal.ts LEGAL_VERSION). Null for accounts created before this existed.
ALTER TABLE "user"
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsVersion" TEXT;
