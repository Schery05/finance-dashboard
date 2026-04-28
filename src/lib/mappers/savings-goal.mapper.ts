import type { SavingsGoal } from "@/lib/types";
import type { SavingsGoalInput } from "@/lib/validators";

type DecimalLike = {
  toNumber?: () => number;
  toString: () => string;
};

type SavingsMovementWithTransaction = {
  transactionId: string | null;
};

export type DBSavingsGoalWithMovements = {
  id: string;
  name: string;
  target: DecimalLike | number | string;
  initialBalance: DecimalLike | number | string;
  deadline: Date | null;
  createdAt: Date;
  movements: SavingsMovementWithTransaction[];
};

export type DBSavingsGoalInput = {
  name: string;
  target: number;
  initialBalance: number;
  deadline: Date | null;
  transactionIds: string[];
};

function decimalToNumber(
  value: DBSavingsGoalWithMovements["target"] | DBSavingsGoalWithMovements["initialBalance"]
) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value.toString());
}

function dateToInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function inputValueToDate(value?: string) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? new Date(`${trimmed}T00:00:00.000Z`) : null;
}

export function mapSavingsGoalDBToUI(
  goal: DBSavingsGoalWithMovements
): SavingsGoal {
  return {
    ID: goal.id,
    Nombre: goal.name,
    MontoObjetivo: decimalToNumber(goal.target),
    FechaLimite: dateToInputValue(goal.deadline),
    TransaccionesAsociadas: goal.movements
      .map((movement) => movement.transactionId)
      .filter((id): id is string => Boolean(id)),
    CreadoEn: goal.createdAt.toISOString(),
    SaldoInicial: decimalToNumber(goal.initialBalance),
  };
}

export function mapSavingsGoalUIToDB(
  data: SavingsGoalInput
): DBSavingsGoalInput {
  return {
    name: data.Nombre.trim(),
    target: data.MontoObjetivo,
    initialBalance: data.SaldoInicial,
    deadline: inputValueToDate(data.FechaLimite),
    transactionIds: Array.from(
      new Set(data.TransaccionesAsociadas.map(String).filter(Boolean))
    ),
  };
}
