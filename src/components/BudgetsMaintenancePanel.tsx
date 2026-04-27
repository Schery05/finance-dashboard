"use client";

import {
  ChevronDown,
  ChevronUp,
  Edit3,
  Plus,
  Search,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
  CATEGORIES_UPDATED_EVENT,
  loadManagedCategories,
  type ManagedCategories,
} from "@/lib/categories";
import {
  currentPeriod,
  type Budget,
} from "@/lib/budgets";
import type { Transaction } from "@/lib/types";
import { useFinanceStore } from "@/store/financeStore";

const money = (n: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

const amountInputFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const parseAmountInput = (value: string) => {
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : 0;
};

const formatAmountInput = (value: string) => {
  const normalized = value.replace(/,/g, "");
  if (!normalized) return "";

  const [integer = "", decimals] = normalized.split(".");
  const formattedInteger = amountInputFormatter.format(Number(integer) || 0);
  return decimals !== undefined
    ? `${formattedInteger}.${decimals.slice(0, 2)}`
    : formattedInteger;
};

function parseDateSafe(dateStr: string): Date | null {
  const s = String(dateStr ?? "").trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function monthKey(dateStr: string) {
  const date = parseDateSafe(dateStr);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeKey(value: string) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function isExpense(tx: Transaction) {
  return normalizeKey(tx.Tipo) === "gasto";
}

function progressTone(percent: number) {
  if (percent <= 70) return "bg-emerald-300";
  if (percent <= 90) return "bg-amber-300";
  return "bg-rose-400";
}

function progressTextTone(percent: number) {
  if (percent <= 70) return "text-emerald-200";
  if (percent <= 90) return "text-amber-200";
  return "text-rose-200";
}

export function BudgetsMaintenancePanel() {
  const transactions = useFinanceStore((state) => state.transactions);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<ManagedCategories>(() =>
    loadManagedCategories()
  );
  const [category, setCategory] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [budgetPeriod, setBudgetPeriod] = useState(currentPeriod());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState(currentPeriod());
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const period = currentPeriod();

  const fetchBudgets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/budgets", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "No se pudo cargar presupuesto");
      setBudgets(json.data as Budget[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando presupuesto");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  useEffect(() => {
    const refresh = () => setCategories(loadManagedCategories());
    refresh();
    window.addEventListener(CATEGORIES_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CATEGORIES_UPDATED_EVENT, refresh);
  }, []);

  const categoryOptions = useMemo(() => {
    return categories.Gasto.map((item) => ({ value: item, label: item }));
  }, [categories.Gasto]);

  const availablePeriods = useMemo(() => {
    return Array.from(new Set([period, ...budgets.map((budget) => budget.period)]))
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a));
  }, [budgets, period]);

  const currentBudgets = useMemo(() => {
    return budgets
      .filter((budget) => budget.period === period)
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [budgets, period]);

  const historicalBudgets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return budgets
      .filter((budget) => budget.period === periodFilter)
      .filter((budget) => {
        if (!query) return true;
        return (
          budget.category.toLowerCase().includes(query) ||
          budget.period.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [budgets, periodFilter, search]);

  const currentSpentByCategory = useMemo(() => {
    const totals = new Map<string, number>();

    for (const tx of transactions) {
      if (!isExpense(tx)) continue;
      if (monthKey(tx.Fecha) !== period) continue;

      const categoryKey = normalizeKey(tx.Categoría);
      totals.set(categoryKey, (totals.get(categoryKey) ?? 0) + (Number(tx.Importe) || 0));
    }

    return totals;
  }, [transactions, period]);

  const historicalSpentByCategory = useMemo(() => {
    const totals = new Map<string, number>();

    for (const tx of transactions) {
      if (!isExpense(tx)) continue;
      if (monthKey(tx.Fecha) !== periodFilter) continue;

      const categoryKey = normalizeKey(tx.Categoría);
      totals.set(categoryKey, (totals.get(categoryKey) ?? 0) + (Number(tx.Importe) || 0));
    }

    return totals;
  }, [transactions, periodFilter]);

  const resetForm = () => {
    setCategory("");
    setMonthlyLimit("");
    setBudgetPeriod(period);
    setEditingId(null);
    setError(null);
  };

  const saveBudget = async () => {
    const amount = parseAmountInput(monthlyLimit);
    const selectedCategory = category.trim();

    if (!selectedCategory) {
      setError("La categoria es obligatoria.");
      return;
    }

    if (amount <= 0) {
      setError("El monto limite mensual debe ser mayor que cero.");
      return;
    }

    const duplicate = budgets.some(
      (budget) =>
        budget.period === budgetPeriod &&
        budget.category === selectedCategory &&
        budget.id !== editingId
    );
    if (duplicate) {
      setError("Ya existe un presupuesto activo para esta categoria en este mes.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const existing = budgets.find((budget) => budget.id === editingId);
        const res = await fetch("/api/budgets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            budget: {
              category: selectedCategory,
              monthlyLimit: amount,
              period: budgetPeriod,
              createdAt: existing?.createdAt ?? new Date().toISOString(),
            },
          }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "No se pudo actualizar presupuesto");
      } else {
        const res = await fetch("/api/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: selectedCategory,
            monthlyLimit: amount,
            period: budgetPeriod,
            createdAt: new Date().toISOString(),
          }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "No se pudo crear presupuesto");
      }

      await fetchBudgets();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando presupuesto");
    } finally {
      setSaving(false);
    }
  };

  const editBudget = (budget: Budget) => {
    setEditingId(budget.id);
    setCategory(budget.category);
    setMonthlyLimit(formatAmountInput(String(budget.monthlyLimit)));
    setBudgetPeriod(budget.period);
    setError(null);
  };

  const renderBudgetCard = (
    budget: Budget,
    spentLookup: Map<string, number>
  ) => {
    const spent = spentLookup.get(normalizeKey(budget.category)) ?? 0;
    const remaining = Math.max(budget.monthlyLimit - spent, 0);
    const percent =
      budget.monthlyLimit > 0
        ? Math.min((spent / budget.monthlyLimit) * 100, 100)
        : 0;

    return (
      <div key={budget.id} className="glass p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words text-base font-semibold">
              {budget.category}
            </h3>
            <p className={`mt-1 text-sm font-medium ${progressTextTone(percent)}`}>
              {percent.toFixed(0)}% consumido
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => editBudget(budget)}
              className="rounded-xl bg-white/5 p-2 text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
              aria-label={`Editar ${budget.category}`}
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDeleteTarget(budget)}
              className="rounded-xl bg-rose-500/10 p-2 text-rose-200 ring-1 ring-rose-300/20 transition hover:bg-rose-500/15"
              aria-label={`Eliminar ${budget.category}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 h-2.5 rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${progressTone(percent)}`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-white/45">Gastado</p>
            <p className="mt-1 font-semibold text-white">{money(spent)}</p>
          </div>
          <div>
            <p className="text-white/45">Limite</p>
            <p className="mt-1 font-semibold text-white">
              {money(budget.monthlyLimit)}
            </p>
          </div>
          <div>
            <p className="text-white/45">Restante</p>
            <p className="mt-1 font-semibold text-white">{money(remaining)}</p>
          </div>
          <div>
            <p className="text-white/45">Periodo</p>
            <p className="mt-1 font-semibold text-white">{budget.period}</p>
          </div>
        </div>
      </div>
    );
  };

  const deleteBudget = async (budget: Budget) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/budgets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: budget.id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "No se pudo eliminar presupuesto");

      setBudgets((prev) => prev.filter((item) => item.id !== budget.id));
      if (editingId === budget.id) resetForm();
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando presupuesto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="glass p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Presupuesto</h2>
            <p className="mt-1 text-sm text-white/60">
              Define limites mensuales por categoria para {period}.
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300 ring-1 ring-emerald-300/20">
            <WalletCards className="h-5 w-5" />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-rose-300/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_220px_auto] lg:items-end">
          <label className="text-sm text-white/70">
            Categoria
            <CustomSelect
              value={category}
              onChange={setCategory}
              placeholder="Selecciona categoria"
              options={categoryOptions}
            />
          </label>

          <label className="text-sm text-white/70">
            Periodo
            <input
              type="month"
              value={budgetPeriod}
              onChange={(event) => setBudgetPeriod(event.target.value)}
              className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-emerald-300/60"
            />
          </label>

          <label className="text-sm text-white/70">
            Monto limite mensual
            <input
              value={monthlyLimit}
              onChange={(event) =>
                setMonthlyLimit(formatAmountInput(event.target.value))
              }
              placeholder="0.00"
              inputMode="decimal"
              className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-emerald-300/60"
            />
          </label>

          <div className="flex gap-2">
            {editingId && (
              <button
                onClick={resetForm}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
            )}
            <button
              onClick={saveBudget}
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
            >
              {editingId ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <div className="mb-1 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Periodo actual</h3>
              <p className="mt-1 text-sm text-white/55">{period}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="glass p-6 text-center text-sm text-white/55 xl:col-span-2">
            Cargando presupuesto...
          </div>
        ) : currentBudgets.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-white/55 xl:col-span-2">
            Aun no hay presupuesto para el periodo actual.
          </div>
        ) : (
          currentBudgets.map((budget) =>
            renderBudgetCard(budget, currentSpentByCategory)
          )
        )}
      </div>

      <div className="glass p-5">
        <button
          onClick={() => setHistoryOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div>
            <h3 className="text-base font-semibold">Consultar otro periodo</h3>
            <p className="mt-1 text-sm text-white/55">
              Revisa presupuesto de meses anteriores o periodos distintos.
            </p>
          </div>
          <span className="rounded-xl bg-white/5 p-2 text-white/70 ring-1 ring-white/10">
            {historyOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </button>

        {historyOpen && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr] md:items-end">
              <label className="text-sm text-white/70">
                Periodo
                <select
                  value={periodFilter}
                  onChange={(event) => setPeriodFilter(event.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-emerald-300/60"
                >
                  {availablePeriods.map((item) => (
                    <option
                      key={item}
                      value={item}
                      className="bg-[#0B1020] text-white"
                    >
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-white/70">
                Buscar
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por categoria"
                    className="w-full rounded-xl bg-white/10 py-2 pl-9 pr-3 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-emerald-300/60"
                  />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {historicalBudgets.length === 0 ? (
                <div className="rounded-2xl bg-white/5 p-6 text-center text-sm text-white/55 ring-1 ring-white/10 xl:col-span-2">
                  No hay presupuesto para la consulta seleccionada.
                </div>
              ) : (
                historicalBudgets.map((budget) =>
                  renderBudgetCard(budget, historicalSpentByCategory)
                )
              )}
            </div>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl shadow-black/50">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-rose-500/10 p-3 text-rose-200 ring-1 ring-rose-300/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold">Eliminar presupuesto</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Estas seguro de que deseas eliminar el presupuesto de{" "}
                  <span className="font-semibold text-white">
                    {deleteTarget.category}
                  </span>
                  ?
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={saving}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15"
              >
                No
              </button>
              <button
                onClick={() => deleteBudget(deleteTarget)}
                disabled={saving}
                className="rounded-xl bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Eliminando..." : "Si"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
