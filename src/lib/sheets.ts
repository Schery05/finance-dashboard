import { google } from "googleapis";
import type { Transaction } from "./types";
import { TransactionInput } from "./validators";

const SHEET_ID = process.env.GOOGLE_SHEETS_ID!;
const RANGE = process.env.GOOGLE_SHEETS_RANGE || "Transacciones!A:G";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  //const key = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const raw = process.env.GOOGLE_PRIVATE_KEY;
  if (!raw) throw new Error("Missing GOOGLE_PRIVATE_KEY in env");

  const key = raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .trim();

  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function parseAmount(v: unknown): number {
  let s = String(v ?? "").trim();

  if (!s) return 0;

  // Quita símbolos y letras comunes
  s = s.replace(/rd\$|dop|usd|\$/gi, "").trim();

  // Quita espacios internos
  s = s.replace(/\s+/g, "");

  // Si viene formato "1.234,56" (punto miles, coma decimal) => 1234.56
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Asumimos que el último separador es el decimal
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // 1.234,56
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // Puede ser "1234,56" (coma decimal) o "1,234" (miles)
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      s = s.replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else {
    // solo punto o nada: "1234.56" o "1.234"
    // si parece miles (1.234) y no hay decimales claros, lo dejamos como miles quitando puntos
    const parts = s.split(".");
    if (parts.length === 2 && parts[1].length === 3) {
      s = s.replace(/\./g, "");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export async function readTransactions(): Promise<TransactionInput[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGE,
  });

  const rows = res.data.values ?? [];
  // Si tu sheet tiene headers en la primera fila, descomenta esto:
  // const dataRows = rows.slice(1);
  const dataRows = rows;

  return dataRows
    .filter((r) => r.length >= 6) // necesitamos al menos ID..EstadoPago
    .map((r) => ({
      ID: String(r[0] ?? "").trim(),
      Fecha: String(r[1] ?? ""),
      Tipo: String(r[2] ?? "").trim() as any,  // "Ingreso" | "Gasto"
      Categoría: String(r[3] ?? "").trim() || "General",
      Importe: parseAmount(r[4]),
      EstadoPago: (r[5] ?? "Pendiente") as any, // "Pagado" | "Pendiente"
      DescripcionAdicional: String(r[6] ?? ""),
    }))
    .filter((t) => t.ID); // evita filas s
}

export async function appendTransaction(tx: Transaction): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        tx.ID,
        tx.Fecha,
        tx.Tipo,
        tx.Categoría,
        tx.Importe,
        tx.EstadoPago,
        tx.DescripcionAdicional ?? "",
      ]],
    },
  });
}

//ACTUALIZACION DE TRANSACCIONES SEGUN SU ID
export async function updateTransactionById(id: string, tx: Omit<Transaction, "ID">) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const sheetName = RANGE.split("!")[0].replace(/"/g, ""); // "Hoja 1"
  // Leemos todas las filas para encontrar el ID (simple y efectivo)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:A`,
  });

  const colA = res.data.values ?? []; // cada item es ["ID"]
  const rowIndex = colA.findIndex((r) => String(r?.[0] ?? "").trim() === id);

  if (rowIndex === -1) throw new Error(`No se encontró la transacción con ID=${id}`);

  // rowIndex es 0-based sobre la columna A (incluye headers en fila 1 si pediste A:A)
  // Si tienes headers en fila 1, entonces rowNumber real = rowIndex + 1
  const rowNumber = rowIndex + 1;

  const updateRange = `${sheetName}!A${rowNumber}:G${rowNumber}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: updateRange,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        id,
        tx.Fecha,
        tx.Tipo,
        tx.Categoría,
        tx.Importe,
        tx.EstadoPago,
        tx.DescripcionAdicional ?? "",
      ]],
    },
  });
}