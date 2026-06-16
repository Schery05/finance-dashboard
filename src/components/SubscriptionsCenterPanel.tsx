"use client";

import {
  AlertTriangle,
  CalendarDays,
  Edit3,
  Pause,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
  detectSubscriptionSuggestions,
  getSubscriptionCategoryTotals,
  getSubscriptionSummary,
  getUpcomingSubscriptionCharges,
  SUBSCRIPTION_CATEGORIES,
  type Subscription,
  type SubscriptionFrequency,
  type SubscriptionInput,
  type SubscriptionStatus,
  type SubscriptionSuggestion,
} from "@/lib/subscriptions";
import { useFinanceStore } from "@/store/financeStore";

const FREQUENCIES: SubscriptionFrequency[] = [
  "Mensual",
  "Bimestral",
  "Trimestral",
  "Semestral",
  "Anual",
];
const STATUSES: SubscriptionStatus[] = ["Activa", "Pausada", "Cancelada"];
const CURRENCIES = ["DOP", "USD", "EUR"];

const money = (value: number, currency = "DOP") =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency,
  }).format(Number.isFinite(value) ? value : 0);

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): SubscriptionInput {
  return {
    name: "",
    category: "Streaming",
    amount: 0,
    currency: "DOP",
    frequency: "Mensual",
    nextChargeDate: todayInputValue(),
    autoRenew: true,
    status: "Activa",
    notes: "",
  };
}

function daysUntil(dateValue: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateValue}T00:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function dateLabel(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function SubscriptionsCenterPanel() {
  const transactions = useFinanceStore((state) => state.transactions);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [form, setForm] = useState<SubscriptionInput>(() => emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchSubscriptions = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/subscriptions", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "No se pudieron cargar suscripciones.");
      setSubscriptions(json.data as Subscription[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando suscripciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const categories = useMemo(() => {
    return Array.from(
      new Set([
        ...SUBSCRIPTION_CATEGORIES,
        ...subscriptions.map((item) => item.category).filter(Boolean),
      ])
    ).sort((a, b) => a.localeCompare(b));
  }, [subscriptions]);

  const summary = useMemo(
    () => getSubscriptionSummary(subscriptions),
    [subscriptions]
  );
  const upcoming = useMemo(
    () => getUpcomingSubscriptionCharges(subscriptions, 8),
    [subscriptions]
  );
  const categoryTotals = useMemo(
    () => getSubscriptionCategoryTotals(subscriptions),
    [subscriptions]
  );
  const suggestions = useMemo(
    () => detectSubscriptionSuggestions({ transactions, subscriptions }),
    [transactions, subscriptions]
  );

  const updateForm = <K extends keyof SubscriptionInput>(
    key: K,
    value: SubscriptionInput[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setCustomCategory("");
    setForm(emptyForm());
    setError("");
  };

  const saveSubscription = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const category = customCategory.trim() || form.category;
      const payload = { ...form, category, amount: Number(form.amount) || 0 };
      const res = await fetch("/api/subscriptions", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId ? { id: editingId, subscription: payload } : payload
        ),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "No se pudo guardar.");
      await fetchSubscriptions();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando suscripcion.");
    } finally {
      setSaving(false);
    }
  };

  const editSubscription = (subscription: Subscription) => {
    setEditingId(subscription.id);
    setForm({
      name: subscription.name,
      category: categories.includes(subscription.category)
        ? subscription.category
        : "Otras",
      amount: subscription.amount,
      currency: subscription.currency,
      frequency: subscription.frequency,
      nextChargeDate: subscription.nextChargeDate,
      autoRenew: subscription.autoRenew,
      status: subscription.status,
      notes: subscription.notes,
    });
    setCustomCategory(
      categories.includes(subscription.category) ? "" : subscription.category
    );
  };

  const updateStatus = async (subscription: Subscription, status: SubscriptionStatus) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: subscription.id,
          subscription: { ...subscription, status },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "No se pudo actualizar.");
      await fetchSubscriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando estado.");
    } finally {
      setSaving(false);
    }
  };

  const cancelSubscription = async (subscription: Subscription) => {
    await updateStatus(subscription, "Cancelada");
  };

  const applySuggestion = (suggestion: SubscriptionSuggestion) => {
    setEditingId(null);
    setCustomCategory(
      categories.includes(suggestion.category) ? "" : suggestion.category
    );
    setForm({
      name: suggestion.name,
      category: categories.includes(suggestion.category)
        ? suggestion.category
        : "Otras",
      amount: suggestion.amount,
      currency: suggestion.currency,
      frequency: suggestion.frequency,
      nextChargeDate: suggestion.nextChargeDate,
      autoRenew: true,
      status: "Activa",
      notes: `Detectada automaticamente (${suggestion.occurrences} ocurrencias).`,
    });
  };

  return (
    <section className="space-y-4">
      {error && (
        <div className="rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-100 ring-1 ring-rose-300/20">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="glass p-5">
          <p className="text-sm text-white/55">Activas</p>
          <p className="mt-2 text-3xl font-semibold">{summary.activeCount}</p>
        </div>
        <div className="glass p-5">
          <p className="text-sm text-white/55">Costo mensual total</p>
          <p className="mt-2 break-words text-2xl font-semibold">
            {money(summary.monthlyTotal)}
          </p>
        </div>
        <div className="glass p-5">
          <p className="text-sm text-white/55">Costo anual total</p>
          <p className="mt-2 break-words text-2xl font-semibold">
            {money(summary.annualTotal)}
          </p>
        </div>
        <div className="glass p-5">
          <p className="text-sm text-white/55">Proximo cobro</p>
          <p className="mt-2 text-lg font-semibold">
            {summary.upcoming
              ? `${summary.upcoming.name} - ${dateLabel(summary.upcoming.nextChargeDate)}`
              : "Sin cobros"}
          </p>
          <p className="mt-1 text-xs text-white/45">
            Mayor costo: {summary.highestCost?.name ?? "N/A"}
          </p>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="glass p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-200" />
            <h3 className="text-base font-semibold">Suscripciones sugeridas</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.key}
                className="rounded-2xl bg-amber-400/10 p-4 ring-1 ring-amber-300/20"
              >
                <p className="font-semibold">
                  Se detecto un gasto recurrente con {suggestion.name} por{" "}
                  {money(suggestion.amount)}.
                </p>
                <p className="mt-1 text-sm text-white/60">
                  {suggestion.occurrences} ocurrencias. Proximo cobro sugerido:{" "}
                  {suggestion.nextChargeDate}.
                </p>
                <button
                  type="button"
                  onClick={() => applySuggestion(suggestion)}
                  className="mt-3 rounded-xl bg-amber-200 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-100"
                >
                  Agregar como suscripcion
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[420px_1fr]">
        <div className="glass p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">
                {editingId ? "Editar suscripcion" : "Nueva suscripcion"}
              </h3>
              <p className="mt-1 text-sm text-white/50">
                Registra servicios recurrentes y renovaciones.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl bg-white/5 p-2 ring-1 ring-white/10"
                aria-label="Cancelar edicion"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-sm text-white/70">
              Nombre del servicio
              <input
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="Netflix, Spotify, ChatGPT Plus..."
                className="budget-input mt-1"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-white/70">
                Categoria
                <div className="mt-1">
                  <CustomSelect
                    value={form.category}
                    onChange={(value) =>
                      updateForm("category", value as SubscriptionInput["category"])
                    }
                    options={categories.map((item) => ({ value: item, label: item }))}
                  />
                </div>
              </label>
              <label className="text-sm text-white/70">
                Categoria personalizada
                <input
                  value={customCategory}
                  onChange={(event) => setCustomCategory(event.target.value)}
                  placeholder="Opcional"
                  className="budget-input mt-1"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-white/70">
                Monto
                <input
                  value={form.amount || ""}
                  onChange={(event) =>
                    updateForm("amount", Number(event.target.value))
                  }
                  inputMode="decimal"
                  placeholder="0.00"
                  className="budget-input mt-1"
                />
              </label>
              <label className="text-sm text-white/70">
                Moneda
                <div className="mt-1">
                  <CustomSelect
                    value={form.currency}
                    onChange={(value) => updateForm("currency", value)}
                    options={CURRENCIES.map((item) => ({ value: item, label: item }))}
                  />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-white/70">
                Frecuencia
                <div className="mt-1">
                  <CustomSelect
                    value={form.frequency}
                    onChange={(value) =>
                      updateForm("frequency", value as SubscriptionFrequency)
                    }
                    options={FREQUENCIES.map((item) => ({ value: item, label: item }))}
                  />
                </div>
              </label>
              <label className="text-sm text-white/70">
                Proximo cobro
                <input
                  type="date"
                  value={form.nextChargeDate}
                  onChange={(event) =>
                    updateForm("nextChargeDate", event.target.value)
                  }
                  className="budget-input mt-1"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-white/70">
                Estado
                <div className="mt-1">
                  <CustomSelect
                    value={form.status}
                    onChange={(value) =>
                      updateForm("status", value as SubscriptionStatus)
                    }
                    options={STATUSES.map((item) => ({ value: item, label: item }))}
                  />
                </div>
              </label>
              <label className="flex min-h-[70px] items-center gap-3 rounded-2xl bg-white/5 px-3 text-sm text-white/75 ring-1 ring-white/10">
                <input
                  type="checkbox"
                  checked={form.autoRenew}
                  onChange={(event) => updateForm("autoRenew", event.target.checked)}
                  className="h-4 w-4 accent-cyan-300"
                />
                Renovacion automatica
              </label>
            </div>

            <label className="text-sm text-white/70">
              Observaciones
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                rows={3}
                placeholder="Plan, usuarios, comentario..."
                className="budget-input mt-1 resize-none"
              />
            </label>

            <button
              type="button"
              onClick={saveSubscription}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
            >
              {editingId ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Registrar suscripcion"}
            </button>
          </div>
        </div>

        <div className="glass min-w-0 p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold">Centro de Suscripciones</h3>
              <p className="text-sm text-white/50">
                {subscriptions.length} servicio(s) registrados
              </p>
            </div>
            <button
              type="button"
              onClick={fetchSubscriptions}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10"
            >
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl ring-1 ring-white/10">
            <table className="min-w-[820px] w-full text-sm">
              <thead className="bg-white/5 text-white/60">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Servicio</th>
                  <th className="px-4 py-3 text-left font-medium">Monto</th>
                  <th className="px-4 py-3 text-left font-medium">Proximo cobro</th>
                  <th className="px-4 py-3 text-left font-medium">Frecuencia</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id} className="border-t border-white/10">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{subscription.name}</p>
                      <p className="text-xs text-white/45">{subscription.category}</p>
                    </td>
                    <td className="px-4 py-3">
                      {money(subscription.amount, subscription.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {daysUntil(subscription.nextChargeDate) >= 0 &&
                          [1, 3, 7].includes(daysUntil(subscription.nextChargeDate)) && (
                            <AlertTriangle className="h-4 w-4 text-amber-200" />
                          )}
                        {subscription.nextChargeDate}
                      </div>
                    </td>
                    <td className="px-4 py-3">{subscription.frequency}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                          subscription.status === "Activa"
                            ? "bg-emerald-400/10 text-emerald-200 ring-emerald-300/20"
                            : subscription.status === "Pausada"
                              ? "bg-amber-400/10 text-amber-200 ring-amber-300/20"
                              : "bg-rose-400/10 text-rose-200 ring-rose-300/20"
                        }`}
                      >
                        {subscription.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => editSubscription(subscription)}
                          className="rounded-xl bg-white/5 p-2 ring-1 ring-white/10"
                          aria-label={`Editar ${subscription.name}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(subscription, "Pausada")}
                          className="rounded-xl bg-amber-400/10 p-2 text-amber-100 ring-1 ring-amber-300/20"
                          aria-label={`Pausar ${subscription.name}`}
                        >
                          <Pause className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelSubscription(subscription)}
                          className="rounded-xl bg-rose-400/10 p-2 text-rose-100 ring-1 ring-rose-300/20"
                          aria-label={`Cancelar ${subscription.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-white/50">
                      {loading
                        ? "Cargando suscripciones..."
                        : "Aun no tienes suscripciones registradas."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <div className="glass p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-cyan-200" />
            <h3 className="text-base font-semibold">Calendario de cobros</h3>
          </div>
          <div className="space-y-2">
            {upcoming.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-1 gap-2 rounded-2xl bg-white/[0.04] p-3 text-sm ring-1 ring-white/10 sm:grid-cols-[90px_1fr_auto] sm:items-center"
              >
                <span className="font-semibold text-cyan-100">
                  {dateLabel(item.nextChargeDate)}
                </span>
                <span>{item.name}</span>
                <span className="font-semibold">
                  {money(item.amount, item.currency)}
                </span>
              </div>
            ))}
            {upcoming.length === 0 && (
              <div className="rounded-2xl bg-white/[0.04] p-4 text-sm text-white/55 ring-1 ring-white/10">
                No hay cobros activos proximos.
              </div>
            )}
          </div>
        </div>

        <div className="glass p-5">
          <div className="mb-4 flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-emerald-200" />
            <h3 className="text-base font-semibold">Distribucion por categorias</h3>
          </div>
          <div className="space-y-3">
            {categoryTotals.map((item) => {
              const percent =
                summary.monthlyTotal > 0 ? (item.amount / summary.monthlyTotal) * 100 : 0;
              return (
                <div key={item.category}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span>{item.category}</span>
                    <span className="font-semibold">{money(item.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-300"
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {categoryTotals.length === 0 && (
              <div className="rounded-2xl bg-white/[0.04] p-4 text-sm text-white/55 ring-1 ring-white/10">
                Sin suscripciones activas para agrupar.
              </div>
            )}
          </div>
        </div>
      </div>

      {upcoming
        .filter((item) => [1, 3, 7].includes(daysUntil(item.nextChargeDate)))
        .map((item) => (
          <div
            key={`alert-${item.id}`}
            className="rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-50 ring-1 ring-amber-300/20"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
              <div>
                <p className="font-semibold">Cobro proximo</p>
                <p className="mt-1 text-amber-50/80">
                  {item.name} se renovara{" "}
                  {daysUntil(item.nextChargeDate) === 1
                    ? "mañana"
                    : `en ${daysUntil(item.nextChargeDate)} dias`}{" "}
                  por {money(item.amount, item.currency)}.
                </p>
              </div>
            </div>
          </div>
        ))}
    </section>
  );
}
