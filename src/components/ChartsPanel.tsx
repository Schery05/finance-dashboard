"use client";

import { motion } from "framer-motion";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";
import type { Transaction } from "@/lib/types";

function toMonthKey(dateStr: string) {
  // espera "YYYY-MM-DD" o similar
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "N/A";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function ChartsPanel({ txs }: { txs: Transaction[] }) {
  // Line chart: neto por mes
  const grouped = new Map<string, { month: string; ingresos: number; gastos: number; neto: number }>();
  for (const t of txs) {
    const month = toMonthKey(t.Fecha);
    const prev = grouped.get(month) ?? { month, ingresos: 0, gastos: 0, neto: 0 };
    const amt = Number(t.Importe) || 0;
    if (t.Tipo === "Ingreso") prev.ingresos += amt;
    else prev.gastos += amt;
    prev.neto = prev.ingresos - prev.gastos;
    grouped.set(month, prev);
  }
  const lineData = Array.from(grouped.values()).sort((a, b) => a.month.localeCompare(b.month));

  // Pie: gastos por categoría
  const cat = new Map<string, number>();
  for (const t of txs) {
    if (t.Tipo !== "Gasto") continue;
    const k = t.Categoría || "Sin categoría";
    cat.set(k, (cat.get(k) ?? 0) + (Number(t.Importe) || 0));
  }
  const pieData = Array.from(cat.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const COLORS = ["#22d3ee","#60a5fa","#34d399","#fbbf24","#fb7185","#a78bfa","#f97316","#2dd4bf"];
  const money = (n: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

  function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const name = String(item?.name ?? "");
  const value = Number(item?.value ?? 0);
  // Recharts suele traer percent en payload
  const percent = Number(item?.payload?.percent ?? item?.percent ?? 0);
  const pct = Number.isFinite(percent) ? percent * 100 : 0;

  return (
    <div className="rounded-xl border border-white/15 bg-[#0A0E1A]/95 px-3 py-2 shadow-2xl backdrop-blur-md">
      <div className="text-xs text-white/70">{name}</div>
      <div className="mt-0.5 text-sm font-semibold text-white">
        {money(value)}
      </div>
      <div className="mt-0.5 text-xs font-medium text-cyan-300">
        {pct.toFixed(1)}%
      </div>
    </div>
  );
}

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
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

        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData}>
              <CartesianGrid strokeOpacity={0.08} />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" />
              <YAxis stroke="rgba(255,255,255,0.5)" />
              <Tooltip contentStyle={
                { background: "rgba(10,14,26,0.85)", 
                border: "1px solid rgba(255,255,255,0.12)", 
                borderRadius: 12 }} />
              <Line type="monotone" dataKey="neto" stroke="#60a5fa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

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

          {/* ✅ Layout real: gráfico izquierda + leyenda derecha */}
          <div className="flex h-[360px] w-full min-w-0 gap-4">
            {/* CHART */}
            <div className="flex w-full items-center gap-4">
  {/* ✅ CHART con tamaño fijo para que NUNCA se recorte */}
  <div className="h-[260px] w-[260px] flex-none">
    <ResponsiveContainer width="100%" height="100%">
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
          isAnimationActive={false}
        >
          {pieData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>

        <Tooltip
        cursor={false}
        wrapperStyle={{ outline: "none", zIndex: 50 }}
          contentStyle={{
            background: "rgba(10,14,26,0.85)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  </div>

          {/* ✅ LEGEND HTML */}
          <div className="min-w-0 flex-1 overflow-auto pr-1 max-h-[260px]">
            <div className="space-y-2">
              {pieData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-white/85 leading-tight truncate">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
          </div>
      </motion.div>
    </div>
  );
}