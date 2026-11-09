-- Add nullable, backfill existing rows by country, then enforce NOT NULL.
ALTER TABLE "Listing" ADD COLUMN "city" TEXT;
ALTER TABLE "Request" ADD COLUMN "city" TEXT;

UPDATE "Listing" SET "city" = CASE "countryCode"
  WHEN 'GH' THEN 'Accra'
  WHEN 'NG' THEN 'Lagos'
  WHEN 'ZA' THEN 'Johannesburg'
  ELSE 'Unknown' END;

UPDATE "Request" SET "city" = CASE "countryCode"
  WHEN 'GH' THEN 'Accra'
  WHEN 'NG' THEN 'Lagos'
  WHEN 'ZA' THEN 'Johannesburg'
  ELSE 'Unknown' END;

ALTER TABLE "Listing" ALTER COLUMN "city" SET NOT NULL;
ALTER TABLE "Request" ALTER COLUMN "city" SET NOT NULL;
