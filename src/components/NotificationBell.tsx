"use client";

import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CreditCard,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { PaymentNotification } from "@/lib/notifications";

type NotificationBellProps = {
  notifications: PaymentNotification[];
};

function notificationTone(type: PaymentNotification["type"]) {
  if (type === "overdue") {
    return {
      card: "border-rose-300/25 bg-rose-500/10",
      icon: "bg-rose-400/15 text-rose-100 ring-rose-300/20",
      badge: "bg-rose-400/15 text-rose-100 ring-rose-300/20",
      label: "Vencido",
      Icon: AlertTriangle,
    };
  }

  if (type.startsWith("debt")) {
    return {
      card: "border-cyan-300/25 bg-cyan-500/10",
      icon: "bg-cyan-400/15 text-cyan-100 ring-cyan-300/20",
      badge: "bg-cyan-400/15 text-cyan-100 ring-cyan-300/20",
      label: "Deuda",
      Icon: CreditCard,
    };
  }

  return {
    card: "border-amber-300/25 bg-amber-500/10",
    icon: "bg-amber-400/15 text-amber-100 ring-amber-300/20",
    badge: "bg-amber-400/15 text-amber-100 ring-amber-300/20",
    label: "Proximo",
    Icon: WalletCards,
  };
}

export function NotificationBell({ notifications }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.length;
  const summary = useMemo(() => {
    const debts = notifications.filter((item) => item.type.startsWith("debt")).length;
    const overdue = notifications.filter((item) => item.type === "overdue").length;
    const upcoming = notifications.filter((item) => item.type === "upcoming").length;
    return { debts, overdue, upcoming };
  }, [notifications]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`notification-trigger relative flex h-11 w-11 items-center justify-center rounded-2xl text-white ring-1 transition ${
          open
            ? "bg-cyan-300/15 ring-cyan-300/30"
            : "bg-white/5 ring-white/10 hover:bg-white/10 hover:ring-white/20"
        }`}
        title="Notificaciones"
        aria-label="Abrir notificaciones"
      >
        <Bell className="h-5 w-5" />

        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow-lg shadow-rose-500/30 ring-2 ring-slate-950">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-panel absolute right-0 top-14 z-50 w-[min(92vw,420px)] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 text-white shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="notification-panel-header border-b border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Notificaciones</h3>
                <p className="notification-muted mt-1 text-xs text-white/50">
                  Alertas financieras y pagos pendientes
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="notification-close rounded-xl bg-white/5 p-2 text-white/60 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar notificaciones"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {unreadCount > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="notification-summary-card rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                  <p className="text-lg font-semibold text-rose-100">{summary.overdue}</p>
                  <p className="notification-muted text-[11px] text-white/45">Vencidas</p>
                </div>
                <div className="notification-summary-card rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                  <p className="text-lg font-semibold text-amber-100">{summary.upcoming}</p>
                  <p className="notification-muted text-[11px] text-white/45">Proximas</p>
                </div>
                <div className="notification-summary-card rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                  <p className="text-lg font-semibold text-cyan-100">{summary.debts}</p>
                  <p className="notification-muted text-[11px] text-white/45">Deudas</p>
                </div>
              </div>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-5">
              <div className="notification-empty rounded-2xl bg-emerald-400/10 p-4 text-sm text-emerald-100 ring-1 ring-emerald-300/20">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  Todo tranquilo
                </div>
                No tienes alertas por ahora.
              </div>
            </div>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
              {notifications.map((notification) => {
                const tone = notificationTone(notification.type);
                const Icon = tone.Icon;

                return (
                  <div
                    key={notification.id}
                    className={`notification-card rounded-2xl border p-3 ${tone.card}`}
                    style={{
                      background: "var(--notification-card-bg)",
                      borderColor: "var(--notification-card-border)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`notification-card-icon rounded-xl p-2 ring-1 ${tone.icon}`}
                        style={{
                          background: "var(--notification-accent-bg)",
                          color: "var(--notification-accent-color)",
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className="notification-title text-sm font-semibold text-white"
                            style={{ color: "var(--notification-title-color)" }}
                          >
                            {notification.title}
                          </p>
                          <span
                            className={`notification-badge rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone.badge}`}
                            style={{
                              background: "var(--notification-accent-bg)",
                              color: "var(--notification-accent-color)",
                            }}
                          >
                            {tone.label}
                          </span>
                        </div>
                        <p
                          className="notification-message mt-1 text-xs leading-5"
                          style={{ color: "var(--notification-message-color)" }}
                        >
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
