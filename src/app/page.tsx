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

export default function Page() {
  const { transactions, fetchTransactions, loading, error } = useFinanceStore();
 // const txs = transactions; // o como lo tengas
  const [open, setOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);



  useEffect(() => {
    fetchTransactions();
     if (!txs?.length) return;

  console.log("SAMPLE TX:", txs[0]);
  console.log("TIPOS únicos:", [...new Set(txs.map(t => String((t as any).Tipo)))].slice(0, 30));
  console.log("ESTADOS únicos:", [...new Set(txs.map(t => String((t as any).EstadoPago)))].slice(0, 30));
  
    console.log("Polling started");
    const id = setInterval(fetchTransactions, 5000);
    return () => clearInterval(id);
  }, [fetchTransactions]);

  const txs = useMemo(() => {
    // opcional: ordenar por fecha desc
    return [...transactions].sort((a, b) => String(b.Fecha).localeCompare(String(a.Fecha)));
  }, [transactions]);

  console.log("SAMPLE TX:", txs?.[0]);
console.log("TIPOS únicos:", Array.from(new Set(txs.map(t => t.Tipo))).slice(0, 20));
console.log("ESTADOS únicos:", Array.from(new Set(txs.map(t => t.EstadoPago))).slice(0, 20));
console.log("CATEGORÍAS sample:", Array.from(new Set(txs.map(t => t.Categoría))).slice(0, 10));
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
          setEditingTx(t);
          setOpen(true);
        }}
/>


      </div>

     <FloatingAddButton
         onClick={() => {
        setEditingTx(null);
        setOpen(true);

        
  }}
/>
   
   
<AddTransactionModal
  open={open}
  onClose={() => setOpen(false)}
  editing={editingTx}
/>
    </DashboardShell>
  );


  
}