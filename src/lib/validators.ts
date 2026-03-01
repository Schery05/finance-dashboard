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