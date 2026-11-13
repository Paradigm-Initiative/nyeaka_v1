-- Country becomes required on every account, and each account gets a language.
--
-- Backfill: every account that exists before this migration signed up when
-- Nyeaka was Nigeria-only, so a missing country is Nigeria. Codes already set are
-- kept, only trimmed and upper-cased. A malformed code is NOT papered over: the
-- CHECK below fails and the migration stops, so it can be fixed by hand first.
-- Nothing is deleted except the "country" text column, which held an English
-- country name that is now derived from "countryCode".
UPDATE "user" SET "countryCode" = upper(trim("countryCode")) WHERE "countryCode" IS NOT NULL;
UPDATE "user" SET "countryCode" = 'NG' WHERE "countryCode" IS NULL;

ALTER TABLE "user" ALTER COLUMN "countryCode" SET NOT NULL;
ALTER TABLE "user" ADD CONSTRAINT "user_countryCode_format_check" CHECK ("countryCode" ~ '^[A-Z]{2}$');
ALTER TABLE "user" DROP COLUMN "country";

ALTER TABLE "user" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
