-- Staff access moves out of Role into its own nullable column, so staff keep their normal
-- role (donor / requester). Existing admins become staffRole ADMIN with role BOTH.
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'REVIEWER');
ALTER TABLE "user" ADD COLUMN "staffRole" "StaffRole";
UPDATE "user" SET "staffRole" = 'ADMIN', "role" = 'BOTH' WHERE "role" = 'ADMIN';
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'DONOR', 'BOTH', 'GUEST');
ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "user" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'GUEST';
DROP TYPE "Role_old";
