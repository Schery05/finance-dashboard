"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { MetricCards } from "@/components/MetricCards";
import { ChartsPanel } from "@/components/ChartsPanel";
import { TransactionsTable } from "@/components/TransactionsTable";
import { FloatingAddButton } from "@/components/FloatingAddButton";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import { BankImportModal } from "@/components/BankImportModal";
import { useFinanceStore } from "@/store/financeStore";
import type { Transaction } from "@/lib/types";

export default function DashboardClientPage() {
  const { transactions, fetchTransactions, loading, error } = useFinanceStore();

  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [cloningTx, setCloningTx] = useState<Transaction | null>(null);
  const [dashboardTransactions, setDashboardTransactions] = useState<
    Transaction[] | null
  >(null);

  const txs = useMemo(() => {
    return [...transactions].sort((a, b) =>
      String(b.Fecha).localeCompare(String(a.Fecha))
    );
  }, [transactions]);

  const dashboardTxs = useMemo(() => {
    const source = dashboardTransactions ?? transactions;
    return [...source].sort((a, b) =>
      String(b.Fecha).localeCompare(String(a.Fecha))
    );
  }, [dashboardTransactions, transactions]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    setDashboardTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    const fetchDashboardTransactions = async () => {
      try {
        const res = await fetch("/api/transactions", { cache: "no-store" });
        const json = await res.json();
        if (json.ok) setDashboardTransactions(json.data as Transaction[]);
      } catch {
        // Keep the last dashboard snapshot if the background refresh fails.
      }
    };

    const id = setInterval(fetchDashboardTransactions, 60000);
    return () => clearInterval(id);
  }, []);

  const closeModal = () => {
    setOpen(false);
    setEditingTx(null);
    setCloningTx(null);
  };

  return (
    <DashboardShell>
      <div className="space-y-4">
        {error && (
          <div className="glass p-4 text-sm text-rose-200 ring-1 ring-rose-500/20">
            Error: {error}
          </div>
        )}

        <MetricCards txs={dashboardTxs} />
        <ChartsPanel txs={dashboardTxs} />
        {loading && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/60">Actualizando datos...</p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={() => setImportOpen(true)}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
          >
            Importar CSV bancario
          </button>
        </div>

        <TransactionsTable
          txs={txs}
          onEdit={(t) => {
            setCloningTx(null);
            setEditingTx(t);
            setOpen(true);
          }}
          onClone={(t) => {
            setEditingTx(null);
            setCloningTx(t);
            setOpen(true);
          }}
        />
      </div>

      <FloatingAddButton
        onClick={() => {
          setEditingTx(null);
          setCloningTx(null);
          setOpen(true);
        }}
      />

      <AddTransactionModal
        key={editingTx?.ID ?? cloningTx?.ID ?? "new"}
        open={open}
        onClose={closeModal}
        editing={editingTx}
        cloning={cloningTx}
      />
      <BankImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </DashboardShell>
  );
}

