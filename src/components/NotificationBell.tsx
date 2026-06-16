"use client";

import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  WalletCards,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import type { PaymentNotification } from "@/lib/notifications";

type NotificationBellProps = {
  notifications: PaymentNotification[];
};

function notificationTone(type: PaymentNotification["type"]) {
  if (type === "overdue") {
    return {
      card: "notification-card-overdue border-rose-300/30 bg-rose-500/10",
      icon: "bg-rose-400/15 text-rose-100 ring-rose-300/20",
      badge: "bg-rose-400/15 text-rose-100 ring-rose-300/20",
      label: "Vencido",
      Icon: AlertTriangle,
      style: {
        "--notification-card-bg": "rgba(244, 63, 94, 0.12)",
        "--notification-card-border": "rgba(253, 164, 175, 0.32)",
        "--notification-accent-bg": "rgba(244, 63, 94, 0.16)",
        "--notification-accent-color": "#fecdd3",
      } as CSSProperties,
    };
  }

  if (type === "budget-overrun" || type === "cashflow-overrun") {
    return {
      card: "notification-card-overdue border-rose-300/30 bg-rose-500/10",
      icon: "bg-rose-400/15 text-rose-100 ring-rose-300/20",
      badge: "bg-rose-400/15 text-rose-100 ring-rose-300/20",
      label: type === "cashflow-overrun" ? "Flujo" : "Presupuesto",
      Icon: AlertTriangle,
      style: {
        "--notification-card-bg": "rgba(244, 63, 94, 0.12)",
        "--notification-card-border": "rgba(253, 164, 175, 0.32)",
        "--notification-accent-bg": "rgba(244, 63, 94, 0.16)",
        "--notification-accent-color": "#fecdd3",
      } as CSSProperties,
    };
  }

  return {
    card: "notification-card-upcoming border-amber-300/30 bg-amber-500/10",
    icon: "bg-amber-400/15 text-amber-100 ring-amber-300/20",
    badge: "bg-amber-400/15 text-amber-100 ring-amber-300/20",
    label: "Próximo",
    Icon: WalletCards,
    style: {
      "--notification-card-bg": "rgba(245, 158, 11, 0.12)",
      "--notification-card-border": "rgba(252, 211, 77, 0.32)",
      "--notification-accent-bg": "rgba(245, 158, 11, 0.16)",
      "--notification-accent-color": "#fde68a",
    } as CSSProperties,
  };
}

export function NotificationBell({ notifications }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [activeView, setActiveView] = useState<"pending" | "history">("pending");
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchReadNotifications = async () => {
      try {
        const res = await fetch("/api/notifications/read", { cache: "no-store" });
        const json = await res.json();
        if (mounted && json.ok && Array.isArray(json.data)) {
          setReadIds(new Set(json.data as string[]));
        }
      } catch {
        // Keep notifications visible if read-state cannot be loaded.
      }
    };

    fetchReadNotifications();
    return () => {
      mounted = false;
    };
  }, []);

  const availableNotifications = useMemo(
    () =>
      notifications.filter((item) => !item.type.startsWith("debt")),
    [notifications]
  );
  const pendingNotifications = useMemo(
    () => availableNotifications.filter((item) => !readIds.has(item.id)),
    [availableNotifications, readIds]
  );
  const readNotifications = useMemo(
    () => availableNotifications.filter((item) => readIds.has(item.id)),
    [availableNotifications, readIds]
  );
  const visibleNotifications = useMemo(
    () => (activeView === "pending" ? pendingNotifications : readNotifications),
    [activeView, pendingNotifications, readNotifications]
  );
  const unreadCount = pendingNotifications.length;
  const summary = useMemo(() => {
    const overdue = pendingNotifications.filter((item) => item.type === "overdue").length;
    const upcoming = pendingNotifications.filter((item) => item.type === "upcoming").length;
    const budget = pendingNotifications.filter(
      (item) => item.type === "budget-overrun" || item.type === "cashflow-overrun"
    ).length;
    return { overdue, upcoming, budget };
  }, [pendingNotifications]);

  const markAsRead = async (notificationIds: string[]) => {
    const ids = notificationIds.filter(Boolean);
    if (ids.length === 0 || markingRead) return;

    setMarkingRead(true);
    const previous = readIds;
    setReadIds((current) => new Set([...current, ...ids]));

    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: ids }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "No se pudo marcar como leida.");
    } catch {
      setReadIds(previous);
    } finally {
      setMarkingRead(false);
    }
  };

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

            <div className="mt-4 grid grid-cols-2 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
              <button
                onClick={() => setActiveView("pending")}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  activeView === "pending"
                    ? "bg-white text-slate-950"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Pendientes ({pendingNotifications.length})
              </button>
              <button
                onClick={() => setActiveView("history")}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  activeView === "history"
                    ? "bg-white text-slate-950"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Historico ({readNotifications.length})
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={() =>
                  markAsRead(pendingNotifications.map((item) => item.id))
                }
                disabled={markingRead}
                className="mt-4 w-full rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Marcar todas como leidas
              </button>
            )}

            {unreadCount > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="notification-summary-card notification-summary-overdue rounded-2xl bg-rose-500/10 p-3 ring-1 ring-rose-300/20">
                  <p className="text-lg font-semibold text-rose-100">{summary.overdue}</p>
                  <p className="text-[11px] font-medium text-rose-100/80">Vencidas</p>
                </div>
                <div className="notification-summary-card notification-summary-upcoming rounded-2xl bg-amber-500/10 p-3 ring-1 ring-amber-300/20">
                  <p className="text-lg font-semibold text-amber-100">{summary.upcoming}</p>
                  <p className="text-[11px] font-medium text-amber-100/80">Próximas</p>
                </div>
                <div className="notification-summary-card notification-summary-overdue rounded-2xl bg-rose-500/10 p-3 ring-1 ring-rose-300/20">
                  <p className="text-lg font-semibold text-rose-100">{summary.budget}</p>
                  <p className="text-[11px] font-medium text-rose-100/80">Presupuesto</p>
                </div>
              </div>
            )}
          </div>

          {visibleNotifications.length === 0 ? (
            <div className="p-5">
              <div className="notification-empty rounded-2xl bg-emerald-400/10 p-4 text-sm text-emerald-100 ring-1 ring-emerald-300/20">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  {activeView === "pending" ? "Todo tranquilo" : "Sin historico"}
                </div>
                {activeView === "pending"
                  ? "No tienes alertas por ahora."
                  : "Las notificaciones marcadas como leidas apareceran aqui."}
              </div>
            </div>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
              {visibleNotifications.map((notification) => {
                const tone = notificationTone(notification.type);
                const Icon = tone.Icon;

                return (
                  <div
                    key={notification.id}
                    className={`notification-card rounded-2xl border p-3 ${tone.card}`}
                    style={{
                      ...tone.style,
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
                        {activeView === "pending" ? (
                          <button
                            onClick={() => markAsRead([notification.id])}
                            disabled={markingRead}
                            className="mt-3 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold ring-1 ring-white/10 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                            style={{ color: "var(--notification-message-color)" }}
                          >
                            Marcar como leida
                          </button>
                        ) : (
                          <p
                            className="mt-3 text-[11px] font-semibold"
                            style={{ color: "var(--notification-message-color)" }}
                          >
                            Leida
                          </p>
                        )}
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
