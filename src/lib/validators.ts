import { z } from "zod";

export const TransactionSchema = z.object({
  Fecha: z.string().min(1),
  Tipo: z.enum(["Ingreso", "Gasto"]),
  Categoría: z.string().min(1),
  Importe: z.number().finite(),
  EstadoPago: z.enum(["Pagado", "Pendiente"]),
  DescripcionAdicional: z.string().optional().default(""),
});

export type TransactionInput = z.infer<typeof TransactionSchema>;

export const SavingsGoalSchema = z.object({
  Nombre: z.string().min(1),
  MontoObjetivo: z.number().finite().positive(),
  FechaLimite: z.string().optional().default(""),
  TransaccionesAsociadas: z.array(z.string()).optional().default([]),
  SaldoInicial: z.number().finite().nonnegative().optional().default(0),
});

export type SavingsGoalInput = z.infer<typeof SavingsGoalSchema>;

export const BudgetSchema = z.object({
  category: z.string().min(1),
  monthlyLimit: z.number().finite().positive(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  createdAt: z.string().optional().default(""),
});

export type BudgetInput = z.infer<typeof BudgetSchema>;

export const DebtSchema = z.object({
  name: z.string().min(1),
  initialAmount: z.number().finite().positive(),
  currentBalance: z.number().finite().nonnegative(),
  interestRate: z.number().finite().min(0),
  monthlyPayment: z.number().finite().nonnegative(),
  paymentDay: z.number().int().min(1).max(31),
  type: z.enum(["TARJETA", "PRESTAMO_PERSONAL", "VEHICULO", "HIPOTECA", "OTRO"]),
});

export type DebtInput = z.infer<typeof DebtSchema>;
