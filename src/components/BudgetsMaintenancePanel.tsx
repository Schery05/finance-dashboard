"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  Eye,
  History,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
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

function transactionCategory(tx: Transaction) {
  const record = tx as unknown as Record<string, unknown>;
  return String(record["Categoría"] ?? record["CategorÃ­a"] ?? "");
}

function isPaid(tx: Transaction) {
  return normalizeKey(tx.EstadoPago) === "pagado";
}

function isPending(tx: Transaction) {
  return normalizeKey(tx.EstadoPago) === "pendiente";
}

function isIncome(tx: Transaction) {
  return normalizeKey(tx.Tipo) === "ingreso";
}

function isExpense(tx: Transaction) {
  return normalizeKey(tx.Tipo) === "gasto" && isPaid(tx);
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
  compact = false,
}: {
  percent: number;
  spent: number;
  stroke: string;
  compact?: boolean;
}) {
  const radius = compact ? 36 : 46;
  const size = compact ? 96 : 120;
  const center = size / 2;
  const strokeWidth = compact ? 8 : 10;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(percent, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={compact ? "relative h-24 w-24 shrink-0" : "relative h-32 w-32 shrink-0"}>
      <svg
        className={compact ? "h-24 w-24 -rotate-90" : "h-32 w-32 -rotate-90"}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="budget-ring-track"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={compact ? "text-xs font-medium text-white/45" : "text-xs font-medium text-white/45"}>
          {progress.toFixed(0)}%
        </span>
        {!compact && (
          <span className="mt-1 max-w-[5.8rem] break-words text-sm font-semibold leading-tight text-white">
            {money(spent)}
          </span>
        )}
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
  const fetchTransactions = useFinanceStore((state) => state.fetchTransactions);
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
  const [cardsPerRow, setCardsPerRow] = useState<2 | 3 | 4 | 5 | 6 | 7 | 8>(4);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [viewTarget, setViewTarget] = useState<Budget | null>(null);
  const [outsideBudgetOpen, setOutsideBudgetOpen] = useState(false);
  const [pendingTxEditingId, setPendingTxEditingId] = useState<string | null>(null);
  const [pendingTxForm, setPendingTxForm] = useState({
    Fecha: "",
    Importe: "",
    EstadoPago: "Pendiente" as "Pagado" | "Pendiente",
    DescripcionAdicional: "",
  });
  const [pendingTxSavingId, setPendingTxSavingId] = useState<string | null>(null);
  const [pendingTxError, setPendingTxError] = useState("");
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

      const categoryKey = normalizeKey(transactionCategory(tx));
      totals.set(categoryKey, (totals.get(categoryKey) ?? 0) + (Number(tx.Importe) || 0));
    }

    return totals;
  }, [transactions, period]);

  const historicalSpentByCategory = useMemo(() => {
    const totals = new Map<string, number>();

    for (const tx of transactions) {
      if (!isExpense(tx)) continue;
      if (monthKey(tx.Fecha) !== periodFilter) continue;

      const categoryKey = normalizeKey(transactionCategory(tx));
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

      const categoryKey = normalizeKey(transactionCategory(tx));
      totals.set(categoryKey, (totals.get(categoryKey) ?? 0) + (Number(tx.Importe) || 0));
    }

    return totals;
  }, [transactions, period]);

  const monthlyCashflow = useMemo(() => {
    let income = 0;
    let paidIncome = 0;
    let pendingIncome = 0;
    let expenses = 0;

    for (const tx of transactions) {
      if (monthKey(tx.Fecha) !== period) continue;

      if (isIncome(tx)) {
        const amount = Number(tx.Importe) || 0;
        income += amount;
        if (isPaid(tx)) paidIncome += amount;
        if (isPending(tx)) pendingIncome += amount;
        continue;
      }

      if (isExpense(tx)) {
        expenses += Number(tx.Importe) || 0;
      }
    }

    const margin = income - expenses;
    const usedPercent = income > 0 ? (expenses / income) * 100 : 0;
    const isOverIncome = expenses > income && expenses > 0;
    const isNearLimit = income > 0 && expenses <= income && usedPercent >= 90;

    return {
      income,
      paidIncome,
      pendingIncome,
      expenses,
      margin,
      usedPercent,
      isOverIncome,
      isNearLimit,
      hasIncome: income > 0,
    };
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
  const budgetCategoryKeys = useMemo(() => {
    return new Set(currentBudgets.map((budget) => normalizeKey(budget.category)));
  }, [currentBudgets]);
  const paidExpensesOutsideBudgetRows = useMemo(() => {
    return transactions
      .filter(isExpense)
      .filter((tx) => monthKey(tx.Fecha) === period)
      .filter((tx) => !budgetCategoryKeys.has(normalizeKey(transactionCategory(tx))))
      .sort((a, b) => {
        const dateSort = String(b.Fecha).localeCompare(String(a.Fecha));
        if (dateSort !== 0) return dateSort;
        return String(b.ID).localeCompare(String(a.ID));
      });
  }, [budgetCategoryKeys, period, transactions]);
  const paidExpensesOutsideBudget = paidExpensesOutsideBudgetRows.reduce(
    (sum, tx) => sum + (Number(tx.Importe) || 0),
    0
  );
  const paidExpensesOutsideBudgetByCategory = useMemo(() => {
    const totals = new Map<string, { amount: number; count: number }>();

    for (const tx of paidExpensesOutsideBudgetRows) {
      const category = String(transactionCategory(tx) || "Sin categoria");
      const current = totals.get(category) ?? { amount: 0, count: 0 };
      totals.set(category, {
        amount: current.amount + (Number(tx.Importe) || 0),
        count: current.count + 1,
      });
    }

    return Array.from(totals.entries())
      .map(([category, value]) => ({ category, ...value }))
      .sort((a, b) => b.amount - a.amount);
  }, [paidExpensesOutsideBudgetRows]);
  const marginPercent =
    monthlyCashflow.income > 0
      ? Math.max((monthlyCashflow.margin / monthlyCashflow.income) * 100, 0)
      : 0;
  const budgetIncomeOverage = Math.max(
    budgetSummary.totalLimit - monthlyCashflow.income,
    0
  );
  const hasBudgetIncomeOverage = budgetIncomeOverage > 0;
  const budgetIncomeOverageCategories = useMemo(() => {
    return [...currentBudgets]
      .sort((a, b) => b.monthlyLimit - a.monthlyLimit)
      .slice(0, 3);
  }, [currentBudgets]);

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

  const viewedBudgetTransactions = useMemo(() => {
    if (!viewTarget) {
      return {
        paid: [] as Transaction[],
        pending: [] as Transaction[],
        paidTotal: 0,
        pendingTotal: 0,
      };
    }

    const categoryKey = normalizeKey(viewTarget.category);
    const rows = transactions
      .filter((tx) => normalizeKey(tx.Tipo) === "gasto")
      .filter((tx) => monthKey(tx.Fecha) === viewTarget.period)
      .filter((tx) => normalizeKey(transactionCategory(tx)) === categoryKey)
      .sort((a, b) => {
        const dateSort = String(b.Fecha).localeCompare(String(a.Fecha));
        if (dateSort !== 0) return dateSort;
        return String(b.ID).localeCompare(String(a.ID));
      });

    const paid = rows.filter(isPaid);
    const pending = rows.filter(isPending);

    return {
      paid,
      pending,
      paidTotal: paid.reduce((sum, tx) => sum + (Number(tx.Importe) || 0), 0),
      pendingTotal: pending.reduce((sum, tx) => sum + (Number(tx.Importe) || 0), 0),
    };
  }, [transactions, viewTarget]);
  const viewedBudgetSpent = viewedBudgetTransactions.paidTotal;
  const viewedBudgetPending = viewedBudgetTransactions.pendingTotal;
  const viewedBudgetRemaining = Math.max(
    (viewTarget?.monthlyLimit ?? 0) - viewedBudgetSpent,
    0
  );
  const viewedBudgetOverage = useMemo(() => {
    const paidIds = new Set<string>();
    const pendingIds = new Set<string>();

    if (!viewTarget || viewTarget.monthlyLimit <= 0) {
      return { paidIds, pendingIds };
    }

    const byOldestFirst = (a: Transaction, b: Transaction) => {
      const dateSort = String(a.Fecha).localeCompare(String(b.Fecha));
      if (dateSort !== 0) return dateSort;
      return String(a.ID).localeCompare(String(b.ID));
    };

    let paidRunningTotal = 0;
    for (const tx of [...viewedBudgetTransactions.paid].sort(byOldestFirst)) {
      paidRunningTotal += Number(tx.Importe) || 0;
      if (paidRunningTotal > viewTarget.monthlyLimit) {
        paidIds.add(tx.ID);
      }
    }

    let projectedRunningTotal = paidRunningTotal;
    for (const tx of [...viewedBudgetTransactions.pending].sort(byOldestFirst)) {
      projectedRunningTotal += Number(tx.Importe) || 0;
      if (projectedRunningTotal > viewTarget.monthlyLimit) {
        pendingIds.add(tx.ID);
      }
    }

    return { paidIds, pendingIds };
  }, [viewTarget, viewedBudgetTransactions]);

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
          (budget) => normalizeKey(budget.category) === normalizeKey(transactionCategory(tx))
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

  const resetPendingTransactionEdit = () => {
    setPendingTxEditingId(null);
    setPendingTxForm({
      Fecha: "",
      Importe: "",
      EstadoPago: "Pendiente",
      DescripcionAdicional: "",
    });
    setPendingTxError("");
  };

  const startPendingTransactionEdit = (tx: Transaction) => {
    setPendingTxEditingId(tx.ID);
    setPendingTxForm({
      Fecha: String(tx.Fecha ?? "").slice(0, 10),
      Importe: formatAmountInput(String(tx.Importe ?? "")),
      EstadoPago: tx.EstadoPago,
      DescripcionAdicional: String(tx.DescripcionAdicional ?? ""),
    });
    setPendingTxError("");
  };

  const savePendingTransaction = async (tx: Transaction) => {
    if (pendingTxSavingId) return;

    setPendingTxSavingId(tx.ID);
    setPendingTxError("");

    try {
      const amount = parseAmountInput(pendingTxForm.Importe);
      if (!pendingTxForm.Fecha) throw new Error("La fecha es obligatoria.");
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("El importe debe ser mayor a cero.");
      }

      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tx.ID,
          transaction: {
            Fecha: pendingTxForm.Fecha,
            Tipo: "Gasto",
            Categoría: transactionCategory(tx),
            Importe: amount,
            EstadoPago: pendingTxForm.EstadoPago,
            DescripcionAdicional: pendingTxForm.DescripcionAdicional,
            EsPagoDeuda: Boolean(tx.EsPagoDeuda),
            ...(tx.DeudaId ? { DeudaId: tx.DeudaId } : {}),
            ...(tx.CuotaActual ? { CuotaActual: tx.CuotaActual } : {}),
          },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "No se pudo actualizar la transaccion.");

      resetPendingTransactionEdit();
      await fetchTransactions();
      await fetchBudgets();
    } catch (err) {
      setPendingTxError(
        err instanceof Error ? err.message : "Error actualizando transaccion."
      );
    } finally {
      setPendingTxSavingId(null);
    }
  };

  const deletePendingTransaction = async (tx: Transaction) => {
    if (pendingTxSavingId) return;

    setPendingTxSavingId(tx.ID);
    setPendingTxError("");

    try {
      const res = await fetch("/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tx.ID }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "No se pudo eliminar la transaccion.");

      if (pendingTxEditingId === tx.ID) resetPendingTransactionEdit();
      await fetchTransactions();
      await fetchBudgets();
    } catch (err) {
      setPendingTxError(
        err instanceof Error ? err.message : "Error eliminando transaccion."
      );
    } finally {
      setPendingTxSavingId(null);
    }
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
    const compact = cardsPerRow >= 4;

    return (
      <div
        key={budget.id}
        className={`budget-card p-5 ${compact ? "budget-card-compact" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className={`${compact ? "text-sm leading-snug" : "text-base"} break-words font-semibold text-white`}>
              {budget.category}
            </h3>
            <p className="mt-1 text-xs text-white/45">{budget.period}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setViewTarget(budget)}
              className="budget-icon-button text-sky-200 hover:text-sky-100"
              aria-label={`Ver transacciones de ${budget.category}`}
              title="Ver transacciones"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => editBudget(budget)}
              className="budget-icon-button"
              aria-label={`Editar ${budget.category}`}
              title="Editar presupuesto"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(budget)}
              className="budget-icon-button text-rose-200 hover:text-rose-100"
              aria-label={`Eliminar ${budget.category}`}
              title="Eliminar presupuesto"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          className={
            compact
              ? "mt-4 flex flex-col items-center gap-3 text-center"
              : "mt-4 flex flex-col gap-4 sm:flex-row sm:items-center"
          }
        >
          <CircularBudgetProgress
            percent={percent}
            spent={spent}
            stroke={status.stroke}
            compact={compact}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/45">Restante</p>
            <p className={`${compact ? "text-xl" : "text-2xl"} mt-1 break-words font-semibold text-white`}>
              {money(remaining)}
            </p>
            <p className="mt-1 break-words text-xs text-white/45">
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

        <div className={`${compact ? "gap-2 text-[11px]" : "gap-3 text-xs"} mt-4 grid grid-cols-3`}>
          <div>
            <p className="text-white/45">Gastado</p>
            <p className="mt-1 break-words font-semibold text-white">{money(spent)}</p>
          </div>
          <div>
            <p className="text-white/45">Limite</p>
            <p className="mt-1 break-words font-semibold text-white">
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
    <section className="budget-dashboard-shell min-w-0">
      <div className="budget-dashboard-header">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-white">Presupuesto</h2>
          <p className="mt-1 text-sm text-white/55">
            Crea y da seguimiento a tus limites por categoria.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
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

      {hasBudgetIncomeOverage && (
        <div className="mb-6 rounded-3xl bg-amber-400/[0.12] p-4 text-amber-50 ring-1 ring-amber-300/30 budget-status-warning">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-300/20 text-amber-100 ring-1 ring-amber-200/30">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white">
                  Tu presupuesto excede tus ingresos previstos en {money(budgetIncomeOverage)}.
                </h3>
                <p className="mt-1 text-sm leading-6 text-white/70">
                  El limite total presupuestado es {money(budgetSummary.totalLimit)} y tus ingresos previstos son {money(monthlyCashflow.income)} para {period}.
                </p>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-2 text-sm sm:grid-cols-3 lg:w-[520px]">
              <div className="rounded-2xl bg-white/[0.08] px-3 py-2 ring-1 ring-white/10">
                Reducir categorias.
              </div>
              <div className="rounded-2xl bg-white/[0.08] px-3 py-2 ring-1 ring-white/10">
                Recalcular presupuesto.
              </div>
              <div className="rounded-2xl bg-white/[0.08] px-3 py-2 ring-1 ring-white/10">
                Ver categorias responsables.
              </div>
            </div>
          </div>

          {budgetIncomeOverageCategories.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {budgetIncomeOverageCategories.map((budget) => (
                <span
                  key={budget.id}
                  className="rounded-full bg-amber-100/12 px-3 py-1 text-xs font-semibold text-amber-50 ring-1 ring-amber-100/20"
                >
                  {budget.category}: {money(budget.monthlyLimit)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        className={
          cardsPerRow >= 4
            ? "grid grid-cols-1 gap-6"
            : "grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]"
        }
      >
        <div className="space-y-6">
          <div className="budget-form-panel min-w-0 p-4 sm:p-5">
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

              <div className="flex min-w-0 gap-2">
                <button
                  type="button"
                  onClick={saveBudget}
                  disabled={saving}
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {saving ? "Guardando..." : "Nuevo presupuesto"}
                </button>
              </div>
            </div>
          </div>

          <div className="budget-filter-panel flex min-w-0 flex-col gap-4 p-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 shrink-0">
              <p className="text-sm font-semibold text-white">
                {filteredCurrentBudgets.length} items
              </p>
              <p className="mt-1 text-xs text-white/45">
                Presupuestos activos para {period}
              </p>
            </div>
            <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-[minmax(220px,1fr)_minmax(180px,0.55fr)] lg:grid-cols-[minmax(240px,1fr)_minmax(200px,0.45fr)_minmax(240px,0.55fr)] xl:max-w-[min(76rem,78%)]">
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
              <div className="text-sm text-white/70">
                Cards por fila
                <div className="mt-1 grid grid-cols-4 gap-1 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10 sm:grid-cols-7">
                  {([2, 3, 4, 5, 6, 7, 8] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCardsPerRow(value)}
                      className={`rounded-xl px-2 py-2 text-sm font-semibold transition ${
                        cardsPerRow === value
                          ? "bg-emerald-300 text-slate-950"
                          : "text-white/65 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div
            className="budget-cards-grid"
            style={
              {
                "--budget-cards-per-row": cardsPerRow,
              } as CSSProperties
            }
          >
            {loading ? (
              <div className="budget-card budget-grid-full p-6 text-center text-sm text-white/55">
                Cargando presupuesto...
              </div>
            ) : currentBudgets.length === 0 ? (
              <div className="budget-card budget-grid-full p-6 text-center text-sm text-white/55">
                Aun no hay presupuesto para el periodo actual.
              </div>
            ) : filteredCurrentBudgets.length === 0 ? (
              <div className="budget-card budget-grid-full p-6 text-center text-sm text-white/55">
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
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Resumen mensual</h3>
                <p className="mt-1 text-sm text-white/50">{period}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden items-center gap-1.5 text-xs font-medium text-white/45 md:inline-flex">
                  <Clock3 className="h-3.5 w-3.5" />
                  Ultima actualizacion: hoy
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                    budgetSummary.usedPercent <= 100
                      ? "bg-emerald-400/10 text-emerald-200 ring-emerald-300/20 budget-status-good"
                      : "bg-rose-500/10 text-rose-100 ring-rose-300/25 budget-status-danger"
                  }`}
                >
                  {budgetSummary.usedPercent <= 100 ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUp className="h-3.5 w-3.5" />
                  )}
                  {budgetSummary.usedPercent <= 100 ? "En control" : "Sobre limite"}
                </span>
                <button className="budget-toolbar-icon" type="button" aria-label="Mas opciones">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">
              <div className="flex flex-col">
                <p className="text-xs font-semibold text-white/50">Presupuesto total</p>
                <p className="mt-1 text-3xl font-semibold text-white">
                  {money(budgetSummary.totalLimit)}
                </p>

                <div className="mt-5 grid grid-cols-[170px_1fr] items-center gap-5">
                  <div className="relative h-40">
                    <svg viewBox="0 0 180 140" className="h-full w-full" aria-hidden>
                      <path
                        d="M 24 118 A 66 66 0 0 1 156 118"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="16"
                        className="budget-ring-track"
                        pathLength="100"
                      />
                      <path
                        d="M 24 118 A 66 66 0 0 1 156 118"
                        fill="none"
                        stroke="#7c5cff"
                        strokeLinecap="round"
                        strokeWidth="16"
                        strokeDasharray="100"
                        strokeDashoffset={100 - Math.min(Math.max(budgetSummary.usedPercent, 0), 100)}
                        pathLength="100"
                      />
                    </svg>
                    <div className="absolute inset-x-0 bottom-3 text-center">
                      <p className="text-3xl font-semibold text-white">
                        {budgetSummary.usedPercent.toFixed(0)}%
                      </p>
                      <p className="text-xs text-white/50">consumido</p>
                    </div>
                  </div>

                  <div className="space-y-4 text-sm">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#7c5cff]" />
                      <div>
                        <p className="font-semibold text-white/80">Gastado</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {money(budgetSummary.totalSpent)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-violet-100/70" />
                      <div>
                        <p className="font-semibold text-white/60">Disponible</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {money(Math.max(budgetSummary.totalLimit - budgetSummary.totalSpent, 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`mt-4 rounded-2xl p-4 text-sm ring-1 ${
                    budgetSummary.usedPercent <= 100
                      ? "bg-emerald-400/10 text-emerald-100 ring-emerald-300/20 budget-status-good"
                      : "bg-rose-500/10 text-rose-100 ring-rose-300/25 budget-status-danger"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 flex-none" />
                    <div>
                      <p className="font-semibold">
                        {budgetSummary.usedPercent <= 100 ? "En control" : "Sobre limite"}
                      </p>
                      <p className="text-xs opacity-75">
                        {budgetSummary.usedPercent <= 100
                          ? "Vas bien, manten tu ritmo actual."
                          : "Revisa las categorias que superan su limite."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                  <div className="rounded-2xl bg-emerald-400/10 p-4 ring-1 ring-emerald-300/20 budget-status-good">
                    <p className="text-sm font-medium text-white/55">Ingresos pagados</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {money(monthlyCashflow.paidIncome)}
                    </p>
                    <div className="mt-5 flex items-center gap-3 text-xs font-semibold text-white/70">
                      <span className="rounded-full bg-emerald-300/20 p-2 text-emerald-200">
                        <ArrowDown className="h-4 w-4" />
                      </span>
                      Ya recibidos
                    </div>
                  </div>
                  <div className="rounded-2xl bg-amber-400/10 p-4 ring-1 ring-amber-300/25 budget-status-warning">
                    <p className="text-sm font-medium text-white/55">Ingresos pendientes</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {money(monthlyCashflow.pendingIncome)}
                    </p>
                    <div className="mt-5 flex items-center gap-3 text-xs font-semibold text-white/70">
                      <span className="rounded-full bg-amber-300/20 p-2 text-amber-200">
                        <Clock3 className="h-4 w-4" />
                      </span>
                      Por recibir
                    </div>
                  </div>
                  <div className="rounded-2xl bg-violet-400/10 p-4 ring-1 ring-violet-300/20">
                    <p className="text-sm font-medium text-white/55">Ingresos previstos</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {money(monthlyCashflow.income)}
                    </p>
                    <div className="mt-5 flex items-center gap-3 text-xs font-semibold text-white/70">
                      <span className="rounded-full bg-violet-300/20 p-2 text-violet-200">
                        <WalletCards className="h-4 w-4" />
                      </span>
                      Total esperado
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                    <p className="text-sm font-medium text-white/55">Gastos pagados</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {money(monthlyCashflow.expenses)}
                    </p>
                    <div className="mt-5 flex items-center gap-3 text-xs font-semibold text-white/70">
                      <span className="rounded-full bg-violet-300/20 p-2 text-violet-200">
                        <ArrowUp className="h-4 w-4" />
                      </span>
                      Ya pagados
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
                  <div className="rounded-2xl bg-emerald-400/10 p-4 ring-1 ring-emerald-300/20 budget-status-good">
                    <p className="text-sm font-semibold text-white/70">Margen disponible</p>
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                      <p className="text-3xl font-semibold text-emerald-200">
                        {money(monthlyCashflow.margin)}
                      </p>
                      <span className="rounded-full bg-emerald-300/15 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                        {marginPercent.toFixed(0)}% del ingreso previsto
                      </span>
                    </div>
                    <div className="mt-4 flex h-12 items-end gap-2 text-emerald-200/80">
                      {[34, 28, 42, 36, 48, 30, 55, 44, 62].map((height, index) => (
                        <span
                          key={index}
                          className="w-full rounded-full bg-current"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl p-4 ring-1 ${
                      monthlyCashflow.isOverIncome
                        ? "bg-rose-500/10 text-rose-100 ring-rose-300/25 budget-status-danger"
                        : monthlyCashflow.isNearLimit
                          ? "bg-amber-400/10 text-amber-100 ring-amber-300/25 budget-status-warning"
                          : "bg-emerald-400/10 text-emerald-100 ring-emerald-300/20 budget-status-good"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {monthlyCashflow.isOverIncome || monthlyCashflow.isNearLimit ? (
                        <ArrowUp className="mt-1 h-5 w-5 flex-none" />
                      ) : (
                        <CheckCircle2 className="mt-1 h-5 w-5 flex-none" />
                      )}
                      <div>
                        <p className="font-semibold">
                          {monthlyCashflow.isOverIncome
                            ? "Tus gastos superan tus ingresos."
                            : monthlyCashflow.isNearLimit
                              ? "Estas cerca de consumir tus ingresos."
                              : "Tus ingresos cubren todos los gastos."}
                        </p>
                        <p className="mt-1 text-sm opacity-75">
                          {monthlyCashflow.isOverIncome
                            ? `Te faltan ${money(Math.abs(monthlyCashflow.margin))} para cubrir tus gastos.`
                            : paidExpensesOutsideBudget > 0
                              ? `${money(paidExpensesOutsideBudget)} estan fuera de categorias presupuestadas.`
                              : "Tienes un margen saludable este mes."}
                        </p>
                        {paidExpensesOutsideBudget > 0 && !monthlyCashflow.isOverIncome && (
                          <button
                            type="button"
                            onClick={() => setOutsideBudgetOpen(true)}
                            className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-current ring-1 ring-white/20 transition hover:bg-white/25"
                          >
                            Ver detalle
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
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

      {outsideBudgetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-950 shadow-2xl shadow-slate-950/30">
            <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Presupuesto {period}
                  </p>
                  <h3 className="mt-1 break-words text-xl font-semibold text-slate-950">
                    Gastos fuera de categorias presupuestadas
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Estos gastos pagados no coinciden con ninguna categoria con presupuesto activo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOutsideBudgetOpen(false)}
                  className="rounded-2xl bg-white p-2 text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-950"
                  aria-label="Cerrar detalle"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-xs font-medium text-slate-500">Total fuera de presupuesto</p>
                  <p className="mt-1 break-words text-xl font-semibold text-slate-950">
                    {money(paidExpensesOutsideBudget)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-xs font-medium text-slate-500">Transacciones</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">
                    {paidExpensesOutsideBudgetRows.length}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-xs font-medium text-slate-500">Categorias detectadas</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">
                    {paidExpensesOutsideBudgetByCategory.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="max-h-[calc(90vh-230px)] overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
                <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <h4 className="text-sm font-semibold text-slate-950">
                    Resumen por categoria
                  </h4>
                  <div className="mt-4 space-y-2">
                    {paidExpensesOutsideBudgetByCategory.length === 0 ? (
                      <p className="rounded-xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">
                        No hay gastos fuera de categorias presupuestadas.
                      </p>
                    ) : (
                      paidExpensesOutsideBudgetByCategory.map((item) => (
                        <div
                          key={item.category}
                          className="rounded-xl bg-white p-3 ring-1 ring-slate-200"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-slate-950">
                                {item.category || "Sin categoria"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {item.count} registro(s)
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold text-slate-950">
                              {money(item.amount)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-950">
                        Transacciones origen
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        Gastos pagados del periodo {period}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
                      {money(paidExpensesOutsideBudget)}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {paidExpensesOutsideBudgetRows.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        No hay transacciones para mostrar.
                      </div>
                    ) : (
                      paidExpensesOutsideBudgetRows.map((tx) => (
                        <div
                          key={tx.ID}
                          className="grid grid-cols-1 gap-3 px-4 py-3 text-sm transition hover:bg-slate-50 sm:grid-cols-[96px_160px_1fr_auto] sm:items-center"
                        >
                          <div className="font-medium text-slate-500">{tx.Fecha}</div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Categoria
                            </p>
                            <p className="mt-1 break-words font-medium text-slate-900">
                              {transactionCategory(tx) || "Sin categoria"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Descripcion
                            </p>
                            <p className="mt-1 break-words font-medium text-slate-900">
                              {tx.DescripcionAdicional || "Sin descripcion"}
                            </p>
                          </div>
                          <div className="text-left text-base font-semibold text-slate-950 sm:text-right">
                            {money(Number(tx.Importe) || 0)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-950 shadow-2xl shadow-slate-950/30">
            <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Presupuesto {viewTarget.period}
                  </p>
                  <h3 className="mt-1 break-words text-xl font-semibold text-slate-950">
                    {viewTarget.category}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setViewTarget(null);
                    resetPendingTransactionEdit();
                  }}
                  className="rounded-2xl bg-white p-2 text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-950"
                  aria-label="Cerrar transacciones"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-xs font-medium text-slate-500">Presupuestado</p>
                  <p className="mt-1 break-words text-xl font-semibold text-slate-950">
                    {money(viewTarget.monthlyLimit)}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                  <p className="text-xs font-medium text-emerald-700">Pagadas</p>
                  <p className="mt-1 break-words text-xl font-semibold text-emerald-950">
                    {money(viewedBudgetSpent)}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                  <p className="text-xs font-medium text-amber-700">Pendientes</p>
                  <p className="mt-1 break-words text-xl font-semibold text-amber-950">
                    {money(viewedBudgetPending)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-4 ring-1 ring-slate-200">
                  <p className="text-xs font-medium text-slate-500">Disponible</p>
                  <p className="mt-1 break-words text-xl font-semibold text-slate-950">
                    {money(viewedBudgetRemaining)}
                  </p>
                </div>
              </div>
            </div>

            <div className="max-h-[calc(90vh-210px)] overflow-y-auto bg-white p-5">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/40">
                  <div className="flex items-center justify-between gap-3 border-b border-emerald-200 px-4 py-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-950">
                        Pagadas
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        {viewedBudgetTransactions.paid.length} registro(s)
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
                      {money(viewedBudgetSpent)}
                    </span>
                  </div>

                  <div className="divide-y divide-emerald-100 bg-white">
                    {viewedBudgetTransactions.paid.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        No hay transacciones pagadas para esta categoria.
                      </div>
                    ) : (
                      viewedBudgetTransactions.paid.map((tx) => {
                        const isOverBudget = viewedBudgetOverage.paidIds.has(tx.ID);

                        return (
                          <div
                            key={tx.ID}
                            className={`grid grid-cols-1 gap-3 px-4 py-3 text-sm transition sm:grid-cols-[96px_1fr_auto] sm:items-center ${
                              isOverBudget
                                ? "bg-rose-50 hover:bg-rose-100"
                                : "hover:bg-emerald-50/70"
                            }`}
                          >
                            <div className="font-medium text-slate-500">{tx.Fecha}</div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                Descripcion
                              </p>
                              <p className="mt-1 break-words font-medium text-slate-900">
                                {tx.DescripcionAdicional || "Sin descripcion"}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                  Pagado
                                </span>
                                {isOverBudget && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                                    <AlertTriangle className="h-3 w-3" />
                                    Sobre presupuesto
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-left text-base font-semibold text-slate-950 sm:text-right">
                              {money(Number(tx.Importe) || 0)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/50">
                  <div className="flex items-center justify-between gap-3 border-b border-amber-200 px-4 py-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-950">
                        Pendientes
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        {viewedBudgetTransactions.pending.length} registro(s)
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
                      {money(viewedBudgetPending)}
                    </span>
                  </div>

                  <div className="divide-y divide-amber-100 bg-white">
                    {pendingTxError && (
                      <div className="bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                        {pendingTxError}
                      </div>
                    )}
                    {viewedBudgetTransactions.pending.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        No hay transacciones pendientes para esta categoria.
                      </div>
                    ) : (
                      viewedBudgetTransactions.pending.map((tx) => {
                        const isProjectedOverBudget =
                          viewedBudgetOverage.pendingIds.has(tx.ID);
                        const isEditing = pendingTxEditingId === tx.ID;
                        const isSavingTransaction = pendingTxSavingId === tx.ID;

                        return (
                          <div
                            key={tx.ID}
                            className={`grid grid-cols-1 gap-3 px-4 py-3 text-sm transition ${
                              isProjectedOverBudget
                                ? "bg-rose-50 hover:bg-rose-100"
                                : "hover:bg-amber-50/70"
                            }`}
                          >
                            {isEditing ? (
                              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[130px_1fr_140px_130px] lg:items-end">
                                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  Fecha
                                  <input
                                    type="date"
                                    value={pendingTxForm.Fecha}
                                    onChange={(event) =>
                                      setPendingTxForm((current) => ({
                                        ...current,
                                        Fecha: event.target.value,
                                      }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-amber-400"
                                  />
                                </label>

                                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  Descripcion
                                  <input
                                    value={pendingTxForm.DescripcionAdicional}
                                    onChange={(event) =>
                                      setPendingTxForm((current) => ({
                                        ...current,
                                        DescripcionAdicional: event.target.value,
                                      }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-amber-400"
                                  />
                                </label>

                                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  Importe
                                  <input
                                    value={pendingTxForm.Importe}
                                    onChange={(event) =>
                                      setPendingTxForm((current) => ({
                                        ...current,
                                        Importe: formatAmountInput(event.target.value),
                                      }))
                                    }
                                    inputMode="decimal"
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-amber-400"
                                  />
                                </label>

                                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  Estado
                                  <select
                                    value={pendingTxForm.EstadoPago}
                                    onChange={(event) =>
                                      setPendingTxForm((current) => ({
                                        ...current,
                                        EstadoPago: event.target.value as "Pagado" | "Pendiente",
                                      }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-amber-400"
                                  >
                                    <option value="Pendiente">Pendiente</option>
                                    <option value="Pagado">Pagado</option>
                                  </select>
                                </label>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[96px_1fr_auto] sm:items-center">
                                <div className="font-medium text-slate-500">{tx.Fecha}</div>
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                    Descripcion
                                  </p>
                                  <p className="mt-1 break-words font-medium text-slate-900">
                                    {tx.DescripcionAdicional || "Sin descripcion"}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                      Pendiente
                                    </span>
                                    {isProjectedOverBudget && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                                        <AlertTriangle className="h-3 w-3" />
                                        Excede si se paga
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-left text-base font-semibold text-slate-950 sm:text-right">
                                  {money(Number(tx.Importe) || 0)}
                                </div>
                              </div>
                            )}

                            <div className="flex flex-wrap justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => savePendingTransaction(tx)}
                                    disabled={Boolean(pendingTxSavingId)}
                                    className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isSavingTransaction ? "Guardando..." : "Guardar"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={resetPendingTransactionEdit}
                                    disabled={Boolean(pendingTxSavingId)}
                                    className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startPendingTransactionEdit(tx)}
                                  disabled={Boolean(pendingTxSavingId)}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Editar
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Deseas eliminar esta transaccion pendiente?"
                                    )
                                  ) {
                                    deletePendingTransaction(tx);
                                  }
                                }}
                                disabled={Boolean(pendingTxSavingId)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {isSavingTransaction ? "Procesando..." : "Eliminar"}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Editar presupuesto</h3>
                <p className="mt-1 text-sm text-white/55">
                  Ajusta la categoria, periodo o limite mensual.
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl bg-white/5 p-2 text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar edicion"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-rose-300/20">
                {error}
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-4">
              <label className="text-sm text-white/70">
                Categoria
                <CustomSelect
                  value={category}
                  onChange={setCategory}
                  placeholder="Selecciona categoria"
                  options={categoryOptions}
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveBudget}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Edit3 className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

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

