import type { Transaction } from "@/lib/types";

export type SubscriptionFrequency =
  | "Mensual"
  | "Bimestral"
  | "Trimestral"
  | "Semestral"
  | "Anual";

export type SubscriptionStatus = "Activa" | "Pausada" | "Cancelada";

export type Subscription = {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  frequency: SubscriptionFrequency;
  nextChargeDate: string;
  autoRenew: boolean;
  status: SubscriptionStatus;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SubscriptionInput = Omit<Subscription, "id" | "createdAt" | "updatedAt">;

export type SubscriptionSuggestion = {
  key: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  frequency: SubscriptionFrequency;
  nextChargeDate: string;
  occurrences: number;
};

export const SUBSCRIPTION_CATEGORIES = [
  "Streaming",
  "Musica",
  "Productividad",
  "IA",
  "Videojuegos",
  "Almacenamiento",
  "Otras",
];

const FREQUENCY_MONTHS: Record<SubscriptionFrequency, number> = {
  Mensual: 1,
  Bimestral: 2,
  Trimestral: 3,
  Semestral: 6,
  Anual: 12,
};

export function normalizeSubscriptionStatus(value: string): SubscriptionStatus {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "PAUSADA") return "Pausada";
  if (normalized === "CANCELADA") return "Cancelada";
  return "Activa";
}

export function normalizeSubscriptionFrequency(value: string): SubscriptionFrequency {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "bimestral") return "Bimestral";
  if (normalized === "trimestral") return "Trimestral";
  if (normalized === "semestral") return "Semestral";
  if (normalized === "anual") return "Anual";
  return "Mensual";
}

export function frequencyToMonthlyCost(amount: number, frequency: SubscriptionFrequency) {
  const months = FREQUENCY_MONTHS[frequency] ?? 1;
  return (Number(amount) || 0) / months;
}

export function frequencyToAnnualCost(amount: number, frequency: SubscriptionFrequency) {
  return frequencyToMonthlyCost(amount, frequency) * 12;
}

export function getActiveSubscriptions(subscriptions: Subscription[]) {
  return subscriptions.filter((item) => item.status === "Activa");
}

export function getSubscriptionSummary(subscriptions: Subscription[]) {
  const active = getActiveSubscriptions(subscriptions);
  const monthlyTotal = active.reduce(
    (sum, item) => sum + frequencyToMonthlyCost(item.amount, item.frequency),
    0
  );
  const annualTotal = active.reduce(
    (sum, item) => sum + frequencyToAnnualCost(item.amount, item.frequency),
    0
  );
  const upcoming = [...active]
    .filter((item) => Boolean(item.nextChargeDate))
    .sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate))[0];
  const highestCost = [...active].sort(
    (a, b) =>
      frequencyToMonthlyCost(b.amount, b.frequency) -
      frequencyToMonthlyCost(a.amount, a.frequency)
  )[0];

  return {
    activeCount: active.length,
    monthlyTotal,
    annualTotal,
    upcoming,
    highestCost,
  };
}

export function getSubscriptionCategoryTotals(subscriptions: Subscription[]) {
  const totals = new Map<string, number>();

  for (const item of getActiveSubscriptions(subscriptions)) {
    totals.set(
      item.category,
      (totals.get(item.category) ?? 0) +
        frequencyToMonthlyCost(item.amount, item.frequency)
    );
  }

  return Array.from(totals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function parseDateSafe(value: string) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const originalDay = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() !== originalDay) next.setDate(0);
  return next;
}

export function getUpcomingSubscriptionCharges(
  subscriptions: Subscription[],
  limit = 12
) {
  return getActiveSubscriptions(subscriptions)
    .filter((item) => Boolean(parseDateSafe(item.nextChargeDate)))
    .sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate))
    .slice(0, limit);
}

function normalizeText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function transactionCategory(tx: Transaction) {
  const entry = Object.entries(tx as unknown as Record<string, unknown>).find(
    ([key]) => normalizeText(key) === "categoria"
  );
  return String(entry?.[1] ?? "");
}

function monthKey(dateValue: string) {
  return String(dateValue ?? "").slice(0, 7);
}

function nextMonthlyDate(dateValue: string) {
  const date = parseDateSafe(dateValue);
  if (!date) return new Date().toISOString().slice(0, 10);
  let next = addMonths(date, 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (next < today) next = addMonths(next, 1);
  return next.toISOString().slice(0, 10);
}

export function detectSubscriptionSuggestions({
  transactions,
  subscriptions,
}: {
  transactions: Transaction[];
  subscriptions: Subscription[];
}): SubscriptionSuggestion[] {
  const existingNames = new Set(
    subscriptions.map((item) => normalizeText(item.name))
  );
  const groups = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (tx.Tipo !== "Gasto") continue;
    if (Number(tx.Importe) <= 0) continue;

    const category = transactionCategory(tx);
    const description = String(tx.DescripcionAdicional ?? "").trim();
    const merchant = normalizeText(description || category);
    if (!merchant) continue;

    const amount = (Number(tx.Importe) || 0).toFixed(2);
    const key = `${merchant}:${amount}`;
    const current = groups.get(key) ?? [];
    current.push(tx);
    groups.set(key, current);
  }

  return Array.from(groups.entries())
    .map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => String(a.Fecha).localeCompare(String(b.Fecha)));
      const monthCount = new Set(sorted.map((tx) => monthKey(tx.Fecha))).size;
      if (sorted.length < 2 || monthCount < 2) return null;

      const latest = sorted[sorted.length - 1];
      const category = transactionCategory(latest) || "Otras";
      const name = String(latest.DescripcionAdicional || category).trim();
      if (existingNames.has(normalizeText(name))) return null;

      return {
        key,
        name,
        category: category.toLowerCase().includes("suscrip")
          ? "Otras"
          : category,
        amount: Number(latest.Importe) || 0,
        currency: "DOP",
        frequency: "Mensual" as const,
        nextChargeDate: nextMonthlyDate(latest.Fecha),
        occurrences: sorted.length,
      };
    })
    .filter(Boolean)
    .slice(0, 5) as SubscriptionSuggestion[];
}
