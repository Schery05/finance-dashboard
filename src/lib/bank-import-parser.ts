import type { TransactionInput } from "@/lib/validators";

export type ParsedBankTransaction = TransactionInput & {
  sourceBank: string;
  sourceReference: string;
  sourceRawDescription: string;
};

const HEADER_ALIASES = {
  date: ["fecha posteo", "fecha", "date"],
  shortDescription: ["descripción corta", "descripcion corta", "tipo", "movimiento"],
  amount: ["monto transacción", "monto transaccion", "monto", "importe"],
  reference: ["no. referencia", "no referencia", "referencia"],
  description: ["descripción", "descripcion", "detalle", "concepto"],
};

export function normalizeBankImportText(value: string) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalize(value: string) {
  return normalizeBankImportText(value);
}

function parseCSVLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function findColumn(headers: string[], aliases: string[]) {
  const normalizedHeaders = headers.map(normalize);
  return normalizedHeaders.findIndex((header) =>
    aliases.some((alias) => header === normalize(alias))
  );
}

function inferGeneratedDate(text: string) {
  const match = text.match(/Generado el\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!match) return new Date();
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

function parseBankAmount(value: string) {
  const raw = String(value ?? "").trim();
  const negative = raw.includes("-") || /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return 0;

  const digits = cleaned.replace(/\./g, "");
  let amount = 0;

  if (cleaned.includes(".")) {
    const decimalsAfterDot = cleaned.split(".").at(-1)?.length ?? 0;
    amount = decimalsAfterDot > 3 ? Number(digits) / 100 : Number(digits);
  } else {
    amount = digits.length >= 5 ? Number(digits) / 100 : Number(digits);
  }

  return negative ? -amount : amount;
}

function parseBankDate(value: string, generatedDate: Date) {
  const [monthRaw, dayRaw] = String(value ?? "").trim().split(/[/-]/);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!month || !day) return "";

  const generatedYear = generatedDate.getFullYear();
  const year =
    month > generatedDate.getMonth() + 1 ? generatedYear - 1 : generatedYear;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function inferBankTransactionCategory(
  description: string,
  shortDescription: string,
  amount: number
) {
  const text = normalize(`${description} ${shortDescription}`);

  if (/rebate|reembolso|reverso|devolucion/.test(text)) {
    return { type: "Ingreso" as const, category: "Reembolsos" };
  }

  if (/cashback\s*gnial|bono\s*buen\s*comportamiento/.test(text)) {
    return { type: "Ingreso" as const, category: "Bonos" };
  }

  if (/pago via app|pago/.test(text)) {
    return { type: "Gasto" as const, category: "Pago tarjeta" };
  }

  if (/uber\s*eats|ubereats|pedidos\s*ya|pedidosya/.test(text)) {
    return { type: "Gasto" as const, category: "Uber Eats / Pedidos Ya" };
  }

  if (/total/.test(text) && amount > 500) {
    return { type: "Gasto" as const, category: "Combustible" };
  }

  if (/bonjour/.test(text)) {
    return { type: "Gasto" as const, category: "Entretenimiento" };
  }

  if (/netflix/.test(text)) {
    return { type: "Gasto" as const, category: "Suscripciones" };
  }

  if (/ikea/.test(text)) {
    return { type: "Gasto" as const, category: "Articulos del hogar" };
  }

  if (/uber|eats|pizza|bonjour|restaurant|food|comida/.test(text)) {
    return { type: "Gasto" as const, category: "Comida" };
  }

  if (/amazon|patreon|chatgpt|internet|mktpl|online/.test(text)) {
    return { type: "Gasto" as const, category: "Compras internet" };
  }

  if (/pricesmart|sirena/.test(text)) {
    return { type: "Gasto" as const, category: "Supermercado Sto" };
  }

  if (/market|minimarket/.test(text)) {
    return { type: "Gasto" as const, category: "Compras" };
  }

  if (/cargo|sobregiro|emision|proteccion|interes|comision/.test(text)) {
    return { type: "Gasto" as const, category: "Cargos bancarios" };
  }

  return { type: "Gasto" as const, category: "Pendiente de categorizar" };
}

function shouldIgnoreCategory(category: string) {
  return normalize(category) === "pago tarjeta";
}

export function parseBankTransactionsCSV(
  text: string,
  sourceBank = "Banco Popular Dominicano"
): ParsedBankTransaction[] {
  const generatedDate = inferGeneratedDate(text);
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
  const rows: ParsedBankTransaction[] = [];

  let headers: string[] | null = null;
  let indexes: Record<keyof typeof HEADER_ALIASES, number> | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = parseCSVLine(line);
    const possibleDateIndex = findColumn(cells, HEADER_ALIASES.date);
    const possibleAmountIndex = findColumn(cells, HEADER_ALIASES.amount);

    if (possibleDateIndex >= 0 && possibleAmountIndex >= 0) {
      headers = cells;
      indexes = {
        date: findColumn(headers, HEADER_ALIASES.date),
        shortDescription: findColumn(headers, HEADER_ALIASES.shortDescription),
        amount: findColumn(headers, HEADER_ALIASES.amount),
        reference: findColumn(headers, HEADER_ALIASES.reference),
        description: findColumn(headers, HEADER_ALIASES.description),
      };
      continue;
    }

    if (!headers || !indexes) continue;
    if (cells.length < headers.length - 1) continue;

    const date = parseBankDate(cells[indexes.date] ?? "", generatedDate);
    const amount = parseBankAmount(cells[indexes.amount] ?? "");
    const description = (cells[indexes.description] ?? "").trim();
    const shortDescription = (cells[indexes.shortDescription] ?? "").trim();
    const reference = (cells[indexes.reference] ?? "").trim();

    if (!date || amount <= 0 || !description) continue;

    const inferred = inferBankTransactionCategory(description, shortDescription, amount);
    if (shouldIgnoreCategory(inferred.category)) continue;

    rows.push({
      Fecha: date,
      Tipo: inferred.type,
      Categoría: inferred.category,
      Importe: amount,
      EstadoPago: "Pagado",
      DescripcionAdicional: reference
        ? `${description.trim()} | Ref ${reference}`
        : description.trim(),
      EsPagoDeuda: false,
      sourceBank,
      sourceReference: reference,
      sourceRawDescription: description,
    });
  }

  return rows;
}
