ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "debtId" TEXT,
ADD COLUMN IF NOT EXISTS "debtInstallment" INTEGER;

CREATE INDEX IF NOT EXISTS "Transaction_userId_debtId_idx" ON "Transaction"("userId", "debtId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Transaction_debtId_fkey'
  ) THEN
    ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_debtId_fkey"
    FOREIGN KEY ("debtId") REFERENCES "Debt"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
