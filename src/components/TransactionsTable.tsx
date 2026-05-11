"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Copy, Pencil, Trash2 } from "lucide-react";
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

function normalizeQueryText(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function compactQueryText(value: string) {
  return normalizeQueryText(value).replace(/[^a-z0-9]/g, "");
}

function parseAmountQuery(value: string) {
  const raw = String(value ?? "")
    .trim()
    .replace(/[^\d,.-]/g, "");

  if (!raw || !/\d/.test(raw)) return null;

  const sign = raw.includes("-") ? -1 : 1;
  const unsigned = raw.replace(/-/g, "");
  let normalized = unsigned;

  if (unsigned.includes(",") && unsigned.includes(".")) {
    normalized = unsigned.replace(/,/g, "");
  } else if (unsigned.includes(",")) {
    const parts = unsigned.split(",");
    const last = parts.at(-1) ?? "";
    normalized =
      last.length === 2
        ? `${parts.slice(0, -1).join("")}.${last}`
        : unsigned.replace(/,/g, "");
  } else if (unsigned.includes(".")) {
    const parts = unsigned.split(".");
    const last = parts.at(-1) ?? "";
    normalized =
      last.length === 2
        ? unsigned
        : unsigned.replace(/\./g, "");
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount * sign : null;
}

function matchesAmountQuery(query: string, amount: number) {
  const queryAmount = parseAmountQuery(query);
  if (queryAmount === null) return false;

  return Math.abs(amount - queryAmount) < 0.01;
}

function matchesTransactionQuery(query: string, text: string, amount: number) {
  const normalizedQuery = normalizeQueryText(query);
  if (!normalizedQuery) return true;

  const normalizedText = normalizeQueryText(text);
  return (
    normalizedText.includes(normalizedQuery) ||
    compactQueryText(normalizedText).includes(compactQueryText(normalizedQuery)) ||
    matchesAmountQuery(normalizedQuery, amount)
  );
}

function matchesMainQuery(query: string, description: string, amount: number) {
  const normalizedQuery = normalizeQueryText(query);
  if (!normalizedQuery) return true;

  const amountText = [
    String(amount),
    amount.toFixed(2),
    money(amount),
    money(amount).replace(/[^\d.,]/g, ""),
  ].join(" ");

  return (
    normalizeQueryText(description).includes(normalizedQuery) ||
    compactQueryText(description).includes(compactQueryText(normalizedQuery)) ||
    normalizeQueryText(amountText).includes(normalizedQuery) ||
    compactQueryText(amountText).includes(compactQueryText(normalizedQuery)) ||
    matchesAmountQuery(normalizedQuery, amount)
  );
}

export function TransactionsTable({
  txs,
  onEdit,
  onClone,
  onDelete,
}: {
  txs: Transaction[];
  onClone: (t: Transaction) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => Promise<void>;
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
  const [excludeSearch, setExcludeSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [excludeMonth, setExcludeMonth] = useState("Ninguno");
  const [excludeDate, setExcludeDate] = useState("");
  const [hideRecurringSuggestions, setHideRecurringSuggestions] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const months = Array.from(new Set(txs.map((t) => monthKey(t.Fecha))))
    .filter((m) => m && m !== "N/A")
    .sort((a, b) => b.localeCompare(a));
  const monthOptions = [
    { value: "Todos", label: "Todos los meses" },
    ...months.map((item) => ({ value: item, label: item })),
  ];
  const categories = Array.from(
    new Set(
      txs
        .map((t) => String(t.Categoría ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  const categoryOptions = [
    { value: "Todas", label: "Todas categorias" },
    ...categories.map((item) => ({ value: item, label: item })),
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
  const excludeMonthOptions = [
    { value: "Ninguno", label: "No excluir mes" },
    ...months.map((item) => ({ value: item, label: item })),
  ];

  const filtered = useMemo(() => txs.filter((t) => {
    const m = monthKey(t.Fecha);
    const s = search.trim();
    const exclude = excludeSearch.trim();

    const categoria = String(t.Categoría ?? "");
    const desc = String(t.DescripcionAdicional ?? "");
    const tipo = String(t.Tipo ?? "");
    const estado = String(t.EstadoPago ?? "").trim();
    const fecha = String(t.Fecha ?? "");
    const importe = Number(t.Importe) || 0;
    const importeTexto = [
      String(importe),
      money(importe).toLowerCase(),
      money(importe).replace(/[^\d.,]/g, ""),
      String(importe).replace(/[^\d.,]/g, ""),
    ].join(" ");
    const searchableText = [
      categoria,
      desc,
      tipo,
      estado,
      fecha,
      importeTexto,
      t.EsSugerenciaRecurrente ? "recurrente sugerido" : "",
    ].join(" ");

    const matchesSearch = matchesMainQuery(s, desc, importe);
    const matchesMonth = month === "Todos" ? true : m === month;
    const matchesCategory =
      categoryFilter === "Todas" ? true : categoria === categoryFilter;
    const matchesType = type === "Todos" ? true : t.Tipo === type;
    const matchesStatus = status === "Todos" ? true : estado.toLowerCase() === status.toLowerCase();
    const excludedBySearch =
      Boolean(exclude) && matchesTransactionQuery(exclude, searchableText, importe);
    const excludedByMonth = excludeMonth !== "Ninguno" && m === excludeMonth;
    const excludedByDate = Boolean(excludeDate) && t.Fecha === excludeDate;
    const excludedByRecurring = hideRecurringSuggestions && Boolean(t.EsSugerenciaRecurrente);

    return (
      matchesSearch &&
      matchesMonth &&
      matchesCategory &&
      matchesType &&
      matchesStatus &&
      !excludedBySearch &&
      !excludedByMonth &&
      !excludedByDate &&
      !excludedByRecurring
    );
  }), [
    txs,
    search,
    month,
    categoryFilter,
    type,
    status,
    excludeSearch,
    excludeMonth,
    excludeDate,
    hideRecurringSuggestions,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    month,
    categoryFilter,
    type,
    status,
    pageSize,
    txs.length,
    excludeSearch,
    excludeMonth,
    excludeDate,
    hideRecurringSuggestions,
  ]);

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

  const selectClass = "native-filter-select";
  const optionClass = "native-filter-option";

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    setDeleteError("");

    try {
      await onDelete(deleteTarget);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la transaccion."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="glass p-5"
    >
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="shrink-0">
          <h3 className="text-base font-semibold">Transacciones</h3>
          <p className="text-sm text-white/60">
            {filtered.length} registro(s) encontrados
          </p>
        </div>

        {/* Filtros */}
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.35fr)_minmax(140px,0.85fr)_minmax(170px,1fr)_minmax(120px,0.7fr)_minmax(140px,0.85fr)] xl:max-w-[980px] xl:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descripcion o importe"
            className={
              controlBase +
              " native-filter-input w-full min-w-0 placeholder-white/50 sm:col-span-2 lg:col-span-1"
            }
          />

          <CustomSelect
            value={month}
            onChange={setMonth}
            options={monthOptions}
            triggerClassName={selectClass}
          />
          <CustomSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions}
            triggerClassName={selectClass}
            contentClassName="max-h-72"
          />
          <CustomSelect
            value={type}
            onChange={(value) =>
              setType(value as "Todos" | "Ingreso" | "Gasto")
            }
            options={typeOptions}
            triggerClassName={selectClass}
          />
          <CustomSelect
            value={status}
            onChange={(value) =>
              setStatus(value as "Todos" | "Pagado" | "Pendiente")
            }
            options={statusOptions}
            triggerClassName={selectClass}
          />
        </div>
      </div>

      <div className="mb-4 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white/85">Excluir del resultado</p>
            <p className="text-xs text-white/50">
              Este campo no busca: oculta coincidencias por texto, monto, mes o fecha.
            </p>
          </div>

          {(excludeSearch || excludeMonth !== "Ninguno" || excludeDate || hideRecurringSuggestions) && (
            <button
              type="button"
              onClick={() => {
                setExcludeSearch("");
                setExcludeMonth("Ninguno");
                setExcludeDate("");
                setHideRecurringSuggestions(false);
              }}
              className="w-fit rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
            >
              Limpiar exclusiones
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1.4fr)_minmax(160px,0.8fr)_minmax(160px,0.8fr)_auto] lg:items-center">
          <input
            value={excludeSearch}
            onChange={(e) => setExcludeSearch(e.target.value)}
            placeholder="Excluir, no buscar (ej. recurrente sugerido)"
            className={
              controlBase +
              " native-filter-input w-full min-w-0 placeholder-white/50"
            }
          />

          <CustomSelect
            value={excludeMonth}
            onChange={setExcludeMonth}
            options={excludeMonthOptions}
            triggerClassName={selectClass}
          />

          <input
            type="date"
            value={excludeDate}
            onChange={(e) => setExcludeDate(e.target.value)}
            className={
              controlBase +
              " native-filter-input w-full min-w-0 placeholder-white/50"
            }
          />

          <label className="flex min-h-[42px] items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-white/75 ring-1 ring-white/10 transition hover:bg-white/10">
            <input
              type="checkbox"
              checked={hideRecurringSuggestions}
              onChange={(e) => setHideRecurringSuggestions(e.target.checked)}
              className="h-4 w-4 accent-cyan-400"
            />
            Ocultar recurrentes
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl ring-1 ring-white/10">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[9%]" />
            <col className="w-[7%]" />
            <col className="w-[17%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
            <col />
            <col className="w-[236px]" />
          </colgroup>
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-3 py-3 text-left font-medium">Fecha</th>
              <th className="px-3 py-3 text-left font-medium">Tipo</th>
              <th className="px-3 py-3 text-left font-medium">Categoría</th>
              <th className="px-3 py-3 text-right font-medium">Importe</th>
              <th className="px-3 py-3 text-left font-medium">Estado</th>
              <th className="px-3 py-3 text-left font-medium">Descripción</th>
              <th className="px-3 py-3 text-right font-medium">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            {paginated.map((t) => {
              const isIngreso = String(t.Tipo ?? "").trim().toLowerCase() === "ingreso";

              return (
                <tr key={t.ID} className="border-t border-white/10 hover:bg-white/[0.03]">
                  <td className="px-3 py-3 whitespace-nowrap text-white/80">{t.Fecha}</td>

                  <td className="px-3 py-3">
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

                  <td className="px-3 py-3 text-white/80">
                    <span className="block truncate">{t.Categoría}</span>
                  </td>

                  <td className="px-3 py-3 text-right font-medium">{money(Number(t.Importe) || 0)}</td>

                  <td className="px-3 py-3">
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

                  <td className="px-3 py-3 text-white/70">
                    <div className="flex min-w-0 flex-col gap-1">
                      {t.EsSugerenciaRecurrente && (
                        <span className="recurring-suggestion-badge w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1">
                          <span className="recurring-suggestion-dot" />
                          Recurrente sugerido
                        </span>
                      )}
                      <span className="truncate">
                        {t.DescripcionAdicional || "Sin descripcion"}
                      </span>
                    </div>
                  </td>

                  <td className="px-3 py-3 text-right">
                    <div className="flex flex-nowrap justify-end gap-1.5">
                      <button
                        onClick={() => onEdit(t)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-2.5 py-2 text-[11px] font-medium ring-1 ring-white/10 transition hover:bg-white/10"
                      >
                        <Pencil className="h-3.5 w-3.5 text-orange-300" />
                        Editar
                      </button>

                      <button
                        onClick={() => {
                          onClone(t);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-2.5 py-2 text-[11px] font-medium ring-1 ring-white/10 transition hover:bg-white/10"
                      >
                        <Copy className="h-3.5 w-3.5 text-violet-300" />
                        Clonar
                      </button>

                      <button
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget(t);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 px-2.5 py-2 text-[11px] font-medium text-rose-100 ring-1 ring-rose-300/20 transition hover:bg-rose-500/15"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-300" />
                        Eliminar
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
            <div className="min-w-[84px]">
              <CustomSelect
                value={String(pageSize)}
                onChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
                options={pageSizeOptions}
                triggerClassName="min-w-[84px]"
                contentClassName="min-w-[84px]"
              />
            </div>
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

      {deleteTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl shadow-black/40">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-2xl bg-rose-500/10 p-3 text-rose-200 ring-1 ring-rose-300/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Eliminar transaccion</h3>
                <p className="mt-1 text-sm leading-6 text-white/60">
                  Estas seguro de que deseas eliminar esta transaccion? Esta accion no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white/[0.04] p-3 text-sm ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/55">Fecha</span>
                <span className="font-medium">{deleteTarget.Fecha}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-white/55">Categoria</span>
                <span className="max-w-[240px] truncate font-medium">
                  {deleteTarget.Categoría}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-white/55">Importe</span>
                <span className="font-semibold">{money(Number(deleteTarget.Importe) || 0)}</span>
              </div>
            </div>

            {deleteError && (
              <div className="mt-4 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-100 ring-1 ring-rose-300/20">
                {deleteError}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (deleting) return;
                  setDeleteTarget(null);
                  setDeleteError("");
                }}
                className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white/75 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Eliminando..." : "Si, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
