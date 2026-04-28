"use client";

import { Edit3, Plus, Tags, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  addManagedCategory,
  deleteManagedCategory,
  fetchManagedCategories,
  loadManagedCategories,
  renameManagedCategory,
  type CategoryType,
  type ManagedCategories,
} from "@/lib/categories";

const categoryTypes: CategoryType[] = ["Ingreso", "Gasto"];

export function CategoriesMaintenancePanel() {
  const [categories, setCategories] = useState<ManagedCategories>(() =>
    loadManagedCategories()
  );
  const [type, setType] = useState<CategoryType>("Gasto");
  const [name, setName] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<{
    name: string;
    type: CategoryType;
  } | null>(null);
  const [categoryToEdit, setCategoryToEdit] = useState<{
    name: string;
    type: CategoryType;
  } | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchManagedCategories();
        if (mounted) setCategories(data);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Error cargando categorias"
          );
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

  const visibleCategories = useMemo(() => categories[type], [categories, type]);

  const addCategory = async () => {
    const value = name.trim();
    if (!value || saving) return;

    const exists = categories[type].some(
      (category) => category.toLowerCase() === value.toLowerCase()
    );
    if (exists) {
      setName("");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const next = await addManagedCategory(type, value);
      setCategories(next);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error agregando categoria");
    } finally {
      setSaving(false);
    }
  };

  const removeCategory = async (
    categoryToRemove: string,
    categoryType: CategoryType
  ) => {
    if (saving) return;

    setSaving(true);
    setError(null);
    try {
      const next = await deleteManagedCategory(categoryType, categoryToRemove);
      setCategories(next);
      setCategoryToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando categoria");
    } finally {
      setSaving(false);
    }
  };

  const openEditCategory = (categoryName: string, categoryType: CategoryType) => {
    setCategoryToEdit({ name: categoryName, type: categoryType });
    setEditName(categoryName);
    setError(null);
  };

  const renameCategory = async () => {
    if (!categoryToEdit || saving) return;

    const nextName = editName.trim();
    if (!nextName) {
      setError("El nuevo nombre de la categoria es obligatorio.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const next = await renameManagedCategory(
        categoryToEdit.type,
        categoryToEdit.name,
        nextName
      );
      setCategories(next);
      setCategoryToEdit(null);
      setEditName("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error renombrando categoria"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="glass p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Categorias</h2>
            <p className="mt-1 text-sm text-white/60">
              Administra categorias disponibles para ingresos y gastos.
            </p>
          </div>
          <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300 ring-1 ring-cyan-300/20">
            <Tags className="h-5 w-5" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr_auto] lg:items-end">
          <div>
            <p className="mb-2 text-sm text-white/70">Tipo</p>
            <div className="grid grid-cols-2 rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
              {categoryTypes.map((item) => (
                <button
                  key={item}
                  onClick={() => setType(item)}
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    type === item
                      ? "bg-white text-slate-950"
                      : "text-white/65 hover:text-white"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <label className="text-sm text-white/70">
            Nueva categoria
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addCategory();
              }}
              placeholder={`Ej. ${type === "Ingreso" ? "Dividendos" : "Mascotas"}`}
              className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60"
            />
          </label>

          <button
            onClick={addCategory}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
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
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Categorias de {type}</h3>
            <p className="mt-1 text-sm text-white/55">
              {visibleCategories.length} categoria(s) registradas.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/55 ring-1 ring-white/10 md:col-span-2 xl:col-span-3">
              Cargando categorias...
            </div>
          ) : visibleCategories.length === 0 ? (
            <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/55 ring-1 ring-white/10 md:col-span-2 xl:col-span-3">
              No hay categorias registradas para este tipo.
            </div>
          ) : (
            visibleCategories.map((category) => (
            <div
              key={category}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
            >
              <p className="min-w-0 break-words text-sm text-white/85">
                {category}
              </p>
              <div className="flex flex-none items-center gap-2">
                <button
                  onClick={() => openEditCategory(category, type)}
                  disabled={saving}
                  className="rounded-xl bg-white/5 p-2 text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                  aria-label={`Editar ${category}`}
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCategoryToDelete({ name: category, type })}
                  disabled={saving}
                  className="rounded-xl bg-rose-500/10 p-2 text-rose-200 ring-1 ring-rose-300/20 transition hover:bg-rose-500/15"
                  aria-label={`Eliminar ${category}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            ))
          )}
        </div>
      </div>

      {categoryToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl shadow-black/50">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-200 ring-1 ring-cyan-300/20">
                <Edit3 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold">Editar categoria</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  El cambio se reflejara en transacciones y presupuesto que usan{" "}
                  <span className="font-semibold text-white">
                    {categoryToEdit.name}
                  </span>
                  .
                </p>
              </div>
            </div>

            <label className="mt-5 block text-sm text-white/70">
              Nuevo nombre
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") renameCategory();
                }}
                className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/45 focus:ring-2 focus:ring-cyan-300/60"
              />
            </label>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setCategoryToEdit(null)}
                disabled={saving}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15"
              >
                Cancelar
              </button>
              <button
                onClick={renameCategory}
                disabled={saving}
                className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl shadow-black/50">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-rose-500/10 p-3 text-rose-200 ring-1 ring-rose-300/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold">Eliminar categoria</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Estas seguro de que deseas eliminar la categoria{" "}
                  <span className="font-semibold text-white">
                    {categoryToDelete.name}
                  </span>{" "}
                  de {categoryToDelete.type}?
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setCategoryToDelete(null)}
                disabled={saving}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/15"
              >
                No
              </button>
              <button
                onClick={() =>
                  removeCategory(categoryToDelete.name, categoryToDelete.type)
                }
                disabled={saving}
                className="rounded-xl bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-300"
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
