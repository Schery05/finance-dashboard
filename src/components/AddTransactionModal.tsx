"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFinanceStore } from "@/store/financeStore";
import type { Transaction } from "@/lib/types";
import type { TransactionInput } from "@/lib/validators";

function toISODate(value: string) {
  const s = String(value ?? "").trim();
  if (!s) return "";

  // Si ya viene ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Si viene dd/mm/yyyy o dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // Intento final: parseable por Date
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return "";
}

export function AddTransactionModal({ open, onClose,editing, }: { open: boolean; onClose: () => void; editing: Transaction | null; }) {
  const { addTransaction, updateTransaction, loading } = useFinanceStore();

  // const [form, setForm] = useState<Transaction>({
  //   Fecha: new Date().toISOString().slice(0, 10),
  //   Tipo: "Gasto",
  //   Categoría: "General",
  //   Importe: 0,
  //   EstadoPago: "Pendiente",
  //   DescripcionAdicional: "",
  // });
  const update = (k: keyof Transaction, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const isEdit = !!editing;

  const [form, setForm] = useState<TransactionInput>({
  Fecha: new Date().toISOString().slice(0, 10),
  Tipo: "Gasto",
  Categoría: "",
  Importe: 0,
  EstadoPago: "Pendiente",
  DescripcionAdicional: "",
});

useEffect(() => {
  if (editing) {
    // modo editar: prellenar
    setForm({
      Fecha: toISODate(editing.Fecha),
      Tipo: editing.Tipo,
      Categoría: editing.Categoría,
      Importe: editing.Importe,
      EstadoPago: editing.EstadoPago,
      DescripcionAdicional: editing.DescripcionAdicional ?? "",
    });
  } else {
    // modo crear: reset
    setForm({
      Fecha: new Date().toISOString().slice(0, 10),
      Tipo: "Gasto",
      Categoría: "General",
      Importe: 0,
      EstadoPago: "Pendiente",
      DescripcionAdicional: "",
    });
  }
}, [editing, open]);


  const submit = async () => {
    const payload: TransactionInput = {
    Fecha: form.Fecha,
    Tipo: form.Tipo,
    Categoría: form.Categoría,
    Importe: Number(form.Importe) || 0,
    EstadoPago: form.EstadoPago,
    DescripcionAdicional: form.DescripcionAdicional ?? "",
  };

  if (editing) {
    await updateTransaction(editing.ID, payload);   // PATCH
  } else {
    await addTransaction(payload);                 // POST
  }

  onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="glass w-full max-w-xl p-5 relative">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-xl bg-white/5 p-2 ring-1 ring-white/10 hover:bg-white/10"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>

             <h3>{isEdit ? "Editar transacción" : "Agregar transacción"}</h3>
              <p className="text-sm text-white/60 mb-4">Se guardará en Google Sheets.</p>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm text-white/70">
                  Fecha
                  <input
                    type="date"
                    value={form.Fecha}
                    onChange={(e) => update("Fecha", e.target.value)}
                    className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
                  />
                </label>

                <label className="text-sm text-white/70">
                  Tipo
                  <select
                    value={form.Tipo}
                    onChange={(e) => update("Tipo", e.target.value as any)}
                    className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
                  >
                    <option value="Ingreso">Ingreso</option>
                    <option value="Gasto">Gasto</option>
                  </select>
                </label>

                <label className="text-sm text-white/70">
                  Categoría
                  <input
                    value={form.Categoría}
                    onChange={(e) => update("Categoría", e.target.value)}
                    className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
                  />
                </label>

                <label className="text-sm text-white/70">
                  Importe
                  <input
                    type="number"
                    value={form.Importe}
                    onChange={(e) => update("Importe", Number(e.target.value))}
                    className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
                  />
                </label>

                <label className="text-sm text-white/70 md:col-span-2">
                  Estado de pago
                  <select
                    value={form.EstadoPago}
                    onChange={(e) => update("EstadoPago", e.target.value as any)}
                    className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
                  >
                    <option value="Pagado">Pagado</option>
                    <option value="Pendiente">Pendiente</option>
                  </select>
                </label>

                <label className="text-sm text-white/70 md:col-span-2">
                  Descripción adicional
                  <textarea
                    value={form.DescripcionAdicional}
                    onChange={(e) => update("DescripcionAdicional", e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
                  />
                </label>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  onClick={onClose}
                  className="rounded-xl bg-white/5 px-4 py-2 text-sm ring-1 ring-white/10 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  disabled={loading}
                  onClick={submit}
                  className="rounded-xl bg-gradient-to-r from-cyan-500/80 to-fuchsia-500/80 px-4 py-2 text-sm font-medium
                             ring-1 ring-white/15 hover:opacity-95 disabled:opacity-60"
                >
                  Guardar
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}