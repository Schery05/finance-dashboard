export type Budget = {
  id: string;
  category: string;
  monthlyLimit: number;
  period: string;
  createdAt: string;
};

export const BUDGETS_STORAGE_KEY = "propiafinance:budgets";

export function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export function loadBudgets(): Budget[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(BUDGETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Budget[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBudgets(budgets: Budget[]) {
  window.localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(budgets));
}
