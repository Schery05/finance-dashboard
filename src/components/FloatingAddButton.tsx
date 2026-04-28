"use client";

import { Plus } from "lucide-react";
import { motion } from "framer-motion";

export function FloatingAddButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.98 }}
      className="fixed bottom-6 right-6 z-50 rounded-2xl bg-emerald-400 px-4 py-3 text-slate-950 shadow-lg shadow-emerald-500/30 ring-1 ring-emerald-200/40 transition hover:bg-emerald-500"
      aria-label="Agregar transacción"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-xl bg-white/95 p-2 text-slate-950 ring-1 ring-slate-900/10">
          <Plus className="h-5 w-5" />
        </span>
        <span className="text-sm font-semibold hidden sm:block">Nueva transacción</span>
      </div>
    </motion.button>
  );
}