"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  Edit3,
  History,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
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

function statusStyles(percent: number) {
  if (percent <= 70) {
    return {
      label: "En control",
      badge:
        "bg-emerald-400/10 text-emerald-200 ring-emerald-300/20 budget-status-good",
      stroke: "#7c5cff",
    };
  }
  if (percent <= 90) {
    return {
      label: "Necesita atencion",
      badge:
        "bg-amber-400/10 text-amber-200 ring-amber-300/25 budget-status-warning",
      stroke: "#f59e0b",
    };
  }
  return {
    label: "Sobre limite",
    badge: "bg-rose-400/10 text-rose-200 ring-rose-300/25 budget-status-danger",
    stroke: "#fb7185",
  };
}

function CircularBudgetProgress({
  percent,
  spent,
  stroke,
}: {
  percent: number;
  spent: number;
  stroke: string;
}) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(percent, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="budget-ring-track"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs font-medium text-white/45">
          {progress.toFixed(0)}%
        </span>
        <span className="mt-1 max-w-[5.8rem] break-words text-sm font-semibold leading-tight text-white">
          {money(spent)}
        </span>
      </div>
    </div>
  );
}

function MonthlyBudgetArc({
  percent,
  spent,
}: {
  percent: number;
  spent: number;
}) {
  const progress = Math.min(Math.max(percent, 0), 100);
  const circumference = 220;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative mx-auto mt-5 h-36 max-w-[260px]">
      <svg viewBox="0 0 260 150" className="h-full w-full" aria-hidden>
        <path
          d="M 34 126 A 96 96 0 0 1 226 126"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="18"
          className="budget-ring-track"
          pathLength={circumference}
        />
        <path
          d="M 34 126 A 96 96 0 0 1 226 126"
          fill="none"
          stroke="#7c5cff"
          strokeLinecap="round"
          strokeWidth="18"
          pathLength={circumference}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-2 text-center">
        <p className="text-xs text-white/45">{progress.toFixed(0)}% usado</p>
        <p className="mt-1 text-2xl font-semibold text-white">{money(spent)}</p>
      </div>
    </div>
  );
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

  const currentExpenseRows = useMemo(() => {
    return currentBudgets
      .map((budget) => {
        const categoryKey = normalizeKey(budget.category);
        const amount = currentSpentByCategory.get(categoryKey) ?? 0;
        const previousAmount = previousSpentByCategory.get(categoryKey) ?? 0;
        const delta =
          previousAmount > 0 ? ((amount - previousAmount) / previousAmount) * 100 : null;

        return {
          category: budget.category,
          amount,
          delta,
        };
      })
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [currentBudgets, currentSpentByCategory, previousSpentByCategory]);

  const budgetTrendData = useMemo(() => {
    const months = availablePeriods.slice(0, 6).reverse();

    return months.map((item) => {
      const monthBudgets = budgets.filter((budget) => budget.period === item);
      const limit = monthBudgets.reduce(
        (sum, budget) => sum + (Number(budget.monthlyLimit) || 0),
        0
      );
      const spent = transactions.reduce((sum, tx) => {
        if (!isExpense(tx)) return sum;
        if (monthKey(tx.Fecha) !== item) return sum;
        const hasBudget = monthBudgets.some(
          (budget) => normalizeKey(budget.category) === normalizeKey(tx.Categoría)
        );
        return hasBudget ? sum + (Number(tx.Importe) || 0) : sum;
      }, 0);

      return {
        period: item.slice(5),
        limite: limit,
        gastado: spent,
      };
    });
  }, [availablePeriods, budgets, transactions]);

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
    const rawPercent =
      budget.monthlyLimit > 0 ? (spent / budget.monthlyLimit) * 100 : 0;
    const status = statusStyles(rawPercent);

    return (
      <div key={budget.id} className="budget-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words text-base font-semibold text-white">
              {budget.category}
            </h3>
            <p className="mt-1 text-xs text-white/45">{budget.period}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => editBudget(budget)}
              className="budget-icon-button"
              aria-label={`Editar ${budget.category}`}
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDeleteTarget(budget)}
              className="budget-icon-button text-rose-200 hover:text-rose-100"
              aria-label={`Eliminar ${budget.category}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <CircularBudgetProgress
            percent={percent}
            spent={spent}
            stroke={status.stroke}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/45">Restante</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {money(remaining)}
            </p>
            <p className="mt-1 text-xs text-white/45">
              de {money(budget.monthlyLimit)}
            </p>
            <span
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${status.badge}`}
            >
              {rawPercent <= 70 ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
              {status.label}
            </span>
          </div>
        </div>

        <div className="mt-5 h-2 rounded-full bg-white/10 budget-line-track">
          <div
            className={`h-full rounded-full ${progressTone(percent)}`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
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
            <p className="text-white/45">Uso</p>
            <p className={`mt-1 font-semibold ${progressTextTone(percent)}`}>
              {rawPercent.toFixed(0)}%
            </p>
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
    <section className="budget-dashboard-shell">
      <div className="budget-dashboard-header">
        <div>
          <h2 className="text-2xl font-semibold text-white">Presupuesto</h2>
          <p className="mt-1 text-sm text-white/55">
            Crea y da seguimiento a tus limites por categoria.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="budget-toolbar-button" type="button">
            <CalendarDays className="h-4 w-4" />
            Este mes
          </button>
          <button className="budget-toolbar-icon" type="button" aria-label="Ordenar">
            <ArrowUpDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="budget-toolbar-button"
          >
            <History className="h-4 w-4" />
            Historico
          </button>
          <button className="budget-toolbar-icon" type="button" aria-label="Filtros">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-rose-300/20">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="budget-form-panel p-5">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(260px,1fr)_170px_220px_auto] xl:items-end">
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
                  className="budget-input mt-1"
                />
              </label>

              <label className="text-sm text-white/70">
                Monto limite
                <input
                  value={monthlyLimit}
                  onChange={(event) =>
                    setMonthlyLimit(formatAmountInput(event.target.value))
                  }
                  placeholder="0.00"
                  inputMode="decimal"
                  className="budget-input mt-1"
                />
              </label>

              <div className="flex gap-2">
                {editingId && (
                  <button onClick={resetForm} className="budget-toolbar-button">
                    <X className="h-4 w-4" />
                    Cancelar
                  </button>
                )}
                <button
                  onClick={saveBudget}
                  disabled={saving}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editingId ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {saving ? "Guardando..." : editingId ? "Actualizar" : "Nuevo presupuesto"}
                </button>
              </div>
            </div>
          </div>

          <div className="budget-filter-panel flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                {filteredCurrentBudgets.length} items
              </p>
              <p className="mt-1 text-xs text-white/45">
                Presupuestos activos para {period}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:w-[620px] md:grid-cols-[1fr_240px]">
              <label className="text-sm text-white/70">
                Buscar
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                  <input
                    value={currentSearch}
                    onChange={(event) => setCurrentSearch(event.target.value)}
                    placeholder="Buscar categoria"
                    className="budget-input budget-search-input w-full py-2 pr-3"
                  />
                </div>
              </label>
              <label className="text-sm text-white/70">
                Categoria
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

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {loading ? (
              <div className="budget-card p-6 text-center text-sm text-white/55 xl:col-span-2">
                Cargando presupuesto...
              </div>
            ) : currentBudgets.length === 0 ? (
              <div className="budget-card p-6 text-center text-sm text-white/55 xl:col-span-2">
                Aun no hay presupuesto para el periodo actual.
              </div>
            ) : filteredCurrentBudgets.length === 0 ? (
              <div className="budget-card p-6 text-center text-sm text-white/55 xl:col-span-2">
                No hay presupuesto con la busqueda o categoria seleccionada.
              </div>
            ) : (
              filteredCurrentBudgets.map((budget) =>
                renderBudgetCard(budget, currentSpentByCategory)
              )
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="budget-side-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Presupuesto mensual</h3>
                <p className="mt-1 text-sm text-white/50">{period}</p>
              </div>
              <button className="budget-toolbar-icon" type="button" aria-label="Mas opciones">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">
              {money(budgetSummary.totalLimit)}
            </p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-200 ring-1 ring-emerald-300/20 budget-status-good">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {budgetSummary.usedPercent <= 100 ? "En control" : "Sobre limite"}
            </span>
            <MonthlyBudgetArc
              percent={budgetSummary.usedPercent}
              spent={budgetSummary.totalSpent}
            />
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                <p className="text-white/45">Restante</p>
                <p className="mt-1 font-semibold text-white">
                  {money(Math.max(budgetSummary.totalLimit - budgetSummary.totalSpent, 0))}
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                <p className="text-white/45">En riesgo</p>
                <p className="mt-1 font-semibold text-white">
                  {budgetSummary.atRiskCount}
                </p>
              </div>
            </div>
          </div>

          <div className="budget-side-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">Mas gastos</h3>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/55 ring-1 ring-white/10">
                Este mes
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {currentExpenseRows.length === 0 ? (
                <p className="rounded-2xl bg-white/5 p-4 text-sm text-white/55 ring-1 ring-white/10">
                  No hay gastos registrados para este periodo.
                </p>
              ) : (
                currentExpenseRows.map((item) => {
                  const isDown = item.delta !== null && item.delta < 0;
                  return (
                    <div key={item.category} className="flex items-center gap-3">
                      <div className="budget-expense-icon">
                        <WalletCards className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {money(item.amount)}
                        </p>
                        <p className="truncate text-xs text-white/45">{item.category}</p>
                      </div>
                      {item.delta !== null && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                            isDown
                              ? "bg-emerald-400/10 text-emerald-200"
                              : "bg-rose-400/10 text-rose-200"
                          }`}
                        >
                          {isDown ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUp className="h-3 w-3" />
                          )}
                          {Math.abs(item.delta).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="budget-side-card p-5">
            <h3 className="text-base font-semibold text-white">Tendencia</h3>
            <div className="mt-4 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={budgetTrendData}>
                  <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => money(Number(value))}
                    contentStyle={{
                      background: "var(--chart-tooltip-bg)",
                      border: "1px solid var(--chart-tooltip-border)",
                      borderRadius: 14,
                      color: "var(--foreground)",
                    }}
                  />
                  <Line type="monotone" dataKey="limite" stroke="#7c5cff" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="gastado" stroke="#22c55e" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </aside>
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
