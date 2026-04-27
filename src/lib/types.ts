export type TxType = "Ingreso" | "Gasto";

export interface Transaction {
  ID: string //obligatorio
  Fecha: string; // ISO o yyyy-mm-dd
  Tipo: TxType;
  Categoría: string;
  Importe: number;
  EstadoPago: "Pagado" | "Pendiente";
  DescripcionAdicional: string;
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
