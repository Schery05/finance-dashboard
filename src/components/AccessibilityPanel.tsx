"use client";

import { Check, Eye, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getStoredTheme,
  saveAppTheme,
  type AppTheme,
} from "@/components/ThemeInitializer";

const options: {
  value: AppTheme;
  title: string;
  description: string;
  Icon: typeof Sun;
}[] = [
  {
    value: "dark",
    title: "Modo oscuro",
    description: "Reduce brillo y mantiene el estilo actual del dashboard.",
    Icon: Moon,
  },
  {
    value: "light",
    title: "Modo claro",
    description: "Mejora contraste en ambientes iluminados y fondos claros.",
    Icon: Sun,
  },
];

export function AccessibilityPanel() {
  const [theme, setTheme] = useState<AppTheme>("dark");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const changeTheme = (nextTheme: AppTheme) => {
    setTheme(nextTheme);
    saveAppTheme(nextTheme);
  };

  return (
    <section className="space-y-4">
      <div className="glass p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-300/20">
              <Eye className="h-3.5 w-3.5" />
              Preferencias visuales
            </div>
            <h2 className="mt-3 text-xl font-semibold">Accesibilidad</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/60">
              Ajusta el modo visual de la aplicación para leer y trabajar con mayor comodidad.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {options.map((option) => {
          const selected = theme === option.value;
          const Icon = option.Icon;

          return (
            <button
              key={option.value}
              onClick={() => changeTheme(option.value)}
              className={`glass p-5 text-left transition ${
                selected
                  ? "ring-2 ring-cyan-300/50"
                  : "hover:bg-white/[0.08]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white/5 p-3 text-cyan-100 ring-1 ring-white/10">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">{option.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-white/60">
                      {option.description}
                    </p>
                  </div>
                </div>
                {selected && (
                  <span className="rounded-full bg-cyan-300 p-1 text-slate-950">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="glass p-5">
        <h3 className="text-base font-semibold">Vista previa</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="theme-preview-card rounded-2xl p-4">
            <p className="theme-preview-muted text-sm">Balance</p>
            <p className="theme-preview-title mt-2 text-2xl font-semibold">
              RD$128,500.00
            </p>
          </div>
          <div className="theme-preview-success rounded-2xl p-4">
            <p className="theme-preview-success-label text-sm font-medium">
              Estado
            </p>
            <p className="mt-2 text-lg font-semibold">
              Finanzas saludables
            </p>
          </div>
          <div className="theme-preview-warning rounded-2xl p-4">
            <p className="theme-preview-warning-label text-sm font-medium">
              Alerta
            </p>
            <p className="mt-2 text-lg font-semibold">
              Revisa gastos variables
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
