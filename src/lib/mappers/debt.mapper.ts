import type { Debt } from "@/lib/types";
import type { DebtInput } from "@/lib/validators";

type DecimalLike = {
  toNumber?: () => number;
  toString: () => string;
};

export type DBDebt = {
  id: string;
  name: string;
  initialAmount: DecimalLike | number | string;
  currentBalance: DecimalLike | number | string;
  interestRate: DecimalLike | number | string;
  monthlyPayment: DecimalLike | number | string;
  paymentDay: number;
  type: Debt["type"] | string;
  createdAt: Date;
};

function decimalToNumber(value: DecimalLike | number | string) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value.toString());
}

export function mapDebtDBToUI(debt: DBDebt): Debt {
  return {
    id: debt.id,
    name: debt.name,
    initialAmount: decimalToNumber(debt.initialAmount),
    currentBalance: decimalToNumber(debt.currentBalance),
    interestRate: decimalToNumber(debt.interestRate),
    monthlyPayment: decimalToNumber(debt.monthlyPayment),
    paymentDay: debt.paymentDay,
    type: debt.type as Debt["type"],
    createdAt: debt.createdAt.toISOString(),
  };
}

export function mapDebtUIToDB(data: DebtInput) {
  return {
    name: data.name.trim(),
    initialAmount: data.initialAmount,
    currentBalance: data.currentBalance,
    interestRate: data.interestRate,
    monthlyPayment: data.monthlyPayment,
    paymentDay: data.paymentDay,
    type: data.type,
  };
}
