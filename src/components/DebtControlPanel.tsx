"use client";

import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, DollarSign, Edit3, Eye, FileUp, Filter, Landmark, Plus, Search, Trash2, TrendingUp, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getDebtAlerts,
  getDebtControlSummary,
type DebtStrategy,
} from "@/lib/debt-control";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { fetchManagedBanks, loadDefaultBanks, type ManagedBank } from "@/lib/banks";
import type { Debt, DebtType, Transaction } from "@/lib/types";
import { useFinanceStore } from "@/store/financeStore";

const debtTypes: { value: DebtType; label: string }[] = [
  { value: "TARJETA", label: "Tarjeta" },
  { value: "PRESTAMO_PERSONAL", label: "Prestamo personal" },
  { value: "VEHICULO", label: "Vehiculo" },
  { value: "HIPOTECA", label: "Hipoteca" },
  { value: "OTRO", label: "Otro" },
];

type DebtHistoryPreviewRow = {
  date: string;
  description: string;
  amount: number;
  status: "Pagado" | "Pendiente";
  installment: number;
};

type DebtHistoryImportSummary = {
  created: number;
  skipped: number;
  total: number;
};

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

const currentPeriod = () => new Date().toISOString().slice(0, 7);

function typeLabel(type: DebtType) {
  return debtTypes.find((item) => item.value === type)?.label ?? "Otro";
}

function parseDateSafe(value: string) {
  const date = new Date(`${String(value ?? "").slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function clampDay(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(day, 1), lastDay);
}

function getFirstDueDate(debt: Debt) {
  const created = parseDateSafe(debt.openingDate || debt.createdAt) ?? new Date();
  const paymentDay = clampDay(
    created.getFullYear(),
    created.getMonth(),
    debt.paymentDay
  );
  const first = new Date(created.getFullYear(), created.getMonth(), paymentDay);

  if (created.getDate() > paymentDay) {
    const nextMonth = addMonths(first, 1);
    return new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      clampDay(nextMonth.getFullYear(), nextMonth.getMonth(), debt.paymentDay)
    );
  }

  return first;
}

function getDueDate(debt: Debt, installment: number) {
  const first = getFirstDueDate(debt);
  const base = addMonths(first, Math.max(installment - 1, 0));
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    clampDay(base.getFullYear(), base.getMonth(), debt.paymentDay)
  );
}

function shortDate(date: Date) {
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function longDate(date: Date) {
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("es-DO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function monthsBetween(start: Date, end: Date) {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

function getInstallmentStatus(debt: Debt, transactions: Transaction[]) {
  const monthlyPayment = Number(debt.monthlyPayment) || 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const linkedPayments = transactions.filter(
    (tx) =>
      tx.DeudaId === debt.id &&
      tx.Tipo === "Gasto" &&
      tx.EstadoPago === "Pagado"
  );

  const paidByInstallment = new Map<number, number>();
  for (const tx of linkedPayments) {
    const installment = Math.max(Number(tx.CuotaActual) || 1, 1);
    paidByInstallment.set(
      installment,
      (paidByInstallment.get(installment) ?? 0) + (Number(tx.Importe) || 0)
    );
  }

  if (monthlyPayment <= 0) {
    return {
      currentInstallment: 1,
      currentPaid: 0,
      currentRemaining: 0,
      overdueCount: 0,
      overdueAmount: 0,
      rows: [],
    };
  }

  const firstDueDate = getFirstDueDate(debt);
  const expectedInstallments =
    today >= firstDueDate ? Math.max(monthsBetween(firstDueDate, today) + 1, 1) : 1;
  const estimatedTotalInstallments = Math.max(
    expectedInstallments + 1,
    Math.ceil(Number(debt.initialAmount) / monthlyPayment)
  );
  const rows = Array.from(
    { length: Math.min(estimatedTotalInstallments, expectedInstallments + 2) },
    (_, index) => {
      const installment = index + 1;
      const dueDate = getDueDate(debt, installment);
      const paid = paidByInstallment.get(installment) ?? 0;
      const remaining = Math.max(monthlyPayment - paid, 0);
      const isCovered = remaining <= 0;
      const isOverdue = dueDate < today && !isCovered;
      const isDueNow = dueDate.getTime() === today.getTime() && !isCovered;

      return {
        installment,
        dueDate,
        paid,
        remaining,
        isCovered,
        isOverdue,
        isDueNow,
      };
    }
  );

  const currentRow =
    rows.find((row) => !row.isCovered) ?? rows[rows.length - 1];
  const overdueRows = rows.filter((row) => row.isOverdue);

  return {
    currentInstallment: currentRow?.installment ?? 1,
    currentPaid: currentRow?.paid ?? 0,
    currentRemaining: currentRow?.remaining ?? 0,
    overdueCount: overdueRows.length,
    overdueAmount: overdueRows.reduce((sum, row) => sum + row.remaining, 0),
    rows: rows
      .filter((row) => row.remaining > 0 && (row.isOverdue || row.installment === currentRow?.installment))
      .slice(0, 4),
  };
}

function loanCode(debt: Debt, index: number) {
  const suffix = debt.id.slice(-4).toUpperCase();
  return `LOAN-${String(index + 1).padStart(3, "0")}-${suffix}`;
}

function loanState(debt: Debt, transactions: Transaction[]) {
  const status = getInstallmentStatus(debt, transactions);
  if (Number(debt.currentBalance) <= 0) return "Saldado";
  return status.overdueCount > 0 ? "En mora" : "Al corriente";
}

function loanProgress(debt: Debt) {
  const totalPayments =
    debt.monthlyPayment > 0
      ? Math.max(1, Math.ceil(debt.initialAmount / debt.monthlyPayment))
      : 1;
  const paidPayments =
    debt.monthlyPayment > 0
      ? Math.min(
          totalPayments,
          Math.floor(Math.max(debt.initialAmount - debt.currentBalance, 0) / debt.monthlyPayment)
        )
      : 0;
  const percent =
    debt.initialAmount > 0
      ? Math.min(((debt.initialAmount - debt.currentBalance) / debt.initialAmount) * 100, 100)
      : 0;

  return { totalPayments, paidPayments, percent };
}

function getPaidByInstallment(debt: Debt, transactions: Transaction[]) {
  const paidByInstallment = new Map<number, number>();
  transactions
    .filter(
      (tx) =>
        tx.DeudaId === debt.id &&
        tx.Tipo === "Gasto" &&
        tx.EstadoPago === "Pagado"
    )
    .forEach((tx) => {
      const installment = Math.max(Number(tx.CuotaActual) || 1, 1);
      paidByInstallment.set(
        installment,
        (paidByInstallment.get(installment) ?? 0) + (Number(tx.Importe) || 0)
      );
    });
  return paidByInstallment;
}

function buildAmortizationSchedule(debt: Debt, transactions: Transaction[]) {
  const monthlyPayment = Number(debt.monthlyPayment) || 0;
  const monthlyRate = (Number(debt.interestRate) || 0) / 100 / 12;
  const paidByInstallment = getPaidByInstallment(debt, transactions);
  const rows = [];
  let balance = Number(debt.initialAmount) || 0;
  let installment = 1;
  let totalInterest = 0;
  let paidMonths = 0;
  let paidInterest = 0;

  while (balance > 0.01 && installment <= 480 && monthlyPayment > 0) {
    const interest = Math.max(balance * monthlyRate, 0);
    const capital = Math.min(Math.max(monthlyPayment - interest, 0), balance);
    const payment = capital + interest;
    const dueDate = getDueDate(debt, installment);
    const paid = paidByInstallment.get(installment) ?? 0;
    const isPaid = paid >= Math.min(monthlyPayment, payment) || balance <= 0;

    balance = Math.max(balance - capital, 0);
    totalInterest += interest;
    if (isPaid) {
      paidMonths += 1;
      paidInterest += interest;
    }

    rows.push({
      installment,
      date: dueDate,
      payment,
      capital,
      interest,
      balance,
      paid,
      status: isPaid ? "Pagado" : "Pendiente",
    });

    if (capital <= 0) break;
    installment += 1;
  }

  return {
    rows,
    totalInterest,
    paidInterest,
    paidMonths,
    remainingMonths: Math.max(rows.length - paidMonths, 0),
    finalDate: rows.at(-1)?.date ?? getFirstDueDate(debt),
  };
}

export function DebtControlPanel({
  viewMode,
}: {
  viewMode: "gestion" | "listado";
}) {
  const transactions = useFinanceStore((state) => state.transactions);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [banks, setBanks] = useState<ManagedBank[]>(() => loadDefaultBanks());
  const [strategy, setStrategy] = useState<DebtStrategy>("avalanche");
  const [period, setPeriod] = useState(currentPeriod());
  const [loanSearch, setLoanSearch] = useState("");
  const [loanStatusFilter, setLoanStatusFilter] = useState("Todos");
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);
  const [historyFile, setHistoryFile] = useState<File | null>(null);
  const [historyPreviewRows, setHistoryPreviewRows] = useState<DebtHistoryPreviewRow[]>([]);
  const [historySummary, setHistorySummary] = useState<DebtHistoryImportSummary | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    initialAmount: "",
    currentBalance: "",
    interestRate: "",
    monthlyPayment: "",
    openingDate: new Date().toISOString().slice(0, 10),
    paymentDay: String(new Date().getDate()),
    type: "TARJETA" as DebtType,
  });

  const fetchDebts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/debts", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "No se pudieron cargar deudas");
      setDebts(json.data as Debt[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando deudas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebts();
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchManagedBanks()
      .then((data) => {
        if (mounted) setBanks(data);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(
    () => getDebtControlSummary({ debts, transactions, strategy, period }),
    [debts, transactions, strategy, period]
  );
  const alerts = useMemo(
    () => getDebtAlerts(summary, strategy),
    [summary, strategy]
  );
  const bankOptions = useMemo(() => {
    const bankNames = banks.map((bank) => bank.name);
    const options = !form.name || bankNames.includes(form.name)
      ? bankNames
      : [form.name, ...bankNames];
    return options.map((bank) => ({ value: bank, label: bank }));
  }, [banks, form.name]);
  const debtTypeOptions = useMemo(
    () => debtTypes.map((type) => ({ value: type.value, label: type.label })),
    []
  );
  const activeLoans = useMemo(
    () => debts.filter((debt) => Number(debt.currentBalance) > 0),
    [debts]
  );
  const loanRows = useMemo(() => {
    const search = loanSearch.trim().toLowerCase();

    return activeLoans
      .map((debt, index) => ({
        debt,
        code: loanCode(debt, index),
        state: loanState(debt, transactions),
        installmentStatus: getInstallmentStatus(debt, transactions),
        progress: loanProgress(debt),
      }))
      .filter((row) => {
        const matchesSearch =
          !search ||
          row.code.toLowerCase().includes(search) ||
          row.debt.name.toLowerCase().includes(search) ||
          typeLabel(row.debt.type).toLowerCase().includes(search);
        const matchesStatus =
          loanStatusFilter === "Todos" || row.state === loanStatusFilter;
        return matchesSearch && matchesStatus;
      });
  }, [activeLoans, loanSearch, loanStatusFilter, transactions]);
  const loansInGoodStanding = useMemo(
    () =>
      activeLoans.filter(
        (debt) => loanState(debt, transactions) === "Al corriente"
      ).length,
    [activeLoans, transactions]
  );
  const loansOverdue = useMemo(
    () =>
      activeLoans.filter((debt) => loanState(debt, transactions) === "En mora")
        .length,
    [activeLoans, transactions]
  );
  const paidLoans = useMemo(
    () => debts.filter((debt) => Number(debt.currentBalance) <= 0).length,
    [debts]
  );
  const totalMonthlyPayments = useMemo(
    () =>
      activeLoans.reduce(
        (total, debt) => total + (Number(debt.monthlyPayment) || 0),
        0
      ),
    [activeLoans]
  );
  const loanStatusOptions = useMemo(
    () => [
      { value: "Todos", label: "Todos" },
      { value: "Al corriente", label: "Al corriente" },
      { value: "En mora", label: "En mora" },
      { value: "Saldado", label: "Saldado" },
    ],
    []
  );
  const visibleLoanIds = useMemo(
    () => new Set(loanRows.map((row) => row.debt.id)),
    [loanRows]
  );
  const selectedDebt = useMemo(
    () => debts.find((debt) => debt.id === selectedDebtId) ?? null,
    [debts, selectedDebtId]
  );

  const resetForm = () => {
    setEditingId(null);
    setShowDebtForm(false);
    setForm({
      name: "",
      initialAmount: "",
      currentBalance: "",
      interestRate: "",
      monthlyPayment: "",
      openingDate: new Date().toISOString().slice(0, 10),
      paymentDay: String(new Date().getDate()),
      type: "TARJETA",
    });
    setError(null);
  };

  const openNewDebtForm = () => {
    resetForm();
    setShowDebtForm(true);
  };

  const editDebt = (debt: Debt) => {
    setEditingId(debt.id);
    setShowDebtForm(true);
    setForm({
      name: debt.name,
      initialAmount: formatAmountInput(String(debt.initialAmount)),
      currentBalance: formatAmountInput(String(debt.currentBalance)),
      interestRate: String(debt.interestRate),
      monthlyPayment: formatAmountInput(String(debt.monthlyPayment)),
      openingDate: String(debt.openingDate || debt.createdAt).slice(0, 10),
      paymentDay: String(debt.paymentDay),
      type: debt.type,
    });
    setError(null);
  };

  const saveDebt = async () => {
    const payload = {
      name: form.name.trim(),
      initialAmount: parseAmountInput(form.initialAmount),
      currentBalance: parseAmountInput(form.currentBalance),
      interestRate: Number(form.interestRate),
      monthlyPayment: parseAmountInput(form.monthlyPayment),
      openingDate: form.openingDate,
      paymentDay: Number(form.paymentDay),
      type: form.type,
    };

    if (!payload.name) return setError("El nombre es obligatorio.");
    if (payload.initialAmount <= 0) return setError("El monto inicial debe ser mayor que cero.");
    if (payload.currentBalance > payload.initialAmount) {
      return setError("El balance actual no puede ser mayor que el monto inicial.");
    }
    if (!payload.openingDate) return setError("La fecha de apertura es obligatoria.");

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/debts", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, debt: payload } : payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "No se pudo guardar la deuda");
      await fetchDebts();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando deuda");
    } finally {
      setSaving(false);
    }
  };

  const deleteDebt = async (debt: Debt) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/debts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: debt.id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "No se pudo eliminar la deuda");
      setDebts((prev) => prev.filter((item) => item.id !== debt.id));
      setDeleteTarget(null);
      if (editingId === debt.id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando deuda");
    } finally {
      setSaving(false);
    }
  };

  const sendDebtHistoryFile = async (
    debtId: string,
    mode: "preview" | "import"
  ) => {
    if (!historyFile) throw new Error("Selecciona un archivo PDF.");

    const body = new FormData();
    body.append("file", historyFile);
    body.append("mode", mode);

    const res = await fetch(`/api/debts/${debtId}/history-import`, {
      method: "POST",
      body,
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "No se pudo procesar el PDF");
    return json.data;
  };

  const previewDebtHistory = async (debtId: string) => {
    setHistoryLoading(true);
    setHistoryError(null);
    setHistorySummary(null);
    try {
      const data = await sendDebtHistoryFile(debtId, "preview");
      setHistoryPreviewRows(data.rows as DebtHistoryPreviewRow[]);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Error procesando PDF");
    } finally {
      setHistoryLoading(false);
    }
  };

  const importDebtHistory = async (debtId: string) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await sendDebtHistoryFile(debtId, "import");
      setHistorySummary(data as DebtHistoryImportSummary);
      await Promise.all([fetchDebts(), useFinanceStore.getState().fetchTransactions()]);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Error importando PDF");
    } finally {
      setHistoryLoading(false);
    }
  };

  if (viewMode === "gestion" && selectedDebt) {
    const schedule = buildAmortizationSchedule(selectedDebt, transactions);
    const progress = loanProgress(selectedDebt);
    const capitalPaid = Math.max(
      Number(selectedDebt.initialAmount) - Number(selectedDebt.currentBalance),
      0
    );
    const chartRows = schedule.rows.map((row) => ({
      month: row.installment,
      label: `Mes ${row.installment}`,
      saldo: Math.round(row.balance),
      capital: Math.round(row.capital),
      interes: Math.round(row.interest),
    }));
    const paidPercent =
      selectedDebt.initialAmount > 0
        ? (capitalPaid / selectedDebt.initialAmount) * 100
        : 0;

    return (
      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => setSelectedDebtId(null)}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Gestion
          </button>
          <button
            onClick={() => {
              setSelectedDebtId(null);
              editDebt(selectedDebt);
            }}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            <Edit3 className="h-4 w-4" />
            Editar prestamo
          </button>
        </div>

        <div className="glass p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{selectedDebt.name}</h2>
              <p className="mt-2 text-sm text-white/55">{typeLabel(selectedDebt.type)}</p>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-xs text-white/50">Estado del prestamo</p>
              <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-300/20">
                <CheckCircle2 className="h-4 w-4" />
                {Number(selectedDebt.currentBalance) <= 0 ? "Pagado" : "Activo"}
              </span>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div>
              <p className="text-sm text-white/45">Monto Original</p>
              <p className="mt-1 text-lg font-semibold">{money(selectedDebt.initialAmount)}</p>
            </div>
            <div>
              <p className="text-sm text-white/45">Saldo Pendiente</p>
              <p className="mt-1 text-lg font-semibold text-rose-200">{money(selectedDebt.currentBalance)}</p>
            </div>
            <div>
              <p className="text-sm text-white/45">Tasa de Interes</p>
              <p className="mt-1 text-lg font-semibold">{selectedDebt.interestRate}%</p>
            </div>
            <div>
              <p className="text-sm text-white/45">Cuota Mensual</p>
              <p className="mt-1 text-lg font-semibold">{money(selectedDebt.monthlyPayment)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-blue-600 p-5 text-white shadow-xl shadow-blue-950/20">
            <div className="mb-4 inline-flex rounded-2xl bg-white/20 p-3">
              <DollarSign className="h-5 w-5" />
            </div>
            <p className="text-sm text-white/80">Capital Pagado</p>
            <p className="mt-2 text-2xl font-semibold">{money(capitalPaid)}</p>
            <p className="mt-2 text-xs text-white/80">{paidPercent.toFixed(1)}% del total</p>
          </div>
          <div className="rounded-2xl bg-orange-500 p-5 text-white shadow-xl shadow-orange-950/20">
            <div className="mb-4 inline-flex rounded-2xl bg-white/20 p-3">
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-sm text-white/80">Intereses Pagados</p>
            <p className="mt-2 text-2xl font-semibold">{money(schedule.paidInterest)}</p>
            <p className="mt-2 text-xs text-white/80">de {money(schedule.totalInterest)} totales</p>
          </div>
          <div className="rounded-2xl bg-emerald-600 p-5 text-white shadow-xl shadow-emerald-950/20">
            <div className="mb-4 inline-flex rounded-2xl bg-white/20 p-3">
              <CalendarDays className="h-5 w-5" />
            </div>
            <p className="text-sm text-white/80">Meses Pagados</p>
            <p className="mt-2 text-2xl font-semibold">{schedule.paidMonths}</p>
            <p className="mt-2 text-xs text-white/80">de {schedule.rows.length} totales</p>
          </div>
          <div className="rounded-2xl bg-fuchsia-600 p-5 text-white shadow-xl shadow-fuchsia-950/20">
            <div className="mb-4 inline-flex rounded-2xl bg-white/20 p-3">
              <Clock3 className="h-5 w-5" />
            </div>
            <p className="text-sm text-white/80">Meses Restantes</p>
            <p className="mt-2 text-2xl font-semibold">{schedule.remainingMonths}</p>
            <p className="mt-2 text-xs text-white/80">Fin: {longDate(schedule.finalDate)}</p>
          </div>
        </div>

        <div className="glass p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-200 ring-1 ring-cyan-300/20">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Historial del prestamo</h3>
              <p className="mt-1 text-sm text-white/55">
                Carga un PDF con el historico de pagos para asociarlo a este prestamo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
            <label className="text-sm text-white/70">
              Archivo PDF
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => {
                  setHistoryFile(event.target.files?.[0] ?? null);
                  setHistoryPreviewRows([]);
                  setHistorySummary(null);
                  setHistoryError(null);
                }}
                className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-950"
              />
            </label>
            <button
              onClick={() => previewDebtHistory(selectedDebt.id)}
              disabled={historyLoading || !historyFile}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Vista previa
            </button>
            <button
              onClick={() => importDebtHistory(selectedDebt.id)}
              disabled={historyLoading || historyPreviewRows.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              Importar historial
            </button>
          </div>

          {historyError && (
            <div className="mt-4 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-rose-300/20">
              {historyError}
            </div>
          )}

          {historySummary && (
            <div className="mt-4 rounded-2xl bg-emerald-400/10 p-3 text-sm text-emerald-100 ring-1 ring-emerald-300/20">
              Historial importado: {historySummary.created} pago(s) creados, {historySummary.skipped} duplicado(s) omitidos, {historySummary.total} detectados.
            </div>
          )}

          {historyPreviewRows.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 text-white/55">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Cuota</th>
                    <th className="px-4 py-3 text-left font-medium">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium">Descripcion</th>
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                    <th className="px-4 py-3 text-right font-medium">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {historyPreviewRows.slice(0, 80).map((row) => (
                    <tr key={`${row.date}-${row.amount}-${row.installment}`} className="border-t border-white/10">
                      <td className="px-4 py-3 font-semibold">#{row.installment}</td>
                      <td className="px-4 py-3 text-white/75">{row.date}</td>
                      <td className="max-w-md px-4 py-3 text-white/75">{row.description}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
                          row.status === "Pagado"
                            ? "bg-emerald-400/10 text-emerald-100 ring-emerald-300/20"
                            : "bg-amber-400/10 text-amber-100 ring-amber-300/20"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="glass p-5">
            <h3 className="text-base font-semibold">Evolucion de la Deuda</h3>
            <p className="mt-1 text-sm text-white/55">Proyeccion del saldo en el tiempo</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows}>
                  <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(value) => compactMoney(Number(value))} />
                  <Tooltip formatter={(value) => money(Number(value))} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }} />
                  <Legend />
                  <Line type="monotone" dataKey="saldo" name="Saldo Pendiente" stroke="#fb7185" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass p-5">
            <h3 className="text-base font-semibold">Capital vs Interes</h3>
            <p className="mt-1 text-sm text-white/55">Primeros 24 meses</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows.slice(0, 24)}>
                  <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(value) => compactMoney(Number(value))} />
                  <Tooltip formatter={(value) => money(Number(value))} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }} />
                  <Legend />
                  <Bar dataKey="capital" name="Capital" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="interes" name="Interes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="glass overflow-hidden p-0">
          <div className="border-b border-white/10 p-5">
            <h3 className="text-base font-semibold">Tabla de Amortizacion</h3>
            <p className="mt-1 text-sm text-white/55">Calendario completo de pagos</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-white/50">
                <tr>
                  <th className="px-5 py-4 text-left font-semibold">Mes</th>
                  <th className="px-5 py-4 text-left font-semibold">Fecha</th>
                  <th className="px-5 py-4 text-right font-semibold">Cuota</th>
                  <th className="px-5 py-4 text-right font-semibold">Capital</th>
                  <th className="px-5 py-4 text-right font-semibold">Interes</th>
                  <th className="px-5 py-4 text-right font-semibold">Saldo</th>
                  <th className="px-5 py-4 text-left font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {schedule.rows.slice(0, 24).map((row) => (
                  <tr key={row.installment} className="border-t border-white/10">
                    <td className="px-5 py-4 font-semibold">{row.installment}</td>
                    <td className="px-5 py-4 text-white/65">{longDate(row.date)}</td>
                    <td className="px-5 py-4 text-right font-semibold">{money(row.payment)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-blue-200">{money(row.capital)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-amber-200">{money(row.interest)}</td>
                    <td className="px-5 py-4 text-right font-semibold">{money(row.balance)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                        row.status === "Pagado"
                          ? "bg-emerald-400/10 text-emerald-100 ring-emerald-300/20"
                          : "bg-amber-400/10 text-amber-100 ring-amber-300/20"
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {schedule.rows.length > 24 && (
            <div className="border-t border-white/10 p-5 text-center text-sm text-white/55">
              Mostrando primeros 24 pagos de {schedule.rows.length} meses.
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="glass p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {viewMode === "gestion" ? "Gestion de Prestamos" : "Control de deudas"}
            </h2>
            <p className="mt-1 text-sm text-white/60">
              {viewMode === "gestion"
                ? "Control y seguimiento de tus obligaciones financieras."
                : "Registra tus deudas, compara estrategias y simula pagos."}
            </p>
          </div>
          {viewMode === "gestion" ? (
            <button
              onClick={openNewDebtForm}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-black/20 ring-1 ring-white/10 transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Nuevo Prestamo
            </button>
          ) : (
            <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-200 ring-1 ring-cyan-300/20">
              <Landmark className="h-5 w-5" />
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-rose-300/20">
            {error}
          </div>
        )}

        {viewMode === "gestion" && (showDebtForm || editingId) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <label className="text-sm text-white/70">
            Banco / tipo
            <CustomSelect
              value={form.name}
              onChange={(value) => setForm({ ...form, name: value })}
              placeholder="Selecciona banco"
              options={bankOptions}
              searchable
              searchPlaceholder="Buscar banco"
            />
          </label>
          <label className="text-sm text-white/70">
            Monto inicial
            <input value={form.initialAmount} onChange={(e) => setForm({ ...form, initialAmount: formatAmountInput(e.target.value) })} placeholder="0.00" inputMode="decimal" className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60" />
          </label>
          <label className="text-sm text-white/70">
            Balance actual
            <input value={form.currentBalance} onChange={(e) => setForm({ ...form, currentBalance: formatAmountInput(e.target.value) })} placeholder="0.00" inputMode="decimal" className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60" />
          </label>
          <label className="text-sm text-white/70">
            Tasa interes %
            <input value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} placeholder="0" inputMode="decimal" className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60" />
          </label>
          <label className="text-sm text-white/70">
            Cuota mensual
            <input value={form.monthlyPayment} onChange={(e) => setForm({ ...form, monthlyPayment: formatAmountInput(e.target.value) })} placeholder="0.00" inputMode="decimal" className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60" />
          </label>
          <label className="text-sm text-white/70">
            Fecha apertura prestamo
            <input type="date" value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })} className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60" />
          </label>
          <label className="text-sm text-white/70">
            Dia pago
            <input value={form.paymentDay} onChange={(e) => setForm({ ...form, paymentDay: e.target.value })} placeholder="1-31" inputMode="numeric" className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60" />
          </label>
          <label className="text-sm text-white/70">
            Tipo de deuda
            <CustomSelect
              value={form.type}
              onChange={(value) => setForm({ ...form, type: value as DebtType })}
              options={debtTypeOptions}
            />
          </label>
          <div className="flex items-end gap-2">
            {(editingId || showDebtForm) && (
              <button onClick={resetForm} className="inline-flex items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-sm text-white ring-1 ring-white/15 hover:bg-white/15">
                <X className="h-4 w-4" />
              </button>
            )}
            <button onClick={saveDebt} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60">
              {editingId ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Agregar"}
            </button>
          </div>
        </div>
        )}
      </div>

      {viewMode === "listado" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="glass p-5">
              <p className="text-sm text-white/55">Total activos</p>
              <p className="mt-2 text-2xl font-semibold">{activeLoans.length}</p>
            </div>
            <div className="glass p-5">
              <p className="text-sm text-white/55">Al corriente</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-200">{loansInGoodStanding}</p>
            </div>
            <div className="glass p-5">
              <p className="text-sm text-white/55">En mora</p>
              <p className="mt-2 text-2xl font-semibold text-amber-200">{loansOverdue}</p>
            </div>
            <div className="glass p-5">
              <p className="text-sm text-white/55">Saldo total</p>
              <p className="mt-2 text-2xl font-semibold">{money(summary.totalCurrentDebt)}</p>
            </div>
          </div>

          <div className="glass p-5">
            <div className="mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-cyan-200" />
              <h3 className="text-base font-semibold">Filtros y búsqueda</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_260px]">
              <label className="text-sm text-white/70">
                Buscar
                <input
                  value={loanSearch}
                  onChange={(event) => setLoanSearch(event.target.value)}
                  placeholder="ID, entidad o tipo..."
                  className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60"
                />
              </label>
              <label className="text-sm text-white/70">
                Estado
                <CustomSelect
                  value={loanStatusFilter}
                  onChange={setLoanStatusFilter}
                  options={loanStatusOptions}
                />
              </label>
            </div>
          </div>

          <div className="glass p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold">Lista de préstamos</h3>
              <p className="mt-1 text-sm text-white/55">
                {loanRows.length} préstamo(s) encontrado(s)
              </p>
            </div>

            {loading ? (
              <div className="rounded-2xl bg-white/5 p-6 text-center text-sm text-white/55 ring-1 ring-white/10">
                Cargando préstamos...
              </div>
            ) : activeLoans.length === 0 ? (
              <div className="rounded-2xl bg-white/5 p-8 text-center text-sm text-white/60 ring-1 ring-white/10">
                No hay préstamos disponibles para visualizar.
              </div>
            ) : loanRows.length === 0 ? (
              <div className="rounded-2xl bg-white/5 p-8 text-center text-sm text-white/60 ring-1 ring-white/10">
                No hay préstamos que coincidan con los filtros actuales.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl ring-1 ring-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 text-white/60">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">ID</th>
                      <th className="px-4 py-3 text-left font-medium">Entidad</th>
                      <th className="px-4 py-3 text-left font-medium">Tipo</th>
                      <th className="px-4 py-3 text-right font-medium">Saldo</th>
                      <th className="px-4 py-3 text-right font-medium">Pago mensual</th>
                      <th className="px-4 py-3 text-left font-medium">Próximo pago</th>
                      <th className="px-4 py-3 text-left font-medium">Estado</th>
                      <th className="px-4 py-3 text-left font-medium">Progreso</th>
                      <th className="px-4 py-3 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loanRows.map((row) => {
                      const nextDueDate = getDueDate(
                        row.debt,
                        row.installmentStatus.currentInstallment
                      );
                      const isOverdue = row.state === "En mora";

                      return (
                        <tr key={row.debt.id} className="border-t border-white/10">
                          <td className="px-4 py-3 font-semibold text-white/85">{row.code}</td>
                          <td className="px-4 py-3 text-white/80">{row.debt.name}</td>
                          <td className="px-4 py-3 text-white/70">{typeLabel(row.debt.type)}</td>
                          <td className="px-4 py-3 text-right font-semibold">{money(row.debt.currentBalance)}</td>
                          <td className="px-4 py-3 text-right">{money(row.debt.monthlyPayment)}</td>
                          <td className="px-4 py-3 text-white/75">
                            {shortDate(nextDueDate)}
                            {isOverdue && (
                              <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-1 text-xs font-semibold text-rose-200 ring-1 ring-rose-300/20">
                                Mora
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
                              isOverdue
                                ? "bg-amber-400/10 text-amber-100 ring-amber-300/20"
                                : "bg-emerald-400/10 text-emerald-100 ring-emerald-300/20"
                            }`}>
                              {row.state}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="h-2 w-28 rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-cyan-300"
                                style={{ width: `${row.progress.percent}%` }}
                              />
                            </div>
                            <p className="mt-1 text-xs text-white/50">
                              {row.progress.paidPayments}/{row.progress.totalPayments} pagos
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => editDebt(row.debt)}
                              className="rounded-xl bg-white/5 p-2 text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                              title="Ver / editar"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
      <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-blue-600 p-5 text-white shadow-xl shadow-blue-950/20">
          <div className="mb-5 inline-flex rounded-2xl bg-white/20 p-3">
            <TrendingUp className="h-5 w-5" />
          </div>
          <p className="text-sm text-white/80">Prestamos Activos</p>
          <p className="mt-2 text-3xl font-semibold">{activeLoans.length}</p>
        </div>
        <div className="rounded-2xl bg-rose-600 p-5 text-white shadow-xl shadow-rose-950/20">
          <div className="mb-5 inline-flex rounded-2xl bg-white/20 p-3">
            <DollarSign className="h-5 w-5" />
          </div>
          <p className="text-sm text-white/80">Deuda Total</p>
          <p className="mt-2 text-3xl font-semibold">{money(summary.totalCurrentDebt)}</p>
        </div>
        <div className="rounded-2xl bg-orange-500 p-5 text-white shadow-xl shadow-orange-950/20">
          <div className="mb-5 inline-flex rounded-2xl bg-white/20 p-3">
            <CalendarDays className="h-5 w-5" />
          </div>
          <p className="text-sm text-white/80">Pago Mensual Total</p>
          <p className="mt-2 text-3xl font-semibold">{money(totalMonthlyPayments)}</p>
        </div>
        <div className="rounded-2xl bg-emerald-600 p-5 text-white shadow-xl shadow-emerald-950/20">
          <div className="mb-5 inline-flex rounded-2xl bg-white/20 p-3">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="text-sm text-white/80">Prestamos Pagados</p>
          <p className="mt-2 text-3xl font-semibold">{paidLoans}</p>
        </div>
      </div>

      <div className="glass p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
            <input
              value={loanSearch}
              onChange={(event) => setLoanSearch(event.target.value)}
              placeholder="Buscar prestamo o acreedor..."
              className="w-full rounded-xl bg-white/10 py-3 pl-11 pr-4 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60"
            />
          </label>
          <CustomSelect
            value={loanStatusFilter}
            onChange={setLoanStatusFilter}
            options={loanStatusOptions}
          />
          <button className="inline-flex items-center justify-center rounded-xl bg-white/10 px-4 py-3 text-white ring-1 ring-white/15 transition hover:bg-white/15">
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="hidden">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold">Estrategia de pago</h3>
            <p className="mt-1 text-sm text-white/55">
              {strategy === "snowball" ? "Snowball: prioriza la deuda mas pequena." : "Avalanche: prioriza la tasa de interes mas alta."}
            </p>
          </div>
          <div className="grid grid-cols-2 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
            <button onClick={() => setStrategy("snowball")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${strategy === "snowball" ? "bg-white text-slate-950" : "text-white/65 hover:text-white"}`}>Snowball</button>
            <button onClick={() => setStrategy("avalanche")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${strategy === "avalanche" ? "bg-white text-slate-950" : "text-white/65 hover:text-white"}`}>Avalanche</button>
          </div>
        </div>

        {summary.priorityDebt && (
          <div className="mt-4 rounded-2xl bg-cyan-300/10 p-4 text-sm text-cyan-100 ring-1 ring-cyan-300/20">
            Deuda prioritaria sugerida: <span className="font-semibold">{summary.priorityDebt.debt.name}</span>
          </div>
        )}
      </div>

      {false && alerts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-100 ring-1 ring-amber-300/20">
              <p className="font-semibold">{alert.title}</p>
              <p className="mt-1 leading-6 text-amber-50/75">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {loading ? (
          <div className="glass p-6 text-center text-sm text-white/55 xl:col-span-2">Cargando deudas...</div>
        ) : activeLoans.length === 0 ? (
          <div className="glass p-8 text-center text-sm text-white/55 xl:col-span-2">No hay prestamos disponibles para visualizar.</div>
        ) : loanRows.length === 0 ? (
          <div className="glass p-8 text-center text-sm text-white/55 xl:col-span-2">No hay prestamos que coincidan con los filtros actuales.</div>
        ) : (
          summary.analyses.filter((analysis) => visibleLoanIds.has(analysis.debt.id)).map((analysis) => {
            const debt = analysis.debt;
            const progress = debt.initialAmount > 0 ? Math.min(((debt.initialAmount - debt.currentBalance) / debt.initialAmount) * 100, 100) : 0;
            const isPriority = summary.priorityDebt?.debt.id === debt.id;
            const installmentStatus = getInstallmentStatus(debt, transactions);

            return (
              <div key={debt.id} className={`glass p-5 ${isPriority ? "ring-2 ring-cyan-300/40" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-base font-semibold">{debt.name}</h3>
                      {isPriority && <span className="rounded-full bg-cyan-300/15 px-2 py-1 text-xs text-cyan-100 ring-1 ring-cyan-300/20">Prioritaria</span>}
                    </div>
                    <p className="mt-1 text-sm text-white/50">{typeLabel(debt.type)} · Apertura {String(debt.openingDate || debt.createdAt).slice(0, 10)} · Pago dia {debt.paymentDay}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editDebt(debt)} className="rounded-xl bg-white/5 p-2 text-white/70 ring-1 ring-white/10 hover:bg-white/10"><Edit3 className="h-4 w-4" /></button>
                    <button onClick={() => setDeleteTarget(debt)} className="rounded-xl bg-rose-500/10 p-2 text-rose-200 ring-1 ring-rose-300/20 hover:bg-rose-500/15"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="mt-4 h-2.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${progress}%` }} /></div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div><p className="text-white/45">Balance</p><p className="mt-1 font-semibold">{money(debt.currentBalance)}</p></div>
                  <div><p className="text-white/45">Interes est.</p><p className="mt-1 font-semibold">{money(analysis.estimatedMonthlyInterest)}</p></div>
                  <div><p className="text-white/45">Tasa</p><p className="mt-1 font-semibold">{debt.interestRate}%</p></div>
                  <div><p className="text-white/45">Pago actual</p><p className="mt-1 font-semibold">{money(debt.monthlyPayment)}</p></div>
                </div>

                <button
                  onClick={() => setSelectedDebtId(debt.id)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/15"
                >
                  Ver detalles y calendario
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="mt-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Estado de cuotas</p>
                      {installmentStatus.rows.length > 0 ? (
                        <p className="mt-1 text-sm text-white/55">
                          {installmentStatus.overdueCount > 0
                            ? `${installmentStatus.overdueCount} cuota(s) pendiente(s)`
                            : `Cuota #${installmentStatus.currentInstallment} pendiente`}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm font-semibold text-emerald-200">
                          Todo al dia
                        </p>
                      )}
                    </div>
                    <div className={`rounded-2xl px-3 py-2 text-sm ring-1 ${
                      installmentStatus.overdueCount > 0
                        ? "bg-rose-500/10 text-rose-100 ring-rose-300/20"
                        : "bg-emerald-400/10 text-emerald-100 ring-emerald-300/20"
                    }`}>
                      {installmentStatus.overdueCount > 0
                        ? `${installmentStatus.overdueCount} atraso(s) · ${money(installmentStatus.overdueAmount)}`
                        : "Sin atrasos"}
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-white/10">
                    <div className="grid grid-cols-[70px_1fr_1fr_1fr] bg-white/5 px-3 py-2 text-xs font-semibold text-white/50">
                      <span>Cuota</span>
                      <span>Vence</span>
                      <span>Pagado</span>
                      <span>Restante</span>
                    </div>
                    {installmentStatus.rows.length === 0 ? (
                      <div className="px-3 py-4 text-sm font-semibold text-emerald-200">
                        Todo al dia
                      </div>
                    ) : (
                      installmentStatus.rows.map((row) => (
                        <div
                          key={row.installment}
                          className="grid grid-cols-[70px_1fr_1fr_1fr] border-t border-white/10 px-3 py-2 text-sm"
                        >
                          <span className="font-semibold text-white/85">#{row.installment}</span>
                          <span className={row.isOverdue ? "text-rose-200" : "text-white/65"}>
                            {shortDate(row.dueDate)}
                          </span>
                          <span className="text-white/80">{money(row.paid)}</span>
                          <span className={row.remaining > 0 ? "font-semibold text-amber-200" : "text-emerald-200"}>
                            {money(row.remaining)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl shadow-black/50">
            <h3 className="text-base font-semibold">Eliminar deuda</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/65">Estas seguro de que deseas eliminar <span className="font-semibold text-white">{deleteTarget.name}</span>?</p>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button onClick={() => setDeleteTarget(null)} disabled={saving} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15">No</button>
              <button onClick={() => deleteDebt(deleteTarget)} disabled={saving} className="rounded-xl bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-rose-300 disabled:opacity-60">Si</button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </section>
  );
}
