"use client";

import { motion } from "framer-motion";
import { Wallet, TrendingUp, TrendingDown, Clock3 } from "lucide-react";
import type { Transaction } from "@/lib/types";

function sum(txs: Transaction[], pred: (t: Transaction) => boolean) {
  return txs.filter(pred).reduce((a, b) => a + (Number(b.Importe) || 0), 0);
}

function money(n: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(n);
}

export function MetricCards({ txs }: { txs: Transaction[] }) {
  const ingresos = sum(txs, (t) => t.Tipo === "Ingreso");
  const gastos = sum(txs, (t) => t.Tipo === "Gasto");
  const pendientes = sum(txs, (t) => t.EstadoPago === "Pendiente");
  const balance = ingresos - gastos;

  const cards = [
    { title: "Balance", value: money(balance), Icon: Wallet, ring: "from-cyan-400/30 to-blue-500/20", accent: "text-cyan-300" },
    { title: "Ingresos", value: money(ingresos), Icon: TrendingUp, ring: "from-emerald-400/30 to-green-500/20", accent: "text-emerald-300" },
    { title: "Gastos", value: money(gastos), Icon: TrendingDown, ring: "from-rose-400/30 to-red-500/20", accent: "text-rose-300" },
    { title: "Pendientes", value: money(pendientes), Icon: Clock3, ring: "from-orange-400/30 to-amber-500/20", accent: "text-orange-300" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((c, idx) => (
        <motion.div
          key={c.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05, duration: 0.45, ease: "easeOut" }}
          className="glass relative overflow-hidden p-5"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${c.ring}`} />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">{c.title}</p>
              <p className="mt-2 text-2xl font-semibold">{c.value}</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <c.Icon className={`h-6 w-6 ${c.accent}`} />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}