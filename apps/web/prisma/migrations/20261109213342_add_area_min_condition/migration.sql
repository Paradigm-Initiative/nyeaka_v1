-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "area" TEXT;

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "area" TEXT,
ADD COLUMN     "minCondition" "Condition";
