CREATE TABLE "RecurringSuggestionDismissal" (
  "id" TEXT NOT NULL,
  "recurrenceKey" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,

  CONSTRAINT "RecurringSuggestionDismissal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecurringSuggestionDismissal_userId_recurrenceKey_date_key"
ON "RecurringSuggestionDismissal"("userId", "recurrenceKey", "date");

CREATE INDEX "RecurringSuggestionDismissal_userId_recurrenceKey_idx"
ON "RecurringSuggestionDismissal"("userId", "recurrenceKey");

ALTER TABLE "RecurringSuggestionDismissal"
ADD CONSTRAINT "RecurringSuggestionDismissal_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
