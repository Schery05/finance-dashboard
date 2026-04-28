export type TxType = "Ingreso" | "Gasto";

export interface Transaction {
  ID: string //obligatorio
  Fecha: string; // ISO o yyyy-mm-dd
  Tipo: TxType;
  Categoría: string;
  Importe: number;
  EstadoPago: "Pagado" | "Pendiente";
  DescripcionAdicional: string;
  EsSugerenciaRecurrente?: boolean;
}

export interface SavingsGoal {
  ID: string;
  Nombre: string;
  MontoObjetivo: number;
  FechaLimite: string;
  TransaccionesAsociadas: string[];
  CreadoEn: string;
  SaldoInicial: number;
}

export type DebtType =
  | "TARJETA"
  | "PRESTAMO_PERSONAL"
  | "VEHICULO"
  | "HIPOTECA"
  | "OTRO";

export interface Debt {
  id: string;
  name: string;
  initialAmount: number;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
  paymentDay: number;
  type: DebtType;
  createdAt: string;
}
