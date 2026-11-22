-- Overturning an ID decision: the latest overturn's time, admin and note.
ALTER TABLE "IdVerification"
  ADD COLUMN "overturnedAt" TIMESTAMP(3),
  ADD COLUMN "overturnedById" TEXT,
  ADD COLUMN "overturnNote" TEXT;

ALTER TABLE "IdVerification" ADD CONSTRAINT "IdVerification_overturnedById_fkey"
  FOREIGN KEY ("overturnedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
