"use client";

import {
  BarChart3,
  ChevronRight,
  PiggyBank,
  Tags,
  WalletCards,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

type ModuleKey = "finanzas" | "ahorros" | "presupuesto" | "mantenimiento";
type MaintenanceSection = "categorias";

type SidebarProps = {
  activeModule: ModuleKey;
  setActiveModule: (module: ModuleKey) => void;
  activeMaintenanceSection: MaintenanceSection;
  setActiveMaintenanceSection: (section: MaintenanceSection) => void;
};

export function Sidebar({
  activeModule,
  setActiveModule,
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
      key: "ahorros" as const,
      label: "Ahorros",
      Icon: PiggyBank,
    },
    {
      key: "presupuesto" as const,
      label: "Presupuesto",
      Icon: WalletCards,
    },
    {
      key: "mantenimiento" as const,
      label: "Mantenimiento",
      Icon: Wrench,
    },
  ];

  return (
    <aside
      className={`
        relative hidden min-h-screen border-r border-white/10 bg-slate-950/95 p-4 text-white transition-all duration-300 md:block
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

      <div className="mb-8 flex items-center gap-3">
        <div
          className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 ring-1 ring-amber-300/25 ${
            collapsed ? "h-12 w-12" : "h-16 w-16"
          }`}
        >
          <Image
            src="/propia-mark-logo.png"
            alt="Propia Finance"
            fill
            sizes={collapsed ? "48px" : "64px"}
            className="object-contain"
            priority
          />
        </div>

        {!collapsed && (
          <div>
            <h1 className="text-lg font-semibold">PropiaFinance</h1>
            <p className="text-xs text-white/50">Control financiero personal</p>
          </div>
        )}
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
                  if (item.key === "mantenimiento") {
                    setActiveMaintenanceSection("categorias");
                  }
                }}
                className={`
                  flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition
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
              </button>
            {item.key === "mantenimiento" && active && !collapsed && (
              <div className="ml-6 mt-2 border-l border-cyan-300/25 pl-3">
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
    </aside>
  );
}
