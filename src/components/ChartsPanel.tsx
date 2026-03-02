"use client";

import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { Transaction } from "@/lib/types";

const money = (n: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

// Soporta YYYY-MM-DD y DD/MM/YYYY
function parseDateSafe(dateStr: string): Date | null {
  const s = (dateStr ?? "").trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const dmy = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function toMonthKey(dateStr: string) {
  const d = parseDateSafe(dateStr);
  if (!d) return "N/A";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function ChartsPanel({ txs }: { txs: Transaction[] }) {
  // Line chart: neto por mes
  const grouped = new Map<
    string,
    { month: string; ingresos: number; gastos: number; neto: number }
  >();

  for (const t of txs) {
    const month = toMonthKey(t.Fecha);
    if (month === "N/A") continue;

    const prev = grouped.get(month) ?? { month, ingresos: 0, gastos: 0, neto: 0 };
    const amt = Number(t.Importe) || 0;

    if ((t.Tipo ?? "").trim() === "Ingreso") prev.ingresos += amt;
    else prev.gastos += amt;

    prev.neto = prev.ingresos - prev.gastos;
    grouped.set(month, prev);
  }

  const lineData = Array.from(grouped.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  // Pie: gastos por categoría (Top 6 + Otros)
  const cat = new Map<string, number>();
  for (const t of txs) {
    if ((t.Tipo ?? "").trim() !== "Gasto") continue;
    const k = (t.Categoría ?? "Sin categoría").trim() || "Sin categoría";
    cat.set(k, (cat.get(k) ?? 0) + (Number(t.Importe) || 0));
  }

  const pieAll = Array.from(cat.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const TOP = 6;
  const top = pieAll.slice(0, TOP);
  const rest = pieAll.slice(TOP);
  const othersValue = rest.reduce((sum, x) => sum + x.value, 0);

  const pieData = othersValue > 0 ? [...top, { name: "Otros", value: othersValue }] : top;

  const COLORS = ["#22d3ee","#60a5fa","#34d399","#fbbf24","#fb7185","#a78bfa","#f97316","#2dd4bf"];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {/* Line */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="glass p-5 xl:col-span-2 min-w-0"
      >
        <div className="mb-3">
          <h3 className="text-base font-semibold">Evolución (Neto mensual)</h3>
          <p className="text-sm text-white/60">Ingresos - Gastos</p>
        </div>

        <div className="h-[280px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData}>
              <CartesianGrid strokeOpacity={0.08} />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" />
              <YAxis stroke="rgba(255,255,255,0.5)" />
              <Tooltip
                contentStyle={{
                  background: "rgba(10,14,26,0.92)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 12,
                  color: "rgba(255,255,255,0.92)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
                formatter={(v: any) => money(Number(v))}
              />
              <Line type="monotone" dataKey="neto" stroke="#60a5fa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Pie */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
        className="glass p-5 min-w-0"
      >
        <div className="mb-3">
          <h3 className="text-base font-semibold">Gastos por categoría</h3>
          <p className="text-sm text-white/60">Top categorías</p>
        </div>

        <div className="h-[320px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={1}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>

              <Tooltip
                wrapperStyle={{ outline: "none" }}
                contentStyle={{
                  background: "rgba(10, 14, 24, 0.92)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: 14,
                  color: "rgba(255,255,255,0.92)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
                }}
                itemStyle={{ color: "rgba(255,255,255,0.92)" }}
                labelStyle={{ color: "rgba(255,255,255,0.70)" }}
                formatter={(value: any, name: any) => [money(Number(value)), String(name)]}
              />

              <Legend
                layout="vertical"
                verticalAlign="middle"
                align="right"
                wrapperStyle={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 12,
                  maxHeight: 220,
                  overflowY: "auto",
                  paddingLeft: 10,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}