"use client";

import { motion } from "framer-motion";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-fuchsia-500/30 to-cyan-400/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-emerald-500/25 to-orange-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_60%)]" />
      </div>

      <main className="relative mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="mb-6 flex flex-col gap-2"
        >
          <h1 className="text-2xl md:text-3xl font-semibold text-glow">
            Finance Dashboard
          </h1>
          <p className="text-sm md:text-base text-white/60">
            Datos en tiempo real desde Google Sheets (refresh cada 5s)
          </p>
        </motion.header>

        {children}
      </main>
    </div>
  );
}