"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Transaction } from "@/lib/types";

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

function toMonthKey(dateStr: string) {
  const d = parseDateSafe(dateStr);
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const moneyFormatter = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatNumber = (n: number) =>
  numberFormatter.format(Number.isFinite(n) ? n : 0);

const money = (n: number) =>
  moneyFormatter.format(Number.isFinite(n) ? n : 0);

type PieDatum = {
  name: string;
  value: number;
};

const PIE_COLORS = [
  "#22d3ee",
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
  "#f97316",
  "#2dd4bf",
];

function CategoryPieTooltip({
  active,
  payload,
  total,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    color?: string;
    value?: number;
    payload?: PieDatum;
  }>;
  total: number;
  label: string;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const datum = item.payload;
  const value = Number(item.value ?? datum?.value ?? 0);
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-2xl shadow-black/25 backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.08)]"
          style={{ background: item.color ?? "#22d3ee" }}
        />
        <p className="max-w-[240px] truncate text-sm font-semibold">
          {datum?.name ?? "Categoria"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl bg-white/[0.06] px-3 py-2 ring-1 ring-white/10">
          <p className="text-white/45">{label}</p>
          <p className="mt-1 font-semibold text-white">{money(value)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.06] px-3 py-2 ring-1 ring-white/10">
          <p className="text-white/45">Participacion</p>
          <p className="mt-1 font-semibold text-cyan-200">
            {percentage.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}

function CategoryPieCard({
  title,
  data,
  total,
  tooltipLabel,
  mounted,
  delay,
}: {
  title: string;
  data: PieDatum[];
  total: number;
  tooltipLabel: string;
  mounted: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay }}
      className="glass min-w-0 p-4 sm:p-5"
    >
      <div className="mb-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-white/60">Top categorias</p>
      </div>

      {data.length === 0 ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-2xl bg-white/[0.03] p-5 text-center text-sm text-white/55 ring-1 ring-white/10">
          No hay datos disponibles para mostrar.
        </div>
      ) : (
        <div className="flex min-h-[320px] w-full min-w-0 flex-col gap-5 xl:flex-row xl:items-center">
          <div className="mx-auto h-[220px] w-full max-w-[220px] flex-none sm:h-[260px] sm:max-w-[260px] 2xl:h-[280px] 2xl:max-w-[280px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                    cx="50%"
                    cy="50%"
                    isAnimationActive={true}
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>

                  <Tooltip
                    cursor={false}
                    content={
                      <CategoryPieTooltip
                        total={total}
                        label={tooltipLabel}
                      />
                    }
                    wrapperStyle={{ outline: "none", zIndex: 50 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="min-w-0 flex-1 pr-0 xl:pr-1">
            <div className="space-y-2.5">
              {data.map((item, i) => (
                <div
                  key={item.name}
                  className="grid grid-cols-[10px_minmax(0,1fr)] items-start gap-2 text-xs sm:grid-cols-[10px_minmax(120px,1fr)_auto]"
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 rounded-sm"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <div className="min-w-0">
                    <p
                      className="break-words leading-snug"
                      style={{ color: "var(--chart-legend-title)" }}
                    >
                      {item.name}
                    </p>
                    <p
                      className="mt-0.5"
                      style={{ color: "var(--chart-legend-muted)" }}
                    >
                      {total > 0
                        ? `${((item.value / total) * 100).toFixed(1)}%`
                        : "0.0%"}
                    </p>
                  </div>
                  <p
                    className="col-start-2 break-words font-medium sm:col-auto sm:whitespace-nowrap sm:text-right"
                    style={{ color: "var(--chart-legend-value)" }}
                  >
                    {money(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function ChartsPanel({ txs }: { txs: Transaction[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const grouped = new Map<
    string,
    { month: string; ingresos: number; gastos: number; neto: number }
  >();

  for (const t of txs) {
    const month = toMonthKey(t.Fecha);
    if (!month) continue;

    const prev = grouped.get(month) ?? {
      month,
      ingresos: 0,
      gastos: 0,
      neto: 0,
    };
    const amt = Number(t.Importe) || 0;

    if (t.Tipo === "Ingreso") prev.ingresos += amt;
    else prev.gastos += amt;

    prev.neto = prev.ingresos - prev.gastos;
    grouped.set(month, prev);
  }

  const lineData = Array.from(grouped.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  const expenseCat = new Map<string, number>();
  const incomeCat = new Map<string, number>();
  for (const t of txs) {
    const k = t.Categoría || "Sin categoria";
    const amount = Number(t.Importe) || 0;

    if (t.Tipo === "Gasto") {
      expenseCat.set(k, (expenseCat.get(k) ?? 0) + amount);
    }

    if (t.Tipo === "Ingreso") {
      incomeCat.set(k, (incomeCat.get(k) ?? 0) + amount);
    }
  }

  const expensePieData = Array.from(expenseCat.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const incomePieData = Array.from(incomeCat.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const totalGastos = expensePieData.reduce((sum, item) => sum + item.value, 0);
  const totalIngresos = incomePieData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="glass min-w-0 p-4 sm:p-5"
      >
        <div className="mb-3">
          <h3 className="text-base font-semibold">Evolucion (Neto mensual)</h3>
          <p className="text-sm text-white/60">Ingresos - Gastos</p>
        </div>

        <div className="h-[280px] sm:h-[340px]">
          {mounted && (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
              <LineChart
                data={lineData}
                margin={{ top: 14, right: 12, bottom: 14, left: 0 }}
              >
                <CartesianGrid stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="month"
                  stroke="var(--chart-axis)"
                  tick={{ fill: "var(--chart-axis)", fontSize: 14 }}
                  tickMargin={10}
                />
                <YAxis
                  stroke="var(--chart-axis)"
                  tick={{ fill: "var(--chart-axis)", fontSize: 14 }}
                  tickFormatter={(value) => formatNumber(Number(value))}
                  tickMargin={8}
                  width={68}
                />
                <Tooltip
                  formatter={(value) => [money(Number(value)), "Neto"]}
                  labelFormatter={(label) => `Mes: ${label}`}
                  contentStyle={{
                    background: "var(--chart-tooltip-bg)",
                    border: "1px solid var(--chart-tooltip-border)",
                    borderRadius: 12,
                    color: "var(--foreground)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="neto"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      <CategoryPieCard
        title="Gastos por categoria"
        data={expensePieData}
        total={totalGastos}
        tooltipLabel="Gasto"
        mounted={mounted}
        delay={0.05}
      />

      <CategoryPieCard
        title="Ingresos por categoria"
        data={incomePieData}
        total={totalIngresos}
        tooltipLabel="Ingreso"
        mounted={mounted}
        delay={0.1}
      />
    </div>
  );
}
