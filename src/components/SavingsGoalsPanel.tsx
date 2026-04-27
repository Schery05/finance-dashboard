"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import type { SavingsGoal, Transaction } from "@/lib/types";
import { useFinanceStore } from "@/store/financeStore";

type GoalSuggestion = {
  name: string;
  targetAmount: number;
};

const suggestions: GoalSuggestion[] = [
  { name: "Fondo de emergencia", targetAmount: 150000 },
  { name: "Inicial de vivienda", targetAmount: 500000 },
  { name: "Vacaciones", targetAmount: 120000 },
  { name: "Vehiculo", targetAmount: 350000 },
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

  if (decimals !== undefined) {
    return `${formattedInteger}.${decimals.slice(0, 2)}`;
  }

  return formattedInteger;
};

const dateLabel = (date: string) => {
  if (!date) return "Sin fecha limite";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Sin fecha limite";
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const isSavingsTransaction = (t: Transaction) => {
  const category = String(t.Categoría ?? "").toLowerCase();
  const description = String(t.DescripcionAdicional ?? "").toLowerCase();
  return category.includes("ahorro") || description.includes("ahorro");
};

const getTransactionLabel = (t: Transaction) => {
  const category = String(t.Categoría ?? "Sin categoria");
  const description = String(t.DescripcionAdicional ?? "").trim();
  return description ? `${category} - ${description}` : category;
};

export function SavingsGoalsPanel() {
  const transactions = useFinanceStore((state) => state.transactions);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<SavingsGoal | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/savings-goals", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "No se pudieron cargar las metas");
      const data = json.data as SavingsGoal[];
      setGoals(data);
      setActiveGoalId((current) => current ?? data[0]?.ID ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando metas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const txById = useMemo(() => {
    return new Map(transactions.map((tx) => [tx.ID, tx]));
  }, [transactions]);

  const savingsTransactions = useMemo(() => {
    return transactions
      .filter((tx) => tx.ID && Number(tx.Importe) > 0 && isSavingsTransaction(tx))
      .sort((a, b) => String(b.Fecha).localeCompare(String(a.Fecha)));
  }, [transactions]);

  const transactionGoalMap = useMemo(() => {
    const map = new Map<string, SavingsGoal>();

    for (const goal of goals) {
      for (const txId of goal.TransaccionesAsociadas) {
        map.set(txId, goal);
      }
    }

    return map;
  }, [goals]);

  const activeGoal = goals.find((goal) => goal.ID === activeGoalId) ?? goals[0];

  const goalProgress = (goal: SavingsGoal) => {
    const transactionTotal = goal.TransaccionesAsociadas.reduce((sum, id) => {
      const tx = txById.get(id);
      return sum + (Number(tx?.Importe) || 0);
    }, 0);
    const initial = Number(goal.SaldoInicial) || 0;
    const current = initial + transactionTotal;
    const percent =
      goal.MontoObjetivo > 0
        ? Math.min((current / goal.MontoObjetivo) * 100, 100)
        : 0;
    return {
      current,
      initial,
      transactionTotal,
      percent,
      remaining: Math.max(goal.MontoObjetivo - current, 0),
    };
  };

  const createGoal = async () => {
    const amount = parseAmountInput(targetAmount);
    const initial = parseAmountInput(initialBalance);
    if (!name.trim() || amount <= 0 || saving) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/savings-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Nombre: name.trim(),
          MontoObjetivo: amount,
          FechaLimite: dueDate,
          TransaccionesAsociadas: [],
          SaldoInicial: initial,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "No se pudo crear la meta");

      setName("");
      setTargetAmount("");
      setInitialBalance("");
      setDueDate("");
      await fetchGoals();
      setActiveGoalId(String(json.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando meta");
    } finally {
      setSaving(false);
    }
  };

  const applySuggestion = (suggestion: GoalSuggestion) => {
    setName(suggestion.name);
    setTargetAmount(formatAmountInput(String(suggestion.targetAmount)));
  };

  const updateGoal = async (goal: SavingsGoal) => {
    const res = await fetch("/api/savings-goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: goal.ID,
        goal,
      }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "No se pudo actualizar la meta");
  };

  const deleteGoal = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/savings-goals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "No se pudo eliminar la meta");

      const next = goals.filter((goal) => goal.ID !== id);
      setGoals(next);
      setActiveGoalId(next[0]?.ID ?? null);
      setGoalToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando meta");
    } finally {
      setSaving(false);
    }
  };

  const toggleTransaction = async (goalId: string, txId: string) => {
    const goal = goals.find((item) => item.ID === goalId);
    if (!goal || saving) return;

    const ownerGoal = transactionGoalMap.get(txId);
    if (ownerGoal && ownerGoal.ID !== goalId) return;

    const exists = goal.TransaccionesAsociadas.includes(txId);
    const updatedGoal = {
      ...goal,
      TransaccionesAsociadas: exists
        ? goal.TransaccionesAsociadas.filter((id) => id !== txId)
        : [...goal.TransaccionesAsociadas, txId],
    };

    setGoals((prev) =>
      prev.map((item) => (item.ID === goalId ? updatedGoal : item))
    );

    try {
      await updateGoal(updatedGoal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando meta");
      setGoals((prev) => prev.map((item) => (item.ID === goalId ? goal : item)));
    }
  };

  return (
    <section className="space-y-4">
      {error && (
        <div className="glass p-4 text-sm text-rose-200 ring-1 ring-rose-500/20">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <div className="glass p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Metas de ahorro</h2>
              <p className="mt-1 text-sm text-white/60">
                Crea una meta y asocia transacciones de ahorro.
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300 ring-1 ring-emerald-300/20">
              <Target className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la meta"
              className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-emerald-300/60"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={targetAmount}
                onChange={(e) => setTargetAmount(formatAmountInput(e.target.value))}
                placeholder="Monto objetivo"
                inputMode="decimal"
                className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-emerald-300/60"
              />
              <input
                value={initialBalance}
                onChange={(e) =>
                  setInitialBalance(formatAmountInput(e.target.value))
                }
                placeholder="Ya ahorrado"
                inputMode="decimal"
                className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-emerald-300/60"
              />
              <input
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                type="date"
                className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-emerald-300/60 sm:col-span-2"
              />
            </div>
            <button
              onClick={createGoal}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Agregar meta
            </button>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-white/45">
              Sugerencias
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.name}
                  onClick={() => applySuggestion(suggestion)}
                  className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/75 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                >
                  {suggestion.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {loading ? (
            <div className="glass flex min-h-[260px] items-center justify-center gap-2 p-6 text-sm text-white/55 lg:col-span-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando metas...
            </div>
          ) : goals.length === 0 ? (
            <div className="glass flex min-h-[260px] items-center justify-center p-6 text-center text-sm text-white/55 lg:col-span-2">
              Aun no tienes metas. Elige una sugerencia o crea tu primera meta.
            </div>
          ) : (
            goals.map((goal) => {
              const progress = goalProgress(goal);
              const selected = activeGoal?.ID === goal.ID;

              return (
                <button
                  key={goal.ID}
                  onClick={() => setActiveGoalId(goal.ID)}
                  className={`glass p-5 text-left transition ${
                    selected ? "ring-2 ring-emerald-300/50" : "hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-semibold">
                        {goal.Nombre}
                      </h3>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {dateLabel(goal.FechaLimite)}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/70">
                      {progress.percent.toFixed(0)}%
                    </span>
                  </div>

                  <div className="mt-4 h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-300"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-white/45">Ahorrado</p>
                      <p className="mt-1 font-semibold text-white">
                        {money(progress.current)}
                      </p>
                      {progress.initial > 0 && (
                        <p className="mt-1 text-xs text-white/40">
                          Incluye {money(progress.initial)} inicial
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-white/45">Falta</p>
                      <p className="mt-1 font-semibold text-emerald-200">
                        {money(progress.remaining)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {activeGoal && (
        <div className="glass p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold">
                Transacciones asociadas a {activeGoal.Nombre}
              </h3>
              <p className="mt-1 text-sm text-white/60">
                Marca las transacciones de ahorro que aportan a esta meta.
              </p>
            </div>
            <button
              onClick={() => setGoalToDelete(activeGoal)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-300/20 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar meta
            </button>
          </div>

          {savingsTransactions.length === 0 ? (
            <div className="rounded-2xl bg-white/5 p-5 text-sm text-white/55 ring-1 ring-white/10">
              No encontre transacciones con categoria o descripcion de ahorro.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {savingsTransactions.map((tx) => {
                const checked = activeGoal.TransaccionesAsociadas.includes(tx.ID);
                const ownerGoal = transactionGoalMap.get(tx.ID);
                const lockedByOtherGoal =
                  Boolean(ownerGoal) && ownerGoal?.ID !== activeGoal.ID;
                const lockedMessage = ownerGoal
                  ? `Esta transaccion pertenece a la meta ${ownerGoal.Nombre}`
                  : undefined;

                return (
                  <label
                    key={tx.ID}
                    className={`group relative flex items-start gap-3 rounded-2xl p-4 ring-1 transition ${
                      lockedByOtherGoal
                        ? "cursor-not-allowed bg-white/[0.03] opacity-50 ring-white/10"
                        : checked
                          ? "cursor-pointer bg-emerald-300/10 ring-emerald-300/30"
                          : "cursor-pointer bg-white/5 ring-white/10 hover:bg-white/10"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={lockedByOtherGoal}
                      onChange={() => toggleTransaction(activeGoal.ID, tx.ID)}
                      className="mt-1 h-4 w-4 accent-emerald-300 disabled:cursor-not-allowed"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="break-words text-sm font-medium text-white">
                          {getTransactionLabel(tx)}
                        </p>
                        <p className="whitespace-nowrap text-sm font-semibold text-emerald-200">
                          {money(Number(tx.Importe) || 0)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-white/45">{tx.Fecha}</p>
                    </div>
                    {checked && (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-300" />
                    )}
                    {lockedByOtherGoal && lockedMessage && (
                      <span className="pointer-events-none absolute left-4 top-3 z-20 max-w-[min(420px,calc(100vw-3rem))] -translate-y-full rounded-xl border border-emerald-300/25 bg-slate-950/95 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-2xl shadow-black/40 backdrop-blur transition duration-100 group-hover:-translate-y-[calc(100%+0.35rem)] group-hover:opacity-100">
                        {lockedMessage}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {goalToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl shadow-black/50">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-rose-500/10 p-3 text-rose-200 ring-1 ring-rose-300/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold">Eliminar meta</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Estas seguro de que quieres eliminar la meta{" "}
                  <span className="font-semibold text-white">
                    {goalToDelete.Nombre}
                  </span>
                  ?
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setGoalToDelete(null)}
                disabled={saving}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                No
              </button>
              <button
                onClick={() => deleteGoal(goalToDelete.ID)}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Si
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
