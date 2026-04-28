"use client";

import { Edit3, Landmark, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getDebtAlerts,
  getDebtControlSummary,
  simulateDebtPayoff,
  type DebtStrategy,
} from "@/lib/debt-control";
import { CustomSelect } from "@/components/ui/CustomSelect";
import type { Debt, DebtType } from "@/lib/types";
import { useFinanceStore } from "@/store/financeStore";

const debtTypes: { value: DebtType; label: string }[] = [
  { value: "TARJETA", label: "Tarjeta" },
  { value: "PRESTAMO_PERSONAL", label: "Prestamo personal" },
  { value: "VEHICULO", label: "Vehiculo" },
  { value: "HIPOTECA", label: "Hipoteca" },
  { value: "OTRO", label: "Otro" },
];

const dominicanBanks = [
  "Banco de Reservas",
  "Banco Popular Dominicano",
  "Banco BHD",
  "Banco Santa Cruz",
  "Scotiabank",
  "Banco Promerica",
  "Banesco",
  "Banco Caribe",
  "Banco Ademi",
  "Banco Vimenca",
  "Banco Lopez de Haro",
  "Banco BDI",
  "Banco Lafise",
  "Banco Activo Dominicana",
  "Bancamerica",
  "BellBank",
  "Citibank",
  "Banco Agricola",
  "Asociacion Popular de Ahorros y Prestamos",
  "Asociacion Cibao de Ahorros y Prestamos",
  "Asociacion La Nacional de Ahorros y Prestamos",
  "Asociacion Duarte de Ahorros y Prestamos",
  "Asociacion Mocana de Ahorros y Prestamos",
  "Asociacion Romana de Ahorros y Prestamos",
  "Asociacion Peravia de Ahorros y Prestamos",
  "Asociacion Bonao de Ahorros y Prestamos",
  "Motor Credito",
  "Banco Fihogar",
  "Banco Union",
  "Banco Confisa",
  "Banco Empire",
  "Banco JMMB Bank",
  "Otro / No listado",
];

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

function monthLabel(months: number | null) {
  if (months === null) return "No amortiza";
  if (months === 0) return "Pagada";
  if (months === 1) return "1 mes";
  return `${months} meses`;
}

export function DebtControlPanel() {
  const transactions = useFinanceStore((state) => state.transactions);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [strategy, setStrategy] = useState<DebtStrategy>("avalanche");
  const [period, setPeriod] = useState(currentPeriod());
  const [extraPayments, setExtraPayments] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    initialAmount: "",
    currentBalance: "",
    interestRate: "",
    monthlyPayment: "",
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

  const summary = useMemo(
    () => getDebtControlSummary({ debts, transactions, strategy, period }),
    [debts, transactions, strategy, period]
  );
  const alerts = useMemo(
    () => getDebtAlerts(summary, strategy),
    [summary, strategy]
  );
  const bankOptions = useMemo(() => {
    const banks = !form.name || dominicanBanks.includes(form.name)
      ? dominicanBanks
      : [form.name, ...dominicanBanks];
    return banks.map((bank) => ({ value: bank, label: bank }));
  }, [form.name]);
  const debtTypeOptions = useMemo(
    () => debtTypes.map((type) => ({ value: type.value, label: type.label })),
    []
  );

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: "",
      initialAmount: "",
      currentBalance: "",
      interestRate: "",
      monthlyPayment: "",
      paymentDay: String(new Date().getDate()),
      type: "TARJETA",
    });
    setError(null);
  };

  const editDebt = (debt: Debt) => {
    setEditingId(debt.id);
    setForm({
      name: debt.name,
      initialAmount: formatAmountInput(String(debt.initialAmount)),
      currentBalance: formatAmountInput(String(debt.currentBalance)),
      interestRate: String(debt.interestRate),
      monthlyPayment: formatAmountInput(String(debt.monthlyPayment)),
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
      paymentDay: Number(form.paymentDay),
      type: form.type,
    };

    if (!payload.name) return setError("El nombre es obligatorio.");
    if (payload.initialAmount <= 0) return setError("El monto inicial debe ser mayor que cero.");
    if (payload.currentBalance > payload.initialAmount) {
      return setError("El balance actual no puede ser mayor que el monto inicial.");
    }

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

  return (
    <section className="space-y-4">
      <div className="glass p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Control de deudas</h2>
            <p className="mt-1 text-sm text-white/60">
              Registra tus deudas, compara estrategias y simula pagos.
            </p>
          </div>
          <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-200 ring-1 ring-cyan-300/20">
            <Landmark className="h-5 w-5" />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-rose-300/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <CustomSelect
            value={form.name}
            onChange={(value) => setForm({ ...form, name: value })}
            placeholder="Selecciona banco"
            options={bankOptions}
          />
          <input value={form.initialAmount} onChange={(e) => setForm({ ...form, initialAmount: formatAmountInput(e.target.value) })} placeholder="Monto inicial" inputMode="decimal" className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60" />
          <input value={form.currentBalance} onChange={(e) => setForm({ ...form, currentBalance: formatAmountInput(e.target.value) })} placeholder="Balance actual" inputMode="decimal" className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60" />
          <input value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} placeholder="Tasa interes %" inputMode="decimal" className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60" />
          <input value={form.monthlyPayment} onChange={(e) => setForm({ ...form, monthlyPayment: formatAmountInput(e.target.value) })} placeholder="Cuota mensual" inputMode="decimal" className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60" />
          <input value={form.paymentDay} onChange={(e) => setForm({ ...form, paymentDay: e.target.value })} placeholder="Dia pago" inputMode="numeric" className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60" />
          <CustomSelect
            value={form.type}
            onChange={(value) => setForm({ ...form, type: value as DebtType })}
            options={debtTypeOptions}
          />
          <div className="flex gap-2">
            {editingId && (
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
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="glass p-5"><p className="text-sm text-white/50">Total deuda actual</p><p className="mt-2 text-2xl font-semibold">{money(summary.totalCurrentDebt)}</p></div>
        <div className="glass p-5"><p className="text-sm text-white/50">Interes mensual estimado</p><p className="mt-2 text-2xl font-semibold">{money(summary.totalEstimatedInterest)}</p></div>
        <div className="glass p-5"><p className="text-sm text-white/50">% deuda vs ingresos</p><p className="mt-2 text-2xl font-semibold">{summary.debtToIncomePercent.toFixed(1)}%</p></div>
        <label className="glass p-5 text-sm text-white/70">
          Periodo ingreso
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="mt-2 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-cyan-300/60" />
        </label>
      </div>

      <div className="glass p-5">
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

      {alerts.length > 0 && (
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
        ) : debts.length === 0 ? (
          <div className="glass p-6 text-center text-sm text-white/55 xl:col-span-2">Aun no tienes deudas registradas.</div>
        ) : (
          summary.analyses.map((analysis) => {
            const debt = analysis.debt;
            const progress = debt.initialAmount > 0 ? Math.min(((debt.initialAmount - debt.currentBalance) / debt.initialAmount) * 100, 100) : 0;
            const extra = parseAmountInput(extraPayments[debt.id] ?? "");
            const simulation = simulateDebtPayoff({ debt, extraPayment: extra });
            const isPriority = summary.priorityDebt?.debt.id === debt.id;

            return (
              <div key={debt.id} className={`glass p-5 ${isPriority ? "ring-2 ring-cyan-300/40" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-base font-semibold">{debt.name}</h3>
                      {isPriority && <span className="rounded-full bg-cyan-300/15 px-2 py-1 text-xs text-cyan-100 ring-1 ring-cyan-300/20">Prioritaria</span>}
                    </div>
                    <p className="mt-1 text-sm text-white/50">{typeLabel(debt.type)} · Pago dia {debt.paymentDay}</p>
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

                <div className="mt-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="text-sm text-white/70">
                      Pago extra mensual
                      <input value={extraPayments[debt.id] ?? ""} onChange={(e) => setExtraPayments({ ...extraPayments, [debt.id]: formatAmountInput(e.target.value) })} placeholder="0.00" inputMode="decimal" className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60" />
                    </label>
                    <div className="text-sm">
                      <p className="text-white/45">Tiempo estimado</p>
                      <p className="font-semibold text-white">{monthLabel(simulation.monthsToPayoff)}</p>
                      {simulation.monthsSaved !== null && simulation.monthsSaved > 0 && <p className="text-xs text-emerald-200">Ahorras {simulation.monthsSaved} mes(es)</p>}
                    </div>
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
    </section>
  );
}
