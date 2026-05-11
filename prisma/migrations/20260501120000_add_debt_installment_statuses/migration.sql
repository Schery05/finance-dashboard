CREATE TABLE "DebtInstallmentStatus" (
  "id" TEXT NOT NULL,
  "installment" INTEGER NOT NULL,
  "status" "PaymentStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,
  "debtId" TEXT NOT NULL,

  CONSTRAINT "DebtInstallmentStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DebtInstallmentStatus_userId_debtId_installment_key"
  ON "DebtInstallmentStatus"("userId", "debtId", "installment");

CREATE INDEX "DebtInstallmentStatus_userId_status_idx"
  ON "DebtInstallmentStatus"("userId", "status");

CREATE INDEX "DebtInstallmentStatus_debtId_installment_idx"
  ON "DebtInstallmentStatus"("debtId", "installment");

ALTER TABLE "DebtInstallmentStatus"
  ADD CONSTRAINT "DebtInstallmentStatus_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DebtInstallmentStatus"
  ADD CONSTRAINT "DebtInstallmentStatus_debtId_fkey"
  FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
