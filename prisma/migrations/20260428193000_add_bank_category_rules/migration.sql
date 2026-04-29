CREATE TABLE "BankCategoryRule" (
  "id" TEXT NOT NULL,
  "pattern" TEXT NOT NULL,
  "categoryName" TEXT NOT NULL,
  "transactionType" "TransactionType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,

  CONSTRAINT "BankCategoryRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankCategoryRule_userId_pattern_key" ON "BankCategoryRule"("userId", "pattern");
CREATE INDEX "BankCategoryRule_userId_pattern_idx" ON "BankCategoryRule"("userId", "pattern");

ALTER TABLE "BankCategoryRule"
ADD CONSTRAINT "BankCategoryRule_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
