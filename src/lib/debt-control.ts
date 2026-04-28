import type { Debt, Transaction } from "@/lib/types";

export type DebtStrategy = "snowball" | "avalanche";

export type DebtAnalysis = {
  debt: Debt;
  estimatedMonthlyInterest: number;
  minimumRecommendedPayment: number;
  isLowPayment: boolean;
  priorityScore: number;
  monthsToPayoff: number | null;
};

export type DebtControlSummary = {
  totalCurrentDebt: number;
  totalEstimatedInterest: number;
  debtToIncomePercent: number;
  monthlyIncome: number;
  priorityDebt: DebtAnalysis | null;
  analyses: DebtAnalysis[];
};

export type DebtAlert = {
  id: string;
  debtId: string;
  title: string;
  message: string;
  type: "interest" | "low-payment" | "priority";
};

function normalizeKey(value: string) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function parseDateSafe(dateStr: string) {
  const value = String(dateStr ?? "").trim();
  if (!value) return null;

  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function getMonthlyIncome(transactions: Transaction[], period: string) {
  return transactions
    .filter((tx) => {
      const date = parseDateSafe(tx.Fecha);
      if (!date) return false;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return key === period && normalizeKey(tx.Tipo) === "ingreso";
    })
    .reduce((sum, tx) => sum + (Number(tx.Importe) || 0), 0);
}

export function estimateMonthlyInterest(debt: Debt) {
  return Math.max(0, debt.currentBalance * (debt.interestRate / 100 / 12));
}

export function estimateMonthsToPayoff(
  balance: number,
  annualRate: number,
  monthlyPayment: number
) {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return null;

  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate <= 0) return Math.ceil(balance / monthlyPayment);
  if (monthlyPayment <= balance * monthlyRate) return null;

  return Math.ceil(
    -Math.log(1 - (balance * monthlyRate) / monthlyPayment) /
      Math.log(1 + monthlyRate)
  );
}

export function analyzeDebt(debt: Debt, strategy: DebtStrategy): DebtAnalysis {
  const estimatedMonthlyInterest = estimateMonthlyInterest(debt);
  const minimumRecommendedPayment = estimatedMonthlyInterest * 1.25;
  const isLowPayment =
    debt.currentBalance > 0 &&
    debt.monthlyPayment > 0 &&
    debt.monthlyPayment <= minimumRecommendedPayment;

  const priorityScore =
    strategy === "snowball"
      ? debt.currentBalance
      : -debt.interestRate;

  return {
    debt,
    estimatedMonthlyInterest,
    minimumRecommendedPayment,
    isLowPayment,
    priorityScore,
    monthsToPayoff: estimateMonthsToPayoff(
      debt.currentBalance,
      debt.interestRate,
      debt.monthlyPayment
    ),
  };
}

export function getPriorityDebt(debts: Debt[], strategy: DebtStrategy) {
  const activeDebts = debts.filter((debt) => debt.currentBalance > 0);
  if (activeDebts.length === 0) return null;

  return [...activeDebts].sort((a, b) => {
    if (strategy === "snowball") {
      return a.currentBalance - b.currentBalance;
    }
    return b.interestRate - a.interestRate;
  })[0];
}

export function getDebtControlSummary({
  debts,
  transactions,
  strategy,
  period,
}: {
  debts: Debt[];
  transactions: Transaction[];
  strategy: DebtStrategy;
  period: string;
}): DebtControlSummary {
  const analyses = debts.map((debt) => analyzeDebt(debt, strategy));
  const priorityDebt = getPriorityDebt(debts, strategy);
  const monthlyIncome = getMonthlyIncome(transactions, period);
  const totalCurrentDebt = debts.reduce(
    (sum, debt) => sum + (Number(debt.currentBalance) || 0),
    0
  );
  const totalEstimatedInterest = analyses.reduce(
    (sum, analysis) => sum + analysis.estimatedMonthlyInterest,
    0
  );

  return {
    totalCurrentDebt,
    totalEstimatedInterest,
    debtToIncomePercent:
      monthlyIncome > 0 ? (totalCurrentDebt / monthlyIncome) * 100 : 0,
    monthlyIncome,
    priorityDebt:
      analyses.find((analysis) => analysis.debt.id === priorityDebt?.id) ?? null,
    analyses,
  };
}

export function simulateDebtPayoff({
  debt,
  extraPayment,
}: {
  debt: Debt;
  extraPayment: number;
}) {
  const payment = Math.max(0, debt.monthlyPayment + extraPayment);
  const months = estimateMonthsToPayoff(
    debt.currentBalance,
    debt.interestRate,
    payment
  );
  const baseMonths = estimateMonthsToPayoff(
    debt.currentBalance,
    debt.interestRate,
    debt.monthlyPayment
  );

  return {
    monthlyPayment: payment,
    monthsToPayoff: months,
    monthsSaved:
      months !== null && baseMonths !== null ? Math.max(baseMonths - months, 0) : null,
  };
}

export function getDebtAlerts(
  summary: DebtControlSummary,
  strategy: DebtStrategy
): DebtAlert[] {
  const alerts: DebtAlert[] = [];
  const highestInterest = [...summary.analyses].sort(
    (a, b) => b.estimatedMonthlyInterest - a.estimatedMonthlyInterest
  )[0];

  if (highestInterest && highestInterest.estimatedMonthlyInterest > 0) {
    alerts.push({
      id: `debt-interest-${highestInterest.debt.id}`,
      debtId: highestInterest.debt.id,
      title: "Interes alto",
      message: `${highestInterest.debt.name} esta generando mas interes que las demas deudas.`,
      type: "interest",
    });
  }

  for (const analysis of summary.analyses.filter((item) => item.isLowPayment)) {
    alerts.push({
      id: `debt-low-payment-${analysis.debt.id}`,
      debtId: analysis.debt.id,
      title: "Pago muy bajo",
      message: `Estas pagando muy poco en ${analysis.debt.name}. La cuota apenas cubre los intereses.`,
      type: "low-payment",
    });
  }

  if (summary.priorityDebt) {
    const strategyLabel =
      strategy === "snowball" ? "Snowball" : "Avalanche";
    alerts.push({
      id: `debt-priority-${summary.priorityDebt.debt.id}`,
      debtId: summary.priorityDebt.debt.id,
      title: "Deuda prioritaria",
      message: `Te conviene priorizar ${summary.priorityDebt.debt.name} con la estrategia ${strategyLabel}.`,
      type: "priority",
    });
  }

  return alerts;
}
