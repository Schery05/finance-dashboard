"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import type { Transaction } from "@/lib/types";
import { useFinanceStore } from "@/store/financeStore";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

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
  const {
    search,
    month,
    type,
    status,
    setSearch,
    setMonth,
    setType,
    setStatus,
  } = useFinanceStore();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const months = Array.from(new Set(txs.map((t) => monthKey(t.Fecha))))
    .filter((m) => m && m !== "N/A")
    .sort((a, b) => b.localeCompare(a));
  const monthOptions = [
    { value: "Todos", label: "Todos los meses" },
    ...months.map((item) => ({ value: item, label: item })),
  ];
  const typeOptions = [
    { value: "Todos", label: "Todos" },
    { value: "Ingreso", label: "Ingreso" },
    { value: "Gasto", label: "Gasto" },
  ];
  const statusOptions = [
    { value: "Todos", label: "Todos estados" },
    { value: "Pagado", label: "PAGADO" },
    { value: "Pendiente", label: "PENDIENTE" },
  ];
  const pageSizeOptions = PAGE_SIZE_OPTIONS.map((option) => ({
    value: String(option),
    label: String(option),
  }));

  const filtered = useMemo(() => txs.filter((t) => {
    const m = monthKey(t.Fecha);
    const s = search.trim().toLowerCase();

    const categoria = String(t.Categoría ?? "").toLowerCase();
    const desc = String(t.DescripcionAdicional ?? "").toLowerCase();
    const tipo = String(t.Tipo ?? "").toLowerCase();
    const estado = String(t.EstadoPago ?? "").trim().toLowerCase();

    const matchesSearch = !s || categoria.includes(s) || desc.includes(s) || tipo.includes(s);
    const matchesMonth = month === "Todos" ? true : m === month;
    const matchesType = type === "Todos" ? true : t.Tipo === type;
    const matchesStatus = status === "Todos" ? true : estado === status.toLowerCase();

    return matchesSearch && matchesMonth && matchesType && matchesStatus;
  }), [txs, search, month, type, status]);

  useEffect(() => {
    setPage(1);
  }, [search, month, type, status, pageSize, txs.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filtered.length);
  const paginated = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const controlBase =
    "rounded-xl px-3 py-2 text-sm outline-none backdrop-blur-xl transition " +
    "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15 focus:ring-2 focus:ring-cyan-400/60";

  const selectWrap = "relative w-full min-w-0";
  const selectClass = controlBase + " w-full min-w-0 appearance-none pr-9";
  const optionClass = "bg-[#0B1020] text-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="glass p-5"
    >
      {/* ✅ HEADER (este es el bloque exacto que controla la distancia/posicionamiento) */}
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="shrink-0">
          <h3 className="text-base font-semibold">Transacciones</h3>
          <p className="text-sm text-white/60">
            {filtered.length} registro(s) encontrados
          </p>
        </div>

        {/* ✅ FILTROS (alineados y compactos) */}
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1.6fr)_minmax(150px,1fr)_minmax(120px,0.8fr)_minmax(150px,1fr)] xl:max-w-[900px] xl:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar (categoría, tipo, descripción)..."
            className={controlBase + " w-full min-w-0 placeholder-white/50 sm:col-span-2 lg:col-span-1"}
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
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as "Todos" | "Ingreso" | "Gasto")
              }
              className={selectClass}
            >
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

          <div className={selectWrap}>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "Todos" | "Pagado" | "Pendiente")
              }
              className={selectClass}
            >
              <option className={optionClass} value="Todos">
                Todos estados
              </option>
              <option className={optionClass} value="Pagado">
                PAGADO
              </option>
              <option className={optionClass} value="Pendiente">
                PENDIENTE
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
            {paginated.map((t) => {
              const isIngreso = String(t.Tipo ?? "").trim().toLowerCase() === "ingreso";

              return (
                <tr key={t.ID} className="border-t border-white/10 hover:bg-white/[0.03]">
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

                  <td className="px-4 py-3 text-white/70">
                    <div className="flex max-w-[420px] flex-col gap-1">
                      {t.EsSugerenciaRecurrente && (
                        <span className="w-fit rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-300/25">
                          Recurrente sugerido
                        </span>
                      )}
                      <span className="truncate">
                        {t.DescripcionAdicional || "Sin descripcion"}
                      </span>
                    </div>
                  </td>

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

      <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-white/60">
          Mostrando{" "}
          <span className="font-semibold text-white/85">
            {pageStart}-{pageEnd}
          </span>{" "}
          de{" "}
          <span className="font-semibold text-white/85">{filtered.length}</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <label className="flex items-center gap-2 text-sm text-white/60">
            Filas
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-cyan-400/60"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option} className={optionClass}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/75 ring-1 ring-white/10 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>

            <span className="min-w-[92px] text-center text-sm font-semibold text-white/85">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/75 ring-1 ring-white/10 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
