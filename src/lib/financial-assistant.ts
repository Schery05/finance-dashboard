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

function ratio(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}

function topCategories(stats: MonthStats, limit = 3) {
  return Array.from(stats.categoryExpenses.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, amount]) => ({ category, amount }));
}

function findMentionedCategory(question: string, categories: string[]) {
  const normalizedQuestion = normalizeKey(question);
  return categories.find((category) =>
    normalizedQuestion.includes(normalizeKey(category))
  );
}

function getBudgetStatus(budgets: Budget[], stats: MonthStats, period: string) {
  return budgets
    .filter((budget) => budget.period === period)
    .map((budget) => {
      const spent = Array.from(stats.categoryExpenses.entries()).find(
        ([category]) => normalizeKey(category) === normalizeKey(budget.category)
      )?.[1] ?? 0;
      return {
        budget,
        spent,
        remaining: Number(budget.monthlyLimit) - spent,
        usedPercent: ratio(spent, Number(budget.monthlyLimit) || 0),
      };
    })
    .sort((a, b) => b.usedPercent - a.usedPercent);
}

function getGoalStatuses(goals: SavingsGoal[], transactions: Transaction[]) {
  return goals
    .map((goal) => ({ goal, progress: goalProgress(goal, transactions) }))
    .sort((a, b) => b.progress.remaining - a.progress.remaining);
}

function parseRequestedAmount(question: string) {
  const matches = Array.from(question.matchAll(/(?:RD\$?\s*)?(\d[\d,.]*)/gi));
  const values = matches
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values[0] ?? 0;
}

function pickFollowUp(question: string, context: AssistantContext) {
  const normalized = normalizeKey(question);
  if (normalized.includes("deuda")) {
    return "Si quieres, preguntame cuanto pago extra conviene ponerle a una deuda especifica.";
  }
  if (normalized.includes("meta") || normalized.includes("ahorr")) {
    return "Tambien puedes preguntarme cuanto necesitas ahorrar por semana para llegar a una meta.";
  }
  if (context.budgets.length === 0) {
    return "Para recomendaciones mas precisas, el proximo paso seria crear presupuestos por categoria.";
  }
  return "Puedo profundizar por categoria, por deuda, por meta o por flujo de efectivo del mes.";
}

function compactCategoryList(categories: { category: string; amount: number }[]) {
  if (categories.length === 0) return "sin gastos destacados todavia";
  return categories
    .map((item) => `${item.category}: ${money(item.amount)}`)
    .join(", ");
}

export function buildFinancialAdvisorBrief(
  question: string,
  context: AssistantContext
) {
  const period = context.period ?? currentPeriod();
  const strategy = context.strategy ?? "avalanche";
  const current = getMonthStats(context.transactions, period);
  const previous = getMonthStats(context.transactions, previousPeriod(period));
  const budgetStatus = getBudgetStatus(context.budgets, current, period);
  const debtSummary = getDebtControlSummary({
    debts: context.debts,
    transactions: context.transactions,
    strategy,
    period,
  });
  const goalStatuses = getGoalStatuses(context.goals, context.transactions);
  const categories = topCategories(current, 6);
  const categoryGrowth = categoryComparison(current, previous).slice(0, 6);
  const mentionedCategory = findMentionedCategory(
    question,
    Array.from(current.categoryExpenses.keys())
  );
  const requestedAmount = parseRequestedAmount(question);

  return {
    period,
    question,
    requestedAmount,
    mentionedCategory: mentionedCategory ?? null,
    monthlyCashflow: {
      income: current.income,
      expenses: current.expenses,
      netSavings: current.savings,
      availableMargin: current.income - current.expenses,
      savingsRatePercent: ratio(current.savings, current.income),
      previousExpenses: previous.expenses,
      expenseChange: current.expenses - previous.expenses,
      transactionCount: current.transactions.length,
    },
    topExpenseCategories: categories,
    categoryChanges: categoryGrowth.map((item) => ({
      category: item.category,
      current: item.amount,
      previous: item.previousAmount,
      difference: item.difference,
      percent: item.percent,
    })),
    budgets: budgetStatus.map((item) => ({
      category: item.budget.category,
      limit: item.budget.monthlyLimit,
      spent: item.spent,
      remaining: item.remaining,
      usedPercent: item.usedPercent,
    })),
    debts: {
      totalCurrentDebt: debtSummary.totalCurrentDebt,
      totalEstimatedMonthlyInterest: debtSummary.totalEstimatedInterest,
      debtToIncomePercent: debtSummary.debtToIncomePercent,
      priorityDebt: debtSummary.priorityDebt
        ? {
            name: debtSummary.priorityDebt.debt.name,
            balance: debtSummary.priorityDebt.debt.currentBalance,
            interestRate: debtSummary.priorityDebt.debt.interestRate,
            monthlyPayment: debtSummary.priorityDebt.debt.monthlyPayment,
            estimatedMonthlyInterest:
              debtSummary.priorityDebt.estimatedMonthlyInterest,
            monthsToPayoff: debtSummary.priorityDebt.monthsToPayoff,
          }
        : null,
      items: debtSummary.analyses.map((item) => ({
        name: item.debt.name,
        balance: item.debt.currentBalance,
        interestRate: item.debt.interestRate,
        monthlyPayment: item.debt.monthlyPayment,
        estimatedMonthlyInterest: item.estimatedMonthlyInterest,
        isLowPayment: item.isLowPayment,
        monthsToPayoff: item.monthsToPayoff,
      })),
    },
    goals: goalStatuses.map((item) => ({
      name: item.goal.Nombre,
      current: item.progress.current,
      target: item.progress.target,
      remaining: item.progress.remaining,
      percent: item.progress.percent,
      deadline: item.goal.FechaLimite,
    })),
    automaticInsights: getAutomaticFinancialInsights(context),
    localRecommendation: answerFinancialQuestion(question, context),
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
  const budgetStatus = getBudgetStatus(context.budgets, current, period);

  if (!normalized) {
    return "Escribeme una pregunta como: 'Como voy este mes?' o 'Puedo gastar RD$3,000 hoy?'.";
  }

  const goalStatuses = getGoalStatuses(context.goals, context.transactions);
  const categories = topCategories(current, 4);
  const categoryNames = Array.from(current.categoryExpenses.keys());
  const mentionedCategory = findMentionedCategory(question, categoryNames);
  const requestedSpend = parseRequestedAmount(question);
  const available = current.income - current.expenses;
  const savingsRate = ratio(current.savings, current.income);
  const expenseChange = current.expenses - previous.expenses;
  const categoryGrowth = categoryComparison(current, previous).filter(
    (item) => item.difference > 0
  );
  const insights = getAutomaticFinancialInsights(context);
  const priority = debtSummary.priorityDebt ?? (
    getPriorityDebt(context.debts, strategy)
      ? { debt: getPriorityDebt(context.debts, strategy)! }
      : null
  );

  if (
    (normalized.includes("puedogastar") ||
      normalized.includes("gastar") ||
      requestedSpend > 0) &&
    !normalized.includes("mucho")
  ) {
    const canSpend = requestedSpend > 0 ? available - requestedSpend >= 0 : available > 0;
    const categoryLine = mentionedCategory
      ? `En ${mentionedCategory} llevas ${money(current.categoryExpenses.get(mentionedCategory) ?? 0)} este mes.`
      : `Tus categorias mas pesadas son ${compactCategoryList(categories.slice(0, 3))}.`;
    const budget = mentionedCategory
      ? budgetStatus.find((item) => normalizeKey(item.budget.category) === normalizeKey(mentionedCategory))
      : budgetStatus[0];
    const budgetLine = budget
      ? `Presupuesto mas sensible: ${budget.budget.category} va en ${budget.usedPercent.toFixed(0)}% (${money(budget.remaining)} restantes).`
      : "No tienes un presupuesto activo para medir ese gasto contra un limite.";
    const result = requestedSpend > 0
      ? `Si gastas ${money(requestedSpend)}, tu margen del mes quedaria en ${money(available - requestedSpend)}.`
      : `Tu margen actual entre ingresos y gastos es ${money(available)}.`;

    return [
      canSpend ? "Si se puede, pero lo haria con criterio." : "Yo lo pausaria por ahora.",
      result,
      categoryLine,
      budgetLine,
      canSpend
        ? "Mi recomendacion: hazlo solo si no compromete pagos fijos, deudas ni una meta importante."
        : "Mi recomendacion: primero recorta un gasto variable o espera a registrar el proximo ingreso.",
    ].join("\n");
  }

  if (normalized.includes("comovoy") || normalized.includes("mes")) {
    const trend =
      previous.expenses > 0
        ? `Frente al mes anterior, tus gastos ${expenseChange >= 0 ? "subieron" : "bajaron"} ${money(Math.abs(expenseChange))}.`
        : "Todavia no hay suficiente comparacion con el mes anterior.";
    const budgetWarning = budgetStatus.find((item) => item.usedPercent >= 85);
    return [
      `Vas con ingresos de ${money(current.income)}, gastos de ${money(current.expenses)} y ahorro neto de ${money(current.savings)}.`,
      `Tu tasa de ahorro del mes es ${savingsRate.toFixed(1)}%. ${trend}`,
      `Mayor concentracion de gasto: ${compactCategoryList(categories.slice(0, 3))}.`,
      budgetWarning
        ? `Ojo con ${budgetWarning.budget.category}: ya consumiste ${budgetWarning.usedPercent.toFixed(0)}% del presupuesto.`
        : "No veo una alerta fuerte de presupuesto en este momento.",
      pickFollowUp(question, context),
    ].join("\n");
  }

  if (normalized.includes("deuda") || normalized.includes("pagarprimero")) {
    if (!priority) return "No tienes deudas registradas para priorizar. Cuando agregues una, puedo ayudarte con Snowball o Avalanche.";
    const analysis = debtSummary.analyses.find((item) => item.debt.id === priority.debt.id);
    const payoffText = analysis?.monthsToPayoff
      ? `Al pago actual, la proyeccion aproximada es ${analysis.monthsToPayoff} meses.`
      : "Con el pago actual no puedo proyectar una fecha clara de cierre.";
    return [
      `Priorizaria ${priority.debt.name}.`,
      `Balance: ${money(priority.debt.currentBalance)}. Tasa: ${priority.debt.interestRate}%. Pago mensual: ${money(priority.debt.monthlyPayment)}.`,
      `Uso la estrategia ${strategy === "avalanche" ? "Avalanche, porque ataca primero la tasa mas alta" : "Snowball, porque busca cerrar primero el balance mas pequeno"}. ${payoffText}`,
      debtSummary.totalCurrentDebt > 0
        ? `Tu deuda total registrada es ${money(debtSummary.totalCurrentDebt)} y el interes mensual estimado ronda ${money(debtSummary.totalEstimatedInterest)}.`
        : "No veo deuda activa adicional registrada.",
      "Siguiente accion: paga el minimo de las demas deudas y manda cualquier excedente a esta prioridad.",
    ].join("\n");
  }

  if (normalized.includes("mucho") || normalized.includes("gastandomucho")) {
    const growing = categoryGrowth[0];
    if (!growing) {
      return [
        `Tus gastos actuales son ${money(current.expenses)}.`,
        `No veo una categoria creciendo fuerte frente al mes anterior. Lo que mas pesa ahora es ${compactCategoryList(categories.slice(0, 3))}.`,
        "Mi lectura: mantendria vigilancia, pero no parece una fuga evidente con los datos disponibles.",
      ].join("\n");
    }
    const reducible = growing.difference * 0.5;
    return [
      `Si, hay una senal a revisar: ${growing.category} subio ${money(growing.difference)} frente al mes anterior.`,
      `Si reduces la mitad de ese aumento, liberarias cerca de ${money(reducible)}.`,
      `Tus gastos totales del mes van en ${money(current.expenses)} y el margen disponible es ${money(available)}.`,
      "Recomendacion practica: revisa los ultimos movimientos de esa categoria y define un limite semanal hasta cerrar el mes.",
    ].join("\n");
  }

  if (normalized.includes("ahorr") || normalized.includes("meta")) {
    const goal = goalStatuses[0];
    if (!goal) return "Aun no tienes metas de ahorro registradas. Crear una meta me ayudaria a darte consejos mas concretos.";
    const monthlyRoom = Math.max(available, 0);
    return [
      `La meta que mas necesita atencion es ${goal.goal.Nombre}.`,
      `Lleva ${money(goal.progress.current)} de ${money(goal.progress.target)} (${goal.progress.percent.toFixed(0)}%). Faltan ${money(goal.progress.remaining)}.`,
      monthlyRoom > 0
        ? `Con tu margen actual, podrias apartar hasta ${money(monthlyRoom)} este mes sin quedar en negativo.`
        : "Ahora mismo no hay margen positivo; primero conviene recuperar flujo antes de aportar mas.",
      "Idea simple: mueve a la meta una parte fija apenas entre el ingreso, no lo que sobre al final.",
    ].join("\n");
  }

  if (normalized.includes("presupuesto") || normalized.includes("limite")) {
    if (budgetStatus.length === 0) {
      return "No tienes presupuestos activos para este mes. Si agregas limites por categoria, puedo decirte cuanto queda, que categoria va acelerada y donde conviene recortar.";
    }
    const tight = budgetStatus[0];
    return [
      `El presupuesto mas presionado es ${tight.budget.category}.`,
      `Has usado ${tight.usedPercent.toFixed(0)}%: ${money(tight.spent)} de ${money(tight.budget.monthlyLimit)}.`,
      tight.remaining >= 0
        ? `Te quedan ${money(tight.remaining)} para cerrar el mes dentro del limite.`
        : `Ya pasaste el limite por ${money(Math.abs(tight.remaining))}.`,
      "Mi recomendacion: congela o reduce esa categoria primero antes de tocar categorias que todavia estan sanas.",
    ].join("\n");
  }

  return [
    "Te respondo con la lectura financiera mas util que veo ahora mismo:",
    `Ingresos: ${money(current.income)}. Gastos: ${money(current.expenses)}. Margen: ${money(available)}.`,
    `Categorias principales: ${compactCategoryList(categories.slice(0, 3))}.`,
    priority ? `Deuda a vigilar: ${priority.debt.name} (${money(priority.debt.currentBalance)} pendientes).` : "No hay una deuda prioritaria registrada ahora mismo.",
    insights[0]?.message ?? "No veo una alerta fuerte; tus datos se ven relativamente estables.",
    pickFollowUp(question, context),
  ].join("\n");
}
