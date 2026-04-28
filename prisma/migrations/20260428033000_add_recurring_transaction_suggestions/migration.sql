ALTER TABLE "Transaction"
ADD COLUMN "recurrenceKey" TEXT,
ADD COLUMN "isRecurringSuggestion" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Transaction_userId_recurrenceKey_idx" ON "Transaction"("userId", "recurrenceKey");

CREATE UNIQUE INDEX "Transaction_userId_recurrenceKey_date_key"
ON "Transaction"("userId", "recurrenceKey", "date");
