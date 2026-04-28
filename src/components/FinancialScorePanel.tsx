"use client";

import { Activity, CalendarDays, CheckCircle2, PiggyBank, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { currentPeriod, type Budget } from "@/lib/budgets";
import { calculateFinancialScore } from "@/lib/finance-score";
import type { Transaction } from "@/lib/types";
import { useFinanceStore } from "@/store/financeStore";

const money = (n: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

const percent = (n: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number.isFinite(n) ? n : 0);

function parseDateSafe(dateStr: string) {
  const value = String(dateStr ?? "").trim();
  if (!value) return null;

  const iso = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function periodFromTransaction(tx: Transaction) {
  const date = parseDateSafe(tx.Fecha);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function splitPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  return {
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    month: Number.isFinite(month) ? month : new Date().getMonth() + 1,
  };
}

function scoreTone(score: number) {
  if (score >= 85) return "text-emerald-200 ring-emerald-300/25 bg-emerald-400/10";
  if (score >= 70) return "text-cyan-200 ring-cyan-300/25 bg-cyan-400/10";
  if (score >= 50) return "text-amber-200 ring-amber-300/25 bg-amber-400/10";
  return "text-rose-200 ring-rose-300/25 bg-rose-400/10";
}

function progressTone(score: number) {
  if (score >= 85) return "bg-emerald-300";
  if (score >= 70) return "bg-cyan-300";
  if (score >= 50) return "bg-amber-300";
  return "bg-rose-400";
}

function pillarText(score: number) {
  if (score >= 85) return "Fuerte";
  if (score >= 70) return "Estable";
  if (score >= 50) return "Mejorable";
  return "Atencion";
}

export function FinancialScorePanel() {
  const transactions = useFinanceStore((state) => state.transactions);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod());
  const [loadingBudgets, setLoadingBudgets] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchBudgets = async () => {
      setLoadingBudgets(true);
      setError(null);
      try {
        const res = await fetch("/api/budgets", { cache: "no-store" });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "No se pudo cargar presupuesto");
        if (mounted) setBudgets(json.data as Budget[]);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Error cargando presupuesto"
          );
        }
      } finally {
        if (mounted) setLoadingBudgets(false);
      }
    };

    fetchBudgets();

    return () => {
      mounted = false;
    };
  }, []);

  const availablePeriods = useMemo(() => {
    return Array.from(
      new Set([
        currentPeriod(),
        ...transactions.map(periodFromTransaction).filter(Boolean),
        ...budgets.map((budget) => budget.period).filter(Boolean),
      ])
    ).sort((a, b) => b.localeCompare(a));
  }, [transactions, budgets]);
  const periodOptions = availablePeriods.map((period) => ({
    value: period,
    label: period,
  }));

  const { month, year } = splitPeriod(selectedPeriod);
  const result = useMemo(
    () =>
      calculateFinancialScore({
        transactions,
        budgets,
        month,
        year,
      }),
    [transactions, budgets, month, year]
  );

  const pillars = [
    {
      label: "Tasa de ahorro",
      score: result.breakdown.savingsScore,
      weight: "40%",
      Icon: PiggyBank,
    },
    {
      label: "Cumplimiento de presupuesto",
      score: result.breakdown.budgetScore,
      weight: "30%",
      Icon: Target,
    },
    {
      label: "Pagos a tiempo",
      score: result.breakdown.paymentsScore,
      weight: "30%",
      Icon: CheckCircle2,
    },
  ];

  const metrics = [
    { label: "Ingresos", value: money(result.metrics.income) },
    { label: "Gastos", value: money(result.metrics.expenses) },
    { label: "Ahorro neto", value: money(result.metrics.savings) },
    { label: "Tasa de ahorro", value: percent(result.metrics.savingsRate) },
    { label: "Presupuesto usado", value: money(result.metrics.budgetUsed) },
    { label: "Limite presupuesto", value: money(result.metrics.budgetLimit) },
    {
      label: "Pagos validados",
      value: `${result.metrics.paymentsPaid}/${result.metrics.paymentsTotal}`,
    },
  ];

  return (
    <section className="space-y-4">
      <div className="glass p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-white/65 ring-1 ring-white/10">
              <Activity className="h-3.5 w-3.5 text-emerald-200" />
              Salud financiera mensual
            </div>
            <h2 className="mt-3 text-xl font-semibold text-white">
              Score financiero
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/60">
              Tu resultado combina ahorro, presupuesto y pagos validados para el periodo seleccionado.
            </p>
          </div>

          <label className="text-sm text-white/70 lg:w-56">
            Periodo
            <div className="relative mt-1">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <CustomSelect
                value={selectedPeriod}
                onChange={setSelectedPeriod}
                options={periodOptions}
                triggerClassName="pl-9"
              />
            </div>
          </label>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl bg-amber-400/10 p-3 text-sm text-amber-100 ring-1 ring-amber-300/20">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
        <div className="glass p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-white/55">{selectedPeriod}</p>
              <h3 className="mt-1 text-lg font-semibold">Resultado general</h3>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${scoreTone(result.score)}`}>
              {result.label}
            </span>
          </div>

          <div className="mt-8 flex items-center justify-center">
            <div className={`flex h-44 w-44 items-center justify-center rounded-full ring-1 ${scoreTone(result.score)}`}>
              <div className="text-center">
                <p className="text-6xl font-semibold tracking-normal text-white">
                  {result.score}
                </p>
                <p className="mt-1 text-sm font-medium text-white/55">de 100</p>
              </div>
            </div>
          </div>

          <div className="mt-8 h-3 rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${progressTone(result.score)}`}
              style={{ width: `${result.score}%` }}
            />
          </div>

          <p className="mt-4 text-center text-sm text-white/60">
            {loadingBudgets
              ? "Actualizando presupuesto..."
              : "Calculado con tus transacciones del mes."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {pillars.map((pillar) => {
            const PillarIcon = pillar.Icon;
            return (
              <div key={pillar.label} className="glass p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-white/55">{pillar.weight} del score</p>
                    <h3 className="mt-1 min-h-12 text-base font-semibold text-white">
                      {pillar.label}
                    </h3>
                  </div>
                  <span className="rounded-2xl bg-white/5 p-3 text-white/70 ring-1 ring-white/10">
                    <PillarIcon className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-3xl font-semibold">{pillar.score}</p>
                    <p className="mt-1 text-sm text-white/50">puntos</p>
                  </div>
                  <p className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${scoreTone(pillar.score)}`}>
                    {pillarText(pillar.score)}
                  </p>
                </div>

                <div className="mt-4 h-2 rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${progressTone(pillar.score)}`}
                    style={{ width: `${pillar.score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <div className="glass p-5">
          <h3 className="text-base font-semibold">Metricas principales</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10"
              >
                <p className="text-xs font-medium uppercase tracking-normal text-white/40">
                  {metric.label}
                </p>
                <p className="mt-2 break-words text-base font-semibold text-white">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-5">
          <h3 className="text-base font-semibold">Recomendaciones</h3>
          <div className="mt-4 space-y-3">
            {result.recommendations.map((recommendation) => (
              <div
                key={recommendation}
                className="rounded-2xl bg-white/[0.04] p-4 text-sm leading-6 text-white/70 ring-1 ring-white/10"
              >
                {recommendation}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
