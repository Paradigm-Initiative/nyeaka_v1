-- Which countries Nyeaka is switched on in, editable by an admin instead of in code.
-- Only enabled countries have a row. Seeded with Nigeria plus Ghana, Kenya, Cameroon,
-- Senegal, Zambia and Zimbabwe, the countries enabled by the team on 2026-11-13.
CREATE TABLE "EnabledCountry" (
  "code" TEXT NOT NULL,
  "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enabledById" TEXT,
  CONSTRAINT "EnabledCountry_pkey" PRIMARY KEY ("code"),
  CONSTRAINT "EnabledCountry_code_format_check" CHECK ("code" ~ '^[A-Z]{2}$')
);

ALTER TABLE "EnabledCountry" ADD CONSTRAINT "EnabledCountry_enabledById_fkey"
  FOREIGN KEY ("enabledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "EnabledCountry" ("code") VALUES ('NG'), ('GH'), ('KE'), ('CM'), ('SN'), ('ZM'), ('ZW');
