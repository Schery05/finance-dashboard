export const DEFAULT_DOMINICAN_BANKS = [
  "Banco de Reservas",
  "Banco Popular Dominicano",
  "Banco BHD",
  "Banco Santa Cruz",
  "Scotiabank",
  "Banco Promerica",
  "Banesco",
  "Banco Caribe",
  "Banco Ademi",
  "Banco Vimenca",
  "Banco Lopez de Haro",
  "Banco BDI",
  "Banco Lafise",
  "Banco Activo Dominicana",
  "Bancamerica",
  "BellBank",
  "Citibank",
  "Banco Agricola",
  "Asociacion Popular de Ahorros y Prestamos",
  "Asociacion Cibao de Ahorros y Prestamos",
  "Asociacion La Nacional de Ahorros y Prestamos",
  "Asociacion Duarte de Ahorros y Prestamos",
  "Asociacion Mocana de Ahorros y Prestamos",
  "Asociacion Romana de Ahorros y Prestamos",
  "Asociacion Peravia de Ahorros y Prestamos",
  "Asociacion Bonao de Ahorros y Prestamos",
  "Motor Credito",
  "Banco Fihogar",
  "Banco Union",
  "Banco Confisa",
  "Banco Empire",
  "Banco JMMB Bank",
  "Otro / No listado",
];

export type ManagedBank = {
  id: string;
  name: string;
};

async function requestBanks(
  url: string,
  init?: RequestInit
): Promise<ManagedBank[]> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error ?? "No se pudo actualizar el listado de bancos");
  }
  return json.data as ManagedBank[];
}

export function loadDefaultBanks(): ManagedBank[] {
  return DEFAULT_DOMINICAN_BANKS.map((name) => ({ id: name, name }));
}

export async function fetchManagedBanks(): Promise<ManagedBank[]> {
  return requestBanks("/api/banks");
}

export async function addManagedBank(name: string): Promise<ManagedBank[]> {
  return requestBanks("/api/banks", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteManagedBank(id: string): Promise<ManagedBank[]> {
  return requestBanks("/api/banks", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}
