import type { Budget } from "@/lib/budgets";
import {
  getDebtControlSummary,
  getPriorityDebt,
  type DebtStrategy,
} from "@/lib/debt-control";
import type { Debt, SavingsGoal, Transaction } from "@/lib/types";

export type AssistantContext = {
  transactions: Transaction[];
  budgets: Budget[];
  debts: Debt[];
  goals: SavingsGoal[];
  period?: string;
  strategy?: DebtStrategy;
};

export type AssistantInsight = {
  title: string;
  message: string;
  tone: "good" | "warning" | "info";
};

type MonthStats = {
  income: number;
  expenses: number;
  savings: number;
  categoryExpenses: Map<string, number>;
  transactions: Transaction[];
};

const money = (n: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

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

function periodKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentPeriod() {
  return periodKey(new Date());
}

function previousPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return periodKey(date);
}

function getCategory(tx: Transaction) {
  const record = tx as unknown as Record<string, string>;
  return record["Categor\u00c3\u00ada"] ?? record["Categoría"] ?? "Sin categoria";
}

function getMonthStats(transactions: Transaction[], period: string): MonthStats {
  const rows = transactions.filter((tx) => {
    const date = parseDateSafe(tx.Fecha);
    return date ? periodKey(date) === period : false;
  });
  const categoryExpenses = new Map<string, number>();
  let income = 0;
  let expenses = 0;

  for (const tx of rows) {
    const amount = Number(tx.Importe) || 0;
    if (normalizeKey(tx.Tipo) === "ingreso") {
      income += amount;
      continue;
    }

    if (normalizeKey(tx.Tipo) === "gasto") {
      expenses += amount;
      const category = getCategory(tx);
      categoryExpenses.set(category, (categoryExpenses.get(category) ?? 0) + amount);
    }
  }

  return {
    income,
    expenses,
    savings: income - expenses,
    categoryExpenses,
    transactions: rows,
  };
}

function topCategory(stats: MonthStats) {
  return Array.from(stats.categoryExpenses.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];
}

function categoryComparison(current: MonthStats, previous: MonthStats) {
  const rows = Array.from(current.categoryExpenses.entries())
    .map(([category, amount]) => {
      const previousAmount = previous.categoryExpenses.get(category) ?? 0;
      const difference = amount - previousAmount;
      const percent =
        previousAmount > 0 ? (difference / previousAmount) * 100 : null;
      return { category, amount, previousAmount, difference, percent };
    })
    .sort((a, b) => b.difference - a.difference);

  return rows;
}

function goalProgress(goal: SavingsGoal, transactions: Transaction[]) {
  const byId = new Map(transactions.map((tx) => [tx.ID, tx]));
  const transactionTotal = goal.TransaccionesAsociadas.reduce((sum, id) => {
    const tx = byId.get(id);
    return sum + (Number(tx?.Importe) || 0);
  }, 0);
  const current = (Number(goal.SaldoInicial) || 0) + transactionTotal;
  const target = Number(goal.MontoObjetivo) || 0;
  return {
    current,
    target,
    remaining: Math.max(target - current, 0),
    percent: target > 0 ? Math.min((current / target) * 100, 100) : 0,
  };
}

export function getAutomaticFinancialInsights({
  transactions,
  budgets,
  debts,
  goals,
  period = currentPeriod(),
  strategy = "avalanche",
}: AssistantContext): AssistantInsight[] {
  const current = getMonthStats(transactions, period);
  const previous = getMonthStats(transactions, previousPeriod(period));
  const insights: AssistantInsight[] = [];

  if (previous.expenses > 0) {
    const diff = current.expenses - previous.expenses;
    const percent = (diff / previous.expenses) * 100;
    if (Math.abs(percent) >= 10) {
      insights.push({
        title: diff > 0 ? "Gastos en aumento" : "Gastos bajo control",
        message:
          diff > 0
            ? `Este mes gastaste ${percent.toFixed(0)}% mas que el mes pasado.`
            : `Este mes gastaste ${Math.abs(percent).toFixed(0)}% menos que el mes pasado.`,
        tone: diff > 0 ? "warning" : "good",
      });
    }
  }

  if (previous.income > 0) {
    const diff = current.income - previous.income;
    const percent = (diff / previous.income) * 100;
    if (Math.abs(percent) >= 10) {
      insights.push({
        title: diff < 0 ? "Ingresos bajaron" : "Ingresos subieron",
        message:
          diff < 0
            ? `Tus ingresos bajaron ${Math.abs(percent).toFixed(0)}% respecto al mes pasado.`
            : `Tus ingresos subieron ${percent.toFixed(0)}% respecto al mes pasado.`,
        tone: diff < 0 ? "warning" : "good",
      });
    }
  }

  const [category, amount] = topCategory(current) ?? [];
  if (category && amount > 0) {
    insights.push({
      title: "Categoria principal",
      message: `Tu mayor gasto este mes es ${category}, con ${money(amount)}.`,
      tone: "info",
    });
  }

  const categoryDiff = categoryComparison(current, previous).find(
    (item) => item.previousAmount > 0 && item.percent !== null && item.percent >= 15
  );
  if (categoryDiff?.percent) {
    insights.push({
      title: "Categoria creciendo",
      message: `Este mes gastaste ${categoryDiff.percent.toFixed(0)}% mas en ${categoryDiff.category}.`,
      tone: "warning",
    });
  }

  const debtSummary = getDebtControlSummary({
    debts,
    transactions,
    strategy,
    period,
  });
  if (debtSummary.priorityDebt) {
    insights.push({
      title: "Deuda prioritaria",
      message: `Te conviene priorizar ${debtSummary.priorityDebt.debt.name}.`,
      tone: "warning",
    });
  }

  const behindGoal = goals
    .map((goal) => ({ goal, progress: goalProgress(goal, transactions) }))
    .filter((item) => item.progress.target > 0 && item.progress.percent < 50)
    .sort((a, b) => a.progress.percent - b.progress.percent)[0];
  if (behindGoal) {
    insights.push({
      title: "Meta por impulsar",
      message: `${behindGoal.goal.Nombre} lleva ${behindGoal.progress.percent.toFixed(0)}%. Faltan ${money(behindGoal.progress.remaining)}.`,
      tone: "info",
    });
  }

  if (budgets.length === 0) {
    insights.push({
      title: "Presupuesto pendiente",
      message: "Configurar presupuesto por categoria haria tus recomendaciones mas precisas.",
      tone: "info",
    });
  }

  return insights.slice(0, 6);
}

export function answerFinancialQuestion(
  question: string,
  context: AssistantContext
) {
  const period = context.period ?? currentPeriod();
  const strategy = context.strategy ?? "avalanche";
  const current = getMonthStats(context.transactions, period);
  const previous = getMonthStats(context.transactions, previousPeriod(period));
  const normalized = normalizeKey(question);
  const debtSummary = getDebtControlSummary({
    debts: context.debts,
    transactions: context.transactions,
    strategy,
    period,
  });

  if (!normalized) {
    return "Escribeme una pregunta como: 'Como voy este mes?' o 'Puedo gastar RD$3,000 hoy?'.";
  }

  const spendMatch = question.match(/(?:RD\$?\s*)?([\d,.]+)/i);
  const requestedSpend = spendMatch ? Number(spendMatch[1].replace(/,/g, "")) : 0;

  if (normalized.includes("puedogastar") || normalized.includes("gast")) {
    const available = current.income - current.expenses;
    const canSpend = requestedSpend > 0 ? available - requestedSpend >= 0 : available > 0;
    const top = topCategory(current);
    const extra = requestedSpend > 0
      ? `Si gastas ${money(requestedSpend)}, quedarias con ${money(available - requestedSpend)} disponibles del mes.`
      : `Ahora mismo llevas ${money(available)} de margen entre ingresos y gastos.`;
    return canSpend
      ? `Puedes hacerlo con cautela. ${extra} Tu mayor gasto actual es ${top ? top[0] : "sin categoria destacada"}.`
      : `Yo no lo recomendaria ahora. ${extra} Primero revisaria gastos variables o pagos pendientes.`;
  }

  if (normalized.includes("comovoy") || normalized.includes("mes")) {
    const diff = current.expenses - previous.expenses;
    return `Este mes tienes ingresos por ${money(current.income)}, gastos por ${money(current.expenses)} y ahorro neto de ${money(current.savings)}. Frente al mes anterior, tus gastos ${diff >= 0 ? "subieron" : "bajaron"} ${money(Math.abs(diff))}.`;
  }

  if (normalized.includes("deuda") || normalized.includes("pagarprimero")) {
    const priority = debtSummary.priorityDebt ?? (
      getPriorityDebt(context.debts, strategy)
        ? { debt: getPriorityDebt(context.debts, strategy)! }
        : null
    );
    if (!priority) return "No tienes deudas registradas para priorizar. Cuando agregues una, puedo ayudarte con Snowball o Avalanche.";
    return `Te conviene priorizar ${priority.debt.name}. Con ${strategy === "avalanche" ? "Avalanche" : "Snowball"}, esa deuda es la mas importante ahora. Su balance es ${money(priority.debt.currentBalance)} y su tasa es ${priority.debt.interestRate}%.`;
  }

  if (normalized.includes("mucho") || normalized.includes("gastandomucho")) {
    const comparison = categoryComparison(current, previous);
    const growing = comparison.find((item) => item.difference > 0);
    if (!growing) return `No veo una categoria creciendo fuerte este mes. Tus gastos actuales son ${money(current.expenses)}.`;
    const reducible = growing.difference * 0.5;
    return `La categoria que mas subio es ${growing.category}: aumentó ${money(growing.difference)} frente al mes anterior. Si reduces la mitad de ese aumento, podrias ahorrar cerca de ${money(reducible)}.`;
  }

  if (normalized.includes("ahorr") || normalized.includes("meta")) {
    const goal = context.goals
      .map((item) => ({ item, progress: goalProgress(item, context.transactions) }))
      .sort((a, b) => b.progress.remaining - a.progress.remaining)[0];
    if (!goal) return "Aun no tienes metas de ahorro registradas. Crear una meta me ayudaria a darte consejos mas concretos.";
    return `Tu meta ${goal.item.Nombre} lleva ${money(goal.progress.current)} de ${money(goal.progress.target)}. Faltan ${money(goal.progress.remaining)}. Si liberas gasto variable este mes, podrias enviarlo directo a esa meta.`;
  }

  const insights = getAutomaticFinancialInsights(context);
  return insights.length > 0
    ? `Lo mas importante ahora: ${insights[0].message}`
    : "No veo una alerta fuerte ahora mismo. Tus datos se ven estables, pero puedo ayudarte a revisar gastos, deudas o metas.";
}
