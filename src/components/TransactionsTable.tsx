"use client";

import { motion } from "framer-motion";
import type { Transaction } from "@/lib/types";
import { useFinanceStore } from "@/store/financeStore";

function monthKey(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "N/A";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function money(n: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(n);
}

export function TransactionsTable({ 
  txs, 
  onEdit,
 }: { 
  txs: Transaction[];
   onEdit: (t: Transaction) => void;
 }) {
  const { search, month, type, setSearch, setMonth, setType } = useFinanceStore();

  const months = Array.from(new Set(txs.map((t) => monthKey(t.Fecha))))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  const filtered = txs.filter((t) => {
    const m = monthKey(t.Fecha);
    const s = search.trim().toLowerCase();
    const matchesSearch =
      !s ||
      t.Categoría.toLowerCase().includes(s) ||
      (t.DescripcionAdicional ?? "").toLowerCase().includes(s) ||
      t.Tipo.toLowerCase().includes(s);

    const matchesMonth = month === "Todos" ? true : m === month;
    const matchesType = type === "Todos" ? true : t.Tipo === type;

    return matchesSearch && matchesMonth && matchesType;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="glass p-5"
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold">Transacciones</h3>
          <p className="text-sm text-white/60">
            {filtered.length} registro(s) mostrados
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar (categoría, tipo, descripción)..."
            className="w-full md:w-[320px] rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/20"
          />
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
          >
            <option value="Todos">Todos los meses</option>
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
          >
            <option value="Todos">Todos</option>
            <option value="Ingreso">Ingreso</option>
            <option value="Gasto">Gasto</option>
          </select>
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
            {filtered.map((t, i) => (
              <tr key={i} className="border-t border-white/10 hover:bg-white/[0.03]">
                <td className="px-4 py-3 whitespace-nowrap text-white/80">{t.Fecha}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs ring-1 ${
                    t.Tipo === "Ingreso" ? "..." : "..."}>
                      ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                      : "bg-rose-500/10 text-rose-300 ring-rose-500/20"
                  }`}>
                    {t.Tipo}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/80">{t.Categoría}</td>
                <td className="px-4 py-3 text-right font-medium">{money(Number(t.Importe) || 0)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs ring-1 ${
                    t.EstadoPago === "Pagado"
                      ? "bg-cyan-500/10 text-cyan-300 ring-cyan-500/20"
                      : "bg-orange-500/10 text-orange-300 ring-orange-500/20"
                  }`}>
                    {t.EstadoPago}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/70 max-w-[420px] truncate">
                  {t.DescripcionAdicional}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                  onClick={() => onEdit(t)}
                  className="rounded-xl bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10 hover:bg-white/10">
                  ✏️ Editar
                 </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/50">
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