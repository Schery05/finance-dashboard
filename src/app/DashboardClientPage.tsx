"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { MetricCards } from "@/components/MetricCards";
import { ChartsPanel } from "@/components/ChartsPanel";
import { TransactionsTable } from "@/components/TransactionsTable";
import { FloatingAddButton } from "@/components/FloatingAddButton";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import { useFinanceStore } from "@/store/financeStore";
import type { Transaction } from "@/lib/types";

export default function DashboardClientPage() {
  const { transactions, fetchTransactions, loading, error } = useFinanceStore();

  const [open, setOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [cloningTx, setCloningTx] = useState<Transaction | null>(null);

  const txs = useMemo(() => {
    return [...transactions].sort((a, b) =>
      String(b.Fecha).localeCompare(String(a.Fecha))
    );
  }, [transactions]);

  useEffect(() => {
    fetchTransactions();

    const id = setInterval(() => {
      fetchTransactions();
    }, 5000);

    return () => clearInterval(id);
  }, [fetchTransactions]);

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

        <MetricCards txs={txs} />
        <ChartsPanel txs={txs} />

        <div className="flex items-center justify-between">
          <p className="text-sm text-white/60">
            {loading ? "Actualizando..." : "Listo"} • refresh cada 5s
          </p>
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
    </DashboardShell>
  );
}
