import type { Debt, Transaction } from "@/lib/types";
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
  type: "overdue" | "upcoming" | "debt-interest" | "debt-low-payment" | "debt-priority";
  daysDifference?: number;
};

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

      const amount = new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
      }).format(Number(tx.Importe) || 0);

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
