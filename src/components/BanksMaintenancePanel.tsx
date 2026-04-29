"use client";

import { Landmark, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  addManagedBank,
  deleteManagedBank,
  fetchManagedBanks,
  loadDefaultBanks,
  type ManagedBank,
} from "@/lib/banks";

export function BanksMaintenancePanel() {
  const [banks, setBanks] = useState<ManagedBank[]>(() => loadDefaultBanks());
  const [name, setName] = useState("");
  const [bankToDelete, setBankToDelete] = useState<ManagedBank | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchManagedBanks();
        if (mounted) setBanks(data);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Error cargando bancos");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    refresh();
    return () => {
      mounted = false;
    };
  }, []);

  const addBank = async () => {
    const value = name.trim();
    if (!value || saving) return;

    const exists = banks.some(
      (bank) => bank.name.toLowerCase() === value.toLowerCase()
    );
    if (exists) {
      setName("");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const next = await addManagedBank(value);
      setBanks(next);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error agregando banco");
    } finally {
      setSaving(false);
    }
  };

  const removeBank = async (bank: ManagedBank) => {
    if (saving) return;

    setSaving(true);
    setError(null);
    try {
      const next = await deleteManagedBank(bank.id);
      setBanks(next);
      setBankToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando banco");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="glass p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Listado Bancos</h2>
            <p className="mt-1 text-sm text-white/60">
              Administra los bancos disponibles al registrar deudas.
            </p>
          </div>
          <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300 ring-1 ring-cyan-300/20">
            <Landmark className="h-5 w-5" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="text-sm text-white/70">
            Nuevo banco
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addBank();
              }}
              placeholder="Ej. Banco Popular Dominicano"
              className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60"
            />
          </label>

          <button
            onClick={addBank}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {saving ? "Guardando..." : "Agregar"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-rose-300/20">
            {error}
          </div>
        )}
      </div>

      <div className="glass p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold">Bancos registrados</h3>
          <p className="mt-1 text-sm text-white/55">
            {banks.length} banco(s) disponible(s).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/55 ring-1 ring-white/10 md:col-span-2 xl:col-span-3">
              Cargando bancos...
            </div>
          ) : banks.length === 0 ? (
            <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/55 ring-1 ring-white/10 md:col-span-2 xl:col-span-3">
              No hay bancos registrados.
            </div>
          ) : (
            banks.map((bank) => (
              <div
                key={bank.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
              >
                <p className="min-w-0 break-words text-sm text-white/85">
                  {bank.name}
                </p>
                <button
                  onClick={() => setBankToDelete(bank)}
                  disabled={saving}
                  className="flex-none rounded-xl bg-rose-500/10 p-2 text-rose-200 ring-1 ring-rose-300/20 transition hover:bg-rose-500/15"
                  aria-label={`Eliminar ${bank.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {bankToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl shadow-black/50">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-rose-500/10 p-3 text-rose-200 ring-1 ring-rose-300/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold">Eliminar banco</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Estas seguro de que deseas quitar{" "}
                  <span className="font-semibold text-white">
                    {bankToDelete.name}
                  </span>{" "}
                  del listado?
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setBankToDelete(null)}
                disabled={saving}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15"
              >
                No
              </button>
              <button
                onClick={() => removeBank(bankToDelete)}
                disabled={saving}
                className="rounded-xl bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-300 disabled:opacity-60"
              >
                {saving ? "Eliminando..." : "Si"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
