import type { Budget } from "@/lib/budgets";
import type { Transaction } from "@/lib/types";

export type FinancialScoreParams = {
  transactions: Transaction[];
  budgets?: Budget[];
  month: number;
  year: number;
};

export type FinancialScoreResult = {
  score: number;
  label: string;
  month: number;
  year: number;
  breakdown: {
    savingsScore: number;
    budgetScore: number;
    paymentsScore: number;
  };
  metrics: {
    income: number;
    expenses: number;
    savings: number;
    savingsRate: number;
    budgetUsed: number;
    budgetLimit: number;
    paymentsPaid: number;
    paymentsTotal: number;
  };
  recommendations: string[];
};

function parseDateSafe(dateStr: string) {
  const value = String(dateStr ?? "").trim();
  if (!value) return null;

  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dmy = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const date = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function normalizeKey(value: string) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function getTransactionCategory(tx: Transaction) {
  const record = tx as unknown as Record<string, string>;
  return record["Categor\u00c3\u00ada"] ?? record["Categoría"] ?? "";
}

function periodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function clampScore(score: number) {
  return Math.min(100, Math.max(1, Math.round(score)));
}

function scoreSavings(income: number, savingsRate: number) {
  if (income <= 0) return 0;
  if (savingsRate >= 0.2) return 100;
  if (savingsRate >= 0.1) return 80;
  if (savingsRate >= 0.01) return 60;
  if (savingsRate === 0) return 40;
  return 20;
}

function scoreBudget(budgetUsed: number, budgetLimit: number) {
  if (budgetLimit <= 0) return 70;

  const ratio = budgetUsed / budgetLimit;
  if (ratio <= 1) return 100;
  if (ratio <= 1.1) return 70;
  return 40;
}

function scorePayments(paymentsPaid: number, paymentsTotal: number) {
  if (paymentsTotal === 0) return 100;

  const ratio = paymentsPaid / paymentsTotal;
  if (ratio === 1) return 100;
  if (ratio >= 0.8) return 80;
  if (ratio >= 0.5) return 60;
  return 30;
}

export function getScoreLabel(score: number) {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Bueno";
  if (score >= 50) return "Regular";
  return "Necesita atención";
}

export function getScoreRecommendations(
  result: Omit<FinancialScoreResult, "recommendations">
) {
  const recommendations: string[] = [];
  const { metrics, breakdown } = result;

  if (breakdown.savingsScore < 80) {
    recommendations.push(
      "Intenta separar al menos un 10% de tus ingresos antes de cubrir gastos variables."
    );
  }

  if (metrics.budgetLimit <= 0) {
    recommendations.push(
      "Configura presupuestos por categoría para medir mejor tus límites mensuales."
    );
  } else if (breakdown.budgetScore < 100) {
    recommendations.push(
      "Revisa las categorías que superaron su presupuesto y ajusta gastos no esenciales."
    );
  }

  if (breakdown.paymentsScore < 100) {
    recommendations.push(
      "Valida los gastos pendientes del mes para mejorar tu cumplimiento de pagos."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Mantén este ritmo y revisa tu score cada semana para detectar cambios a tiempo."
    );
  }

  return recommendations;
}

export function calculateFinancialScore({
  transactions,
  budgets = [],
  month,
  year,
}: FinancialScoreParams): FinancialScoreResult {
  const selectedPeriod = periodKey(year, month);
  const periodTransactions = transactions.filter((tx) => {
    const date = parseDateSafe(tx.Fecha);
    if (!date) return false;
    return date.getFullYear() === year && date.getMonth() + 1 === month;
  });

  const income = periodTransactions
    .filter((tx) => normalizeKey(tx.Tipo) === "ingreso")
    .reduce((sum, tx) => sum + (Number(tx.Importe) || 0), 0);

  const expenseTransactions = periodTransactions.filter(
    (tx) => normalizeKey(tx.Tipo) === "gasto"
  );

  const expenses = expenseTransactions.reduce(
    (sum, tx) => sum + (Number(tx.Importe) || 0),
    0
  );

  const savings = income - expenses;
  const savingsRate = income > 0 ? savings / income : 0;
  const savingsScore = scoreSavings(income, savingsRate);

  const periodBudgets = budgets.filter(
    (budget) => budget.period === selectedPeriod
  );
  const budgetCategories = new Set(
    periodBudgets.map((budget) => normalizeKey(budget.category))
  );
  const budgetLimit = periodBudgets.reduce(
    (sum, budget) => sum + (Number(budget.monthlyLimit) || 0),
    0
  );
  const budgetUsed = expenseTransactions
    .filter((tx) => budgetCategories.has(normalizeKey(getTransactionCategory(tx))))
    .reduce((sum, tx) => sum + (Number(tx.Importe) || 0), 0);
  const budgetScore = scoreBudget(budgetUsed, budgetLimit);

  const paymentsTotal = expenseTransactions.length;
  const paymentsPaid = expenseTransactions.filter(
    (tx) => normalizeKey(tx.EstadoPago) === "pagado"
  ).length;
  const paymentsScore = scorePayments(paymentsPaid, paymentsTotal);

  const score = clampScore(
    savingsScore * 0.4 + budgetScore * 0.3 + paymentsScore * 0.3
  );

  const baseResult: Omit<FinancialScoreResult, "recommendations"> = {
    score,
    label: getScoreLabel(score),
    month,
    year,
    breakdown: {
      savingsScore,
      budgetScore,
      paymentsScore,
    },
    metrics: {
      income,
      expenses,
      savings,
      savingsRate,
      budgetUsed,
      budgetLimit,
      paymentsPaid,
      paymentsTotal,
    },
  };

  return {
    ...baseResult,
    recommendations: getScoreRecommendations(baseResult),
  };
}
