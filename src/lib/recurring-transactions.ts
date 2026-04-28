import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

type DecimalLike = {
  toNumber?: () => number;
  toString: () => string;
};

type SourceTransaction = {
  id: string;
  date: Date;
  type: string;
  amount: DecimalLike | number | string;
  additionalDescription: string | null;
  categoryId: string;
  category: {
    name: string;
  };
};

type RawSourceTransaction = {
  id: string;
  date: Date;
  type: string;
  amount: DecimalLike | number | string;
  additionalDescription: string | null;
  categoryId: string;
  categoryName: string;
};

type IdRow = {
  id: string;
};

const MIN_RECURRING_OCCURRENCES = 2;
const MAX_DAY_VARIANCE = 4;
const MIN_MONTHLY_INTERVAL_DAYS = 24;
const MAX_MONTHLY_INTERVAL_DAYS = 38;

function decimalToNumber(value: DecimalLike | number | string) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value.toString());
}

function normalizeKeyPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysBetween(a: Date, b: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() -
      new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) /
      msPerDay
  );
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return values.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function dateForMonth(year: number, monthIndex: number, preferredDay: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(preferredDay, lastDay));
}

function nextSuggestedDate(latestDate: Date, preferredDay: number, today: Date) {
  let year = latestDate.getFullYear();
  let monthIndex = latestDate.getMonth() + 1;
  let candidate = dateForMonth(year, monthIndex, preferredDay);

  while (candidate < today) {
    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
    candidate = dateForMonth(year, monthIndex, preferredDay);
  }

  return candidate;
}

function recurrenceKeyFor(tx: SourceTransaction) {
  const category = normalizeKeyPart(tx.category.name);
  const description =
    normalizeKeyPart(tx.additionalDescription ?? "") || "sin-descripcion";
  const amount = decimalToNumber(tx.amount).toFixed(2);

  return `${category}:${description}:${amount}`;
}

function isRecurringMonthlyPattern(transactions: SourceTransaction[]) {
  if (transactions.length < MIN_RECURRING_OCCURRENCES) return false;

  const monthKeys = new Set(
    transactions.map(
      (tx) =>
        `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(
          2,
          "0"
        )}`
    )
  );

  if (monthKeys.size < MIN_RECURRING_OCCURRENCES) return false;

  const days = transactions.map((tx) => tx.date.getDate());
  const daySpread = Math.max(...days) - Math.min(...days);
  if (daySpread <= MAX_DAY_VARIANCE) return true;

  const intervals = transactions
    .slice(1)
    .map((tx, index) => daysBetween(transactions[index].date, tx.date));

  return intervals.every(
    (interval) =>
      interval >= MIN_MONTHLY_INTERVAL_DAYS &&
      interval <= MAX_MONTHLY_INTERVAL_DAYS
  );
}

export async function ensureRecurringTransactionSuggestions(userId: string) {
  const rawTransactions = await prisma.$queryRaw<RawSourceTransaction[]>`
    SELECT
      t."id",
      t."date",
      t."type",
      t."amount",
      t."additionalDescription",
      t."categoryId",
      c."name" AS "categoryName"
    FROM "Transaction" t
    INNER JOIN "Category" c ON c."id" = t."categoryId"
    WHERE t."userId" = ${userId}
      AND t."type" = 'GASTO'::"TransactionType"
      AND COALESCE(t."isRecurringSuggestion", false) = false
    ORDER BY t."date" ASC
  `;

  const sourceTransactions: SourceTransaction[] = rawTransactions.map((tx) => ({
    id: tx.id,
    date: tx.date,
    type: tx.type,
    amount: tx.amount,
    additionalDescription: tx.additionalDescription,
    categoryId: tx.categoryId,
    category: {
      name: tx.categoryName,
    },
  }));

  const grouped = new Map<string, SourceTransaction[]>();

  for (const tx of sourceTransactions) {
    const amount = decimalToNumber(tx.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const key = recurrenceKeyFor(tx);
    const group = grouped.get(key) ?? [];
    group.push(tx);
    grouped.set(key, group);
  }

  let created = 0;
  const today = startOfToday();

  for (const [recurrenceKey, group] of grouped) {
    const sorted = [...group].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    if (!isRecurringMonthlyPattern(sorted)) continue;

    const latest = sorted[sorted.length - 1];
    const preferredDay = median(sorted.map((tx) => tx.date.getDate()));
    const date = nextSuggestedDate(latest.date, preferredDay, today);
    const amount = decimalToNumber(latest.amount);

    const pendingSuggestion = await prisma.$queryRaw<IdRow[]>`
      SELECT "id"
      FROM "Transaction"
      WHERE "userId" = ${userId}
        AND "recurrenceKey" = ${recurrenceKey}
        AND COALESCE("isRecurringSuggestion", false) = true
        AND "paymentStatus" = 'PENDIENTE'::"PaymentStatus"
      LIMIT 1
    `;

    if (pendingSuggestion.length > 0) continue;

    const existingSuggestion = await prisma.$queryRaw<IdRow[]>`
      SELECT "id"
      FROM "Transaction"
      WHERE "userId" = ${userId}
        AND "recurrenceKey" = ${recurrenceKey}
        AND "date" = ${date}
      LIMIT 1
    `;

    if (existingSuggestion.length > 0) continue;

    const existingManualTransaction = await prisma.$queryRaw<IdRow[]>`
      SELECT "id"
      FROM "Transaction"
      WHERE "userId" = ${userId}
        AND COALESCE("isRecurringSuggestion", false) = false
        AND "date" = ${date}
        AND "type" = 'GASTO'::"TransactionType"
        AND "categoryId" = ${latest.categoryId}
        AND "amount" = ${amount}
      LIMIT 1
    `;

    if (existingManualTransaction.length > 0) continue;

    const description =
      latest.additionalDescription?.trim() || "Gasto recurrente sugerido";

    const inserted = await prisma.$executeRaw`
      INSERT INTO "Transaction" (
        "id",
        "userId",
        "categoryId",
        "date",
        "type",
        "amount",
        "paymentStatus",
        "additionalDescription",
        "recurrenceKey",
        "isRecurringSuggestion",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${userId},
        ${latest.categoryId},
        ${date},
        'GASTO'::"TransactionType",
        ${amount},
        'PENDIENTE'::"PaymentStatus",
        ${description},
        ${recurrenceKey},
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT ("userId", "recurrenceKey", "date") DO NOTHING
    `;

    if (inserted > 0) created += 1;
  }

  return {
    created,
    patterns: grouped.size,
  };
}
