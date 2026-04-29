"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileUp, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
  fetchManagedCategories,
  loadManagedCategories,
  type ManagedCategories,
} from "@/lib/categories";
import type { Transaction } from "@/lib/types";
import { useFinanceStore } from "@/store/financeStore";

type BankImportPreviewRow = Transaction & {
  sourceRawDescription: string;
  sourceReference?: string;
  sourceImportKey?: string;
};

type ImportSummary = {
  created: number;
  skipped: number;
  total: number;
};

const money = (value: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

function getPreviewRowKey(row: BankImportPreviewRow) {
  if (row.sourceImportKey) return row.sourceImportKey;

  return [
    row.Fecha,
    row.Tipo,
    Number(row.Importe) || 0,
    row.sourceRawDescription || row.DescripcionAdicional || "",
    row.sourceReference || "",
  ].join("|");
}

async function sendImportFile(
  file: File,
  mode: "preview" | "import",
  overrides: { pattern: string; category: string }[] = [],
  excludedRows: string[] = [],
  rowEdits: { key: string; type?: "Ingreso" | "Gasto"; category?: string }[] = []
) {
  const body = new FormData();
  body.append("file", file);
  body.append("mode", mode);
  body.append("overrides", JSON.stringify(overrides));
  body.append("excludedRows", JSON.stringify(excludedRows));
  body.append("rowEdits", JSON.stringify(rowEdits));

  const res = await fetch("/api/transactions/import-bank", {
    method: "POST",
    body,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "No se pudo procesar el archivo");
  return json.data;
}

export function BankImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const fetchTransactions = useFinanceStore((state) => state.fetchTransactions);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<BankImportPreviewRow[]>([]);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});
  const [excludedRows, setExcludedRows] = useState<string[]>([]);
  const [rowEdits, setRowEdits] = useState<
    Record<string, { type?: "Ingreso" | "Gasto"; category?: string }>
  >({});
  const [categories, setCategories] = useState<ManagedCategories>(() =>
    loadManagedCategories()
  );
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    return previewRows.reduce(
      (acc, tx) => {
        if (tx.Tipo === "Ingreso") acc.income += Number(tx.Importe) || 0;
        else acc.expenses += Number(tx.Importe) || 0;
        return acc;
      },
      { income: 0, expenses: 0 }
    );
  }, [previewRows]);

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    fetchManagedCategories()
      .then((data) => {
        if (mounted) setCategories(data);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, [open]);

  const getCategoryOptions = (row: BankImportPreviewRow) => {
    const typeCategories = categories[row.Tipo] ?? [];
    const options = typeCategories.includes(row.Categoría)
      ? typeCategories
      : [row.Categoría, ...typeCategories];

    return options.map((category) => ({
      value: category,
      label: category,
    }));
  };

  const typeOptions = [
    { value: "Gasto", label: "Gasto" },
    { value: "Ingreso", label: "Ingreso" },
  ];

  const rememberRowEdit = (
    row: BankImportPreviewRow,
    edit: { type?: "Ingreso" | "Gasto"; category?: string }
  ) => {
    const key = getPreviewRowKey(row);

    setRowEdits((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...edit,
      },
    }));
  };

  const changePreviewType = (
    row: BankImportPreviewRow,
    rowIndex: number,
    type: "Ingreso" | "Gasto"
  ) => {
    const typeCategories = categories[type] ?? [];
    const category = typeCategories.includes(row.Categoría)
      ? row.Categoría
      : typeCategories[0] ?? (type === "Ingreso" ? "Reembolsos" : "Pendiente de categorizar");

    setPreviewRows((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === rowIndex ? { ...item, Tipo: type, Categoría: category } : item
      )
    );
    rememberRowEdit(row, { type, category });
  };

  const changePreviewCategory = (
    row: BankImportPreviewRow,
    rowIndex: number,
    category: string
  ) => {
    const pattern = row.sourceRawDescription || `${row.Fecha}-${row.Importe}-${rowIndex}`;

    setPreviewRows((prev) =>
      prev.map((item, itemIndex) =>
        item.sourceRawDescription === row.sourceRawDescription || itemIndex === rowIndex
          ? { ...item, Categoría: category }
          : item
      )
    );
    setCategoryOverrides((prev) => ({
      ...prev,
      [pattern]: category,
    }));
    rememberRowEdit(row, { category });
  };

  const removePreviewRow = (row: BankImportPreviewRow, rowIndex: number) => {
    const key = getPreviewRowKey(row);

    setPreviewRows((prev) => prev.filter((_, itemIndex) => itemIndex !== rowIndex));
    setExcludedRows((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const resetAndClose = () => {
    setFile(null);
    setPreviewRows([]);
    setCategoryOverrides({});
    setExcludedRows([]);
    setRowEdits({});
    setSummary(null);
    setError(null);
    onClose();
  };

  const preview = async () => {
    if (!file) {
      setError("Selecciona un archivo CSV o PDF.");
      return;
    }

    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const data = await sendImportFile(file, "preview");
      setPreviewRows(
        (data.rows as BankImportPreviewRow[]).map((row) => ({
          ...row,
          sourceImportKey: getPreviewRowKey(row),
        }))
      );
      setExcludedRows([]);
      setRowEdits({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error procesando archivo");
    } finally {
      setLoading(false);
    }
  };

  const importRows = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const data = (await sendImportFile(
        file,
        "import",
        Object.entries(categoryOverrides).map(([pattern, category]) => ({
          pattern,
          category,
        })),
        excludedRows,
        Object.entries(rowEdits).map(([key, edit]) => ({
          key,
          ...edit,
        }))
      )) as ImportSummary;
      setSummary(data);
      await fetchTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error importando archivo");
    } finally {
      setLoading(false);
    }
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
            onClick={resetAndClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="glass relative w-full max-w-6xl p-5">
              <button
                onClick={resetAndClose}
                className="absolute right-4 top-4 rounded-xl bg-white/5 p-2 ring-1 ring-white/10 hover:bg-white/10"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-5 flex items-start gap-3">
                <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-200 ring-1 ring-cyan-300/20">
                  <FileUp className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">
                    Importar transacciones bancarias
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-white/60">
                    Sube un CSV o PDF del banco, revisa la vista previa y luego confirma la carga masiva.
                    Los PDF escaneados se leen con OCR de IA cuando este configurado.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                <label className="text-sm text-white/70">
                  Archivo CSV o PDF
                  <input
                    type="file"
                    accept=".csv,.pdf,text/csv,application/pdf"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setPreviewRows([]);
                      setCategoryOverrides({});
                      setExcludedRows([]);
                      setRowEdits({});
                      setSummary(null);
                      setError(null);
                    }}
                    className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-950"
                  />
                </label>
                <button
                  onClick={preview}
                  disabled={loading || !file}
                  className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15 disabled:opacity-50"
                >
                  Vista previa
                </button>
                <button
                  onClick={importRows}
                  disabled={loading || previewRows.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  Importar
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-rose-300/20">
                  {error}
                </div>
              )}

              {summary && (
                <div className="mt-4 rounded-2xl bg-emerald-400/10 p-3 text-sm text-emerald-100 ring-1 ring-emerald-300/20">
                  Importación completada: {summary.created} creadas, {summary.skipped} duplicadas omitidas, {summary.total} detectadas.
                </div>
              )}

              {previewRows.length > 0 && (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                      <p className="text-sm text-white/55">Detectadas</p>
                      <p className="mt-1 text-xl font-semibold">{previewRows.length}</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                      <p className="text-sm text-white/55">Gastos</p>
                      <p className="mt-1 text-xl font-semibold text-rose-200">
                        {money(totals.expenses)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                      <p className="text-sm text-white/55">Ingresos / créditos</p>
                      <p className="mt-1 text-xl font-semibold text-emerald-200">
                        {money(totals.income)}
                      </p>
                    </div>
                  </div>

                  <div className="max-h-[520px] overflow-auto rounded-2xl ring-1 ring-white/10">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-slate-950 text-white/65">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Fecha</th>
                          <th className="px-4 py-3 text-left font-medium">Tipo</th>
                          <th className="px-4 py-3 text-left font-medium">Categoría</th>
                          <th className="px-4 py-3 text-right font-medium">Importe</th>
                          <th className="px-4 py-3 text-left font-medium">Descripción</th>
                          <th className="px-4 py-3 text-right font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 80).map((row, index) => (
                          <tr key={`${row.Fecha}-${row.Importe}-${index}`} className="border-t border-white/10">
                            <td className="px-4 py-3 text-white/80">{row.Fecha}</td>
                            <td className="min-w-36 px-4 py-3">
                              <CustomSelect
                                value={row.Tipo}
                                onChange={(type) =>
                                  changePreviewType(
                                    row,
                                    index,
                                    type as "Ingreso" | "Gasto"
                                  )
                                }
                                options={typeOptions}
                                triggerClassName="min-h-9 rounded-lg py-1.5"
                                contentClassName="z-[70]"
                              />
                            </td>
                            <td className="min-w-56 px-4 py-3">
                              <CustomSelect
                                value={row.Categoría}
                                onChange={(category) =>
                                  changePreviewCategory(row, index, category)
                                }
                                options={getCategoryOptions(row)}
                                searchable
                                searchPlaceholder="Buscar categoria"
                                triggerClassName="min-h-9 rounded-lg py-1.5"
                                contentClassName="z-[70]"
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">{money(row.Importe)}</td>
                            <td className="max-w-[360px] truncate px-4 py-3 text-white/70">
                              {row.DescripcionAdicional}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => removePreviewRow(row, index)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 ring-1 ring-rose-300/20 transition hover:bg-rose-500/20"
                                title="Quitar de esta importacion"
                              >
                                <Trash2 className="h-4 w-4" />
                                Quitar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}



