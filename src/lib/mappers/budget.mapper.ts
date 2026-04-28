import type { Budget } from "@/lib/budgets";
import type { BudgetInput } from "@/lib/validators";

type DecimalLike = {
  toNumber?: () => number;
  toString: () => string;
};

export type DBBudgetWithCategory = {
  id: string;
  month: number;
  year: number;
  limit: DecimalLike | number | string;
  createdAt: Date;
  category: {
    name: string;
  };
};

export type DBBudgetInput = {
  categoryName: string;
  month: number;
  year: number;
  limit: number;
  createdAt?: Date;
};

function decimalToNumber(value: DBBudgetWithCategory["limit"]) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value.toString());
}

function formatPeriod(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parsePeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error("Periodo invalido.");
  }

  return { year, month };
}

export function mapBudgetDBToUI(budget: DBBudgetWithCategory): Budget {
  return {
    id: budget.id,
    category: budget.category.name,
    monthlyLimit: decimalToNumber(budget.limit),
    period: formatPeriod(budget.year, budget.month),
    createdAt: budget.createdAt.toISOString(),
  };
}

export function mapBudgetUIToDB(data: BudgetInput): DBBudgetInput {
  const { year, month } = parsePeriod(data.period);

  return {
    categoryName: data.category.trim(),
    month,
    year,
    limit: data.monthlyLimit,
    createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
  };
}
