"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { BudgetsMaintenancePanel } from "@/components/BudgetsMaintenancePanel";
import { CategoriesMaintenancePanel } from "@/components/CategoriesMaintenancePanel";
import { SavingsGoalsPanel } from "@/components/SavingsGoalsPanel";
import { Sidebar } from "@/components/Sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [activeModule, setActiveModule] = useState<
    "finanzas" | "ahorros" | "presupuesto" | "mantenimiento"
  >("finanzas");
  const [activeMaintenanceSection, setActiveMaintenanceSection] = useState<
    "categorias"
  >("categorias");
  const isSavingsModule = activeModule === "ahorros";
  const isBudgetsModule = activeModule === "presupuesto";
  const isMaintenanceModule = activeModule === "mantenimiento";

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-fuchsia-500/30 to-cyan-400/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-emerald-500/25 to-orange-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_60%)]" />
      </div>

      <Sidebar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        activeMaintenanceSection={activeMaintenanceSection}
        setActiveMaintenanceSection={setActiveMaintenanceSection}
      />

      <main className="relative mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="mb-6 flex flex-col gap-2"
        >
          <h1 className="text-2xl md:text-3xl font-semibold text-glow">
            {isSavingsModule
              ? "Metas de ahorro"
              : isBudgetsModule
                ? "Presupuesto"
              : isMaintenanceModule
                ? "Mantenimiento"
                : "Finance Dashboard"}
          </h1>
          <p className="text-sm md:text-base text-white/60">
            {isSavingsModule
              ? "Asocia tus transacciones de ahorro y mide el avance de cada meta."
              : isBudgetsModule
                ? "Controla tu limite mensual por categoria."
              : isMaintenanceModule
                ? "Gestiona catalogos y configuraciones del sistema."
                : "Datos en tiempo real desde Google Sheets (refresh cada 5s)"}
          </p>
        </motion.header>

        {isSavingsModule ? (
          <SavingsGoalsPanel />
        ) : isBudgetsModule ? (
          <BudgetsMaintenancePanel />
        ) : isMaintenanceModule ? (
          <CategoriesMaintenancePanel />
        ) : (
          children
        )}
      </main>
    </div>
  );
}
