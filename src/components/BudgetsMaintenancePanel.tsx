"use client";

import {
  Edit3,
  History,
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
  fetchManagedCategories,
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

function previousPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return "";

  const date = new Date(year, month - 2, 1);
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
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState("Todas");
  const [currentSearch, setCurrentSearch] = useState("");
  const [currentCategoryFilter, setCurrentCategoryFilter] = useState("Todas");
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
    const fetchCategories = async () => {
      try {
        setCategories(await fetchManagedCategories());
      } catch {
        refresh();
      }
    };

    refresh();
    fetchCategories();
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
  const availablePeriodOptions = availablePeriods.map((item) => ({
    value: item,
    label: item,
  }));

  const currentBudgets = useMemo(() => {
    return budgets
      .filter((budget) => budget.period === period)
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [budgets, period]);

  const currentCategoryFilterOptions = useMemo(() => {
    return [
      { value: "Todas", label: "Todas las categorias" },
      ...currentBudgets.map((budget) => ({
        value: budget.category,
        label: budget.category,
      })),
    ];
  }, [currentBudgets]);

  const filteredCurrentBudgets = useMemo(() => {
    const query = currentSearch.trim().toLowerCase();
    const selectedCategory = normalizeKey(currentCategoryFilter);

    return currentBudgets.filter((budget) => {
      const matchesSearch =
        !query ||
        budget.category.toLowerCase().includes(query) ||
        budget.period.toLowerCase().includes(query);
      const matchesCategory =
        currentCategoryFilter === "Todas" ||
        normalizeKey(budget.category) === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [currentBudgets, currentSearch, currentCategoryFilter]);

  const historicalBudgets = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selectedCategory = normalizeKey(historyCategoryFilter);

    return budgets
      .filter((budget) => budget.period === periodFilter)
      .filter((budget) => {
        const matchesSearch =
          !query ||
          budget.category.toLowerCase().includes(query) ||
          budget.period.toLowerCase().includes(query);
        const matchesCategory =
          historyCategoryFilter === "Todas" ||
          normalizeKey(budget.category) === selectedCategory;

        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [budgets, periodFilter, search, historyCategoryFilter]);

  const historyCategoryOptions = useMemo(() => {
    const periodCategories = budgets
      .filter((budget) => budget.period === periodFilter)
      .map((budget) => budget.category)
      .sort((a, b) => a.localeCompare(b));

    return [
      { value: "Todas", label: "Todas las categorias" },
      ...periodCategories.map((item) => ({ value: item, label: item })),
    ];
  }, [budgets, periodFilter]);

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

  const previousSpentByCategory = useMemo(() => {
    const previous = previousPeriod(period);
    const totals = new Map<string, number>();

    for (const tx of transactions) {
      if (!isExpense(tx)) continue;
      if (monthKey(tx.Fecha) !== previous) continue;

      const categoryKey = normalizeKey(tx.Categoría);
      totals.set(categoryKey, (totals.get(categoryKey) ?? 0) + (Number(tx.Importe) || 0));
    }

    return totals;
  }, [transactions, period]);

  const budgetSummary = useMemo(() => {
    const previous = previousPeriod(period);
    const previousBudgets = budgets.filter((budget) => budget.period === previous);
    const totalLimit = currentBudgets.reduce(
      (sum, budget) => sum + (Number(budget.monthlyLimit) || 0),
      0
    );
    const previousLimit = previousBudgets.reduce(
      (sum, budget) => sum + (Number(budget.monthlyLimit) || 0),
      0
    );
    const budgetCategories = new Set(
      currentBudgets.map((budget) => normalizeKey(budget.category))
    );
    const totalSpent = currentBudgets.reduce(
      (sum, budget) =>
        sum + (currentSpentByCategory.get(normalizeKey(budget.category)) ?? 0),
      0
    );
    const previousSpent = previousBudgets.reduce(
      (sum, budget) =>
        sum + (previousSpentByCategory.get(normalizeKey(budget.category)) ?? 0),
      0
    );
    const atRiskCount = currentBudgets.filter((budget) => {
      const spent = currentSpentByCategory.get(normalizeKey(budget.category)) ?? 0;
      const percent =
        budget.monthlyLimit > 0 ? (spent / budget.monthlyLimit) * 100 : 0;
      return percent > 80;
    }).length;

    return {
      totalLimit,
      previousLimit,
      totalSpent,
      previousSpent,
      atRiskCount,
      activeCount: budgetCategories.size,
      usedPercent: totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0,
    };
  }, [
    budgets,
    currentBudgets,
    currentSpentByCategory,
    period,
    previousSpentByCategory,
  ]);

  const percentChange = (current: number, previous: number) => {
    if (previous <= 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const renderSummaryDelta = (current: number, previous: number) => {
    const delta = percentChange(current, previous);
    if (delta === null) return "Sin periodo anterior";

    const isPositive = delta >= 0;
    return (
      <span className={isPositive ? "text-emerald-300" : "text-rose-300"}>
        {isPositive ? "+" : ""}
        {delta.toFixed(1)}% vs mes anterior
      </span>
    );
  };

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
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Presupuesto</h2>
            <p className="mt-1 text-sm text-white/60">
              Define limites mensuales por categoria para {period}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
            >
              <History className="h-4 w-4" />
              Ver historico
            </button>
            <div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300 ring-1 ring-emerald-300/20">
              <WalletCards className="h-5 w-5" />
            </div>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-white/45">
            Limite mensual total
          </p>
          <p className="mt-3 text-2xl font-semibold">
            {money(budgetSummary.totalLimit)}
          </p>
          <p className="mt-2 text-sm text-white/55">
            En {budgetSummary.activeCount} categoria(s) activas
          </p>
          <p className="mt-1 text-xs font-semibold">
            {renderSummaryDelta(
              budgetSummary.totalLimit,
              budgetSummary.previousLimit
            )}
          </p>
        </div>

        <div className="glass p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-white/45">
            Total gastado
          </p>
          <p className="mt-3 text-2xl font-semibold">
            {money(budgetSummary.totalSpent)}
          </p>
          <p className="mt-2 text-sm text-white/55">
            {budgetSummary.usedPercent.toFixed(0)}% del limite total usado
          </p>
          <p className="mt-1 text-xs font-semibold">
            {renderSummaryDelta(
              budgetSummary.totalSpent,
              budgetSummary.previousSpent
            )}
          </p>
        </div>

        <div className="glass p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-white/45">
            Presupuesto en riesgo
          </p>
          <p className="mt-3 text-2xl font-semibold">
            {budgetSummary.atRiskCount} categoria(s)
          </p>
          <p className="mt-2 text-sm text-white/55">
            Sobre 80% de consumo del limite
          </p>
          <p className="mt-1 text-xs font-semibold text-amber-200">
            Revisa estas categorias
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Periodo actual</h3>
              <p className="mt-1 text-sm text-white/55">{period}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10 md:grid-cols-[1fr_260px] md:items-end">
            <label className="text-sm text-white/70">
              Buscar presupuesto
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                <input
                  value={currentSearch}
                  onChange={(event) => setCurrentSearch(event.target.value)}
                  placeholder="Buscar por categoria dentro del periodo"
                  className="w-full rounded-xl bg-white/10 py-2 pl-9 pr-3 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-emerald-300/60"
                />
              </div>
            </label>

            <label className="text-sm text-white/70">
              Filtrar categoria
              <div className="mt-1">
                <CustomSelect
                  value={currentCategoryFilter}
                  onChange={setCurrentCategoryFilter}
                  options={currentCategoryFilterOptions}
                  searchable
                  searchPlaceholder="Buscar categoria"
                />
              </div>
            </label>
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
        ) : filteredCurrentBudgets.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-white/55 xl:col-span-2">
            No hay presupuesto con la busqueda o categoria seleccionada.
          </div>
        ) : (
          filteredCurrentBudgets.map((budget) =>
            renderBudgetCard(budget, currentSpentByCategory)
          )
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

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div className="glass max-h-[88vh] w-full max-w-5xl overflow-hidden p-0">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
              <div>
                <h3 className="text-lg font-semibold">Historico de presupuesto</h3>
                <p className="mt-1 text-sm text-white/55">
                  Consulta presupuestos anteriores por periodo y categoria.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-xl bg-white/5 p-2 text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar historico"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(88vh-96px)] overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_240px_1fr] lg:items-end">
                <label className="text-sm text-white/70">
                  Periodo
                  <div className="mt-1">
                    <CustomSelect
                      value={periodFilter}
                      onChange={(value) => {
                        setPeriodFilter(value);
                        setHistoryCategoryFilter("Todas");
                      }}
                      options={availablePeriodOptions}
                    />
                  </div>
                </label>

                <label className="text-sm text-white/70">
                  Categoria
                  <div className="mt-1">
                    <CustomSelect
                      value={historyCategoryFilter}
                      onChange={setHistoryCategoryFilter}
                      options={historyCategoryOptions}
                      searchable
                      searchPlaceholder="Buscar categoria"
                    />
                  </div>
                </label>

                <label className="text-sm text-white/70">
                  Buscar
                  <div className="relative mt-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar por categoria o periodo"
                      className="w-full rounded-xl bg-white/10 py-2 pl-9 pr-3 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-emerald-300/60"
                    />
                  </div>
                </label>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
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
          </div>
        </div>
      )}
    </section>
  );
}
