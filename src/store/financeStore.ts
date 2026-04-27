import { create } from "zustand";
import type { Transaction } from "@/lib/types";
import type { TransactionInput } from "@/lib/validators";

type MonthFilter = "Todos" | string; // "2026-02"
type TypeFilter = "Todos" | "Ingreso" | "Gasto";
type StatusFilter = "Todos" | "Pagado" | "Pendiente";

interface FinanceState {
  loading: boolean;
  error?: string;
  transactions: Transaction[];

  search: string;
  month: MonthFilter;
  type: TypeFilter;
  status: StatusFilter;

  setSearch: (v: string) => void;
  setMonth: (v: MonthFilter) => void;
  setType: (v: TypeFilter) => void;
  setStatus: (v: StatusFilter) => void;

  fetchTransactions: () => Promise<void>;
  addTransaction: (tx: TransactionInput) => Promise<void>;
  updateTransaction: (id: string, tx: Omit<TransactionInput, "ID">) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  loading: false,
  transactions: [],
  search: "",
  month: "Todos",
  type: "Todos",
  status: "Todos",

  setSearch: (v) => set({ search: v }),
  setMonth: (v) => set({ month: v }),
  setType: (v) => set({ type: v }),
  setStatus: (v) => set({ status: v }),

  fetchTransactions: async () => {
    set({ loading: true, error: undefined });
    console.log("Fetching /api/transactions...", new Date().toISOString());
    try {
      const res = await fetch("/api/transactions", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Fetch failed");
      set({ transactions: json.data, loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? "Error", loading: false });
    }
  },

  addTransaction: async (tx) => {
    set({ loading: true, error: undefined });
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tx),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Insert failed");
      await get().fetchTransactions();
    } catch (e: any) {
      set({ error: e?.message ?? "Error", loading: false });
    }
  },

  updateTransaction: async (id, tx) => {
  set({ loading: true, error: undefined });
  try {
    const res = await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, transaction: tx }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "Update failed");
    await get().fetchTransactions();
  } catch (e: any) {
    set({ error: e?.message ?? "Error", loading: false });
  }
},
  
}));

