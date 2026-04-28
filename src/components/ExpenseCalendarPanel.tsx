"use client";

import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import type { Transaction } from "@/lib/types";

function parseDateSafe(dateStr: string): Date | null {
  const s = String(dateStr ?? "").trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function money(n: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;

  return new Intl.DateTimeFormat("es-DO", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function shiftMonth(key: string, offset: number) {
  const [year, month] = key.split("-").map(Number);
  const next = new Date(year, month - 1 + offset, 1);
  return monthKey(next);
}

function expenseTone(amount: number, maxAmount: number) {
  if (amount <= 0 || maxAmount <= 0) return "bg-white/[0.035] ring-white/10";

  const ratio = amount / maxAmount;
  if (ratio >= 0.75) return "bg-rose-400/25 ring-rose-300/35 text-white";
  if (ratio >= 0.45) return "bg-orange-400/20 ring-orange-300/30 text-white";
  if (ratio >= 0.2) return "bg-amber-300/15 ring-amber-200/25 text-white";
  return "bg-cyan-300/10 ring-cyan-200/20 text-white";
}

export function ExpenseCalendarPanel({ txs }: { txs: Transaction[] }) {
  const expenseRows = useMemo(() => {
    return txs
      .map((tx) => ({ tx, date: parseDateSafe(tx.Fecha) }))
      .filter(
        (item): item is { tx: Transaction; date: Date } =>
          Boolean(item.date) && item.tx.Tipo === "Gasto"
      );
  }, [txs]);

  const months = useMemo(() => {
    return Array.from(new Set(expenseRows.map((item) => monthKey(item.date)))).sort(
      (a, b) => b.localeCompare(a)
    );
  }, [expenseRows]);

  const [selectedMonth, setSelectedMonth] = useState("");
  const activeMonth = selectedMonth || months[0] || monthKey(new Date());
  const monthOptions = (months.length === 0 ? [activeMonth] : months).map(
    (month) => ({ value: month, label: monthLabel(month) })
  );

  const calendar = useMemo(() => {
    const [year, month] = activeMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay();
    const leadingBlanks = (firstDay + 6) % 7;

    const totals = new Map<number, number>();
    const counts = new Map<number, number>();
    for (const { tx, date } of expenseRows) {
      if (monthKey(date) !== activeMonth) continue;
      const day = date.getDate();
      totals.set(day, (totals.get(day) ?? 0) + (Number(tx.Importe) || 0));
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }

    const dayTotals = Array.from(totals.values());
    const maxDay = dayTotals.length > 0 ? Math.max(...dayTotals) : 0;
    const totalMonth = dayTotals.reduce((sum, value) => sum + value, 0);
    const averageDaily = totalMonth / daysInMonth;

    const cells: Array<{ day: number | null; amount: number; count: number }> = [];
    for (let i = 0; i < leadingBlanks; i += 1) {
      cells.push({ day: null, amount: 0, count: 0 });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        day,
        amount: totals.get(day) ?? 0,
        count: counts.get(day) ?? 0,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, amount: 0, count: 0 });
    }

    const costlyDays = Array.from(totals.entries())
      .map(([day, amount]) => ({ day, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    return { cells, maxDay, totalMonth, averageDaily, costlyDays };
  }, [activeMonth, expenseRows]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="glass p-5"
    >
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300 ring-1 ring-cyan-300/20">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Calendario de gastos</h3>
            <p className="mt-1 text-sm text-white/60">
              Vista mensual por dia para detectar tus dias mas costosos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:min-w-[560px]">
          <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedMonth(shiftMonth(activeMonth, -1))}
                className="rounded-xl bg-white/5 p-2 text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="min-w-[160px] text-center text-sm font-semibold capitalize text-white">
                {monthLabel(activeMonth)}
              </p>
              <button
                onClick={() => setSelectedMonth(shiftMonth(activeMonth, 1))}
                className="rounded-xl bg-white/5 p-2 text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedMonth(monthKey(new Date()))}
                className="rounded-xl bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Hoy
              </button>
              <div className="hidden rounded-xl bg-white/5 p-1 ring-1 ring-white/10 sm:flex">
                {["Dia", "Semana", "Mes", "Año"].map((item) => (
                  <span
                    key={item}
                    className={`rounded-lg px-2.5 py-1.5 text-xs ${
                      item === "Mes"
                        ? "bg-white text-slate-950"
                        : "text-white/45"
                    }`}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <label className="text-sm text-white/70">
            Ver otro mes
            <div className="mt-1">
            <CustomSelect
              value={activeMonth}
              onChange={setSelectedMonth}
              options={monthOptions}
            />
            </div>
          </label>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <p className="text-white/45">Total del mes</p>
              <p className="mt-1 font-semibold text-white">
                {money(calendar.totalMonth)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <p className="text-white/45">Promedio diario</p>
              <p className="mt-1 font-semibold text-white">
                {money(calendar.averageDaily)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-white/45">
        {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {calendar.cells.map((cell, index) => (
          <div
            key={`${cell.day ?? "blank"}-${index}`}
            className={`min-h-[88px] rounded-2xl p-2 text-left ring-1 transition md:min-h-[112px] ${
              cell.day
                ? expenseTone(cell.amount, calendar.maxDay)
                : "bg-transparent ring-transparent"
            }`}
            title={cell.day ? `${cell.day}: ${money(cell.amount)}` : undefined}
          >
            {cell.day && (
              <>
                <p className="text-xs font-semibold text-white/70">{cell.day}</p>
                {cell.amount > 0 && (
                  <>
                    <p className="mt-2 break-words text-xs font-semibold leading-snug text-white md:text-sm">
                      {money(cell.amount)}
                    </p>
                    <p className="mt-1 text-[11px] text-white/55">
                      {cell.count} trxn
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
          <span>Intensidad:</span>
          <span className="rounded-full bg-cyan-300/10 px-2 py-1 ring-1 ring-cyan-200/20">
            Bajo
          </span>
          <span className="rounded-full bg-amber-300/15 px-2 py-1 ring-1 ring-amber-200/25">
            Medio
          </span>
          <span className="rounded-full bg-orange-400/20 px-2 py-1 ring-1 ring-orange-300/30">
            Alto
          </span>
          <span className="rounded-full bg-rose-400/25 px-2 py-1 ring-1 ring-rose-300/35">
            Muy alto
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-white/60 lg:justify-end">
          {calendar.costlyDays.length === 0 ? (
            <span className="rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/10">
              Sin gastos en {monthLabel(activeMonth)}
            </span>
          ) : (
            calendar.costlyDays.map((item) => (
              <span
                key={item.day}
                className="rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/10"
              >
                Dia {item.day}:{" "}
                <span className="font-semibold text-white">{money(item.amount)}</span>
              </span>
            ))
          )}
        </div>
      </div>
    </motion.section>
  );
}
