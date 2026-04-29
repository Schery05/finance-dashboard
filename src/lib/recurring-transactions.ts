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
  return sorted.length % 2 === 0
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
  const sourceTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: "GASTO",
      isRecurringSuggestion: false,
    },
    include: {
      category: true,
    },
    orderBy: {
      date: "asc",
    },
  });

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

    const pendingSuggestion = await prisma.transaction.findFirst({
      where: {
        userId,
        recurrenceKey,
        isRecurringSuggestion: true,
        paymentStatus: "PENDIENTE",
      },
      select: {
        id: true,
      },
    });

    if (pendingSuggestion) continue;

    const existingSuggestion = await prisma.transaction.findFirst({
      where: {
        userId,
        recurrenceKey,
        date,
      },
      select: {
        id: true,
      },
    });

    if (existingSuggestion) continue;

    const existingManualTransaction = await prisma.transaction.findFirst({
      where: {
        userId,
        isRecurringSuggestion: false,
        date,
        type: "GASTO",
        categoryId: latest.categoryId,
        amount,
      },
      select: {
        id: true,
      },
    });

    if (existingManualTransaction) continue;

    await prisma.transaction.create({
      data: {
        userId,
        categoryId: latest.categoryId,
        date,
        type: "GASTO",
        amount,
        paymentStatus: "PENDIENTE",
        additionalDescription:
          latest.additionalDescription?.trim() || "Gasto recurrente sugerido",
        recurrenceKey,
        isRecurringSuggestion: true,
      },
    });

    created += 1;
  }

  return {
    created,
    patterns: grouped.size,
  };
}
