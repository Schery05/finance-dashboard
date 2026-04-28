CREATE TYPE "DebtType" AS ENUM (
  'TARJETA',
  'PRESTAMO_PERSONAL',
  'VEHICULO',
  'HIPOTECA',
  'OTRO'
);

CREATE TABLE "Debt" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "initialAmount" DECIMAL(12, 2) NOT NULL,
  "currentBalance" DECIMAL(12, 2) NOT NULL,
  "interestRate" DECIMAL(5, 2) NOT NULL,
  "monthlyPayment" DECIMAL(12, 2) NOT NULL,
  "paymentDay" INTEGER NOT NULL,
  "type" "DebtType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,

  CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Debt_userId_type_idx" ON "Debt"("userId", "type");
CREATE INDEX "Debt_userId_paymentDay_idx" ON "Debt"("userId", "paymentDay");

ALTER TABLE "Debt"
ADD CONSTRAINT "Debt_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
