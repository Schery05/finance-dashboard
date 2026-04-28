export type CategoryType = "Ingreso" | "Gasto";

export type ManagedCategories = Record<CategoryType, string[]>;

export const CATEGORIES_STORAGE_KEY = "propiafinance:categories";
export const CATEGORIES_UPDATED_EVENT = "propiafinance:categories-updated";

export const DEFAULT_GASTO_CATEGORIES = [
  "Ahorro Boda Jally",
  "Ahorro cooperativa (Personal)",
  "Ahorro Personal",
  "Ashley Universidad",
  "Combustible",
  "Compra Articulos Hogar",
  "Compra Colmado",
  "Compras Boda Jally",
  "Compras Colombia",
  "Compras GYM",
  "Compras internet",
  "Contribucion Congregacion",
  "Cuidado personal (Ej. Belleza)",
  "Dexter Necesidades",
  "Dinero mami",
  "Dinero prestado",
  "Educacion (Universidad/ Colegio)",
  "Electricidad",
  "Electricidad San Pedro",
  "Entretenimiento",
  "Gas San Pedro",
  "Gas Santo Domingo",
  "Gastos medicos",
  "Gimnasio/Deporte",
  "Imprevistos",
  "Internet San Pedro",
  "Internet Santo Domingo",
  "Mant. de vehiculo",
  "Paquetes envio",
  "Parqueos",
  "Peajes",
  "Prime",
  "Retiro efectivo",
  "Servicio telecomunicacion movil",
  "Supermercado San Pedro",
  "Supermercado Sto",
  "Suscripciones",
  "Uber",
  "Uber Eats/Pedidos Ya",
  "Viaje colombia",
  "Viaje personal",
  "Vivienda (alquiler San Pedro)",
  "Vivienda (alquiler Santo Domingo)",
];

export const DEFAULT_INGRESO_CATEGORIES = [
  "Sueldo",
  "Horas / Trabajos extras",
  "Remesas",
  "Bonos",
  "Doble sueldo Navidad",
  "Alquileres",
  "Inversiones",
  "Aportes",
  "Comisiones",
  "Pago prestamos",
  "Regalo recibido",
];

export const DEFAULT_CATEGORIES: ManagedCategories = {
  Ingreso: DEFAULT_INGRESO_CATEGORIES,
  Gasto: DEFAULT_GASTO_CATEGORIES,
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b)
  );
}

export function loadManagedCategories(): ManagedCategories {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;

  try {
    const raw = window.localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!raw) return DEFAULT_CATEGORIES;

    const parsed = JSON.parse(raw) as Partial<ManagedCategories>;
    return {
      Ingreso: uniqueSorted([
        ...DEFAULT_INGRESO_CATEGORIES,
        ...(parsed.Ingreso ?? []),
      ]),
      Gasto: uniqueSorted([...DEFAULT_GASTO_CATEGORIES, ...(parsed.Gasto ?? [])]),
    };
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export function saveManagedCategories(categories: ManagedCategories) {
  window.localStorage.setItem(
    CATEGORIES_STORAGE_KEY,
    JSON.stringify({
      Ingreso: uniqueSorted(categories.Ingreso),
      Gasto: uniqueSorted(categories.Gasto),
    })
  );
  window.dispatchEvent(new Event(CATEGORIES_UPDATED_EVENT));
}

export async function fetchManagedCategories(): Promise<ManagedCategories> {
  const res = await fetch("/api/categories", { cache: "no-store" });
  const json = await res.json();

  if (!json.ok) {
    throw new Error(json.error ?? "No se pudieron cargar las categorias");
  }

  const categories = json.data as ManagedCategories;
  saveManagedCategories(categories);
  return categories;
}

export async function addManagedCategory(
  type: CategoryType,
  name: string
): Promise<ManagedCategories> {
  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, name }),
  });
  const json = await res.json();

  if (!json.ok) {
    throw new Error(json.error ?? "No se pudo agregar la categoria");
  }

  return fetchManagedCategories();
}

export async function deleteManagedCategory(
  type: CategoryType,
  name: string
): Promise<ManagedCategories> {
  const res = await fetch("/api/categories", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, name }),
  });
  const json = await res.json();

  if (!json.ok) {
    throw new Error(json.error ?? "No se pudo eliminar la categoria");
  }

  return fetchManagedCategories();
}

export async function renameManagedCategory(
  type: CategoryType,
  oldName: string,
  newName: string
): Promise<ManagedCategories> {
  const res = await fetch("/api/categories", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, oldName, newName }),
  });
  const json = await res.json();

  if (!json.ok) {
    throw new Error(json.error ?? "No se pudo renombrar la categoria");
  }

  return fetchManagedCategories();
}
