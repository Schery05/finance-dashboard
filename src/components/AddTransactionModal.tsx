"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFinanceStore } from "@/store/financeStore";
import type { Transaction } from "@/lib/types";
import type { TransactionInput } from "@/lib/validators";
import { CustomSelect } from "@/components/ui/CustomSelect";

const GASTO_CATEGORIES = [
  "Ahorro Boda Jally",
  "Ahorro cooperativa (Personal)",
  "Ahorro Personal",
  "Ashley Universidad",
  "Combustible",
  "Compra Articulos Hogar",
  "Compra Colmado",
  "Compras Boda Jally",
  "Compras Colombia",
  "Compras GYM",
  "Compras internet",
  "Contribucion Congregacion",
  "Cuidado personal (Ej. Belleza)",
  "Dinero mami",
  "Dinero prestado",
  "Educación (Universidad/ Colegio)",
  "Electricidad",
  "Electricidad San Pedro",
  "Entretenimiento",
  "Gas San Pedro",
  "Gas Santo Domingo",
  "Gastos médicos",
  "Gimnasio/Deporte",
  "Imprevistos",
  "Internet San Pedro",
  "Internet Santo Domingo",
  "Mant. de vehículo",
  "Paquetes envío",
  "Parqueos",
  "Peajes",
  "Prime",
  "Retiro efectivo",
  "Servicio telecomunicación móvil",
  "Supermercado San Pedro",
  "Supermercado Sto",
  "Suscripciones",
  "Uber",
  "Uber Eats/Pedidos Ya",
  "Viaje colombia",
  "Viaje personal",
  "Vivienda (alquiler San Pedro)",
  "Vivienda (alquiler Santo Domingo)",
];
const INGRESO_CATEGORIES = [
  "Sueldo",
  "Horas / Trabajos extras",
  "Remesas",
  "Bonos",
  "Doble sueldo Navidad",
  "Alquileres",
  "Inversiones",
  "Aportes",
  "Comisiones",
  "Pago prestamos",
  "Regalo recibido",
];

// ✅ Sets para validar sin líos de TS
const GASTO_SET = new Set<string>(GASTO_CATEGORIES);
const INGRESO_SET = new Set<string>(INGRESO_CATEGORIES);

function categoryExists(tipo: "Ingreso" | "Gasto", categoria: string) {
  const c = (categoria ?? "").trim();
  return tipo === "Ingreso" ? INGRESO_SET.has(c) : GASTO_SET.has(c);
}

function normalizeTipo(tipo?: string): "Ingreso" | "Gasto" {
  const t = (tipo ?? "").trim().toLowerCase();
  return t === "ingreso" ? "Ingreso" : "Gasto";
}

function toISODate(value: string) {
  const s = String(value ?? "").trim();
  if (!s) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
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

  const [form, setForm] = useState<TransactionInput>({
    Fecha: new Date().toISOString().slice(0, 10),
    Tipo: "Gasto",
    Categoría: "",
    Importe: 0,
    EstadoPago: "Pendiente",
    DescripcionAdicional: "",
  });

  const update = (k: keyof TransactionInput, v: any) =>
    setForm((p) => ({ ...p, [k]: v }));

  const isEdit = !!editing;
  const isClone = !!cloning && !editing;

  // ✅ Opciones según tipo
  const categoryOptions = useMemo(() => {
    const list = form.Tipo === "Ingreso" ? INGRESO_CATEGORIES : GASTO_CATEGORIES;
    return list.map((c) => ({ value: c, label: c }));
  }, [form.Tipo]);

  /**
   * ✅ Prefill EDIT / CLONE / NEW
   */
  useEffect(() => {
    if (!open) return;

    if (editing) {
      const tipo = normalizeTipo(editing.Tipo);
      const cat = (editing.Categoría ?? "").trim();

      setForm({
        Fecha: toISODate(editing.Fecha),
        Tipo: tipo,
        Categoría: categoryExists(tipo, cat) ? cat : "",
        Importe: Number(editing.Importe) || 0,
        EstadoPago: editing.EstadoPago,
        DescripcionAdicional: editing.DescripcionAdicional ?? "",
      });
      return;
    }

    if (cloning) {
      const tipo = normalizeTipo(cloning.Tipo);
      const cat = (cloning.Categoría ?? "").trim();

      setForm({
        // ✅ si quieres la misma fecha del registro clonado:
        Fecha: toISODate(cloning.Fecha),
        // ✅ mismo tipo:
        Tipo: tipo,
        // ✅ misma categoría (si existe en el catálogo):
        Categoría: categoryExists(tipo, cat) ? cat : "",
        Importe: Number(cloning.Importe) || 0,
        EstadoPago: cloning.EstadoPago,
        DescripcionAdicional: cloning.DescripcionAdicional ?? "",
      });
      return;
    }

    // NEW
    setForm({
      Fecha: new Date().toISOString().slice(0, 10),
      Tipo: "Gasto",
      Categoría: "",
      Importe: 0,
      EstadoPago: "Pendiente",
      DescripcionAdicional: "",
    });
  }, [open, editing, cloning]);

  /**
   * ✅ IMPORTANTE:
   * Antes borrabas Categoría SIEMPRE al cambiar Tipo.
   * Ahora solo se borra si la categoría no pertenece al nuevo tipo.
   */
  useEffect(() => {
    if (!form.Categoría) return;
    if (!categoryExists(form.Tipo, form.Categoría)) {
      update("Categoría", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.Tipo]);

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
            <div className="glass w-full max-w-xl p-5 relative">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-xl bg-white/5 p-2 ring-1 ring-white/10 hover:bg-white/10"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-base font-semibold">
                {isEdit
                  ? "Editar transacción"
                  : isClone
                  ? "Clonar transacción"
                  : "Nueva transacción"}
              </h3>
              <p className="text-sm text-white/60 mb-4">
                Se guardará en Google Sheets.
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
                    onChange={(v) => update("Tipo", normalizeTipo(v))}
                    placeholder="Selecciona tipo"
                    options={[
                      { value: "Ingreso", label: "Ingreso" },
                      { value: "Gasto", label: "Gasto" },
                    ]}
                  />
                </label>

                <label className="text-sm text-white/70 md:col-span-2">
                  Categoría
                  <CustomSelect
                    value={form.Categoría}
                    onChange={(v) => update("Categoría", v)}
                    placeholder="Selecciona categoría"
                    options={categoryOptions}
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

                <label className="text-sm text-white/70">
                  Estado de pago
                  <CustomSelect
                    value={form.EstadoPago}
                    onChange={(v) => update("EstadoPago", v)}
                    placeholder="Selecciona estado"
                    options={[
                      { value: "Pagado", label: "Pagado" },
                      { value: "Pendiente", label: "Pendiente" },
                    ]}
                  />
                </label>

                <label className="text-sm text-white/70 md:col-span-2">
                  Descripción adicional
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
                  className="rounded-xl bg-gradient-to-r from-cyan-500/80 to-fuchsia-500/80 px-4 py-2 text-sm font-medium
                             ring-1 ring-white/15 hover:opacity-95 disabled:opacity-60"
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