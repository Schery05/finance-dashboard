import type { Budget } from "@/lib/budgets";
import type { Debt, Transaction } from "@/lib/types";
import type { Subscription } from "@/lib/subscriptions";
import {
  getDebtAlerts,
  getDebtControlSummary,
  type DebtStrategy,
} from "@/lib/debt-control";

export type PaymentNotification = {
  id: string;
  transactionId?: string;
  debtId?: string;
  title: string;
  message: string;
  type:
    | "overdue"
    | "upcoming"
    | "budget-overrun"
    | "cashflow-overrun"
    | "subscription-renewal"
    | "debt-interest"
    | "debt-low-payment"
    | "debt-priority";
  daysDifference?: number;
  budgetId?: string;
  category?: string;
  period?: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
  }).format(Number.isFinite(value) ? value : 0);

function normalizeKey(value: string) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function getTransactionCategory(tx: Transaction) {
  const entry = Object.entries(tx as unknown as Record<string, unknown>).find(
    ([key]) => normalizeKey(key) === "categoria"
  );

  return String(entry?.[1] ?? "");
}

function isPaid(tx: Transaction) {
  return normalizeKey(tx.EstadoPago) === "pagado";
}

function normalizeDate(dateValue: string) {
  const value = String(dateValue ?? "").trim();

  if (!value) return null;

  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }

  // Formato DD/MM/YYYY
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3];

    return new Date(`${year}-${month}-${day}T00:00:00`);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

export function getPaymentNotifications(
  transactions: Transaction[],
  daysBeforeDue = 3
): PaymentNotification[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return transactions
    .filter(
      (tx) =>
        tx.Tipo === "Gasto" &&
        tx.EstadoPago === "Pendiente"
    )
    .map((tx) => {
      const paymentDate = normalizeDate(tx.Fecha);

      if (!paymentDate) return null;

      paymentDate.setHours(0, 0, 0, 0);

      const diffDays = Math.ceil(
        (paymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      const amount = money(Number(tx.Importe) || 0);

      if (diffDays < 0) {
        return {
          id: `overdue-${tx.ID}`,
          transactionId: tx.ID,
          title: "Pago vencido",
          message: `Tienes pendiente pagar ${tx.Categoría} por ${amount}.`,
          type: "overdue" as const,
          daysDifference: diffDays,
        };
      }

      if (diffDays <= daysBeforeDue) {
        return {
          id: `upcoming-${tx.ID}`,
          transactionId: tx.ID,
          title: "Pago próximo",
          message:
            diffDays === 0
              ? `Hoy debes pagar ${tx.Categoría} por ${amount}.`
              : `Tienes un pago pendiente de ${tx.Categoría} en ${diffDays} día(s).`,
          type: "upcoming" as const,
          daysDifference: diffDays,
        };
      }

      return null;
    })
    .filter(Boolean) as PaymentNotification[];
}

function periodKey(dateValue: string) {
  const date = normalizeDate(dateValue);
  if (!date) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getBudgetNotifications({
  budgets,
  transactions,
}: {
  budgets: Budget[];
  transactions: Transaction[];
}): PaymentNotification[] {
  if (budgets.length === 0 || transactions.length === 0) return [];

  const spentByPeriodAndCategory = new Map<string, number>();

  for (const tx of transactions) {
    if (normalizeKey(tx.Tipo) !== "gasto") continue;
    if (!isPaid(tx)) continue;

    const period = periodKey(tx.Fecha);
    const category = normalizeKey(getTransactionCategory(tx));
    if (!period || !category) continue;

    const key = `${period}:${category}`;
    spentByPeriodAndCategory.set(
      key,
      (spentByPeriodAndCategory.get(key) ?? 0) + (Number(tx.Importe) || 0)
    );
  }

  return budgets
    .map((budget) => {
      const limit = Number(budget.monthlyLimit) || 0;
      if (limit <= 0) return null;

      const key = `${budget.period}:${normalizeKey(budget.category)}`;
      const spent = spentByPeriodAndCategory.get(key) ?? 0;
      if (spent <= limit) return null;

      const excess = spent - limit;
      return {
        id: `budget-overrun-${budget.id}-${budget.period}`,
        budgetId: budget.id,
        category: budget.category,
        period: budget.period,
        title: "Presupuesto superado",
        message: `${budget.category} supero el presupuesto de ${budget.period}: gastado ${money(spent)} de ${money(limit)} (${money(excess)} por encima).`,
        type: "budget-overrun" as const,
      };
    })
    .filter(Boolean) as PaymentNotification[];
}

export function getCashflowNotifications(
  transactions: Transaction[],
  period = new Date().toISOString().slice(0, 7)
): PaymentNotification[] {
  let income = 0;
  let expenses = 0;

  for (const tx of transactions) {
    if (periodKey(tx.Fecha) !== period) continue;

    if (normalizeKey(tx.Tipo) === "ingreso") {
      income += Number(tx.Importe) || 0;
    }

    if (normalizeKey(tx.Tipo) === "gasto" && isPaid(tx)) {
      expenses += Number(tx.Importe) || 0;
    }
  }

  if (expenses <= income || expenses <= 0) return [];

  return [
    {
      id: `cashflow-overrun-${period}`,
      title: "Gastos superan ingresos previstos",
      message:
        income > 0
          ? `En ${period}, tus gastos pagados (${money(expenses)}) superan tus ingresos previstos (${money(income)}) por ${money(expenses - income)}.`
          : `En ${period}, tienes gastos pagados por ${money(expenses)} y aun no hay ingresos previstos registrados.`,
      type: "cashflow-overrun",
      period,
    },
  ];
}

export function getSubscriptionNotifications(
  subscriptions: Subscription[]
): PaymentNotification[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return subscriptions
    .filter((subscription) => subscription.status === "Activa")
    .map((subscription) => {
      const date = new Date(`${subscription.nextChargeDate}T00:00:00`);
      if (Number.isNaN(date.getTime())) return null;

      const diffDays = Math.ceil((date.getTime() - today.getTime()) / 86400000);
      if (![1, 3, 7].includes(diffDays)) return null;

      return {
        id: `subscription-renewal-${subscription.id}-${subscription.nextChargeDate}`,
        title: "Suscripcion por renovar",
        message:
          diffDays === 1
            ? `${subscription.name} se renovara mañana por ${money(subscription.amount)}.`
            : `${subscription.name} se renovara en ${diffDays} dias por ${money(subscription.amount)}.`,
        type: "subscription-renewal" as const,
        daysDifference: diffDays,
      };
    })
    .filter(Boolean) as PaymentNotification[];
}

export function getDebtNotifications({
  debts,
  transactions,
  strategy = "avalanche",
  period = new Date().toISOString().slice(0, 7),
}: {
  debts: Debt[];
  transactions: Transaction[];
  strategy?: DebtStrategy;
  period?: string;
}): PaymentNotification[] {
  const summary = getDebtControlSummary({ debts, transactions, strategy, period });

  return getDebtAlerts(summary, strategy).map((alert) => ({
    id: alert.id,
    debtId: alert.debtId,
    title: alert.title,
    message: alert.message,
    type:
      alert.type === "interest"
        ? "debt-interest"
        : alert.type === "low-payment"
          ? "debt-low-payment"
          : "debt-priority",
  }));
}
