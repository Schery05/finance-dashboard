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

export function ChartsPanel({ txs }: { txs: Transaction[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  const cat = new Map<string, number>();
  for (const t of txs) {
    if (t.Tipo !== "Gasto") continue;
    const k = t.Categoría || "Sin categoria";
    cat.set(k, (cat.get(k) ?? 0) + (Number(t.Importe) || 0));
  }

  const pieData = Array.from(cat.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const totalGastos = pieData.reduce((sum, item) => sum + item.value, 0);

  const COLORS = [
    "#22d3ee",
    "#60a5fa",
    "#34d399",
    "#fbbf24",
    "#fb7185",
    "#a78bfa",
    "#f97316",
    "#2dd4bf",
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="glass min-w-0 p-5"
      >
        <div className="mb-3">
          <h3 className="text-base font-semibold">Evolucion (Neto mensual)</h3>
          <p className="text-sm text-white/60">Ingresos - Gastos</p>
        </div>

        <div className="h-[340px]">
          {mounted && (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={340}>
              <LineChart
                data={lineData}
                margin={{ top: 14, right: 24, bottom: 14, left: 12 }}
              >
                <CartesianGrid strokeOpacity={0.08} />
                <XAxis
                  dataKey="month"
                  stroke="rgba(255,255,255,0.55)"
                  tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 14 }}
                  tickMargin={10}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.55)"
                  tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 14 }}
                  tickFormatter={(value) => formatNumber(Number(value))}
                  tickMargin={8}
                  width={90}
                />
                <Tooltip
                  formatter={(value) => [money(Number(value)), "Neto"]}
                  labelFormatter={(label) => `Mes: ${label}`}
                  contentStyle={{
                    background: "rgba(10,14,26,0.85)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
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

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
        className="glass min-w-0 p-5"
      >
        <div className="mb-3">
          <h3 className="text-base font-semibold">Gastos por categoria</h3>
          <p className="text-sm text-white/60">Top categorias</p>
        </div>

        <div className="flex min-h-[360px] w-full min-w-0 flex-col gap-5 xl:flex-row xl:items-center">
          <div className="mx-auto h-[280px] w-[280px] flex-none xl:h-[260px] xl:w-[260px] 2xl:h-[280px] 2xl:w-[280px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                <PieChart>
                  <Pie
                    data={pieData}
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
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>

                  <Tooltip
                    cursor={false}
                    formatter={(value) => [money(Number(value)), "Gasto"]}
                    wrapperStyle={{ outline: "none", zIndex: 50 }}
                    contentStyle={{
                      background: "rgba(10,14,26,0.95)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      borderRadius: 12,
                      color: "#ffffff",
                      padding: "12px 14px",
                    }}
                    labelStyle={{ color: "#cbd5e1", fontSize: 13 }}
                    itemStyle={{ color: "#f8fafc", fontSize: 14, fontWeight: 600 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="min-w-0 flex-1 pr-1">
            <div className="space-y-2.5">
              {pieData.map((item, i) => (
                <div
                  key={item.name}
                  className="grid grid-cols-[10px_minmax(140px,1fr)_auto] items-start gap-2 text-xs"
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 rounded-sm"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <div className="min-w-0">
                    <p className="break-words leading-snug text-white/90">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-white/45">
                      {totalGastos > 0
                        ? `${((item.value / totalGastos) * 100).toFixed(1)}%`
                        : "0.0%"}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-right font-medium text-white/75">
                    {money(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
