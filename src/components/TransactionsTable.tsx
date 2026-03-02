"use client";

import { motion } from "framer-motion";
import type { Transaction } from "@/lib/types";
import { useFinanceStore } from "@/store/financeStore";

function parseDateSafe(dateStr: string): Date | null {
  const s = (dateStr ?? "").trim();
  if (!s) return null;

  // YYYY-MM-DD o YYYY/MM/DD
  const iso = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // DD/MM/YYYY o DD-MM-YYYY
  const dmy = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function monthKey(dateStr: string) {
  const d = parseDateSafe(dateStr);
  if (!d) return "N/A";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function money(n: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function TransactionsTable({
  txs,
  onEdit,
  onClone,
}: {
  txs: Transaction[];
  onClone: (t: Transaction) => void;
  onEdit: (t: Transaction) => void;
}) {
  const { search, month, type, setSearch, setMonth, setType } = useFinanceStore();

  const months = Array.from(new Set(txs.map((t) => monthKey(t.Fecha))))
    .filter((m) => m && m !== "N/A")
    .sort((a, b) => b.localeCompare(a));

  const filtered = txs.filter((t) => {
    const m = monthKey(t.Fecha);
    const s = search.trim().toLowerCase();

    const categoria = String(t.Categoría ?? "").toLowerCase();
    const desc = String(t.DescripcionAdicional ?? "").toLowerCase();
    const tipo = String(t.Tipo ?? "").toLowerCase();

    const matchesSearch = !s || categoria.includes(s) || desc.includes(s) || tipo.includes(s);
    const matchesMonth = month === "Todos" ? true : m === month;
    const matchesType = type === "Todos" ? true : t.Tipo === type;

    return matchesSearch && matchesMonth && matchesType;
  });

  const controlBase =
    "rounded-xl px-3 py-2 text-sm outline-none backdrop-blur-xl transition " +
    "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15 focus:ring-2 focus:ring-cyan-400/60";

  const selectWrap = "relative w-full md:w-auto";
  const selectClass = controlBase + " pr-9 appearance-none";
  const optionClass = "bg-[#0B1020] text-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="glass p-5"
    >
      {/* ✅ HEADER (este es el bloque exacto que controla la distancia/posicionamiento) */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold">Transacciones</h3>
          <p className="text-sm text-white/60">{filtered.length} registro(s) mostrados</p>
        </div>

        {/* ✅ FILTROS (alineados y compactos) */}
        <div className="grid w-full grid-cols-1 gap-3 md:w-auto md:grid-cols-[320px_170px_140px] md:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar (categoría, tipo, descripción)..."
            className={controlBase + " placeholder-white/50 w-full"}
          />

          <div className={selectWrap}>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectClass}>
              <option className={optionClass} value="Todos">
                Todos los meses
              </option>
              {months.map((m) => (
                <option className={optionClass} key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/70">
              ▾
            </span>
          </div>

          <div className={selectWrap}>
            <select value={type} onChange={(e) => setType(e.target.value as any)} className={selectClass}>
              <option className={optionClass} value="Todos">
                Todos
              </option>
              <option className={optionClass} value="Ingreso">
                Ingreso
              </option>
              <option className={optionClass} value="Gasto">
                Gasto
              </option>
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/70">
              ▾
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl ring-1 ring-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-left font-medium">Tipo</th>
              <th className="px-4 py-3 text-left font-medium">Categoría</th>
              <th className="px-4 py-3 text-right font-medium">Importe</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-left font-medium">Descripción</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((t, i) => {
              const isIngreso = String(t.Tipo ?? "").trim().toLowerCase() === "ingreso";

              return (
                <tr key={i} className="border-t border-white/10 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 whitespace-nowrap text-white/80">{t.Fecha}</td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ring-1 transition-all duration-200 ${
                        isIngreso
                          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
                          : "bg-rose-500/15 text-rose-300 ring-rose-400/30"
                      }`}
                    >
                      {t.Tipo}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-white/80">{t.Categoría}</td>

                  <td className="px-4 py-3 text-right font-medium">{money(Number(t.Importe) || 0)}</td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ring-1 ${
                        t.EstadoPago === "Pagado"
                          ? "bg-cyan-500/10 text-cyan-300 ring-cyan-500/20"
                          : "bg-orange-500/10 text-orange-300 ring-orange-500/20"
                      }`}
                    >
                      {t.EstadoPago}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-white/70 max-w-[420px] truncate">{t.DescripcionAdicional}</td>

                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(t)}
                        className="rounded-xl bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10 hover:bg-white/10"
                      >
                        ✏️ Editar
                      </button>

                      <button
                        onClick={() => {
                          console.log("CLONE CLICK", t);
                          onClone(t);
                        }}
                        className="rounded-xl bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10 hover:bg-white/10"
                      >
                        📄 Clonar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-white/50">
                  No hay resultados con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}