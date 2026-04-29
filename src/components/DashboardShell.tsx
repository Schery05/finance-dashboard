"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { AccessibilityPanel } from "@/components/AccessibilityPanel";
import { BanksMaintenancePanel } from "@/components/BanksMaintenancePanel";
import { BudgetsMaintenancePanel } from "@/components/BudgetsMaintenancePanel";
import { CategoriesMaintenancePanel } from "@/components/CategoriesMaintenancePanel";
import { DebtControlPanel } from "@/components/DebtControlPanel";
import { ExpenseCalendarPanel } from "@/components/ExpenseCalendarPanel";
import { FinancialAssistantPanel } from "@/components/FinancialAssistantPanel";
import { FinancialScorePanel } from "@/components/FinancialScorePanel";
import { SavingsGoalsPanel } from "@/components/SavingsGoalsPanel";
import { Sidebar } from "@/components/Sidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { getDebtNotifications, getPaymentNotifications } from "@/lib/notifications";
import type { Debt } from "@/lib/types";
import { useFinanceStore } from "@/store/financeStore";
import { UserMenu } from "@/components/UserMenu";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [activeModule, setActiveModule] = useState<
    | "finanzas"
    | "calendar"
    | "score"
    | "asistente"
    | "deudas"
    | "accesibilidad"
    | "ahorros"
    | "presupuesto"
    | "mantenimiento"
  >("finanzas");
  const [activeMaintenanceSection, setActiveMaintenanceSection] = useState<
    "categorias" | "bancos"
  >("categorias");
  const [activeDebtSection, setActiveDebtSection] = useState<
    "gestion" | "listado"
  >("gestion");
  const isSavingsModule = activeModule === "ahorros";
  const isCalendarModule = activeModule === "calendar";
  const isScoreModule = activeModule === "score";
  const isAssistantModule = activeModule === "asistente";
  const isDebtsModule = activeModule === "deudas";
  const isAccessibilityModule = activeModule === "accesibilidad";
  const isBudgetsModule = activeModule === "presupuesto";
  const isMaintenanceModule = activeModule === "mantenimiento";
  const { transactions } = useFinanceStore();
  const [debtsForNotifications, setDebtsForNotifications] = useState<Debt[]>([]);
  const notifications = [
    ...getPaymentNotifications(transactions),
    ...getDebtNotifications({
      debts: debtsForNotifications,
      transactions,
    }),
  ];

  React.useEffect(() => {
    let mounted = true;
    fetch("/api/debts", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.ok) setDebtsForNotifications(json.data as Debt[]);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

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
        activeDebtSection={activeDebtSection}
        setActiveDebtSection={setActiveDebtSection}
        activeMaintenanceSection={activeMaintenanceSection}
        setActiveMaintenanceSection={setActiveMaintenanceSection}
      />


          <main className="relative mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
           
          <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="mb-6 flex items-start justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-glow">
              {isSavingsModule
                ? "Metas de ahorro"
                : isCalendarModule
                ? "Calendar Trxn"
                : isScoreModule
                ? "Score financiero"
                : isAssistantModule
                ? "Asistente Financiero"
                : isDebtsModule
                ? "Control de deudas"
                : isAccessibilityModule
                ? "Accesibilidad"
                : isBudgetsModule
                ? "Presupuesto"
                : isMaintenanceModule
                ? "Mantenimiento"
                : "Centro de Control Financiero"}
            </h1>

            <p className="max-w-2xl text-sm md:text-base leading-7 text-slate-300">
              {isSavingsModule
                ? "Asocia tus transacciones de ahorro y mide el avance de cada meta."
                : isCalendarModule
                ? "Vista mensual para identificar tus dias de mayor gasto."
                : isScoreModule
                ? "Mide tu salud financiera mensual con ahorro, presupuesto y pagos."
                : isAssistantModule
                ? "Consulta tus finanzas en lenguaje natural con recomendaciones accionables."
                : isDebtsModule
                ? "Gestiona balances, intereses y estrategia de pago de deudas."
                : isAccessibilityModule
                ? "Personaliza el modo visual de la aplicación."
                : isBudgetsModule
                ? "Controla tu limite mensual por categoria."
                : isMaintenanceModule
                ? "Gestiona catalogos y configuraciones del sistema."
                : (
                    <>
                      <span className="block text-white">Control total de tus finanzas,</span>
                      <span className="block font-semibold text-emerald-300">
                        en tiempo real y siempre actualizado.
                      </span>
                    </>
                  )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell notifications={notifications} />

            <div className="h-8 w-px bg-white/10" />

            <UserMenu />
          </div>
        </motion.header>

        {isSavingsModule ? (
          <SavingsGoalsPanel />
        ) : isCalendarModule ? (
          <ExpenseCalendarPanel txs={transactions} />
        ) : isScoreModule ? (
          <FinancialScorePanel />
        ) : isAssistantModule ? (
          <FinancialAssistantPanel />
        ) : isDebtsModule ? (
          <DebtControlPanel viewMode={activeDebtSection} />
        ) : isAccessibilityModule ? (
          <AccessibilityPanel />
        ) : isBudgetsModule ? (
          <BudgetsMaintenancePanel />
        ) : isMaintenanceModule && activeMaintenanceSection === "bancos" ? (
          <BanksMaintenancePanel />
        ) : isMaintenanceModule ? (
          <CategoriesMaintenancePanel />
        ) : (
          children
        )}
      </main>
    </div>
  );
}
