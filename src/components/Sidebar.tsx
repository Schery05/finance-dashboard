"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Eye,
  Gauge,
  Landmark,
  PiggyBank,
  Tags,
  WalletCards,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import iconLogo from "../app/icon.png";
import { useState } from "react";

type ModuleKey =
  | "finanzas"
  | "calendar"
  | "score"
  | "asistente"
  | "deudas"
  | "accesibilidad"
  | "ahorros"
  | "presupuesto"
  | "mantenimiento";
type MaintenanceSection = "categorias" | "bancos";
type DebtSection = "gestion" | "listado";

type SidebarProps = {
  activeModule: ModuleKey;
  setActiveModule: (module: ModuleKey) => void;
  activeDebtSection: DebtSection;
  setActiveDebtSection: (section: DebtSection) => void;
  activeMaintenanceSection: MaintenanceSection;
  setActiveMaintenanceSection: (section: MaintenanceSection) => void;
};

export function Sidebar({
  activeModule,
  setActiveModule,
  activeDebtSection,
  setActiveDebtSection,
  activeMaintenanceSection,
  setActiveMaintenanceSection,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      key: "finanzas" as const,
      label: "Finanzas",
      Icon: BarChart3,
    },
    {
      key: "presupuesto" as const,
      label: "Presupuesto",
      Icon: WalletCards,
    },
    {
      key: "ahorros" as const,
      label: "Ahorros",
      Icon: PiggyBank,
    },
    {
      key: "deudas" as const,
      label: "Control de deudas",
      Icon: Landmark,
    },
    {
      key: "score" as const,
      label: "Score financiero",
      Icon: Gauge,
    },
    {
      key: "asistente" as const,
      label: "Asistente IA",
      Icon: Bot,
    },
    {
      key: "calendar" as const,
      label: "Calendar Trxn",
      Icon: CalendarDays,
    },
    {
      key: "accesibilidad" as const,
      label: "Accesibilidad",
      Icon: Eye,
    },
    {
      key: "mantenimiento" as const,
      label: "Mantenimiento",
      Icon: Wrench,
    },
  ];

  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`
        relative hidden min-h-screen border-r border-white/10 bg-slate-800/95 p-4 text-white transition-all duration-500 ease-out md:block
        ${collapsed ? "w-20" : "w-72"}
      `}
    >
      <button
        onClick={() => setCollapsed((prev) => !prev)}
        className="
          absolute -right-4 top-8 z-20 flex h-8 w-8 items-center justify-center
          rounded-full bg-white text-slate-950 shadow-lg transition hover:scale-105
        "
        title={collapsed ? "Abrir menu" : "Cerrar menu"}
      >
        <span
          className={`transition-transform duration-300 ${
            collapsed ? "rotate-0" : "rotate-180"
          }`}
        >
          <ChevronRight className="h-4 w-4" />
        </span>
      </button>

      <div className="mb-8 flex items-center justify-center">
        <div
          className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-transparent ${
            collapsed ? "h-16 w-16" : "h-32 w-32"
          }`}
        >
          <Image
            src={iconLogo}
            alt="Propia Finance"
            fill
            sizes={collapsed ? "64px" : "128px"}
            className="object-contain"
            priority
          />
        </div>
      </div>

      <nav className="space-y-2">
        {menuItems.map((item) => {
          const active = activeModule === item.key;
          const ItemIcon = item.Icon;

          return (
            <div key={item.key}>
              <button
                onClick={() => {
                  setActiveModule(item.key);
                  if (item.key === "deudas") {
                    setActiveDebtSection("gestion");
                  }
                  if (item.key === "mantenimiento") {
                    setActiveMaintenanceSection("categorias");
                  }
                }}
                className={`
                  flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition duration-300 ease-out
                  ${
                    active
                      ? "bg-white text-slate-950 shadow-lg shadow-cyan-500/10"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }
                  ${collapsed ? "justify-center px-0" : ""}
                `}
                title={collapsed ? item.label : undefined}
              >
                <ItemIcon className="h-5 w-5" />

                {!collapsed && <span>{item.label}</span>}
                {!collapsed &&
                  (item.key === "deudas" || item.key === "mantenimiento") && (
                    <ChevronDown
                      className={`ml-auto h-4 w-4 transition-transform ${
                        active ? "rotate-180" : ""
                      }`}
                    />
                  )}
              </button>
            {item.key === "deudas" && active && !collapsed && (
              <div className="ml-6 mt-2 space-y-2 border-l border-cyan-300/25 pl-3">
                <button
                  onClick={() => setActiveDebtSection("gestion")}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold ring-1 transition ${
                    activeDebtSection === "gestion"
                      ? "bg-cyan-300/15 text-cyan-100 ring-cyan-300/25 shadow-lg shadow-cyan-500/5"
                      : "bg-white/5 text-white/60 ring-white/10 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  <Landmark className="h-3.5 w-3.5" />
                  <span>Gestion</span>
                </button>
                <button
                  onClick={() => setActiveDebtSection("listado")}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold ring-1 transition ${
                    activeDebtSection === "listado"
                      ? "bg-cyan-300/15 text-cyan-100 ring-cyan-300/25 shadow-lg shadow-cyan-500/5"
                      : "bg-white/5 text-white/60 ring-white/10 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  <Tags className="h-3.5 w-3.5" />
                  <span>Listado de Prestamos</span>
                </button>
              </div>
            )}
            {item.key === "mantenimiento" && active && !collapsed && (
              <div className="ml-6 mt-2 space-y-2 border-l border-cyan-300/25 pl-3">
                <button
                  onClick={() => setActiveMaintenanceSection("categorias")}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold ring-1 transition ${
                    activeMaintenanceSection === "categorias"
                      ? "bg-cyan-300/15 text-cyan-100 ring-cyan-300/25 shadow-lg shadow-cyan-500/5"
                      : "bg-white/5 text-white/60 ring-white/10 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  <Tags className="h-3.5 w-3.5" />
                  <span>Categorias</span>
                </button>
                <button
                  onClick={() => setActiveMaintenanceSection("bancos")}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold ring-1 transition ${
                    activeMaintenanceSection === "bancos"
                      ? "bg-cyan-300/15 text-cyan-100 ring-cyan-300/25 shadow-lg shadow-cyan-500/5"
                      : "bg-white/5 text-white/60 ring-white/10 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  <Landmark className="h-3.5 w-3.5" />
                  <span>Listado Bancos</span>
                </button>
              </div>
            )}
          </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="absolute bottom-5 left-4 right-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <p className="text-sm font-medium">Proxima mejora</p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">
            Presupuesto, alertas y metas automaticas.
          </p>
        </div>
      )}
    </motion.aside>
  );
}
