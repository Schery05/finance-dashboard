import type { Transaction } from "@/lib/types";
import type { TransactionInput } from "@/lib/validators";

type DBTransactionType = "INGRESO" | "GASTO";
type DBPaymentStatus = "PAGADO" | "PENDIENTE";

type DecimalLike = {
  toNumber?: () => number;
  toString: () => string;
};

export type DBTransactionWithCategory = {
  id: string;
  date: Date;
  type: DBTransactionType | string;
  amount: DecimalLike | number | string;
  paymentStatus: DBPaymentStatus | string;
  additionalDescription: string | null;
  debtId?: string | null;
  debtInstallment?: number | null;
  isRecurringSuggestion?: boolean;
  category: {
    name: string;
  };
};

export type DBTransactionInput = {
  date: Date;
  type: DBTransactionType;
  amount: number;
  paymentStatus: DBPaymentStatus;
  additionalDescription: string | null;
  categoryName: string;
  debtId?: string | null;
  debtInstallment?: number | null;
};

function decimalToNumber(value: DBTransactionWithCategory["amount"]) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value.toString());
}

function formatDateForUI(date: Date) {
  return date.toISOString().slice(0, 10);
}

function mapTypeToUI(type: string): Transaction["Tipo"] {
  return type.toUpperCase() === "INGRESO" ? "Ingreso" : "Gasto";
}

function mapTypeToDB(type: TransactionInput["Tipo"]): DBTransactionType {
  return type === "Ingreso" ? "INGRESO" : "GASTO";
}

function mapPaymentStatusToUI(status: string): Transaction["EstadoPago"] {
  return status.toUpperCase() === "PAGADO" ? "Pagado" : "Pendiente";
}

function mapPaymentStatusToDB(
  status: TransactionInput["EstadoPago"]
): DBPaymentStatus {
  return status === "Pagado" ? "PAGADO" : "PENDIENTE";
}

export function mapDBToUI(tx: DBTransactionWithCategory): Transaction {
  return {
    ID: tx.id,
    Fecha: formatDateForUI(tx.date),
    Tipo: mapTypeToUI(tx.type),
    Categoría: tx.category.name,
    Importe: decimalToNumber(tx.amount),
    EstadoPago: mapPaymentStatusToUI(tx.paymentStatus),
    DescripcionAdicional: tx.additionalDescription ?? "",
    EsPagoDeuda: Boolean(tx.debtId && tx.debtId.length > 0),
    DeudaId: tx.debtId ?? undefined,
    CuotaActual: tx.debtInstallment ?? undefined,
    EsSugerenciaRecurrente: Boolean(tx.isRecurringSuggestion),
  };
}

export function mapUIToDB(data: TransactionInput): DBTransactionInput {
  const isDebtPayment = data.Tipo === "Gasto" && data.EsPagoDeuda;

  return {
    date: new Date(`${data.Fecha}T00:00:00.000Z`),
    type: mapTypeToDB(data.Tipo),
    amount: data.Importe,
    paymentStatus: mapPaymentStatusToDB(data.EstadoPago),
    additionalDescription: data.DescripcionAdicional?.trim() || null,
    categoryName: data.Categoría.trim(),
    debtId: isDebtPayment ? data.DeudaId?.trim() || null : null,
    debtInstallment: isDebtPayment ? data.CuotaActual ?? null : null,
  };
}
