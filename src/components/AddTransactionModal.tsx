"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
  CATEGORIES_UPDATED_EVENT,
  fetchManagedCategories,
  loadManagedCategories,
  type ManagedCategories,
} from "@/lib/categories";
import type { Transaction } from "@/lib/types";
import type { TransactionInput } from "@/lib/validators";
import { useFinanceStore } from "@/store/financeStore";

function categoryExists(
  categories: ManagedCategories,
  tipo: "Ingreso" | "Gasto",
  categoria: string
) {
  const c = (categoria ?? "").trim();
  return categories[tipo].includes(c);
}

function normalizeTipo(tipo?: string): "Ingreso" | "Gasto" {
  const t = (tipo ?? "").trim().toLowerCase();
  return t === "ingreso" ? "Ingreso" : "Gasto";
}

function toISODate(value: string) {
  const s = String(value ?? "").trim();
  if (!s) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return "";
}

const amountInputFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const parseAmountInput = (value: string) => {
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : 0;
};

const formatAmountInput = (value: number) => {
  if (!Number.isFinite(value)) return "";
  return amountInputFormatter.format(value);
};

export function AddTransactionModal({
  open,
  onClose,
  editing,
  cloning,
}: {
  open: boolean;
  onClose: () => void;
  editing: Transaction | null;
  cloning: Transaction | null;
}) {
  const { addTransaction, updateTransaction, loading } = useFinanceStore();
  const [categories, setCategories] = useState<ManagedCategories>(() =>
    loadManagedCategories()
  );

  const [form, setForm] = useState<TransactionInput>({
    Fecha: new Date().toISOString().slice(0, 10),
    Tipo: "Gasto",
    Categoría: "",
    Importe: 0,
    EstadoPago: "Pendiente",
    DescripcionAdicional: "",
  });

  const update = <K extends keyof TransactionInput>(
    key: K,
    value: TransactionInput[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const isEdit = !!editing;
  const isClone = !!cloning && !editing;

  useEffect(() => {
    const refreshCategories = () => setCategories(loadManagedCategories());
    const fetchCategories = async () => {
      try {
        setCategories(await fetchManagedCategories());
      } catch {
        refreshCategories();
      }
    };

    refreshCategories();
    fetchCategories();
    window.addEventListener(CATEGORIES_UPDATED_EVENT, refreshCategories);
    return () =>
      window.removeEventListener(CATEGORIES_UPDATED_EVENT, refreshCategories);
  }, []);

  const categoryOptions = useMemo(() => {
    return categories[form.Tipo].map((category) => ({
      value: category,
      label: category,
    }));
  }, [categories, form.Tipo]);

  useEffect(() => {
    if (!open) return;

    if (editing) {
      const tipo = normalizeTipo(editing.Tipo);
      const category = (editing.Categoría ?? "").trim();

      setForm({
        Fecha: toISODate(editing.Fecha),
        Tipo: tipo,
        Categoría: categoryExists(categories, tipo, category) ? category : "",
        Importe: Number(editing.Importe) || 0,
        EstadoPago: editing.EstadoPago,
        DescripcionAdicional: editing.DescripcionAdicional ?? "",
      });
      return;
    }

    if (cloning) {
      const tipo = normalizeTipo(cloning.Tipo);
      const category = (cloning.Categoría ?? "").trim();

      setForm({
        Fecha: toISODate(cloning.Fecha),
        Tipo: tipo,
        Categoría: categoryExists(categories, tipo, category) ? category : "",
        Importe: Number(cloning.Importe) || 0,
        EstadoPago: cloning.EstadoPago,
        DescripcionAdicional: cloning.DescripcionAdicional ?? "",
      });
      return;
    }

    setForm({
      Fecha: new Date().toISOString().slice(0, 10),
      Tipo: "Gasto",
      Categoría: "",
      Importe: 0,
      EstadoPago: "Pendiente",
      DescripcionAdicional: "",
    });
  }, [open, editing, cloning, categories]);

  useEffect(() => {
    if (!form.Categoría) return;
    if (!categoryExists(categories, form.Tipo, form.Categoría)) {
      update("Categoría", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, form.Tipo]);

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
      await updateTransaction(editing.ID, payload);
    } else {
      await addTransaction(payload);
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
            <div className="glass relative w-full max-w-xl p-5">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-xl bg-white/5 p-2 ring-1 ring-white/10 hover:bg-white/10"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-base font-semibold">
                {isEdit
                  ? "Editar transaccion"
                  : isClone
                    ? "Clonar transaccion"
                    : "Nueva transaccion"}
              </h3>
              <p className="mb-4 text-sm text-white/60">
                Se guardara en Google Sheets.
              </p>

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
                  <CustomSelect
                    value={form.Tipo}
                    onChange={(value) => update("Tipo", normalizeTipo(value))}
                    placeholder="Selecciona tipo"
                    options={[
                      { value: "Ingreso", label: "Ingreso" },
                      { value: "Gasto", label: "Gasto" },
                    ]}
                  />
                </label>

                <label className="text-sm text-white/70 md:col-span-2">
                  Categoria
                  <CustomSelect
                    value={form.Categoría}
                    onChange={(value) => update("Categoría", value)}
                    placeholder="Selecciona categoria"
                    options={categoryOptions}
                  />
                </label>

                <label className="text-sm text-white/70">
                  Importe
                  <input
                    type="text"
                    value={formatAmountInput(form.Importe)}
                    onChange={(e) => update("Importe", parseAmountInput(e.target.value))}
                    className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
                  />
                </label>

                <label className="text-sm text-white/70">
                  Estado de pago
                  <CustomSelect
                    value={form.EstadoPago}
                    onChange={(value) =>
                      update("EstadoPago", value as "Pagado" | "Pendiente")
                    }
                    placeholder="Selecciona estado"
                    options={[
                      { value: "Pagado", label: "Pagado" },
                      { value: "Pendiente", label: "Pendiente" },
                    ]}
                  />
                </label>

                <label className="text-sm text-white/70 md:col-span-2">
                  Descripcion adicional
                  <textarea
                    value={form.DescripcionAdicional}
                    onChange={(e) =>
                      update("DescripcionAdicional", e.target.value)
                    }
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
                  disabled={loading || !form.Categoría}
                  onClick={submit}
                  className="rounded-xl bg-gradient-to-r from-cyan-500/80 to-fuchsia-500/80 px-4 py-2 text-sm font-medium ring-1 ring-white/15 hover:opacity-95 disabled:opacity-60"
                >
                  {isEdit ? "Actualizar" : isClone ? "Crear copia" : "Guardar"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
