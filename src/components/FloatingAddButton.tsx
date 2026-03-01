"use client";

import { Plus } from "lucide-react";
import { motion } from "framer-motion";

export function FloatingAddButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.98 }}
      className="fixed bottom-6 right-6 z-50 rounded-2xl bg-white/10 backdrop-blur-xl px-4 py-3
                 ring-1 ring-white/15 shadow-lg hover:bg-white/15"
      aria-label="Agregar transacción"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-xl bg-white/10 p-2 ring-1 ring-white/10">
          <Plus className="h-5 w-5" />
        </span>
        <span className="text-sm font-medium hidden sm:block">Nueva transacción</span>
      </div>
    </motion.button>
  );
}